const express = require('express');
const router = express.Router();
const alumnosController = require('./alumnos.controller');

// GET /api/alumnos - Listar alumnos
router.get('/', alumnosController.listarAlumnos);

// GET /api/alumnos/:id - Detalle de un alumno
router.get('/:id', alumnosController.obtenerDetalleAlumno);

module.exports = router;
