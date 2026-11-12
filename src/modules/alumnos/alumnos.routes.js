const express = require("express");
const router = express.Router();
const alumnosController = require("./alumnos.controller");
const { autenticar } = require("../../shared/middleware/auth.middleware");
const { autorizar } = require("../../shared/middleware/permisos.middleware");
const { PERMISOS } = require("../../shared/constants/permisos");

router.get("/", 
  autenticar,
  autorizar(PERMISOS.VER_TODOS_ALUMNOS),
  alumnosController.listarAlumnos
);

router.get("/:id", 
  autenticar,
  autorizar(PERMISOS.VER_TODOS_ALUMNOS),
  alumnosController.obtenerDetalleAlumno
);

router.get("/:id/historial-matriculas",
  autenticar,
  autorizar(PERMISOS.VER_HISTORIAL_MATRICULAS),
  alumnosController.obtenerHistorialMatriculas
);

router.patch("/:id/inhabilitar",
  autenticar,
  autorizar(PERMISOS.INHABILITAR_ALUMNO),
  alumnosController.inhabilitarAlumno
);

router.put("/:id/inhabilitar",
  autenticar,
  autorizar(PERMISOS.INHABILITAR_ALUMNO),
  alumnosController.inhabilitarAlumno
);

module.exports = router;