const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'
];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos'
];

const menorDeMil = (n) => {
  if (n === 100) return 'cien';
  const resto = n % 100;
  const decenas = resto < 30
    ? UNIDADES[resto]
    : DECENAS[Math.floor(resto / 10)] + (resto % 10 ? ` y ${UNIDADES[resto % 10]}` : '');
  return [CENTENAS[Math.floor(n / 100)], decenas].filter(Boolean).join(' ');
};

const enteroEnLetras = (n) => {
  if (n === 0) return 'cero';
  const miles = Math.floor(n / 1000);
  // Antes de "mil" se dice "un", no "uno": veintiún mil, treinta y un mil
  const textoMiles = miles === 0
    ? ''
    : miles === 1
      ? 'mil'
      : `${menorDeMil(miles).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')} mil`;
  return [textoMiles, menorDeMil(n % 1000)].filter(Boolean).join(' ');
};

// 150 -> "Ciento cincuenta y 00/100 soles" (formato del recibo de la academia)
const montoEnLetras = (monto) => {
  const centimos = Math.round(Number(monto) * 100);
  // ponytail: llega hasta 999 999.99; agregar millones si algún cobro lo necesita
  if (!Number.isFinite(centimos) || centimos < 0 || centimos >= 100000000) {
    throw new RangeError(`Monto no válido para el recibo: ${monto}`);
  }
  const letras = enteroEnLetras(Math.floor(centimos / 100));
  const decimales = String(centimos % 100).padStart(2, '0');
  return `${letras.charAt(0).toUpperCase()}${letras.slice(1)} y ${decimales}/100 soles`;
};

module.exports = {
  montoEnLetras
};

// Autoverificación: node src/shared/utils/monto-letras.util.js
if (require.main === module) {
  const assert = require('assert');
  const casos = {
    '150.00': 'Ciento cincuenta y 00/100 soles',
    '0.99': 'Cero y 99/100 soles',
    16: 'Dieciséis y 00/100 soles',
    31: 'Treinta y uno y 00/100 soles',
    100: 'Cien y 00/100 soles',
    101.5: 'Ciento uno y 50/100 soles',
    1000: 'Mil y 00/100 soles',
    2001: 'Dos mil uno y 00/100 soles',
    21000: 'Veintiún mil y 00/100 soles',
    131000: 'Ciento treinta y un mil y 00/100 soles',
    '999999.99': 'Novecientos noventa y nueve mil novecientos noventa y nueve y 99/100 soles'
  };
  for (const [monto, esperado] of Object.entries(casos)) {
    assert.strictEqual(montoEnLetras(monto), esperado);
  }
  assert.throws(() => montoEnLetras('abc'), RangeError);
  assert.throws(() => montoEnLetras(-1), RangeError);
  console.log('montoEnLetras OK');
}
