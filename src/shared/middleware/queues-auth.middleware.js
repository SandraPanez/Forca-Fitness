const { autenticar } = require('./auth.middleware');

const AUTH_COOKIE_NAME = 'forca_auth_token';

function obtenerCookie(req, nombre) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split('=');

    if (key === nombre) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}

function autenticarDashboard(req, res, next) {
  const token = obtenerCookie(req, AUTH_COOKIE_NAME);

  if (token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${token}`;
  }

  return autenticar(req, res, next);
}

module.exports = {
  autenticarDashboard
};
