// HU-26: endpoints del Director para precios y promociones de disciplinas.
const db = require('../../shared/config/database');
const repository = require('./disciplinas-precios.repository');
const { crearServicioPreciosDisciplinas } = require('./disciplinas-precios.service');
const { successResponse, errorResponse } = require('../../shared/utils/response.util');

function crearControladorPreciosDisciplinas(servicio) {
  function responderError(res, error, contexto) {
    if (error.status && error.status < 500) {
      return errorResponse(res, error.status, error.message, error.errores || null);
    }
    console.error(`Error en ${contexto}:`, error);
    return errorResponse(res, 500, 'Error interno al gestionar el precio de la disciplina');
  }

  return {
    async listarPrecios(req, res) {
      try {
        const data = await servicio.listarPrecios();
        return successResponse(res, 200, data, 'Precios obtenidos correctamente');
      } catch (error) {
        return responderError(res, error, 'listarPrecios');
      }
    },

    async obtenerPrecio(req, res) {
      try {
        const data = await servicio.obtenerPrecio(req.params.id);
        return successResponse(res, 200, data, 'Precio obtenido correctamente');
      } catch (error) {
        return responderError(res, error, 'obtenerPrecio');
      }
    },

    async actualizarPrecio(req, res) {
      try {
        const data = await servicio.actualizarPrecio(req.params.id, req.body || {});
        return successResponse(res, 200, data, 'Precio actualizado con éxito');
      } catch (error) {
        return responderError(res, error, 'actualizarPrecio');
      }
    }
  };
}

module.exports = crearControladorPreciosDisciplinas(
  crearServicioPreciosDisciplinas({ repository, database: db })
);
module.exports.crearControladorPreciosDisciplinas = crearControladorPreciosDisciplinas;
