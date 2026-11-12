// HU-20 - Control de duplicados de recordatorios.
// No se crea tabla (la HU no requiere almacenar notificaciones). Se reutiliza el
// Redis que ya usa el proyecto (BullMQ) con claves temporales SET NX + EX.
// Si Redis no responde, se usa un respaldo en memoria del proceso.

const PREFIJO_CLAVE = 'hu20:recordatorio-vencimiento:';
const TTL_SEGUNDOS = 3 * 24 * 60 * 60;
const TIMEOUT_REDIS_MS = 3000;

function conTimeout(promesa, ms) {
  let timer;
  const limite = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Redis no respondió a tiempo')), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(timer));
}

function crearRegistroEnvios({ redis = null, ttlSegundos = TTL_SEGUNDOS, logger = console } = {}) {
  const memoria = new Map();

  function limpiarMemoria() {
    const ahora = Date.now();
    for (const [clave, expira] of memoria) {
      if (expira <= ahora) memoria.delete(clave);
    }
  }

  return {
    // Devuelve true si la clave se reservó ahora (se puede enviar) y false si ya existía.
    async reservar(clave) {
      limpiarMemoria();
      if (memoria.has(clave)) return false;

      if (redis) {
        try {
          const resultado = await conTimeout(
            redis.set(`${PREFIJO_CLAVE}${clave}`, '1', 'EX', ttlSegundos, 'NX'),
            TIMEOUT_REDIS_MS
          );
          if (resultado !== 'OK') return false;
        } catch (error) {
          logger.warn(`[HU-20][REDIS] Control de duplicados solo en memoria: ${error.message}`);
        }
      }

      memoria.set(clave, Date.now() + ttlSegundos * 1000);
      return true;
    },

    // Libera la clave cuando el envío falla, para permitir reintentarlo.
    async liberar(clave) {
      memoria.delete(clave);
      if (!redis) return;
      try {
        await conTimeout(redis.del(`${PREFIJO_CLAVE}${clave}`), TIMEOUT_REDIS_MS);
      } catch (error) {
        logger.warn(`[HU-20][REDIS] No se pudo liberar la clave ${clave}: ${error.message}`);
      }
    }
  };
}

module.exports = {
  crearRegistroEnvios,
  PREFIJO_CLAVE,
  TTL_SEGUNDOS
};
