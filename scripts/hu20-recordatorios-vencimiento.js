// HU-20 - Ejecución manual (solo desarrollo) del proceso de recordatorios.
// No expone ningún endpoint: se ejecuta desde la terminal con el .env local.
//
// Uso:
//   node scripts/hu20-recordatorios-vencimiento.js [--fecha=AAAA-MM-DD] [--enviar] [--destinatario=correo]
//
//   (sin opciones)          Simulación con la fecha de hoy (America/Lima): lista a quién
//                           se le enviaría, sin enviar correos.
//   --fecha=2026-11-20      Simula que hoy es esa fecha (no espera al día real).
//   --destinatario=x@y.com  Envía de verdad, pero TODOS los correos van a ese buzón de prueba.
//                           No marca los envíos en Redis, así el job real no se ve afectado.
//   --enviar                Envía a los correos reales de los alumnos (como el job diario).

require('dotenv').config();

const db = require('../src/shared/config/database');
const { redisConnection } = require('../src/shared/config/redis');
const { sendTransactionalEmail } = require('../src/shared/messaging/email.client');
const repository = require('../src/modules/notificaciones/recordatorios-vencimiento.repository');
const { crearRegistroEnvios } = require('../src/modules/notificaciones/recordatorios-vencimiento.registro');
const { crearServicioRecordatoriosVencimiento } = require('../src/modules/notificaciones/recordatorios-vencimiento.service');

function leerArgumentos(argv) {
  const opciones = { fecha: undefined, enviar: false, destinatario: null };
  for (const arg of argv) {
    if (arg.startsWith('--fecha=')) opciones.fecha = arg.slice('--fecha='.length);
    else if (arg === '--enviar') opciones.enviar = true;
    else if (arg.startsWith('--destinatario=')) opciones.destinatario = arg.slice('--destinatario='.length).trim();
    else throw new Error(`Opción no reconocida: ${arg}`);
  }
  return opciones;
}

async function cerrarConexiones() {
  await db.pool.end().catch(() => {});
  if (redisConnection.status !== 'wait' && redisConnection.status !== 'end') {
    await redisConnection.quit().catch(() => redisConnection.disconnect());
  }
}

async function main() {
  const opciones = leerArgumentos(process.argv.slice(2));
  const conDestinatarioPrueba = Boolean(opciones.destinatario);
  const dryRun = !opciones.enviar && !conDestinatarioPrueba;

  const servicio = crearServicioRecordatoriosVencimiento({
    repository,
    enviarCorreo: conDestinatarioPrueba
      ? (correo) => sendTransactionalEmail({ ...correo, recipient: opciones.destinatario })
      : sendTransactionalEmail,
    registroEnvios: crearRegistroEnvios({ redis: conDestinatarioPrueba ? null : redisConnection })
  });

  const modo = dryRun ? 'SIMULACIÓN (no se envían correos)'
    : conDestinatarioPrueba ? `ENVÍO A BUZÓN DE PRUEBA (${opciones.destinatario})`
      : 'ENVÍO REAL A ALUMNOS';
  console.log(`[HU-20] Modo: ${modo}`);

  const resumen = await servicio.procesarRecordatoriosVencimiento({ fechaReferencia: opciones.fecha, dryRun });
  console.table(resumen.detalle);
}

main()
  .then(() => { process.exitCode = 0; })
  .catch((error) => {
    console.error(`[HU-20] Error: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(cerrarConexiones);
