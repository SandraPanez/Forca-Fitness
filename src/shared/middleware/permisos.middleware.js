const { tienePermiso } = require('../constants/permisos');
const permisosRepository = require('../repositories/permisos.repository');

function autorizar(permiso) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Usuario no autenticado'
      });
    }

    try {
      const sobrescritura = await permisosRepository.obtenerSobrescritura(
        req.user.id,
        permiso
      );
      const autorizado = sobrescritura === null
        ? tienePermiso(req.user.roles, permiso)
        : sobrescritura;

      if (!autorizado) {
        return res.status(403).json({
          message: 'No tiene permisos para realizar esta acción'
        });
      }

      return next();
    } catch (error) {
      console.error('Error al verificar permisos de acceso:', error);
      return res.status(500).json({
        message: 'No se pudieron verificar los permisos de acceso'
      });
    }
  };
}

function autorizarRol(rolesPermitidos) {
  const permitidos = (Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos])
    .map(r => String(r).toUpperCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Usuario no autenticado'
      });
    }

    const tieneRol = (req.user.roles || []).some(rol => permitidos.includes(String(rol).toUpperCase()));
    if (!tieneRol) {
      return res.status(403).json({
        message: 'Acceso restringido: requiere rol de Tesorero'
      });
    }

    return next();
  };
}

module.exports = {
  autorizar,
  autorizarRol
};