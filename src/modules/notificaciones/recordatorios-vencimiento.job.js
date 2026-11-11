// HU-20 T6 - Job diario de recordatorios de vencimiento.
// Sigue el mecanismo de tareas periódicas del proyecto (setInterval + unref en
// index.js), sin nuevas dependencias. Revisa cada 15 minutos y ejecuta el
// servicio UNA vez por día calendario (America/Lima) a partir de la hora
// configurada. Toda la lógica de negocio vive en el servicio.

const INTERVALO_REVISION_MS = 15 * 60 * 1000;
const HORA_POR_DEFECTO = 8;

function obtenerFechaHoraLima(fecha = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(fecha).map(({ type, value }) => [type, value])
  );
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: Number(partes.hour)
  };
}

function leerHoraConfigurada(valor) {
  const hora = Number(valor);
  return Number.isInteger(hora) && hora >= 0 && hora <= 23 ? hora : HORA_POR_DEFECTO;
}

function iniciarJobRecordatoriosVencimiento({
  procesar = (opciones) => require('./recordatorios-vencimiento.service').procesarRecordatoriosVencimiento(opciones),
  activo = process.env.RECORDATORIOS_VENCIMIENTO_ACTIVO !== 'false',
  hora = leerHoraConfigurada(process.env.RECORDATORIOS_VENCIMIENTO_HORA),
  intervaloMs = INTERVALO_REVISION_MS,
  ahora = () => new Date(),
  logger = console
} = {}) {
  if (!activo) {
    logger.log('[HU-20] Job de recordatorios de vencimiento desactivado (RECORDATORIOS_VENCIMIENTO_ACTIVO=false).');
    return null;
  }

  let ultimaFechaEjecutada = null;
  let enEjecucion = false;

  async function revisar() {
    const { fecha, hora: horaActual } = obtenerFechaHoraLima(ahora());
    if (enEjecucion || ultimaFechaEjecutada === fecha || horaActual < hora) return false;

    enEjecucion = true;
    try {
      await procesar({ fechaReferencia: fecha });
      ultimaFechaEjecutada = fecha;
      return true;
    } catch (error) {
      // Ej.: BD no disponible. Se reintenta en la siguiente revisión del mismo día.
      logger.warn(`[HU-20] Job de recordatorios no completado (${error.message}). Se reintentará.`);
      return false;
    } finally {
      enEjecucion = false;
    }
  }

  const timer = setInterval(revisar, intervaloMs);
  timer.unref();
  setImmediate(revisar);

  return {
    revisar,
    detener: () => clearInterval(timer)
  };
}

module.exports = {
  iniciarJobRecordatoriosVencimiento,
  obtenerFechaHoraLima
};
