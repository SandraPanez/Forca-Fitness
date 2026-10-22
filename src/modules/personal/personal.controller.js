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

module.exports = {
  listarPersonal
};
