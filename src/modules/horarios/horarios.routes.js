const express = require('express');

const horariosController = require('./horarios.controller');

const { autenticar } = require('../../shared/middleware/auth.middleware');
const { autorizar } = require('../../shared/middleware/permisos.middleware');
const { PERMISOS } = require('../../shared/constants/permisos');

const router = express.Router();

// Solo el Director puede gestionar horarios.
router.use(
  autenticar,
  autorizar(PERMISOS.MODIFICAR_HORARIOS)
);

// GET /api/horarios
// Consultar las clases y sus horarios.
router.get(
  '/',
  horariosController.listarClases
);

// POST /api/horarios/:idDiscHorario/previsualizar
// Validar una propuesta sin modificar PostgreSQL.
router.post(
  '/:idDiscHorario/previsualizar',
  horariosController.previsualizarCambio
);

// PUT /api/horarios/:idDiscHorario/confirmar
// Confirmar y guardar una modificacion de horario.
router.put(
  '/:idDiscHorario/confirmar',
  horariosController.confirmarCambio
);

module.exports = router;