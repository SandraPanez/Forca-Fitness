const express = require('express');
const router = express.Router();
const pagosController = require('./pagos.controller');
const { autenticar } = require('../../shared/middleware/auth.middleware');
const { autorizar } = require('../../shared/middleware/permisos.middleware');
const { PERMISOS } = require('../../shared/constants/permisos');

// POST /api/pagos/crear-preferencia - Crear preferencia de pago
router.post('/crear-preferencia', pagosController.crearPreferencia);
router.post('/efectivo', pagosController.registrarEfectivo);
router.get(
  '/gestion',
  autenticar,
  autorizar(PERMISOS.GESTIONAR_PAGOS),
  pagosController.listarCobros
);
router.post(
  '/efectivo/confirmar',
  autenticar,
  autorizar(PERMISOS.GESTIONAR_PAGOS),
  pagosController.confirmarEfectivo
);

// GET /api/pagos/success - URL de retorno exitoso
router.get('/success', pagosController.pagoExitoso);

// GET /api/pagos/failure - URL de retorno fallido
router.get('/failure', pagosController.pagoFallido);

// GET /api/pagos/pending - URL de retorno pendiente
router.get('/pending', pagosController.pagoPendiente);

// POST /api/pagos/webhook - Notificaciones de Mercado Pago
router.post('/webhook', pagosController.webhook);

module.exports = router;