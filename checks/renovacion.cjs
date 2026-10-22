// node checks/renovacion.cjs <puerto PostgreSQL desechable> [--serve]
// Solo localhost, usuario de pruebas y un cluster llamado forca-renovacion-test-*.
// No carga .env ni se conecta a Render, SMTP o Mercado Pago.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const repo = process.env.FORCA_TEST_REPO || path.resolve(__dirname, '..');
const fromRepo = createRequire(path.join(repo, 'index.js'));
const { Pool } = fromRepo('pg');
const express = fromRepo('express');
const jwt = fromRepo('jsonwebtoken');
const port = Number(process.argv[2]);
assert(Number.isInteger(port) && port > 0, 'Indica el puerto de un PostgreSQL temporal de pruebas.');
const pool = new Pool({ host: '127.0.0.1', port, user: 'codex_renovacion', database: 'postgres', ssl: false });
const databasePath = fromRepo.resolve('./src/shared/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true,
  exports: { pool, query: (...args) => pool.query(...args) } };
process.env.JWT_SECRET = 'solo-para-esta-comprobacion-local';
process.env.MP_ACCESS_TOKEN = 'TEST-no-se-realizan-pagos-externos';
const matriculas = fromRepo('./src/modules/matriculas/matriculas.routes');
const pagos = fromRepo('./src/modules/pagos/pagos.repository');
const pagosController = fromRepo('./src/modules/pagos/pagos.controller');
const { autenticar } = fromRepo('./src/shared/middleware/auth.middleware');
const { autorizar } = fromRepo('./src/shared/middleware/permisos.middleware');
const { PERMISOS } = fromRepo('./src/shared/constants/permisos');
const alumnoToken = jwt.sign({ roles: ['ALUMNO'] }, process.env.JWT_SECRET, { subject: 'USU01', expiresIn: '1h' });
const tesoreroToken = jwt.sign({ roles: ['TESORERO'] }, process.env.JWT_SECRET, { subject: 'USU90', expiresIn: '1h' });
const S = '"Academia Forca&Fitness"';
let server;

async function datosDeEjemplo() {
  await pool.query(`
    DROP SCHEMA IF EXISTS ${S} CASCADE;
    CREATE SCHEMA ${S};
    CREATE TABLE ${S}."Persona" ("Id_Persona" VARCHAR(10) PRIMARY KEY, "Nombre" VARCHAR(40), "Segundo_Nombre" VARCHAR(40),
      "Apellido_Paterno" VARCHAR(20), "Apellido_Materno" VARCHAR(20), "Numero_Documento" VARCHAR(10),
      "Fecha_Nacimiento" DATE, "Genero" VARCHAR(6), "Direccion" VARCHAR(50));
    CREATE TABLE ${S}."Usuario" ("Id_Usuario" VARCHAR(10) PRIMARY KEY, "Correo" VARCHAR(100), "Estado_Usuario" VARCHAR(15), "Id_Persona" VARCHAR(10));
    CREATE TABLE ${S}."Alumno" ("Id_alumno" VARCHAR(10) PRIMARY KEY, "Id_Persona" VARCHAR(10));
    CREATE TABLE ${S}."Metodo_Contacto" ("Id_contacto" VARCHAR(10) PRIMARY KEY, "Tipo_Contacto" VARCHAR(20), "Contacto" VARCHAR(50), "Id_Persona" VARCHAR(10));
    CREATE TABLE ${S}."Disciplina" ("Id_Disciplinas" VARCHAR(10) PRIMARY KEY, "Nombre_Disciplina" VARCHAR(20), "Tarifa" NUMERIC, "Descripcion" TEXT, tarifa NUMERIC);
    CREATE TABLE ${S}."Horarios" ("Id_Horario" VARCHAR(10) PRIMARY KEY, "Dias" VARCHAR(50), "Hora_Inicio" TIME, "Hora_Fin" TIME, "Turno" VARCHAR(20));
    CREATE TABLE ${S}."Disciplina_Horario" ("Id_DiscHorario" VARCHAR(10) PRIMARY KEY, "Id_Disciplina" VARCHAR(10), "Id_Horario" VARCHAR(10), "Capacidad_Max" INT);
    CREATE TABLE ${S}."Matricula" ("Id_Matricula" VARCHAR(10) PRIMARY KEY, "Id_alumno" VARCHAR(10), "Fecha_Inscripcion" DATE DEFAULT CURRENT_DATE, "Estado_Matricula" VARCHAR(30));
    CREATE TABLE ${S}."Detalles_Matricula" ("Id_DetMatricula" VARCHAR(10) PRIMARY KEY, "Id_Matricula" VARCHAR(10), "Id_DiscHorario" VARCHAR(10), "Fecha_Inicio" DATE, "Fecha_Fin" DATE);
    CREATE TABLE ${S}."Metodo_Pago" ("Id_MPago" VARCHAR(10) PRIMARY KEY, "Nombre_Metodo" VARCHAR(20));
    CREATE TABLE ${S}."Pago" ("Id_Pago" VARCHAR(10) PRIMARY KEY, "Id_Matricula" VARCHAR(10), "Id_MPago" VARCHAR(10), "Monto" NUMERIC,
      "Estado_Pago" VARCHAR(15), "Id_Usuario_Registro" VARCHAR(10), "Fecha_Pago" TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE ${S}."Registro_Cobro" ("Id_Registro" VARCHAR(30) PRIMARY KEY, "Id_Pago" VARCHAR(10), "Monto" NUMERIC,
      "Medio_Pago" VARCHAR(20), "Resultado" VARCHAR(15), "Fecha_Hora" TIMESTAMP, "Referencia_Operacion" VARCHAR(100));
    INSERT INTO ${S}."Persona" VALUES ('PER01','Ana','María','Prueba','Demo','12345678','2021-04-03','F','Dirección de prueba'),
      ('PER02','Otro',NULL,'Alumno','Demo','12345679','2000-01-01','M','Otra dirección');
    INSERT INTO ${S}."Usuario" VALUES ('USU01','contacto@example.com','ACTIVO','PER01'), ('USU02','otro@example.com','ACTIVO','PER02');
    INSERT INTO ${S}."Alumno" VALUES ('ALU01','PER01'), ('ALU02','PER02');
    INSERT INTO ${S}."Metodo_Contacto" VALUES ('CON01','CORREO','contacto@example.com','PER01');
    INSERT INTO ${S}."Disciplina" VALUES ('DIS01','MMA',150,'MMA',150),('DIS02','Boxeo',120,'Boxeo',120),('DIS03','Jiu Jitsu',130,'Jiu Jitsu',130);
    INSERT INTO ${S}."Horarios" VALUES ('HOR01','Lunes y miércoles','18:00','19:00','Tarde');
    INSERT INTO ${S}."Disciplina_Horario" VALUES ('DH01','DIS01','HOR01',1),('DH02','DIS02','HOR01',2),('DH03','DIS03','HOR01',10);
    INSERT INTO ${S}."Matricula" VALUES ('MAT01','ALU01',CURRENT_DATE-28,'Activa'),('MAT02','ALU01',CURRENT_DATE-34,'Activa'),
      ('MAT03','ALU01',CURRENT_DATE-10,'Activa'),('MAT04','ALU02',CURRENT_DATE-25,'Activa');
    INSERT INTO ${S}."Detalles_Matricula" VALUES ('DET01','MAT01','DH01',CURRENT_DATE-28,CURRENT_DATE+2),
      ('DET02','MAT02','DH02',CURRENT_DATE-34,CURRENT_DATE-4),('DET03','MAT03','DH03',CURRENT_DATE-10,CURRENT_DATE+20),
      ('DET04','MAT04','DH02',CURRENT_DATE-25,CURRENT_DATE+5);
    INSERT INTO ${S}."Metodo_Pago" VALUES ('MP02','Efectivo');
  `);
  await pool.query(fs.readFileSync(path.join(repo, 'src/modules/comprobantes/comprobantes-envio.schema.sql'), 'utf8'));
}

async function main() {
  const directory = (await pool.query('SHOW data_directory')).rows[0].data_directory;
  assert.match(directory.replaceAll('\\', '/'), /\/forca-renovacion-test-[a-z0-9]+\/data\/?$/i, 'Se rechaza una base que no sea el cluster temporal de pruebas.');
  await datosDeEjemplo();
  const app = express();
  app.use(express.json());
  app.use('/api/matriculas', matriculas);
  app.post('/api/pagos/efectivo', pagosController.registrarEfectivo);
  app.post('/api/pagos/efectivo/confirmar', autenticar, autorizar(PERMISOS.GESTIONAR_PAGOS), pagosController.confirmarEfectivo);
  if (process.argv.includes('--serve')) {
    for (const page of ['mis-matriculas.html', 'pagos.html']) app.get(`/${page}`, (_, res) => {
      const session = `<script>localStorage.setItem('token',${JSON.stringify(alumnoToken)});localStorage.setItem('usuario',JSON.stringify({nombre:'Ana María Prueba Demo',roles:['ALUMNO']}));</script>`;
      res.send(fs.readFileSync(path.join(repo, 'public', page), 'utf8').replace('<script src="/js/auth.js">', session + '<script src="/js/auth.js">'));
    });
    app.use(express.static(path.join(repo, 'public')));
  }
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(url, method = 'GET', body, token = alumnoToken) {
    const response = await fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, ...(await response.json()) };
  }
  const renew = id => request(`/api/matriculas/mis-matriculas/${id}/renovar`, 'POST');
  const period = async id => (await pool.query(`SELECT "Fecha_Inicio"::TEXT AS inicio, "Fecha_Fin"::TEXT AS fin FROM ${S}."Detalles_Matricula" WHERE "Id_Matricula"=$1`, [id])).rows[0];
  const dates = (await pool.query('SELECT CURRENT_DATE::TEXT AS hoy, (CURRENT_DATE+3)::TEXT AS inicio, (CURRENT_DATE+32)::TEXT AS fin, (CURRENT_DATE+29)::TEXT AS fin_tardia')).rows[0];
  assert.equal((await request('/api/matriculas/mis-matriculas/DET01/renovar', 'POST', null, null)).status, 401);
  assert.equal((await request('/api/matriculas/mis-matriculas/DET01/renovar', 'POST', null, tesoreroToken)).status, 403);
  assert.equal((await renew('DET04')).status, 404, 'No renovar un alumno ajeno.');
  assert.equal((await renew('DET03')).status, 409, 'No renovar con veinte días pendientes.');
  await pool.query(`UPDATE ${S}."Disciplina_Horario" SET "Capacidad_Max"=1 WHERE "Id_DiscHorario"='DH02'`);
  assert.equal((await renew('DET02')).status, 409, 'Rechazar un horario sin cupos.');
  await pool.query(`UPDATE ${S}."Disciplina_Horario" SET "Capacidad_Max"=2 WHERE "Id_DiscHorario"='DH02'`);
  const first = await renew('DET01');
  assert.equal(first.status, 201, JSON.stringify(first));
  assert.equal(first.data.monto, '150');
  const renewal = first.data.matriculaId;
  const duplicates = await Promise.all([renew('DET01'), renew('DET01')]);
  assert(duplicates.every(result => result.status === 201 && result.data.reutilizada && result.data.matriculaId === renewal), 'Reusar el pendiente ante dos solicitudes.');
  assert.equal((await renew('DET02')).status, 409, 'No reutilizar una matrícula de otra disciplina.');
  let rows = (await request('/api/matriculas/mis-matriculas')).data;
  assert.equal(rows.find(row => row.id_matricula === renewal).estado_vigencia, 'Pendiente de pago');
  assert.equal(rows.find(row => row.id_detalle === 'DET01').puede_renovar, true);
  const original = await period('MAT01');
  const cash = await request('/api/pagos/efectivo', 'POST', { id_matricula: renewal, monto: 1 });
  assert.equal(cash.status, 201, JSON.stringify(cash));
  assert.equal(Number(cash.data.Monto), 150, 'El monto viene de la base, no del cuerpo.');
  assert.equal((await request('/api/pagos/efectivo/confirmar', 'POST', { id_matricula: renewal }, tesoreroToken)).status, 200);
  assert.deepEqual(await period(renewal), { inicio: dates.inicio, fin: dates.fin });
  assert.deepEqual(await period('MAT01'), original, 'Conservar el periodo histórico.');
  const once = await period(renewal);
  await pagos.actualizarEstadoMatricula(renewal, 'Activa');
  assert.deepEqual(await period(renewal), once, 'No extender otra vez ante una notificación repetida.');
  rows = (await request('/api/matriculas/mis-matriculas')).data;
  assert.equal(rows.find(row => row.id_detalle === 'DET01').puede_renovar, false);
  const late = await renew('DET02');
  assert.equal(late.status, 201, JSON.stringify(late));
  await pool.query(`UPDATE ${S}."Detalles_Matricula" SET "Fecha_Inicio"=CURRENT_DATE-2, "Fecha_Fin"=CURRENT_DATE+27 WHERE "Id_Matricula"=$1`, [late.data.matriculaId]);
  await pagos.actualizarEstadoMatricula(late.data.matriculaId, 'Activa');
  assert.deepEqual(await period(late.data.matriculaId), { inicio: dates.hoy, fin: dates.fin_tardia }, 'Renovación tardía desde la confirmación del pago.');
  await pool.query(`INSERT INTO ${S}."Matricula" VALUES ('MAT99','ALU02',CURRENT_DATE,'PENDIENTE');
    INSERT INTO ${S}."Detalles_Matricula" VALUES ('DET99','MAT99','DH03',CURRENT_DATE,CURRENT_DATE+30)`);
  const altaNueva = await period('MAT99');
  await pagos.actualizarEstadoMatricula('MAT99', 'Activa');
  assert.deepEqual(await period('MAT99'), altaNueva, 'Conservar el periodo original de una primera matrícula.');
  const envioRepo = fromRepo('./src/modules/comprobantes/comprobantes-envio.repository');
  const envio = await envioRepo.crearEnvioPendiente({ idPago: cash.data.Id_Pago, correoDestino: 'contacto@example.com', intento: 1, traceId: 'prueba-local' });
  await envioRepo.asignarJob(envio.id_envio, cash.data.Id_Pago, 'job-local');
  await envioRepo.marcarEnviado(envio.id_envio, cash.data.Id_Pago, 'smtp-simulado');
  assert.equal((await envioRepo.obtenerUltimoEnvio(cash.data.Id_Pago)).estado, 'ENVIADO');
  console.log('OK PostgreSQL: permisos, propiedad, cupos, duplicados, pendiente, efectivo, fechas anticipadas/tardías, primera matrícula, idempotencia y persistencia HU-13.');
  if (process.argv.includes('--serve')) {
    await datosDeEjemplo();
    console.log(`VISTA_DE_PRUEBA=${base}/mis-matriculas.html#renovar`);
    return;
  }
  server.close();
  await pool.end();
}
main().catch(async error => { console.error(error); server?.close(); await pool.end(); process.exitCode = 1; });
