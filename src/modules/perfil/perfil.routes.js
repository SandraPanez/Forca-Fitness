const express = require("express");
const router  = express.Router();
const perfilController = require("./perfil.controller");
const { autenticar } = require("../../shared/middleware/auth.middleware");
const { autorizar }  = require("../../shared/middleware/permisos.middleware");
const { PERMISOS }   = require("../../shared/constants/permisos");

router.get("/",  autenticar, autorizar(PERMISOS.VER_PROPIO_PERFIL),   perfilController.obtenerPerfil);
router.put("/",  autenticar, autorizar(PERMISOS.EDITAR_PROPIO_PERFIL), perfilController.actualizarPerfil);

module.exports = router;