// HU-20 - Enviar notificaciones automáticas de recordatorio de vencimiento.
// Flujo: matrículas que vencen exactamente en 3 o 1 día -> excluir las que ya
// tienen reserva / pago anticipado confirmado del siguiente periodo -> enviar
// correo con sendTransactionalEmail(). Un fallo no detiene a los demás.

const { construirCorreoRecordatorio } = require('./recordatorios-vencimiento.template');

const DIAS_RECORDATORIO = Object.freeze([3, 1]);
const ZONA_HORARIA = 'America/Lima';
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Día calendario actual en Perú como 'YYYY-MM-DD' (mismo criterio que balance.calculator).
function obtenerFechaHoyLima(fecha = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(fecha);
}

function esFechaValida(valor) {
  if (!FORMATO_FECHA.test(String(valor))) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

// Evita escribir correos completos en los logs.
function enmascararCorreo(correo) {
  const [usuario, dominio] = String(correo || '').split('@');
  if (!dominio) return '(sin correo)';
  return `${usuario.slice(0, 2)}***@${dominio}`;
}

function crearServicioRecordatoriosVencimiento({
  repository,
  enviarCorreo,
  registroEnvios,
  logger = console,
  obtenerFechaHoy = obtenerFechaHoyLima
}) {
  if (!repository || !enviarCorreo || !registroEnvios) {
    throw new Error('El servicio de recordatorios requiere repository, enviarCorreo y registroEnvios.');
  }

  async function procesarRecordatoriosVencimiento({ fechaReferencia, dryRun = false } = {}) {
    const fecha = fechaReferencia || obtenerFechaHoy();
    if (!esFechaValida(fecha)) {
      throw new Error(`Fecha de referencia inválida: ${fecha}. Use el formato AAAA-MM-DD.`);
    }

    const resumen = {
      fecha_referencia: fecha,
      dry_run: Boolean(dryRun),
      candidatos: 0,
      enviados: 0,
      simulados: 0,
      omitidos_renovacion_confirmada: 0,
      omitidos_sin_correo: 0,
      omitidos_duplicado: 0,
      ignorados_fuera_de_rango: 0,
      fallidos: 0,
      detalle: []
    };

    const candidatos = await repository.obtenerMatriculasPorVencer(fecha, [...DIAS_RECORDATORIO]);
    resumen.candidatos = candidatos.length;

    for (const matricula of candidatos) {
      const dias = Number(matricula.dias_restantes);
      const referencia = {
        id_matricula: matricula.id_matricula,
        id_detalle: matricula.id_detalle,
        disciplina: matricula.disciplina,
        fecha_fin: matricula.fecha_fin,
        dias_restantes: dias,
        correo: enmascararCorreo(matricula.correo)
      };
      const registrar = (resultado, extra = {}) =>
        resumen.detalle.push({ ...referencia, resultado, ...extra });

      try {
        // T3: solo exactamente 3 o 1 día (defensa adicional al filtro SQL).
        if (!DIAS_RECORDATORIO.includes(dias)) {
          resumen.ignorados_fuera_de_rango++;
          registrar('ignorado_fuera_de_rango');
          continue;
        }

        // T4: exclusión por reserva o pago anticipado del siguiente periodo.
        const siguiente = await repository.obtenerSiguientePeriodoConfirmado({
          idAlumno: matricula.id_alumno,
          idDisciplina: matricula.id_disciplina,
          fechaFin: matricula.fecha_fin
        });
        if (siguiente.tiene_reserva || siguiente.tiene_pago_anticipado) {
          resumen.omitidos_renovacion_confirmada++;
          registrar('omitido_renovacion_confirmada', {
            motivo: siguiente.tiene_reserva ? 'reserva_confirmada' : 'pago_anticipado_confirmado'
          });
          continue;
        }

        const correo = String(matricula.correo || '').trim();
        if (!FORMATO_CORREO.test(correo)) {
          resumen.omitidos_sin_correo++;
          registrar('omitido_sin_correo');
          logger.warn(`[HU-20][SIN_CORREO] matricula=${matricula.id_matricula} alumno=${matricula.id_alumno}`);
          continue;
        }

        const mensaje = construirCorreoRecordatorio({
          nombreAlumno: matricula.nombre_alumno,
          disciplina: matricula.disciplina,
          fechaFin: matricula.fecha_fin,
          diasRestantes: dias
        });

        if (dryRun) {
          resumen.simulados++;
          registrar('simulado', { asunto: mensaje.subject });
          continue;
        }

        // Idempotencia: un recordatorio por detalle, vencimiento y aviso (3 o 1).
        const clave = `${matricula.id_detalle}:${matricula.fecha_fin}:${dias}`;
        if (!(await registroEnvios.reservar(clave))) {
          resumen.omitidos_duplicado++;
          registrar('omitido_duplicado');
          continue;
        }

        try {
          // T5: reutiliza el cliente SMTP existente.
          await enviarCorreo({ recipient: correo, ...mensaje });
        } catch (errorEnvio) {
          await registroEnvios.liberar(clave);
          throw errorEnvio;
        }

        resumen.enviados++;
        registrar('enviado');
      } catch (error) {
        resumen.fallidos++;
        registrar('fallido', { error: error.message });
        logger.error(
          `[HU-20][ERROR] matricula=${matricula.id_matricula} detalle=${matricula.id_detalle} ` +
          `correo=${referencia.correo} error=${error.message}`
        );
      }
    }

    logger.log(
      `[HU-20] Recordatorios ${fecha}${dryRun ? ' (simulación)' : ''}: candidatos=${resumen.candidatos} ` +
      `enviados=${resumen.enviados} simulados=${resumen.simulados} ` +
      `omitidos_renovacion=${resumen.omitidos_renovacion_confirmada} sin_correo=${resumen.omitidos_sin_correo} ` +
      `duplicados=${resumen.omitidos_duplicado} fallidos=${resumen.fallidos}`
    );

    return resumen;
  }

  return { procesarRecordatoriosVencimiento };
}

// Instancia por defecto con las dependencias reales del proyecto
// (se arma al primer uso para que las pruebas no abran conexiones).
let servicioPorDefecto = null;
function obtenerServicioPorDefecto() {
  if (!servicioPorDefecto) {
    const repository = require('./recordatorios-vencimiento.repository');
    const { sendTransactionalEmail } = require('../../shared/messaging/email.client');
    const { redisConnection } = require('../../shared/config/redis');
    const { crearRegistroEnvios } = require('./recordatorios-vencimiento.registro');

    servicioPorDefecto = crearServicioRecordatoriosVencimiento({
      repository,
      enviarCorreo: sendTransactionalEmail,
      registroEnvios: crearRegistroEnvios({ redis: redisConnection })
    });
  }
  return servicioPorDefecto;
}

module.exports = {
  DIAS_RECORDATORIO,
  crearServicioRecordatoriosVencimiento,
  obtenerFechaHoyLima,
  enmascararCorreo,
  procesarRecordatoriosVencimiento: (opciones) =>
    obtenerServicioPorDefecto().procesarRecordatoriosVencimiento(opciones)
};
