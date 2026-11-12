const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const comprobantesRepository = require('./comprobantes.repository');
const comprobantesService = require('./comprobantes.service');
const { generarReciboPdf } = require('./comprobantes.pdf');

describe('Comprobantes con descuentos', () => {
  it('muestra el precio original, el descuento y el total realmente cobrado', async () => {
    const buscarOriginal = comprobantesRepository.buscarPorPago;
    comprobantesRepository.buscarPorPago = async () => ({
      id_pago: 'PAG-001',
      estado_pago: 'APROBADO',
      monto: '120.00',
      monto_cobrado: '96.00',
      monto_original: '120.00',
      tipo_descuento: 'PORCENTAJE',
      valor_descuento: '20.00',
      monto_descuento: '24.00',
      metodo_pago: 'EFECTIVO',
      referencia: 'REC-001',
      fecha_emision: '2026-11-11T12:00:00.000Z',
      alumno: 'Alumno de prueba',
      documento: '12345678',
      correo_electronico: 'alumno@example.com',
      disciplinas: 'Box',
      periodo: '01/11-30/11',
      correlativo: 1
    });

    try {
      const comprobante = await comprobantesService.obtenerComprobante('PAG-001');

      assert.equal(comprobante.monto_original, 120);
      assert.equal(comprobante.tipo_descuento, 'PORCENTAJE');
      assert.equal(comprobante.valor_descuento, 20);
      assert.equal(comprobante.monto_descuento, 24);
      assert.equal(comprobante.total, 'S/ 96.00');
      assert.equal(comprobante.recibo.monto_original, 'S/ 120.00');
      assert.equal(comprobante.recibo.detalle_descuento, 'Descuento (20%): - S/ 24.00');
      assert.equal(comprobante.recibo.total_pagado, 'S/ 96.00');

      const pdf = generarReciboPdf(comprobante.recibo);
      const chunks = [];
      pdf.on('data', chunk => chunks.push(chunk));
      const contenidoPdf = await new Promise((resolve, reject) => {
        pdf.on('end', () => resolve(Buffer.concat(chunks)));
        pdf.on('error', reject);
      });

      assert.equal(contenidoPdf.subarray(0, 5).toString(), '%PDF-');
      assert.ok(contenidoPdf.length > 1000);
    } finally {
      comprobantesRepository.buscarPorPago = buscarOriginal;
    }
  });

  it('mantiene el formato y total de comprobantes sin descuento', async () => {
    const buscarOriginal = comprobantesRepository.buscarPorPago;
    comprobantesRepository.buscarPorPago = async () => ({
      id_pago: 'PAG-002',
      estado_pago: 'APROBADO',
      monto: '75.00',
      monto_cobrado: '75.00',
      monto_original: '75.00',
      tipo_descuento: null,
      valor_descuento: null,
      monto_descuento: '0.00',
      metodo_pago: 'EFECTIVO',
      referencia: 'REC-002',
      fecha_emision: '2026-11-11T12:00:00.000Z',
      alumno: 'Alumno sin descuento',
      documento: '87654321',
      correo_electronico: 'alumno@example.com',
      disciplinas: 'Box',
      periodo: '01/11-30/11',
      correlativo: 2
    });

    try {
      const comprobante = await comprobantesService.obtenerComprobante('PAG-002');

      assert.equal(comprobante.total, 'S/ 75.00');
      assert.equal(comprobante.monto_descuento, 0);
      assert.equal(comprobante.recibo.monto_original, null);
      assert.equal(comprobante.recibo.detalle_descuento, null);
      assert.equal(comprobante.recibo.total_pagado, 'S/ 75.00');
    } finally {
      comprobantesRepository.buscarPorPago = buscarOriginal;
    }
  });
});
