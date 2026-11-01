const personalService = require('./personal.service');
const ROLES = require('../../shared/constants/roles');

async function inactivarPersonal(req, res) {
  if (!req.user.roles.includes(ROLES.DIRECTOR)) {
    return res.status(403).json({ success: false, message: 'Solo el director puede dar de baja al personal.' });
  }
  try {
    const resultado = await personalService.inactivarPersonal(req.params.id, req.user.id);
    return res.status(200).json({ success: true, message: 'Acceso retirado', data: resultado });
  } catch (error) {
    if ([400, 403, 404].includes(error.status)) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error al inactivar la cuenta del trabajador:', error);
    return res.status(500).json({ success: false, message: 'No se pudo inactivar la cuenta del trabajador.' });
  }
}

async function crearPersonal(req, res) {
  if (!req.user.roles.includes(ROLES.DIRECTOR)) {
    return res.status(403).json({ success: false, message: 'Solo el director puede registrar personal.' });
  }
  try {
    const resultado = await personalService.crearPersonal(req.body);
    return res.status(201).json({ success: true, message: 'Trabajador registrado', data: resultado });
  } catch (error) {
    if (error.status === 400 || error.status === 409) {
      return res.status(error.status).json({ success: false, message: error.message, campo: error.campo });
    }
    console.error('Error al crear la cuenta del trabajador:', error);
    return res.status(500).json({ success: false, message: 'No se pudo crear la cuenta del trabajador.' });
  }
}

async function validarRegistro(req, res) {
  if (!req.user.roles.includes(ROLES.DIRECTOR)) {
    return res.status(403).json({
      success: false,
      message: 'Solo el director puede registrar personal.'
    });
  }

  try {
    await personalService.validarRegistro(req.body);
    return res.status(200).json({ success: true, message: 'Los datos son válidos.' });
  } catch (error) {
    if (error.status === 400 || error.status === 409) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        campo: error.campo
      });
    }

    console.error('Error al validar el registro de personal:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudieron validar los datos. Inténtalo nuevamente.'
    });
  }
}

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

async function actualizarAccesos(req, res) {
  try {
    const resultado = await personalService.actualizarAccesos(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: resultado.mensaje
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error('Error al actualizar roles y permisos del trabajador:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al guardar los roles y permisos del trabajador'
    });
  }
}

module.exports = {
  inactivarPersonal,
  crearPersonal,
  validarRegistro,
  listarPersonal,
  obtenerDetalle,
  actualizarAccesos
};
