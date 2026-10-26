const express = require('express');
const router = express.Router();
const matriculasController = require('./matriculas.controller');
const { autenticar } = require('../../shared/middleware/auth.middleware');
const { autorizar } = require('../../shared/middleware/permisos.middleware');
const { PERMISOS } = require('../../shared/constants/permisos');

// GET /api/matriculas/disciplinas - Obtener lista de disciplinas (T_04)
router.get('/disciplinas', matriculasController.getDisciplinas);

// GET /api/matriculas/disciplinas/:id/horarios - Obtener horarios por disciplina (T_03)
router.get('/disciplinas/:id/horarios', matriculasController.getHorariosPorDisciplina);

// GET /api/matriculas/validar-reserva - Validar tope de 4 cupos y ventana de 2 meses (PSW-199)
router.get('/validar-reserva', matriculasController.validarReserva);

router.get(
  '/mis-matriculas',
  autenticar,
  autorizar(PERMISOS.VER_PROPIA_MATRICULA),
  matriculasController.getMisMatriculas
);

// POST /api/matriculas - Guardar los datos de matrícula en la BD (T_08)
router.post('/', matriculasController.registrarMatricula);

// POST /api/matriculas/reservar - Crear reserva de cupo para alumno autenticado (PSW-202)
router.post('/reservar', autenticar, matriculasController.crearReserva);

router.post(
  '/mis-matriculas/:idDetalle/renovar',
  autenticar,
  autorizar(PERMISOS.REGISTRAR_MATRICULA),
  matriculasController.renovarMatricula
);

module.exports = router;
