require('dotenv').config();
const express = require('express');
const db = require('./src/shared/config/database');

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
  try {
    await db.checkConnection();
    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      message: 'Servidor Forca-Fitness corriendo correctamente'
    });
  } catch (error) {
    console.error('Health check de PostgreSQL fallido:', error);
    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: 'El servidor está activo, pero no puede conectarse a PostgreSQL'
    });
  }
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Servidor iniciado en http://${HOST}:${PORT}`);
});
