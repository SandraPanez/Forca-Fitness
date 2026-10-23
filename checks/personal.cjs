// Run: node checks/personal.cjs. No network or real database connections.
const assert = require('node:assert/strict');
const path = require('node:path');
const repo = path.resolve(__dirname, '..');

const repositoryPath = require.resolve(path.join(repo, 'src/modules/personal/personal.repository.js'));
let filas = [], detalle = null, sobrescrituras = [], accesosGuardados = null;
let permisoSobrescrito = null;
require.cache[repositoryPath] = {
  id: repositoryPath, filename: repositoryPath, loaded: true,
  exports: {
    listarPersonalOperativo: async () => filas,
    obtenerDetallePersonal: async () => detalle,
    guardarAccesos: async (...accesos) => { accesosGuardados = accesos; }
  }
};
const permisosRepositoryPath = require.resolve(path.join(repo, 'src/shared/repositories/permisos.repository.js'));
require.cache[permisosRepositoryPath] = {
  id: permisosRepositoryPath, filename: permisosRepositoryPath, loaded: true,
  exports: {
    listarSobrescrituras: async () => sobrescrituras,
    obtenerSobrescritura: async () => permisoSobrescrito
  }
};
const { listarPersonal, obtenerDetalle } = require(path.join(repo, 'src/modules/personal/personal.service.js'));
const personalService = require(path.join(repo, 'src/modules/personal/personal.service.js'));
const { tienePermiso, PERMISOS } = require(path.join(repo, 'src/shared/constants/permisos.js'));
const { autorizar } = require(path.join(repo, 'src/shared/middleware/permisos.middleware.js'));

(async () => {
  filas = [
    { id: 'U3', nombre: 'Cristian Benites Góngora', roles: ['PROFESOR'] },
    { id: 'U4', nombre: 'Ángel Zapata Ruiz', roles: ['PROFESOR'] },
    { id: 'U2', nombre: 'Paul Rafael Yepez', roles: ['TESORERO'] },
    { id: 'U5', nombre: 'alberto Zegarra Lima', roles: ['PROFESOR'] },
    { id: 'U6', nombre: 'Zoila Vega Soto', roles: ['PROFESOR', 'TESORERO'] },
    { id: 'U7', nombre: '', roles: ['PROFESOR'] }
  ];
  const lista = await listarPersonal();
  assert.deepEqual(lista.map(p => p.id), ['U2', 'U6', 'U5', 'U4', 'U3', 'U7'],
    'Tesoreros primero y profesores alfabéticos sin importar tildes ni mayúsculas.');
  assert.equal(lista.at(-1).nombre, 'Sin nombre registrado', 'Una cuenta sin persona no debe romper la lista.');

  detalle = {
    id: 'U6',
    nombre: 'Zoila Vega Soto',
    roles: ['PROFESOR', 'TESORERO'],
    disciplinas: ['MMA']
  };
  const detalleMixto = await obtenerDetalle('U6');
  assert.deepEqual(detalleMixto.disciplinas, ['MMA'], 'El profesor muestra sus disciplinas.');
  assert(detalleMixto.permisos.includes(PERMISOS.GESTIONAR_PAGOS),
    'Los permisos efectivos del tesorero se derivan de la configuración de roles.');
  assert(detalleMixto.permisos.includes(PERMISOS.VER_ALUMNOS_DISCIPLINAS),
    'Los permisos efectivos del profesor se derivan de la configuración de roles.');
  assert.deepEqual(detalleMixto.permisosDisponibles, Object.values(PERMISOS),
    'La vista recibe la lista de permisos configurados, sin inventar permisos.');
  detalle = { id: 'U2', nombre: 'Paul Rafael Yepez', roles: ['TESORERO'], disciplinas: ['MMA'] };
  const detalleTesorero = await obtenerDetalle('U2');
  assert.deepEqual(detalleTesorero.disciplinas, [], 'El tesorero no muestra disciplinas.');
  assert(!detalleTesorero.permisos.includes(PERMISOS.VER_ALUMNOS_DISCIPLINAS),
    'Un tesorero no recibe permisos configurados solo para profesor.');
  sobrescrituras = [{ permiso: PERMISOS.GESTIONAR_PAGOS, habilitado: false }];
  const permisoRevocado = await obtenerDetalle('U2');
  assert(!permisoRevocado.permisos.includes(PERMISOS.GESTIONAR_PAGOS),
    'Una sobrescritura OFF prevalece sobre el permiso de rol.');
  sobrescrituras = [{ permiso: PERMISOS.ADMINISTRAR_ACCESOS, habilitado: true }];
  const permisoConcedido = await obtenerDetalle('U2');
  assert(permisoConcedido.permisos.includes(PERMISOS.ADMINISTRAR_ACCESOS),
    'Una sobrescritura ON agrega el permiso efectivo.');
  sobrescrituras = [];
  detalle = null;
  assert.equal(await obtenerDetalle('NOEXISTE'), null, 'Una cuenta fuera del personal operativo no se detalla.');

  await assert.rejects(
    personalService.actualizarAccesos('U2', { roles: [], permisos: [] }),
    { status: 400 },
    'No se permite guardar una cuenta sin roles.'
  );
  await assert.rejects(
    personalService.actualizarAccesos('U2', {
      roles: ['DIRECTOR'],
      permisos: []
    }),
    { status: 400 },
    'Solo se permiten los roles operativos seleccionables.'
  );
  await assert.rejects(
    personalService.actualizarAccesos('U2', {
      roles: ['TESORERO'],
      permisos: ['PERMISO_INEXISTENTE']
    }),
    { status: 400 },
    'No se guardan permisos que no están en el catálogo.'
  );
  await personalService.actualizarAccesos('U2', {
    roles: ['PROFESOR', 'TESORERO'],
    permisos: [PERMISOS.VER_ALUMNOS_DISCIPLINAS]
  });
  assert.deepEqual(accesosGuardados, [
    'U2',
    ['PROFESOR', 'TESORERO'],
    [PERMISOS.VER_ALUMNOS_DISCIPLINAS]
  ], 'Los roles y permisos válidos se envían al repositorio para guardar.');

  assert.equal(PERMISOS.ADMINISTRAR_ACCESOS, 'ADMINISTRAR_ACCESOS', 'El permiso debe estar declarado con su nombre.');
  assert(!tienePermiso(['DIRECTOR'], undefined), 'Un permiso inexistente no debe autorizar al director.');
  assert(tienePermiso(['DIRECTOR'], PERMISOS.ADMINISTRAR_ACCESOS), 'El director ve Administración de accesos.');
  assert(tienePermiso(['DIRECTOR', 'PROFESOR'], PERMISOS.ADMINISTRAR_ACCESOS), 'Director + Profesor conserva el acceso.');
  for (const rol of ['TESORERO', 'PROFESOR', 'ALUMNO']) {
    assert(!tienePermiso([rol], PERMISOS.ADMINISTRAR_ACCESOS), `${rol} no debe acceder por defecto.`);
  }

  async function verificarAutorizacion(roles, permiso) {
    const resultado = { status: null, body: null, autorizado: false };
    const response = {
      status(status) {
        resultado.status = status;
        return this;
      },
      json(body) {
        resultado.body = body;
        return this;
      }
    };
    await autorizar(permiso)(
      { user: { id: 'U_TEST', roles } },
      response,
      () => { resultado.autorizado = true; }
    );
    return resultado;
  }

  permisoSobrescrito = false;
  const permisoDenegado = await verificarAutorizacion(['TESORERO'], PERMISOS.GESTIONAR_PAGOS);
  assert.equal(permisoDenegado.status, 403, 'OFF debe prevalecer sobre el permiso derivado del rol.');
  assert.equal(permisoDenegado.autorizado, false);
  permisoSobrescrito = true;
  const permisoConcedidoPorOverride = await verificarAutorizacion(['PROFESOR'], PERMISOS.GESTIONAR_PAGOS);
  assert.equal(permisoConcedidoPorOverride.autorizado, true, 'ON puede conceder el permiso según override.');
  permisoSobrescrito = null;
  const permisoPorRol = await verificarAutorizacion(['TESORERO'], PERMISOS.GESTIONAR_PAGOS);
  assert.equal(permisoPorRol.autorizado, true, 'Sin override se mantiene la regla del rol.');

  console.log('personal: OK');
})().catch(error => { console.error(error); process.exit(1); });
