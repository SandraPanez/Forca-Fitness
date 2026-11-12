// HU-26: prueba de integración con PostgreSQL. BORRA y recrea el esquema, así
// que SOLO corre contra una base local desechable y solo si se pide explícitamente:
//
//   HU26_PG_PORT=55433 HU26_PG_PASSWORD=... node --test src/modules/matriculas/disciplinas-precios.integracion.test.js
//
// Variables opcionales: HU26_PG_HOST (127.0.0.1), HU26_PG_USER (postgres), HU26_PG_DB (forca_hu26).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HOSTS_LOCALES = ['127.0.0.1', 'localhost', '::1'];
const host = process.env.HU26_PG_HOST || '127.0.0.1';
const habilitada = Boolean(process.env.HU26_PG_PORT) && HOSTS_LOCALES.includes(host);

if (habilitada) {
  // Se fija ANTES de cargar database.js; dotenv no sobrescribe variables existentes,
  // así que el .env (base en la nube) no se usa en esta prueba.
  Object.assign(process.env, {
    DATABASE_URL: '',
    DB_HOST: host,
    DB_PORT: process.env.HU26_PG_PORT,
    DB_USER: process.env.HU26_PG_USER || 'postgres',
    DB_PASSWORD: process.env.HU26_PG_PASSWORD || '',
    DB_NAME: process.env.HU26_PG_DB || 'forca_hu26',
    DB_SSL: 'false'
  });
}

const S = '"Academia Forca&Fitness"';

describe('HU-26 · Integración PostgreSQL (solo base local desechable)', { skip: !habilitada && 'Define HU26_PG_PORT con una base local desechable' }, () => {
  let db;
  let servicio;
  let matriculasRepository;
  let pagosRepository;

  async function nuevaMatricula(id, alumno, estado) {
    await db.query(`INSERT INTO ${S}."Matricula" ("Id_Matricula", "Fecha_Inscripcion", "Estado_Matricula", "Id_alumno") VALUES ($1, CURRENT_DATE, $2, $3)`, [id, estado, alumno]);
    await db.query(`INSERT INTO ${S}."Detalles_Matricula" ("Id_DetMatricula", "Id_Matricula", "Fecha_Inicio", "Fecha_Fin", "Id_DiscHorario") VALUES ($1, $2, '2026-12-01', '2026-12-31', 'DH01')`, [`DET${id.slice(3)}`, id]);
  }
  const montoMatricula = async (id) => Number((await matriculasRepository.getResumenMatricula(id)).monto);
  const montoCobro = async (id) => Number((await pagosRepository.obtenerResumenMatricula(id)).monto);

  before(async () => {
    db = require('../../shared/config/database');
    const opciones = db.pool.options;
    assert.ok(!opciones.connectionString && HOSTS_LOCALES.includes(opciones.host), 'La prueba solo puede usar una base local');

    const schema = fs.readFileSync(path.join(__dirname, '../pagos/pagos.schema version 2.sql'), 'utf8').replace(/^﻿/, '');
    const migracion = fs.readFileSync(path.join(__dirname, 'hu26-precios-promociones-migration.sql'), 'utf8');
    await db.query(`DROP SCHEMA IF EXISTS ${S} CASCADE`);
    await db.query(schema);
    await db.query(migracion);
    await db.query(migracion); // la migración es idempotente

    const q = (sql, p) => db.query(sql, p);
    await q(`INSERT INTO ${S}."Documento_Identificacion" VALUES ('DOC01','DNI')`);
    await q(`INSERT INTO ${S}."Disciplina" ("Id_Disciplinas","Nombre_Disciplina","Descripcion","Tarifa") VALUES ('DISC01','Capoeira','Adultos',120),('DISC03','Boxeo','Técnico',110)`);
    await q(`INSERT INTO ${S}."Horarios" VALUES ('HOR01','19:00','20:30','Noche','Lunes')`);
    await q(`INSERT INTO ${S}."Persona" VALUES ('PERPRO','Profe',NULL,'Uno','Dos','1980-01-01','M','dir','00000000','DOC01')`);
    await q(`INSERT INTO ${S}."Profesor" VALUES ('PRO01','PERPRO',NULL,NULL)`);
    await q(`INSERT INTO ${S}."Disciplina_Horario" VALUES ('DH01',20,'HOR01','DISC01','PRO01'),('DH03',20,'HOR01','DISC03','PRO01')`);
    await q(`INSERT INTO ${S}."Metodo_Pago" VALUES ('MP01','MERCADO PAGO',NULL,TRUE,TRUE),('MP02','EFECTIVO',NULL,FALSE,TRUE)`);
    for (const n of ['01', '02', '03', '04', '05']) {
      await q(`INSERT INTO ${S}."Persona" VALUES ($1,$2,NULL,'Test','Uno','2000-01-01','F','dir',$3,'DOC01')`, [`PER${n}`, `Alumno${n}`, `100000${n}`]);
      await q(`INSERT INTO ${S}."Alumno" VALUES ($1,'ACTIVO','Ninguna',$2)`, [`ALU${n}`, `PER${n}`]);
    }

    // Matrícula pagada (pago y registro de cobro históricos) y matrícula registrada sin pagar.
    await nuevaMatricula('MAT01', 'ALU01', 'Activa');
    await q(`INSERT INTO ${S}."Pago" ("Id_Pago","Monto","Estado_Pago","Id_Matricula","Id_MPago") VALUES ('PAG01',120,'APROBADO','MAT01','MP02')`);
    await q(`INSERT INTO ${S}."Registro_Cobro" ("Id_Registro","Monto","Medio_Pago","Resultado","Id_Pago") VALUES ('REG01',120,'EFECTIVO','APROBADO','PAG01')`);
    await nuevaMatricula('MAT02', 'ALU02', 'PENDIENTE');

    const repository = require('./disciplinas-precios.repository');
    const { crearServicioPreciosDisciplinas } = require('./disciplinas-precios.service');
    servicio = crearServicioPreciosDisciplinas({ repository, database: db });
    matriculasRepository = require('./matriculas.repository');
    pagosRepository = require('../pagos/pagos.repository');
  });

  after(async () => {
    if (db) await db.pool.end();
  });

  it('T1. lista precio base y promoción actual de cada disciplina', async () => {
    const lista = await servicio.listarPrecios();
    assert.deepEqual(lista.map(d => [d.id, d.tarifa, d.precio_vigente, d.promocion]), [
      ['DISC03', 110, 110, null],
      ['DISC01', 120, 120, null]
    ]);
  });

  it('8. el nuevo precio y la promoción aplican a matrículas registradas después del cambio', async () => {
    const r = await servicio.actualizarPrecio('DISC01', {
      tarifa: 150, promocion: { tipo: 'PORCENTAJE', valor: 15, texto: 'Verano' }
    });
    assert.equal(r.actual.precio_vigente, 127.5);
    assert.equal(r.matriculas_con_precio_conservado, 1); // solo MAT02 (MAT01 ya está pagada)

    await nuevaMatricula('MAT04', 'ALU04', 'PENDIENTE');
    assert.equal(await montoMatricula('MAT04'), 127.5);
    assert.equal(await montoCobro('MAT04'), 127.5);

    // Lo que ve el alumno al matricularse es el precio con promoción.
    const disciplina = await matriculasRepository.getDisciplinaById('DISC01');
    assert.equal(Number(disciplina.tarifa), 127.5);
    assert.equal(Number(disciplina.tarifa_base), 150);
    assert.equal(disciplina.promocion_texto, 'Verano');
  });

  it('9. matrículas y pagos anteriores no cambian (sin recálculo retroactivo)', async () => {
    // Matrícula registrada antes del cambio y aún sin pagar: conserva S/ 120.
    assert.equal(await montoMatricula('MAT02'), 120);
    assert.equal(await montoCobro('MAT02'), 120);

    // Pago y registro de cobro históricos intactos; la matrícula pagada no se tocó.
    const pago = await db.query(`SELECT "Monto"::NUMERIC AS monto, "Estado_Pago" FROM ${S}."Pago" WHERE "Id_Pago"='PAG01'`);
    assert.deepEqual([Number(pago.rows[0].monto), pago.rows[0].Estado_Pago], [120, 'APROBADO']);
    const cobro = await db.query(`SELECT "Monto"::NUMERIC AS monto FROM ${S}."Registro_Cobro" WHERE "Id_Registro"='REG01'`);
    assert.equal(Number(cobro.rows[0].monto), 120);
    const det = await db.query(`SELECT "Tarifa_Aplicada" FROM ${S}."Detalles_Matricula" WHERE "Id_Matricula"='MAT01'`);
    assert.equal(det.rows[0].Tarifa_Aplicada, null);

    // Un segundo cambio congela MAT04 en S/ 127.50 y no altera MAT02.
    await servicio.actualizarPrecio('DISC01', { tarifa: 160, promocion: null });
    await nuevaMatricula('MAT05', 'ALU05', 'PENDIENTE');
    assert.deepEqual(
      [await montoCobro('MAT02'), await montoCobro('MAT04'), await montoCobro('MAT05')],
      [120, 127.5, 160]
    );

    // Otra disciplina no se ve afectada.
    const boxeo = await servicio.obtenerPrecio('DISC03');
    assert.equal(boxeo.precio_vigente, 110);
  });

  it('la base de datos impide promociones inválidas aunque se salte el backend', async () => {
    await assert.rejects(
      db.query(`UPDATE ${S}."Disciplina" SET "Promocion_Tipo"='PORCENTAJE', "Promocion_Valor"=150, "Promocion_Texto"='X' WHERE "Id_Disciplinas"='DISC03'`),
      /CK_Disciplina_Promocion/
    );
    await assert.rejects(
      db.query(`UPDATE ${S}."Disciplina" SET "Promocion_Tipo"='PORCENTAJE' WHERE "Id_Disciplinas"='DISC03'`),
      /CK_Disciplina_Promocion/
    );
  });

  it('getDisciplinas devuelve el precio vigente para las páginas del alumno', async () => {
    await servicio.actualizarPrecio('DISC03', { tarifa: 110, promocion: { tipo: 'MONTO_FIJO', valor: 10, texto: 'Lanzamiento' } });
    const lista = await matriculasRepository.getDisciplinas();
    const boxeo = lista.find(d => d.id === 'DISC03');
    assert.deepEqual([Number(boxeo.tarifa), Number(boxeo.tarifa_base), boxeo.promocion_texto], [100, 110, 'Lanzamiento']);
  });
});
