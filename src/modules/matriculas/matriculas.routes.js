
const express = require('express');
const router = express.Router();

const matriculasController = require('./matriculas.controller');
const disciplinasPreciosController = require('./disciplinas-precios.controller');

const {
  autenticar
} = require('../../shared/middleware/auth.middleware');

const {
  autorizar
} = require('../../shared/middleware/permisos.middleware');

const {
  PERMISOS
} = require('../../shared/constants/permisos');

// =========================================================
// DISCIPLINAS Y HORARIOS
// =========================================================

// GET /api/matriculas/disciplinas
// Obtener lista de disciplinas (T_04)
router.get(
  '/disciplinas',
  matriculasController.getDisciplinas
);

// =========================================================
// PRECIOS Y PROMOCIONES (HU-26) - solo Director
// =========================================================

// GET /api/matriculas/disciplinas/precios
// Precio base y promoción actual de cada disciplina (T1)
router.get(
  '/disciplinas/precios',
  autenticar,
  autorizar(PERMISOS.GESTIONAR_PRECIOS),
  disciplinasPreciosController.listarPrecios
);

// GET /api/matriculas/disciplinas/:id/precio
router.get(
  '/disciplinas/:id/precio',
  autenticar,
  autorizar(PERMISOS.GESTIONAR_PRECIOS),
  disciplinasPreciosController.obtenerPrecio
);

// PUT /api/matriculas/disciplinas/:id/precio
// Guardar precio base y una única promoción para futuras matrículas (T6)
router.put(
  '/disciplinas/:id/precio',
  autenticar,
  autorizar(PERMISOS.GESTIONAR_PRECIOS),
  disciplinasPreciosController.actualizarPrecio
);

// GET /api/matriculas/disciplinas/:id/horarios
// Obtener horarios por disciplina (T_03)
router.get(
  '/disciplinas/:id/horarios',
  matriculasController.getHorariosPorDisciplina
);

// =========================================================
// RESERVAS
// =========================================================

// GET /api/matriculas/validar-reserva
// Validar tope de 4 cupos y ventana de 2 meses (PSW-199)
router.get(
  '/validar-reserva',
  matriculasController.validarReserva
);

// POST /api/matriculas/reservar
// Crear reserva de cupo para alumno autenticado (PSW-202)
// Funcionalidad conservada de develop
router.post(
  '/reservar',
  autenticar,
  matriculasController.crearReserva
);

// GET /api/matriculas/mis-reservas
// Consultar reservas del alumno autenticado (HU-10)
router.get(
  '/mis-reservas',
  autenticar,
  autorizar(PERMISOS.VER_PROPIA_MATRICULA),
  matriculasController.getMisReservas
);

// =========================================================
// MATRÍCULAS
// =========================================================

// GET /api/matriculas/mis-matriculas
// Consultar matrículas del alumno autenticado
router.get(
  '/mis-matriculas',
  autenticar,
  autorizar(PERMISOS.VER_PROPIA_MATRICULA),
  matriculasController.getMisMatriculas
);

// POST /api/matriculas
// Registrar matrícula en la base de datos (T_08)
router.post(
  '/',
  matriculasController.registrarMatricula
);

// =========================================================
// RENOVACIONES
// =========================================================

// POST /api/matriculas/mis-matriculas/:idDetalle/renovar
// Preparar renovación de matrícula (HU-08)
// Funcionalidad conservada de main
router.post(
  '/mis-matriculas/:idDetalle/renovar',
  autenticar,
  autorizar(PERMISOS.REGISTRAR_MATRICULA),
  matriculasController.renovarMatricula
);

module.exports = router;
