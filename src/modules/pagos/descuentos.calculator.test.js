const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calcularDescuento } = require('../../../public/js/descuentos');

describe('Cálculo de descuentos', () => {
  it('calcula un descuento porcentual y el total con precisión de céntimos', () => {
    assert.deepEqual(calcularDescuento({
      precioOriginal: 120,
      tipo: 'PORCENTAJE',
      valor: 20
    }), {
      tipo: 'PORCENTAJE',
      valor: 20,
      precioOriginal: 120,
      descuento: 24,
      montoFinal: 96
    });
  });

  it('redondea medio céntimo al céntimo más cercano', () => {
    const resultado = calcularDescuento({
      precioOriginal: 0.2,
      tipo: 'PORCENTAJE',
      valor: 2.5
    });

    assert.equal(resultado.descuento, 0.01);
    assert.equal(resultado.montoFinal, 0.19);
  });

  it('calcula un descuento fijo sin errores de coma flotante', () => {
    const resultado = calcularDescuento({
      precioOriginal: 180.1,
      tipo: 'MONTO_FIJO',
      valor: 30.05
    });

    assert.equal(resultado.descuento, 30.05);
    assert.equal(resultado.montoFinal, 150.05);
  });

  it('permite descontar el 100% y obtener un total de cero', () => {
    const resultado = calcularDescuento({
      precioOriginal: 42.37,
      tipo: 'PORCENTAJE',
      valor: 100
    });

    assert.equal(resultado.descuento, 42.37);
    assert.equal(resultado.montoFinal, 0);
  });

  it('permite un monto fijo igual al precio original', () => {
    const resultado = calcularDescuento({
      precioOriginal: 42.37,
      tipo: 'MONTO_FIJO',
      valor: 42.37
    });

    assert.equal(resultado.montoFinal, 0);
  });

  it('rechaza tipos de descuento desconocidos', () => {
    assert.throws(() => calcularDescuento({
      precioOriginal: 120,
      tipo: 'AUMENTO',
      valor: 10
    }), /tipo de descuento válido/);
  });

  it('rechaza precios originales que no sean positivos', () => {
    for (const precioOriginal of [0, -1, 'no es un precio']) {
      assert.throws(() => calcularDescuento({
        precioOriginal,
        tipo: 'PORCENTAJE',
        valor: 10
      }));
    }
  });

  it('rechaza descuentos no positivos, no numéricos o con más de dos decimales', () => {
    for (const valor of [0, -1, 'invalido', 1.001]) {
      assert.throws(() => calcularDescuento({
        precioOriginal: 120,
        tipo: 'MONTO_FIJO',
        valor
      }));
    }
  });

  it('rechaza porcentajes mayores al 100%', () => {
    assert.throws(() => calcularDescuento({
      precioOriginal: 120,
      tipo: 'PORCENTAJE',
      valor: 100.01
    }), /no superar el 100%/);
  });

  it('rechaza montos fijos mayores al precio original', () => {
    assert.throws(() => calcularDescuento({
      precioOriginal: 120,
      tipo: 'MONTO_FIJO',
      valor: 120.01
    }), /no puede superar/);
  });
});
