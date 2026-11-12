const perfilService = require("./perfil.service");

async function obtenerPerfil(req, res) {
  try {
    const datos = await perfilService.obtenerPerfil(req.user.id);
    res.json({ success: true, data: datos });
  } catch (error) {
    console.error("Error al obtener perfil:", error);
    res.status(404).json({ success: false, message: error.message });
  }
}

async function actualizarPerfil(req, res) {
  try {
    const resultado = await perfilService.actualizarPerfil(req.user.id, req.body);
    res.json({ success: true, message: resultado.mensaje });
  } catch (error) {
    console.error("Error al actualizar perfil:", error);
    res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = { obtenerPerfil, actualizarPerfil };