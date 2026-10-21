// Run: node checks/perfil.cjs. No network or real database connections.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const repo = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const filename = path.join(repo, file);
  const actual = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, console: { ...console, error() {} }, process, Date,
    require: id => Object.hasOwn(mocks, id) ? mocks[id] : actual(id)
  }, { filename });
  return module.exports;
}

let calls = [], missing = false, failContact = false, insertContact = false;
const profile = { id: 'ALU01', nombre: 'Ana Maria', apellido_paterno: 'Prueba', apellido_materno: 'Demo',
  fecha_nacimiento: '2021-04-03', genero: 'F', direccion: 'Direccion de prueba',
  numero_documento: '12345678', correo_electronico: 'contacto@example.com', numero_celular: '987654321' };
const client = {
  async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('SELECT a."Id_Persona"')) {
      assert.deepEqual(Array.from(params), ['USU01'], 'PUT must use the authenticated user, ignoring body IDs.');
      return { rows: missing ? [] : [{ Id_Persona: 'PER01' }] };
    }
    if (sql.includes('UPDATE') && sql.includes('"Persona"')) {
      assert.deepEqual(Array.from(params).slice(0, 2), ['Ana', 'Maria'], 'Preserve both first names.');
      assert.equal(params.at(-1), 'PER01');
    }
    if (sql.includes('UPDATE') && sql.includes('"Metodo_Contacto"')) {
      assert.match(sql, /UPPER\("Tipo_Contacto"\)/, 'Existing mixed-case contacts must be found.');
      assert.match(sql, /"Tipo_Contacto" = \$2/, 'Write the canonical type for receipts.');
      assert(['CORREO', 'CELULAR'].includes(params[1]));
      assert.equal(params[2], 'PER01');
      if (failContact) throw new Error('Fallo simulado al guardar contacto');
      return { rows: insertContact ? [] : [{ Id_contacto: 'CON01' }] };
    }
    if (sql.includes('AS siguiente')) return { rows: [{ siguiente: 3 }] };
    return { rows: [] };
  },
  release() { calls.push({ sql: 'RELEASE' }); }
};
const db = { pool: {
  async connect() { return client; },
  async query(sql, params) {
    calls.push({ sql, params });
    assert.match(sql, /WHERE u\."Id_Usuario" = \$1/);
    assert.match(sql, /"Segundo_Nombre"/);
    assert.match(sql, /UPPER\(mc\."Tipo_Contacto"\)/);
    assert.equal(params[0], 'USU01');
    return { rows: missing ? [] : [profile] };
  }
} };
const matriculas = load('src/modules/matriculas/matriculas.repository.js', { '../../shared/config/database': db });
const repository = load('src/modules/perfil/perfil.repository.js', {
  '../../shared/config/database': db, '../matriculas/matriculas.repository': matriculas
});
const service = load('src/modules/perfil/perfil.service.js', { './perfil.repository': repository });
const controller = load('src/modules/perfil/perfil.controller.js', { './perfil.service': service });
const auth = load('src/shared/middleware/auth.middleware.js', {
  jsonwebtoken: { verify: token => ({ sub: 'USU01', roles: [token] }) }
});
const routes = {};
load('src/modules/perfil/perfil.routes.js', {
  express: { Router: () => ({ get: (_, ...handlers) => { routes.GET = handlers; }, put: (_, ...handlers) => { routes.PUT = handlers; } }) },
  './perfil.controller': controller, '../../shared/middleware/auth.middleware': auth
});
async function request(method, role, body = {}) {
  const req = { headers: role ? { authorization: `Bearer ${role}` } : {}, body };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  let i = 0;
  await (function next() { return routes[method][i++](req, res, next); })();
  return res;
}

(async () => {
  assert.equal((await request('GET')).statusCode, 401);
  assert.equal((await request('PUT', 'TESORERO', profile)).statusCode, 403);
  assert.equal(calls.length, 0, 'Unauthorized requests must not query the database.');
  assert.equal((await request('GET', 'ALUMNO')).body.data.id, 'ALU01');
  calls = [];
  const saved = await request('PUT', 'ALUMNO', { ...profile, id: 'ALU_AJENO', id_usuario: 'USU_AJENO' });
  assert.equal(saved.statusCode, 200);
  assert(calls.some(call => call.sql === 'COMMIT'));
  assert.equal(calls.at(-1).sql, 'RELEASE');
  calls = [];
  assert.equal((await request('PUT', 'ALUMNO', { ...profile, fecha_nacimiento: '2999-01-01' })).statusCode, 400);
  assert.equal(calls.length, 0, 'Reject a future birthdate before opening a transaction.');
  assert.equal((await request('PUT', 'ALUMNO', { ...profile, correo_electronico: 'correo-invalido' })).statusCode, 400);
  insertContact = true;
  assert.equal((await request('PUT', 'ALUMNO', profile)).statusCode, 200);
  const inserts = calls.filter(call => call.sql.includes('INSERT INTO'));
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0].params[0], 'CON03', 'Reuse the registration ID generator.');
  assert.equal(inserts[0].params[1], 'CORREO');
  assert.equal(inserts[1].params[1], 'CELULAR');
  calls = [];
  failContact = true;
  assert.equal((await request('PUT', 'ALUMNO', profile)).statusCode, 400);
  assert(calls.some(call => call.sql === 'ROLLBACK'));
  assert(!calls.some(call => call.sql === 'COMMIT'));
  assert.equal(calls.at(-1).sql, 'RELEASE');
  failContact = false;
  missing = true;
  assert.equal((await request('GET', 'ALUMNO')).statusCode, 404);
  const index = fs.readFileSync(path.join(repo, 'index.js'), 'utf8');
  assert.match(index, /app\.use\('\/api\/perfil', perfilRoutes\)/, 'Mount the new route.');
  const modules = load('src/modules/index.js', Object.fromEntries([
    './alumnos/alumnos.routes', './matriculas/matriculas.routes', './auth/auth.routes',
    './pagos/pagos.routes', './comprobantes/comprobantes.routes', './profesores/profesores.routes', './perfil/perfil.routes'
  ].map(id => [id, id])));
  assert.equal(modules.perfilRoutes, './perfil/perfil.routes');
  for (const file of ['public/perfil.html', 'public/editar-perfil.html']) {
    const html = fs.readFileSync(path.join(repo, file), 'utf8');
    assert.match(html, /id="app-header"/);
    assert.match(html, /\/css\/header\.css/);
    assert(!html.includes('2012-12-31'));
  }
  console.log('OK HU-02: roles, own profile, child birthdate, contacts, rollback and route/header integration.');
})().catch(error => { console.error(error); process.exitCode = 1; });
