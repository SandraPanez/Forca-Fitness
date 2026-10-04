const express = require('express');
const router = express.Router();
const pagosController = require('./pagos.controller');

// POST /api/pagos/crear-preferencia - Crear preferencia de pago
router.post('/crear-preferencia', pagosController.crearPreferencia);
router.post('/efectivo', pagosController.registrarEfectivo);

// GET /api/pagos/success - URL de retorno exitoso
router.get('/success', pagosController.pagoExitoso);

// GET /api/pagos/failure - URL de retorno fallido
router.get('/failure', pagosController.pagoFallido);

// GET /api/pagos/pending - URL de retorno pendiente
router.get('/pending', pagosController.pagoPendiente);

// POST /api/pagos/webhook - Notificaciones de Mercado Pago
router.post('/webhook', pagosController.webhook);

module.exports = router;