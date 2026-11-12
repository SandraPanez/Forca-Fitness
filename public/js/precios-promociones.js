// HU-26: validación de precio base y promoción, compartida por el panel del
// Director (navegador) y el backend (Node), igual que descuentos.js de HU-15.
// En el navegador debe cargarse después de /js/descuentos.js.

const calcularDescuentoPromocion = (typeof module !== 'undefined' && module.exports)
  ? require('./descuentos').calcularDescuento
  : calcularDescuento;

const TIPOS_PROMOCION = Object.freeze({
  PORCENTAJE: 'Porcentaje',
  MONTO_FIJO: 'Monto fijo'
});
const MAX_TEXTO_PROMOCION = 40;
const MAX_TARIFA = 99999999.99; // DECIMAL(10,2)

const MENSAJE_PROMOCION_UNICA =
  'Solo puede existir una promoción activa por disciplina. No se permiten descuentos acumulados.';

function estaVacio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

function validarTarifa(tarifa) {
  if (estaVacio(tarifa)) return { error: 'El precio base es obligatorio.' };
  if (typeof tarifa !== 'number' && typeof tarifa !== 'string') {
    return { error: 'El precio base debe ser un número válido.' };
  }
  const numero = Number(tarifa);
  if (!Number.isFinite(numero)) return { error: 'El precio base debe ser un número válido.' };
  if (numero <= 0) return { error: 'El precio base debe ser mayor que 0.' };
  if (Math.abs(numero * 100 - Math.round(numero * 100)) > 1e-8) {
    return { error: 'El precio base admite como máximo dos decimales.' };
  }
  if (numero > MAX_TARIFA) return { error: 'El precio base es demasiado alto.' };
  return { valor: Math.round(numero * 100) / 100 };
}

// Acepta { tarifa, promocion } (promocion = null | { tipo, valor, texto }).
// Devuelve los errores por campo para mostrarlos debajo de cada uno.
function validarConfiguracionPrecio(entrada = {}) {
  const errores = {};
  let promocion = entrada.promocion;

  if (Array.isArray(entrada.promociones) || Array.isArray(promocion)) {
    const lista = [
      ...(Array.isArray(entrada.promociones) ? entrada.promociones : []),
      ...(Array.isArray(promocion) ? promocion : (promocion ? [promocion] : []))
    ].filter(Boolean);
    if (lista.length > 1) {
      errores.promocion = MENSAJE_PROMOCION_UNICA;
      return { valido: false, errores, datos: null };
    }
    promocion = lista[0] || null;
  }

  const tarifa = validarTarifa(entrada.tarifa);
  if (tarifa.error) errores.tarifa = tarifa.error;

  let promocionNormalizada = null;
  if (promocion !== undefined && promocion !== null && promocion !== false) {
    if (typeof promocion !== 'object') {
      errores.promocion = 'La promoción no tiene un formato válido.';
    } else {
      const tipo = estaVacio(promocion.tipo) ? '' : String(promocion.tipo).trim().toUpperCase();
      const texto = estaVacio(promocion.texto) ? '' : String(promocion.texto).trim();

      if (!tipo) errores.promocion_tipo = 'Selecciona el tipo de descuento.';
      else if (!Object.prototype.hasOwnProperty.call(TIPOS_PROMOCION, tipo)) {
        errores.promocion_tipo = 'Selecciona un tipo de descuento válido.';
      }

      if (estaVacio(promocion.valor)) {
        errores.promocion_valor = 'El valor del descuento es obligatorio.';
      } else if (typeof promocion.valor !== 'number' && typeof promocion.valor !== 'string') {
        errores.promocion_valor = 'El descuento debe ser un número válido.';
      } else if (!errores.tarifa && !errores.promocion_tipo) {
        try {
          const calculo = calcularDescuentoPromocion({
            precioOriginal: tarifa.valor,
            tipo,
            valor: typeof promocion.valor === 'string' ? promocion.valor.trim() : promocion.valor
          });
          if (calculo.montoFinal <= 0) {
            errores.promocion_valor = tipo === 'PORCENTAJE'
              ? 'El porcentaje debe ser menor que 100%.'
              : 'El descuento debe ser menor que el precio base.';
          } else {
            promocionNormalizada = { tipo, valor: calculo.valor, texto };
          }
        } catch (error) {
          errores.promocion_valor = error.message;
        }
      } else if (!Number.isFinite(Number(promocion.valor)) || Number(promocion.valor) <= 0) {
        errores.promocion_valor = 'El descuento debe ser un número mayor que cero.';
      }

      if (!texto) errores.promocion_texto = 'El texto de la promoción es obligatorio.';
      else if (texto.length > MAX_TEXTO_PROMOCION) {
        errores.promocion_texto = `El texto de la promoción admite como máximo ${MAX_TEXTO_PROMOCION} caracteres.`;
      }
    }
  }

  const valido = Object.keys(errores).length === 0;
  return {
    valido,
    errores,
    datos: valido ? { tarifa: tarifa.valor, promocion: promocionNormalizada } : null
  };
}

// Precio que pagará una matrícula nueva con la configuración indicada.
function calcularPrecioVigente({ tarifa, promocion }) {
  const base = Number(tarifa);
  if (!promocion) return { tarifa: base, descuento: 0, precioFinal: base };
  const calculo = calcularDescuentoPromocion({
    precioOriginal: base,
    tipo: promocion.tipo,
    valor: Number(promocion.valor)
  });
  return { tarifa: calculo.precioOriginal, descuento: calculo.descuento, precioFinal: calculo.montoFinal };
}

function describirPromocion(promocion) {
  if (!promocion) return 'Sin promoción';
  const valor = Number(promocion.valor);
  const detalle = promocion.tipo === 'PORCENTAJE'
    ? `${Number.isInteger(valor) ? valor : valor.toFixed(2)}% de descuento`
    : `S/ ${valor.toFixed(2)} de descuento`;
  return `${promocion.texto} (${detalle})`;
}

function mismaPromocion(a, b) {
  if (!a || !b) return !a && !b;
  return a.tipo === b.tipo && Number(a.valor) === Number(b.valor) && a.texto === b.texto;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TIPOS_PROMOCION,
    MAX_TEXTO_PROMOCION,
    MENSAJE_PROMOCION_UNICA,
    validarConfiguracionPrecio,
    calcularPrecioVigente,
    describirPromocion,
    mismaPromocion
  };
}
