require('dotenv').config();

const express = require('express');
const db = require('./src/shared/config/database');
const path = require('path');

const app = express();

app.use(express.json());


// Primera página del sistema = Login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/control-acceso', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'control_acceso.html'));
});

// Registrar módulos (Rutas)
const {
  matriculasRoutes,
  alumnosRoutes,
  authRoutes,
  pagosRoutes
} = require('./src/modules');

app.use('/api/matriculas', matriculasRoutes);
app.use('/api/alumnos', alumnosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/pagos', pagosRoutes);

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

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const EXPIRATION_CHECK_INTERVAL = 5 * 60 * 1000;
const expirationCheck = setInterval(async () => {
  try {
    const expired = await require('./src/modules/pagos/pagos.service')
      .anularSolicitudesEfectivoVencidas();
    if (expired > 0) {
      console.log(`Solicitudes de efectivo anuladas por vencimiento: ${expired}`);
    }
  } catch (error) {
    console.error('Error al anular solicitudes de efectivo vencidas:', error);
  }
}, EXPIRATION_CHECK_INTERVAL);
expirationCheck.unref();

app.listen(PORT, HOST, () => {
  console.log(`Servidor iniciado en http://${HOST}:${PORT}`);
});
