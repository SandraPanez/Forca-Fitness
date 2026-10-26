const express = require('express');
const router = express.Router();
const pagosController = require('./pagos.controller');
const { autenticar } = require('../../shared/middleware/auth.middleware');
const { autorizar } = require('../../shared/middleware/permisos.middleware');
const { PERMISOS } = require('../../shared/constants/permisos');

// GET /api/pagos/verificar/:matricula - Verificar estado de pago de una matrícula
router.get('/verificar/:matricula', pagosController.verificarEstadoMatricula);
// La cuenta de un alumno nuevo sigue inactiva hasta verificar el pago en la API.
router.post('/sincronizar/:matricula', pagosController.sincronizarPago);

// POST /api/pagos/crear-preferencia - Crear preferencia de pago
router.post('/crear-preferencia', pagosController.crearPreferencia);
router.post('/efectivo', pagosController.registrarEfectivo);
router.get(
  '/gestion',
  autenticar,
  autorizar(PERMISOS.GESTIONAR_PAGOS),
  pagosController.listarCobros
);
router.get(
  '/efectivo/pendientes',
  autenticar,
  autorizar(PERMISOS.GESTIONAR_PAGOS),
  pagosController.listarEfectivoPendientes
);
router.post(
  '/efectivo/confirmar',
  autenticar,
  autorizar(PERMISOS.GESTIONAR_PAGOS),
  pagosController.confirmarEfectivo
);

// GET /api/pagos/success - URL de retorno exitoso
router.get(['/success', '/failure', '/pending'], pagosController.pagoExitoso);

// POST /api/pagos/webhook - Notificaciones de Mercado Pago
router.post('/webhook', pagosController.webhook);

module.exports = router;
