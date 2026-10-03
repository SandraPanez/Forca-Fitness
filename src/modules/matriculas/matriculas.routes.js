const express = require('express');
const router = express.Router();
const matriculasController = require('./matriculas.controller');

// GET /api/matriculas/disciplinas - Obtener lista de disciplinas (T_04)
router.get('/disciplinas', matriculasController.getDisciplinas);

// GET /api/matriculas/disciplinas/:id/horarios - Obtener horarios por disciplina (T_03)
router.get('/disciplinas/:id/horarios', matriculasController.getHorariosPorDisciplina);

// POST /api/matriculas - Guardar los datos de matrícula en la BD (T_08)
router.post('/', matriculasController.registrarMatricula);

module.exports = router;
