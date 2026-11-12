const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const pagosController = require('./pagos.controller');
const pagosService = require('./pagos.service');
const pagosRepository = require('./pagos.repository');
const db = require('../../shared/config/database');

function crearResponse() {
  return {
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

describe('Confirmación de cobro con descuento', () => {
  it('solo permite solicitar descuentos al Director', async () => {
    const confirmarOriginal = pagosService.confirmarEfectivo;
    pagosService.confirmarEfectivo = async () => {
      assert.fail('No debe ejecutar el servicio para un rol no autorizado');
    };

    try {
      const response = crearResponse();
      await pagosController.confirmarEfectivo({
        body: {
          id_matricula: 'MAT-001',
          descuento: { tipo: 'PORCENTAJE', valor: 10 }
        },
        user: { id: 'USR-001', roles: ['TESORERO'] }
      }, response);

      assert.equal(response.statusCode, 403);
      assert.equal(response.body.success, false);
    } finally {
      pagosService.confirmarEfectivo = confirmarOriginal;
    }
  });

  it('rechaza descuentos mal formados antes de confirmar el pago', async () => {
    const confirmarOriginal = pagosService.confirmarEfectivo;
    pagosService.confirmarEfectivo = async () => {
      assert.fail('No debe ejecutar el servicio para un descuento mal formado');
    };

    try {
      const response = crearResponse();
      await pagosController.confirmarEfectivo({
        body: {
          id_matricula: 'MAT-001',
          descuento: { tipo: 'PORCENTAJE' }
        },
        user: { id: 'USR-001', roles: ['DIRECTOR'] }
      }, response);

      assert.equal(response.statusCode, 400);
      assert.equal(response.body.success, false);
    } finally {
      pagosService.confirmarEfectivo = confirmarOriginal;
    }
  });

  it('envía al servicio el descuento autorizado y responde con el mensaje esperado', async () => {
    const confirmarOriginal = pagosService.confirmarEfectivo;
    const descuento = { tipo: 'MONTO_FIJO', valor: 15 };
    let argumentos;
    pagosService.confirmarEfectivo = async (...args) => {
      argumentos = args;
      return {
        Id_Pago: 'PAG-001',
        Monto_Original: 120,
        Monto_Descuento: 15,
        Monto_Cobrado: 105,
        estadoMatricula: 'Activa'
      };
    };

    try {
      const response = crearResponse();
      await pagosController.confirmarEfectivo({
        body: {
          id_matricula: 'MAT-001',
          referencia_operacion: 'REC-001',
          descuento
        },
        user: { id: 'USR-DIR', roles: ['DIRECTOR'] }
      }, response);

      assert.deepEqual(argumentos, ['MAT-001', 'REC-001', 'USR-DIR', descuento]);
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.message, 'Descuento aplicado correctamente.');
      assert.equal(response.body.data.Monto_Cobrado, 105);
    } finally {
      pagosService.confirmarEfectivo = confirmarOriginal;
    }
  });

  it('no convierte un fallo de persistencia del descuento en una confirmación simulada', async () => {
    const confirmarOriginal = pagosRepository.confirmarPagoEfectivo;
    pagosRepository.confirmarPagoEfectivo = async () => {
      throw new Error('No se pudo guardar el descuento');
    };

    try {
      await assert.rejects(
        pagosService.confirmarEfectivo(
          'MAT-001',
          null,
          'USR-DIR',
          { tipo: 'PORCENTAJE', valor: 10 }
        ),
        /No se pudo guardar el descuento/
      );
    } finally {
      pagosRepository.confirmarPagoEfectivo = confirmarOriginal;
    }
  });

  it('registra el importe descontado en la misma transacción y conserva el precio original', async () => {
    const connectOriginal = db.pool.connect;
    const futuroOriginal = pagosRepository.esMatriculaPeriodoFuturo;
    const actualizarOriginal = pagosRepository.actualizarEstadoMatricula;
    const activarOriginal = pagosRepository.activarUsuarioPorMatricula;
    let parametrosRegistro;
    let consultaActualizacion;

    db.pool.connect = async () => ({
      async query(sql, params = []) {
        const consulta = sql.replace(/\s+/g, ' ').trim();
        if (consulta === 'BEGIN' || consulta === 'COMMIT' || consulta === 'ROLLBACK') {
          return { rows: [] };
        }
        if (consulta.startsWith('SELECT p."Id_Pago", p."Monto"')) {
          return { rows: [{ Id_Pago: 'PAG-001', Monto: '120.00' }] };
        }
        if (consulta.startsWith('UPDATE "Academia Forca&Fitness"."Pago"')) {
          consultaActualizacion = consulta;
          return { rows: [{ Id_Pago: 'PAG-001', Monto: '120.00' }] };
        }
        if (consulta.startsWith('INSERT INTO "Academia Forca&Fitness"."Registro_Cobro"')) {
          parametrosRegistro = params;
          return { rows: [] };
        }
        throw new Error(`Consulta no esperada en prueba: ${consulta}`);
      },
      release() {}
    });
    pagosRepository.esMatriculaPeriodoFuturo = async () => false;
    pagosRepository.actualizarEstadoMatricula = async () => {};
    pagosRepository.activarUsuarioPorMatricula = async () => {};

    try {
      const resultado = await pagosRepository.confirmarPagoEfectivo(
        'MAT-001',
        'USR-DIR',
        'REC-001',
        { tipo: 'PORCENTAJE', valor: 20 }
      );

      assert.equal(resultado.Monto_Original, 120);
      assert.equal(resultado.Monto_Descuento, 24);
      assert.equal(resultado.Monto_Cobrado, 96);
      assert.equal(parametrosRegistro[1], 96);
      assert.equal(parametrosRegistro[4], 120);
      assert.equal(parametrosRegistro[5], 'PORCENTAJE');
      assert.equal(parametrosRegistro[6], 20);
      assert.equal(parametrosRegistro[7], 24);
      assert.match(consultaActualizacion, /SET "Estado_Pago" = 'APROBADO'/);
      assert.doesNotMatch(consultaActualizacion, /SET[^]*"Monto"\s*=/);
    } finally {
      db.pool.connect = connectOriginal;
      pagosRepository.esMatriculaPeriodoFuturo = futuroOriginal;
      pagosRepository.actualizarEstadoMatricula = actualizarOriginal;
      pagosRepository.activarUsuarioPorMatricula = activarOriginal;
    }
  });
});
