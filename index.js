require('dotenv').config();
const express = require('express');
const db = require('./src/shared/config/database');
const redis = require('./src/shared/config/redis');

const path = require('path');
const app = express();

// Middlewares globales
app.use(express.json()); // Para parsear el body en formato JSON
app.use(express.static(path.join(__dirname, 'public'))); // Servir archivos estáticos del frontend

// Registrar módulos (Rutas)
const {
  matriculasRoutes,
  alumnosRoutes
} = require('./src/modules');

app.use('/api/matriculas', matriculasRoutes);
app.use('/api/alumnos', alumnosRoutes);

// Ruta de prueba
app.get('/api/health', async (req, res) => {
  const services = { database: 'disconnected', redis: 'disconnected' };

  try {
    await db.checkConnection();
    services.database = 'connected';
  } catch (error) {
    console.error('Health check de PostgreSQL fallido:', error);
  }

  try {
    await redis.checkConnection();
    services.redis = 'connected';
  } catch (error) {
    console.error('Health check de Redis fallido:', error);
  }

  const isHealthy = services.database === 'connected' && services.redis === 'connected';
  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'error',
    ...services,
    message: isHealthy
      ? 'Servidor Forca-Fitness corriendo correctamente'
      : 'El servidor está activo, pero uno o más servicios no están disponibles'
  });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Servidor iniciado en http://${HOST}:${PORT}`);
});
