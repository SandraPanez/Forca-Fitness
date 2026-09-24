const express = require("express");
const router = express.Router();
const alumnosController = require("./alumnos.controller");

router.get("/", alumnosController.listarAlumnos);
router.get("/:id", alumnosController.obtenerDetalleAlumno);

module.exports = router;
