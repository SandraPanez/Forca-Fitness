// Run: node checks/control-acceso.cjs. Executes the page with fake data; no .env or database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const permisosRepositoryPath = require.resolve('../src/shared/repositories/permisos.repository');
require.cache[permisosRepositoryPath] = {
  id: permisosRepositoryPath,
  filename: permisosRepositoryPath,
  loaded: true,
  exports: { obtenerSobrescritura: async () => null }
};
const { autorizar } = require('../src/shared/middleware/permisos.middleware');
const { PERMISOS } = require('../src/shared/constants/permisos');
const html = fs.readFileSync(path.join(__dirname, '../public/control_acceso.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const catalog = ['MMA', 'Boxeo', 'Jiu Jitsu', 'Capoeira', 'Jiu Jitsu Kids'];
const teacherDisciplines = ['MMA', 'Boxeo', 'Jiu Jitsu'];
const allStudents = ['MMA', 'Boxeo', 'Capoeira'].map((name, index) => ({
  id: `A${index + 1}`, nombres: `Alumno ${index + 1}`, apellido_paterno: 'Prueba',
  dias_restantes: 20, disciplinas: [name]
}));

class Element {
  constructor() {
    this.children = []; this.listeners = {}; this.dataset = {}; this.value = '';
    this.textContent = ''; this.hidden = false;
    this.classList = { add() {}, remove() {} };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) {
    this.children = []; this.append(...children);
    if (this.isSelect) this.value = children[0]?.value || '';
  }
  setAttribute() {}
  addEventListener(event, callback) { this.listeners[event] = callback; }
  focus() {}
}

async function check(roles, options = {}) {
  const elements = new Map(), requests = [];
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  element('#discipline').isSelect = true;
  element('#status').value = 'all';
  element('#control-acceso .eyebrow').textContent = 'PROFESOR';
  element('.app-usuario-nombre').textContent = 'Director de prueba';
  const serverRoles = options.serverRoles || roles;
  const available = options.disciplines || catalog;
  const assigned = options.assigned || teacherDisciplines;
  const records = options.students || allStudents;
  const scoped = records.filter(student => student.disciplinas.some(name => assigned.includes(name)));
  const context = vm.createContext({
    console: { error() {} }, URLSearchParams,
    obtenerRolesUsuario: () => roles,
    Option: function(text, value) { const option = new Element(); option.textContent = text; option.value = value; return option; },
    window: { location: { hash: '' } },
    document: {
      querySelector: element, querySelectorAll: () => [],
      createElement: () => new Element(), addEventListener() {}
    },
    authFetch: async url => {
      requests.push(url);
      let status = 200, data;
      if (url === '/api/matriculas/disciplinas') {
        data = available.map(nombre => ({ nombre }));
      } else {
        const general = url.startsWith('/api/alumnos');
        let allowed = false;
        const res = { status(code) { status = code; return this; }, json() {} };
        await autorizar(general ? PERMISOS.VER_TODOS_ALUMNOS : PERMISOS.VER_ALUMNOS_DISCIPLINAS)(
          { user: { roles: serverRoles } }, res, () => { allowed = true; }
        );
        if (allowed) {
          if (url === '/api/profesores/me') data = { nombre: 'Profesor de prueba', disciplinas: assigned };
          else if (url === '/api/alumnos' || url === '/api/profesores/me/alumnos') data = general ? records : scoped;
          else {
            const student = (general ? records : scoped).find(item => item.id === url.split('/').at(-1));
            status = student ? 200 : 404;
            data = student ? { dni: 'Documento de prueba', disciplinas: student.disciplinas.join(', ') } : null;
          }
        }
      }
      return { status, ok: status === 200, json: async () => ({ success: status === 200, data }) };
    }
  });
  vm.runInContext(script, context, { filename: 'control_acceso.html' });
  await new Promise(setImmediate);
  return { context, element, requests };
}

(async () => {
  for (const roles of [['DIRECTOR'], ['DIRECTOR', 'PROFESOR']]) {
    const page = await check(roles);
    assert.deepEqual(page.requests, ['/api/matriculas/disciplinas', '/api/alumnos']);
    assert.equal(page.element('#control-acceso .eyebrow').textContent, 'DIRECTOR');
    assert.equal(page.element('.app-usuario-nombre').textContent, 'Director de prueba');
    assert.equal(page.element('#discipline').children.length, catalog.length,
      'El director ve el catálogo completo, incluso disciplinas sin alumnos.');
    page.element('#discipline').value = 'Capoeira';
    page.element('#discipline').listeners.change();
    assert.equal(page.element('#rows').children.length, 1);
    assert.equal(page.element('#rows').children[0].children[0].children[0].children[0].textContent, 'Alumno 3 Prueba');
    page.element('#search').value = 'No existe';
    page.element('#search').listeners.input();
    assert.equal(page.element('#empty').hidden, false);
    await vm.runInContext("openStudentDrawer('A3', null)", page.context);
    assert.equal(page.requests.at(-1), '/api/alumnos/A3');
    assert.equal(page.element('#detail-dni').textContent, 'Documento de prueba');
  }

  const teacher = await check(['PROFESOR']);
  assert.deepEqual(teacher.requests, ['/api/profesores/me', '/api/profesores/me/alumnos']);
  assert.equal(teacher.element('#control-acceso .eyebrow').textContent, 'PROFESOR');
  assert.deepEqual(teacher.element('#discipline').children.map(option => option.value), ['Boxeo', 'Jiu Jitsu', 'MMA']);
  assert.deepEqual(Array.from(vm.runInContext('students.map(student => student.id)', teacher.context)), ['A1', 'A2']);
  await vm.runInContext("openStudentDrawer('A1', null)", teacher.context);
  assert.equal(teacher.requests.at(-1), '/api/profesores/me/alumnos/A1');

  for (const roles of [['TESORERO'], ['ALUMNO']]) {
    const denied = await check(roles);
    assert.match(denied.element('#rows').children[0].children[0].textContent, /Error 403/);
  }
  const forgedRole = await check(['DIRECTOR'], { serverRoles: ['PROFESOR'] });
  assert.match(forgedRole.element('#rows').children[0].children[0].textContent, /Error 403/,
    'Cambiar el rol del navegador no concede el permiso general del servidor.');
  const empty = await check(['DIRECTOR'], { disciplines: [], students: [] });
  assert.equal(empty.element('#discipline').children[0].textContent, 'No hay disciplinas registradas');
  assert.equal(empty.element('#empty').hidden, false);
  const unassigned = await check(['PROFESOR'], { assigned: [] });
  assert.equal(unassigned.element('#discipline').children[0].textContent, 'No tienes disciplinas asignadas');
  console.log('control de acceso: OK (director, profesor, ambos roles, filtros y permisos).');
})().catch(error => { console.error(error); process.exitCode = 1; });
