function calcularDescuento({ precioOriginal, tipo, valor }) {
  const normalizarCentimos = (monto, nombre) => {
    if (
      typeof monto !== 'number' &&
      (typeof monto !== 'string' || monto.trim() === '')
    ) {
      throw new Error(`${nombre} debe ser un número válido.`);
    }

    const numero = Number(monto);
    if (!Number.isFinite(numero)) {
      throw new Error(`${nombre} debe ser un número válido.`);
    }

    const centimos = Math.round(numero * 100);
    if (
      !Number.isSafeInteger(centimos) ||
      Math.abs(numero * 100 - centimos) > 1e-8
    ) {
      throw new Error(`${nombre} debe tener como máximo dos decimales.`);
    }

    return centimos;
  };

  const precioCentimos = normalizarCentimos(precioOriginal, 'El precio original');
  if (precioCentimos <= 0) {
    throw new Error('El precio original debe ser mayor que cero.');
  }

  const valorCentimos = normalizarCentimos(valor, 'El descuento');
  if (valorCentimos <= 0) {
    throw new Error('El descuento debe ser mayor que cero.');
  }

  let descuentoCentimos;

  if (tipo === 'PORCENTAJE') {
    if (valorCentimos > 10000) {
      throw new Error('El porcentaje debe ser mayor que cero y no superar el 100%.');
    }

    descuentoCentimos = Number(
      (BigInt(precioCentimos) * BigInt(valorCentimos) + 5000n) / 10000n
    );
  } else if (tipo === 'MONTO_FIJO') {
    if (valorCentimos > precioCentimos) {
      throw new Error('El descuento no puede superar el precio original.');
    }

    descuentoCentimos = valorCentimos;
  } else {
    throw new Error('Selecciona un tipo de descuento válido.');
  }

  return {
    tipo,
    valor: valorCentimos / 100,
    precioOriginal: precioCentimos / 100,
    descuento: descuentoCentimos / 100,
    montoFinal: (precioCentimos - descuentoCentimos) / 100
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcularDescuento };
}
