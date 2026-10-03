const express = require("express");
const router = express.Router();
const alumnosController = require("./alumnos.controller");
const { autenticar } = require("../../shared/middleware/auth.middleware");
const { autorizar } = require("../../shared/middleware/permisos.middleware");
const { PERMISOS } = require("../../shared/constants/permisos");

router.get("/", 
  // autenticar, 
  // autorizar(PERMISOS.VER_TODOS_ALUMNOS),
  alumnosController.listarAlumnos
);

router.get("/:id", 
  // autenticar, 
  // autorizar(PERMISOS.VER_TODOS_ALUMNOS),
  alumnosController.obtenerDetalleAlumno
);

module.exports = router;