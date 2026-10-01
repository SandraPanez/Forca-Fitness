const express = require('express');
const router = express.Router();

const alumnosController = require('./alumnos.controller');
const { autenticar } = require('../../shared/middleware/auth.middleware');
const { autorizar } = require('../../shared/middleware/permisos.middleware');
const { PERMISOS } = require('../../shared/constants/permisos');

// GET /api/alumnos - Listar todos los alumnos
router.get(
  '/',
  autenticar,
  autorizar(PERMISOS.VER_TODOS_ALUMNOS),
  alumnosController.listarAlumnos
);

// GET /api/alumnos/:id - Detalle de un alumno
router.get(
  '/:id',
  autenticar,
  autorizar(PERMISOS.VER_TODOS_ALUMNOS),
  alumnosController.obtenerDetalleAlumno
);

module.exports = router;