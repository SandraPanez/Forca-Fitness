// HU-20 - Pruebas del servicio de recordatorios de vencimiento.
// Ejecutar: node --test src/modules/notificaciones/
// No requieren PostgreSQL, Redis ni SMTP: se inyectan dobles en memoria.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  crearServicioRecordatoriosVencimiento,
  obtenerFechaHoyLima,
  enmascararCorreo,
  DIAS_RECORDATORIO
} = require('./recordatorios-vencimiento.service');
const { construirCorreoRecordatorio, ASUNTO_RECORDATORIO } = require('./recordatorios-vencimiento.template');
const { crearRegistroEnvios } = require('./recordatorios-vencimiento.registro');
const { iniciarJobRecordatoriosVencimiento, obtenerFechaHoraLima } = require('./recordatorios-vencimiento.job');

const HOY = '2026-11-11';

function sumarDias(fechaIso, dias) {
  const [a, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

function matricula(id, diasRestantes, extra = {}) {
  return {
    id_matricula: `MAT${id}`,
    id_detalle: `DET${id}`,
    estado_matricula: 'Activa',
    id_alumno: `ALU${id}`,
    nombre_alumno: `Alumno ${id}`,
    correo: `alumno${id}@correo.com`,
    id_disciplina: 'DIS01',
    disciplina: 'Jiu Jitsu',
    fecha_fin: sumarDias(HOY, diasRestantes),
    dias_restantes: diasRestantes,
    ...extra
  };
}

// Doble del repositorio. Por defecto NO filtra (devuelve todo) para comprobar
// también la defensa del servicio; con filtrarComoSql replica el WHERE real.
function crearRepositorioFalso(matriculas, { siguientes = {}, filtrarComoSql = false } = {}) {
  const llamadas = { porVencer: [], siguientePeriodo: [] };
  return {
    llamadas,
    async obtenerMatriculasPorVencer(fecha, dias) {
      llamadas.porVencer.push({ fecha, dias });
      return filtrarComoSql
        ? matriculas.filter((m) => dias.includes(m.dias_restantes))
        : matriculas;
    },
    async obtenerSiguientePeriodoConfirmado(params) {
      llamadas.siguientePeriodo.push(params);
      return siguientes[params.idAlumno] || { tiene_reserva: false, tiene_pago_anticipado: false };
    }
  };
}

function crearCorreoFalso({ fallarPara = [] } = {}) {
  const enviados = [];
  const enviarCorreo = async (correo) => {
    if (fallarPara.includes(correo.recipient)) {
      throw new Error('SMTP no disponible');
    }
    enviados.push(correo);
    return { messageId: `<id-${enviados.length}>` };
  };
  return { enviados, enviarCorreo };
}

const loggerSilencioso = { log() {}, warn() {}, error() {} };

function crearServicio(repository, correo, registroEnvios = crearRegistroEnvios({ logger: loggerSilencioso })) {
  return crearServicioRecordatoriosVencimiento({
    repository,
    enviarCorreo: correo.enviarCorreo,
    registroEnvios,
    logger: loggerSilencioso,
    obtenerFechaHoy: () => HOY
  });
}

describe('HU-20: Recordatorios automáticos de vencimiento de matrícula', () => {

  describe('CA1 / CASO 1: vence en 3 días sin reserva ni pago siguiente', () => {
    it('envía el correo recordatorio al correo registrado', async () => {
      const repo = crearRepositorioFalso([matricula('01', 3)]);
      const correo = crearCorreoFalso();
      const resumen = await crearServicio(repo, correo).procesarRecordatoriosVencimiento();

      assert.equal(resumen.enviados, 1);
      assert.equal(correo.enviados.length, 1);
      assert.equal(correo.enviados[0].recipient, 'alumno01@correo.com');
      assert.equal(correo.enviados[0].subject, ASUNTO_RECORDATORIO);
      assert.match(correo.enviados[0].text, /Tu matrícula está próxima a vencer/);
      assert.match(correo.enviados[0].text, /3 días/);
    });
  });

  describe('CA2 / CASO 2: vence en 1 día sin reserva ni pago siguiente', () => {
    it('envía la segunda notificación indicando que vence mañana', async () => {
      const repo = crearRepositorioFalso([matricula('02', 1)]);
      const correo = crearCorreoFalso();
      const resumen = await crearServicio(repo, correo).procesarRecordatoriosVencimiento();

      assert.equal(resumen.enviados, 1);
      assert.match(correo.enviados[0].text, /Tu matrícula vence mañana/);
      assert.match(correo.enviados[0].text, /1 día\b/);
    });
  });

  describe('CA3 / CASO 3: vence en 3 días con reserva confirmada del siguiente periodo', () => {
    it('no envía el recordatorio', async () => {
      const repo = crearRepositorioFalso([matricula('03', 3)], {
        siguientes: { ALU03: { tiene_reserva: true, tiene_pago_anticipado: true } }
      });
      const correo = crearCorreoFalso();
      const resumen = await crearServicio(repo, correo).procesarRecordatoriosVencimiento();

      assert.equal(correo.enviados.length, 0);
      assert.equal(resumen.omitidos_renovacion_confirmada, 1);
      assert.equal(resumen.detalle[0].motivo, 'reserva_confirmada');
      // La exclusión se evalúa para el mismo alumno, disciplina y periodo siguiente.
      assert.deepEqual(repo.llamadas.siguientePeriodo[0], {
        idAlumno: 'ALU03', idDisciplina: 'DIS01', fechaFin: sumarDias(HOY, 3)
      });
    });
  });

  describe('CA3 / CASO 4: vence en 1 día con pago anticipado confirmado', () => {
    it('no envía el recordatorio', async () => {
      const repo = crearRepositorioFalso([matricula('04', 1)], {
        siguientes: { ALU04: { tiene_reserva: false, tiene_pago_anticipado: true } }
      });
      const correo = crearCorreoFalso();
      const resumen = await crearServicio(repo, correo).procesarRecordatoriosVencimiento();

      assert.equal(correo.enviados.length, 0);
      assert.equal(resumen.omitidos_renovacion_confirmada, 1);
      assert.equal(resumen.detalle[0].motivo, 'pago_anticipado_confirmado');
    });
  });

  describe('CASO 5: vence en 2, 4 o más días (o ya venció)', () => {
    it('solicita al repositorio exactamente 3 y 1 días (no "<= 3")', async () => {
      const repo = crearRepositorioFalso([]);
      await crearServicio(repo, crearCorreoFalso()).procesarRecordatoriosVencimiento();
      assert.deepEqual(repo.llamadas.porVencer, [{ fecha: HOY, dias: [3, 1] }]);
      assert.deepEqual([...DIAS_RECORDATORIO], [3, 1]);
    });

    it('no envía aunque el repositorio devuelva otras distancias', async () => {
      const repo = crearRepositorioFalso([0, 2, 4, 5, 7, 30, -1].map((d, i) => matricula(`1${i}`, d)));
      const correo = crearCorreoFalso();
      const resumen = await crearServicio(repo, correo).procesarRecordatoriosVencimiento();

      assert.equal(correo.enviados.length, 0);
      assert.equal(resumen.ignorados_fuera_de_rango, 7);
      assert.equal(repo.llamadas.siguientePeriodo.length, 0);
    });

    it('con datos mixtos solo notifica a los de 3 y 1 día', async () => {
      const repo = crearRepositorioFalso(
        [matricula('21', 4), matricula('22', 3), matricula('23', 2), matricula('24', 1)],
        { filtrarComoSql: true }
      );
      const correo = crearCorreoFalso();
      await crearServicio(repo, correo).procesarRecordatoriosVencimiento();

      assert.deepEqual(correo.enviados.map((c) => c.recipient).sort(),
        ['alumno22@correo.com', 'alumno24@correo.com']);
    });
  });

  describe('CASO 6: un correo falla', () => {
    it('registra el error y continúa con los demás alumnos', async () => {
      const repo = crearRepositorioFalso([matricula('31', 3), matricula('32', 1), matricula('33', 3)]);
      const correo = crearCorreoFalso({ fallarPara: ['alumno31@correo.com'] });
      const errores = [];
      const servicio = crearServicioRecordatoriosVencimiento({
        repository: repo,
        enviarCorreo: correo.enviarCorreo,
        registroEnvios: crearRegistroEnvios({ logger: loggerSilencioso }),
        logger: { ...loggerSilencioso, error: (m) => errores.push(m) },
        obtenerFechaHoy: () => HOY
      });

      const resumen = await servicio.procesarRecordatoriosVencimiento();

      assert.equal(resumen.fallidos, 1);
      assert.equal(resumen.enviados, 2);
      assert.deepEqual(correo.enviados.map((c) => c.recipient),
        ['alumno32@correo.com', 'alumno33@correo.com']);
      assert.equal(errores.length, 1);
      assert.match(errores[0], /MAT31/);
      assert.doesNotMatch(errores[0], /alumno31@correo\.com/, 'el log no expone el correo completo');
    });

    it('un error al consultar la exclusión tampoco detiene el proceso', async () => {
      const repo = crearRepositorioFalso([matricula('41', 3), matricula('42', 3)]);
      const original = repo.obtenerSiguientePeriodoConfirmado;
      repo.obtenerSiguientePeriodoConfirmado = async (p) => {
        if (p.idAlumno === 'ALU41') throw new Error('timeout BD');
        return original(p);
      };
      const correo = crearCorreoFalso();
      const resumen = await crearServicio(repo, correo).procesarRecordatoriosVencimiento();

      assert.equal(resumen.fallidos, 1);
      assert.equal(resumen.enviados, 1);
    });

    it('un envío fallido puede reintentarse en una nueva ejecución', async () => {
      const registro = crearRegistroEnvios({ logger: loggerSilencioso });
      const repo = crearRepositorioFalso([matricula('51', 3)]);
      const correoFalla = crearCorreoFalso({ fallarPara: ['alumno51@correo.com'] });
      await crearServicio(repo, correoFalla, registro).procesarRecordatoriosVencimiento();

      const correoOk = crearCorreoFalso();
      const resumen = await crearServicio(repo, correoOk, registro).procesarRecordatoriosVencimiento();
      assert.equal(resumen.enviados, 1);
    });
  });

  describe('Evitar duplicados', () => {
    it('una segunda ejecución el mismo día no reenvía el mismo recordatorio', async () => {
      const registro = crearRegistroEnvios({ logger: loggerSilencioso });
      const repo = crearRepositorioFalso([matricula('61', 3), matricula('62', 1)]);
      const correo = crearCorreoFalso();
      const servicio = crearServicio(repo, correo, registro);

      await servicio.procesarRecordatoriosVencimiento();
      const segunda = await servicio.procesarRecordatoriosVencimiento();

      assert.equal(correo.enviados.length, 2);
      assert.equal(segunda.omitidos_duplicado, 2);
    });

    it('usa Redis con SET NX y expiración cuando está disponible', async () => {
      const claves = new Map();
      const redisFalso = {
        async set(clave, valor, ex, ttl, nx) {
          assert.equal(ex, 'EX');
          assert.equal(nx, 'NX');
          assert.ok(ttl > 0);
          if (claves.has(clave)) return null;
          claves.set(clave, valor);
          return 'OK';
        },
        async del(clave) { claves.delete(clave); }
      };
      // Dos registros distintos simulan dos procesos (p. ej. un reinicio del servidor).
      const r1 = crearRegistroEnvios({ redis: redisFalso, logger: loggerSilencioso });
      const r2 = crearRegistroEnvios({ redis: redisFalso, logger: loggerSilencioso });
      assert.equal(await r1.reservar('DET01:2026-11-14:3'), true);
      assert.equal(await r2.reservar('DET01:2026-11-14:3'), false);
      await r1.liberar('DET01:2026-11-14:3');
      assert.equal(await r2.reservar('DET01:2026-11-14:3'), true);
    });

    it('si Redis falla, sigue funcionando con el control en memoria', async () => {
      const redisCaido = { set: async () => { throw new Error('ECONNREFUSED'); }, del: async () => {} };
      const registro = crearRegistroEnvios({ redis: redisCaido, logger: loggerSilencioso });
      assert.equal(await registro.reservar('k'), true);
      assert.equal(await registro.reservar('k'), false);
    });
  });

  describe('Otras validaciones', () => {
    it('modo simulación (dryRun) no envía ni marca los envíos', async () => {
      const registro = crearRegistroEnvios({ logger: loggerSilencioso });
      const repo = crearRepositorioFalso([matricula('71', 3)]);
      const correo = crearCorreoFalso();
      const servicio = crearServicio(repo, correo, registro);

      const simulado = await servicio.procesarRecordatoriosVencimiento({ dryRun: true });
      assert.equal(simulado.simulados, 1);
      assert.equal(correo.enviados.length, 0);

      const real = await servicio.procesarRecordatoriosVencimiento();
      assert.equal(real.enviados, 1);
    });

    it('omite alumnos sin correo válido registrado', async () => {
      const repo = crearRepositorioFalso([matricula('81', 3, { correo: null }), matricula('82', 1, { correo: 'invalido' })]);
      const correo = crearCorreoFalso();
      const resumen = await crearServicio(repo, correo).procesarRecordatoriosVencimiento();
      assert.equal(resumen.omitidos_sin_correo, 2);
      assert.equal(correo.enviados.length, 0);
    });

    it('acepta una fecha de referencia manual y rechaza fechas inválidas', async () => {
      const repo = crearRepositorioFalso([]);
      const servicio = crearServicio(repo, crearCorreoFalso());
      await servicio.procesarRecordatoriosVencimiento({ fechaReferencia: '2026-12-29' });
      assert.equal(repo.llamadas.porVencer[0].fecha, '2026-12-29');
      await assert.rejects(servicio.procesarRecordatoriosVencimiento({ fechaReferencia: '2026-02-30' }), /inválida/);
      await assert.rejects(servicio.procesarRecordatoriosVencimiento({ fechaReferencia: '11/11/2026' }), /inválida/);
    });

    it('calcula el día calendario en America/Lima y no en UTC', () => {
      // 2026-11-12 03:00 UTC sigue siendo 2026-11-11 (22:00) en Lima.
      assert.equal(obtenerFechaHoyLima(new Date('2026-11-12T03:00:00Z')), '2026-11-11');
      assert.deepEqual(obtenerFechaHoraLima(new Date('2026-11-12T03:00:00Z')), { fecha: '2026-11-11', hora: 22 });
    });

    it('enmascara correos en logs', () => {
      assert.equal(enmascararCorreo('alumno@correo.com'), 'al***@correo.com');
      assert.equal(enmascararCorreo(null), '(sin correo)');
    });
  });

  describe('T1: plantilla del correo', () => {
    it('incluye nombre, disciplina, fecha, días restantes, renovación e identidad', () => {
      const correo = construirCorreoRecordatorio({
        nombreAlumno: 'Ana Pérez', disciplina: 'Karate', fechaFin: '2026-11-14', diasRestantes: 3
      });
      assert.equal(correo.subject, 'Recordatorio de vencimiento - Forca & Fitness');
      for (const parte of [correo.text, correo.html]) {
        assert.match(parte, /Ana Pérez/);
        assert.match(parte, /Karate/);
        assert.match(parte, /14 de noviembre de 2026/);
        assert.match(parte, /3 días/);
        assert.match(parte, /renovar/i);
        assert.match(parte, /Forca (&|&amp;) Fitness/);
      }
    });

    it('escapa el HTML de los datos del alumno', () => {
      const correo = construirCorreoRecordatorio({
        nombreAlumno: '<script>x</script>', disciplina: 'Box', fechaFin: '2026-11-12', diasRestantes: 1
      });
      assert.doesNotMatch(correo.html, /<script>/);
      assert.match(correo.html, /&lt;script&gt;/);
    });
  });

  describe('T6: job diario', () => {
    const esperarTick = () => new Promise((r) => setImmediate(r));

    it('ejecuta el servicio una sola vez por día desde la hora configurada', async () => {
      let ahora = new Date('2026-11-11T12:00:00Z'); // 07:00 Lima
      const llamadas = [];
      const job = iniciarJobRecordatoriosVencimiento({
        procesar: async (op) => { llamadas.push(op.fechaReferencia); },
        activo: true, hora: 8, intervaloMs: 60 * 60 * 1000, ahora: () => ahora, logger: loggerSilencioso
      });
      try {
        await esperarTick();
        assert.equal(llamadas.length, 0, 'antes de la hora no se ejecuta');

        ahora = new Date('2026-11-11T13:30:00Z'); // 08:30 Lima
        assert.equal(await job.revisar(), true);
        assert.equal(await job.revisar(), false);
        ahora = new Date('2026-11-11T22:00:00Z'); // 17:00 Lima
        assert.equal(await job.revisar(), false);
        assert.deepEqual(llamadas, ['2026-11-11']);

        ahora = new Date('2026-11-12T13:30:00Z'); // día siguiente
        assert.equal(await job.revisar(), true);
        assert.deepEqual(llamadas, ['2026-11-11', '2026-11-12']);
      } finally {
        job.detener();
      }
    });

    it('si la ejecución falla (p. ej. sin BD), se reintenta en la siguiente revisión', async () => {
      let intentos = 0;
      const job = iniciarJobRecordatoriosVencimiento({
        procesar: async () => { intentos++; if (intentos === 1) throw new Error('BD caída'); },
        activo: true, hora: 0, intervaloMs: 60 * 60 * 1000,
        ahora: () => new Date('2026-11-11T15:00:00Z'), logger: loggerSilencioso
      });
      try {
        await esperarTick();
        assert.equal(intentos, 1);
        assert.equal(await job.revisar(), true);
        assert.equal(await job.revisar(), false);
        assert.equal(intentos, 2);
      } finally {
        job.detener();
      }
    });

    it('puede desactivarse por configuración', () => {
      const job = iniciarJobRecordatoriosVencimiento({ activo: false, logger: loggerSilencioso });
      assert.equal(job, null);
    });
  });
});
