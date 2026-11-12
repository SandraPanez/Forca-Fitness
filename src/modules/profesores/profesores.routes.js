const express = require('express');
const profesoresController = require('./profesores.controller');
const { autenticar } = require('../../shared/middleware/auth.middleware');
const { autorizar } = require('../../shared/middleware/permisos.middleware');
const { PERMISOS } = require('../../shared/constants/permisos');

const router = express.Router();
const autenticarProfesor = [
  autenticar,
  autorizar(PERMISOS.VER_ALUMNOS_DISCIPLINAS)
];

router.get('/me', autenticarProfesor, profesoresController.obtenerPerfil);
router.get('/me/alumnos', autenticarProfesor, profesoresController.listarAlumnos);
router.get(
  '/me/alumnos/:id',
  autenticarProfesor,
  profesoresController.obtenerDetalleAlumno
);

module.exports = router;
