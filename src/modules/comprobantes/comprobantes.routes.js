const express = require('express');
const comprobantesController = require('./comprobantes.controller');
const { autenticar } = require('../../shared/middleware/auth.middleware');
const { autorizar } = require('../../shared/middleware/permisos.middleware');
const { PERMISOS } = require('../../shared/constants/permisos');

const router = express.Router();

// Solo quienes gestionan pagos (Tesorero y Director)
router.use(autenticar, autorizar(PERMISOS.GESTIONAR_PAGOS));

// GET /api/comprobantes/:idPago - Comprobante de un pago aprobado
router.get('/:idPago', comprobantesController.obtener);

module.exports = router;
