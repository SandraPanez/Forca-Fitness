
const express = require('express');
const router = express.Router();

const pagosController = require('./pagos.controller');

const {
  autenticar
} = require('../../shared/middleware/auth.middleware');

const {
  autorizar,
  autorizarRol
} = require('../../shared/middleware/permisos.middleware');

const {
  PERMISOS
} = require('../../shared/constants/permisos');

const ROLES = require('../../shared/constants/roles');

// =========================================================
// VERIFICACION Y SINCRONIZACION DE PAGOS
// =========================================================

// GET /api/pagos/verificar/:matricula
router.get(
  '/verificar/:matricula',
  pagosController.verificarEstadoMatricula
);

// POST /api/pagos/sincronizar/:matricula
router.post(
  '/sincronizar/:matricula',
  pagosController.sincronizarPago
);

// =========================================================
// REGISTRO DE PAGOS
// =========================================================

// POST /api/pagos/crear-preferencia
router.post(
  '/crear-preferencia',
  pagosController.crearPreferencia
);

// POST /api/pagos/efectivo
router.post(
  '/efectivo',
  pagosController.registrarEfectivo
);

// =========================================================
// GESTION DE COBROS
// =========================================================

router.get(
  '/gestion',
  autenticar,
  autorizar(PERMISOS.GESTIONAR_PAGOS),
  pagosController.listarCobros
);

router.get(
  '/por-alumno',
  autenticar,
  autorizar(PERMISOS.GESTIONAR_PAGOS),
  pagosController.listarCobrosPorAlumno
);

// =========================================================
// BALANCE FINANCIERO
// =========================================================

// Consultar balance general
router.get(
  '/balance',
  autenticar,
  autorizarRol(ROLES.TESORERO),
  autorizar(PERMISOS.CONSULTAR_BALANCE),
  pagosController.obtenerBalanceFinanciero
);

// Consultar detalle de una operacion financiera
router.get(
  '/balance/:idPago',
  autenticar,
  autorizarRol(ROLES.TESORERO),
  autorizar(PERMISOS.CONSULTAR_BALANCE),
  pagosController.obtenerDetalleOperacionBalance
);

// Bloquear modificaciones desde el balance financiero
router.all(
  ['/balance', '/balance/:idPago'],
  autenticar,
  autorizarRol(ROLES.TESORERO),
  autorizar(PERMISOS.CONSULTAR_BALANCE),
  pagosController.restringirMutacionBalance
);

// =========================================================
// PAGOS EN EFECTIVO
// =========================================================

// Consultar pagos pendientes de confirmacion
router.get(
  '/efectivo/pendientes',
  autenticar,
  autorizar(PERMISOS.GESTIONAR_PAGOS),
  pagosController.listarEfectivoPendientes
);

// Confirmar pago en efectivo
router.post(
  '/efectivo/confirmar',
  autenticar,
  autorizar(PERMISOS.GESTIONAR_PAGOS),
  pagosController.confirmarEfectivo
);

// =========================================================
// RETORNOS DE MERCADO PAGO
// =========================================================

// Los tres retornos utilizan el controlador que verifica
// el resultado del pago y redirige a pagos.html.
router.get(
  ['/success', '/failure', '/pending'],
  pagosController.pagoExitoso
);

// =========================================================
// WEBHOOK DE MERCADO PAGO
// =========================================================

router.post(
  '/webhook',
  pagosController.webhook
);

module.exports = router;
