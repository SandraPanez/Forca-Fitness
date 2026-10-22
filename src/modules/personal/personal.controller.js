const personalService = require('./personal.service');

async function listarPersonal(req, res) {
  try {
    const personal = await personalService.listarPersonal();

    return res.status(200).json({
      success: true,
      data: personal
    });
  } catch (error) {
    console.error('Error al listar el personal operativo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener el personal registrado'
    });
  }
}

async function obtenerDetalle(req, res) {
  try {
    const persona = await personalService.obtenerDetalle(req.params.id);

    if (!persona) {
      return res.status(404).json({
        success: false,
        message: 'Trabajador no encontrado en el personal operativo'
      });
    }

    return res.status(200).json({
      success: true,
      data: persona
    });
  } catch (error) {
    console.error('Error al obtener el detalle del trabajador:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener la información del trabajador'
    });
  }
}

module.exports = {
  listarPersonal,
  obtenerDetalle
};
