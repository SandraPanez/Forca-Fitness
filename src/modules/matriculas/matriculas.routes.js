const express = require('express');
const router = express.Router();
const matriculasController = require('./matriculas.controller');

const { autenticar } = require('../../shared/middleware/auth.middleware');
const { autorizar } = require('../../shared/middleware/permisos.middleware');
const { PERMISOS } = require('../../shared/constants/permisos');

// GET /api/matriculas/disciplinas
router.get('/disciplinas', matriculasController.getDisciplinas);

// POST /api/matriculas - Registrar matrícula
router.post(
  '/',
  autenticar,
  autorizar(PERMISOS.REGISTRAR_MATRICULA),
  matriculasController.registrarMatricula
);

module.exports = router;