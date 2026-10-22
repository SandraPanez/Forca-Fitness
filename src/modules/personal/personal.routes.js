const express = require('express');
const personalController = require('./personal.controller');
const { autenticar } = require('../../shared/middleware/auth.middleware');
const { autorizar } = require('../../shared/middleware/permisos.middleware');
const { PERMISOS } = require('../../shared/constants/permisos');

const router = express.Router();

router.get(
  '/',
  autenticar,
  autorizar(PERMISOS.ADMINISTRAR_ACCESOS),
  personalController.listarPersonal
);

module.exports = router;
