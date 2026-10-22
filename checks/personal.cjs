// Run: node checks/personal.cjs. No network or real database connections.
const assert = require('node:assert/strict');
const path = require('node:path');
const repo = path.resolve(__dirname, '..');

const repositoryPath = require.resolve(path.join(repo, 'src/modules/personal/personal.repository.js'));
let filas = [];
require.cache[repositoryPath] = {
  id: repositoryPath, filename: repositoryPath, loaded: true,
  exports: { listarPersonalOperativo: async () => filas }
};
const { listarPersonal } = require(path.join(repo, 'src/modules/personal/personal.service.js'));
const { tienePermiso, PERMISOS } = require(path.join(repo, 'src/shared/constants/permisos.js'));

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

  assert(tienePermiso(['DIRECTOR'], PERMISOS.ADMINISTRAR_ACCESOS), 'El director ve Administración de accesos.');
  assert(tienePermiso(['DIRECTOR', 'PROFESOR'], PERMISOS.ADMINISTRAR_ACCESOS), 'Director + Profesor conserva el acceso.');
  for (const rol of ['TESORERO', 'PROFESOR', 'ALUMNO']) {
    assert(!tienePermiso([rol], PERMISOS.ADMINISTRAR_ACCESOS), `${rol} no debe acceder por defecto.`);
  }
  console.log('personal: OK');
})().catch(error => { console.error(error); process.exit(1); });
