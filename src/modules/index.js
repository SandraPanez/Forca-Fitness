require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

// Middlewares globales
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Registrar módulos de la aplicación
const {
  matriculasRoutes,
  alumnosRoutes
} = require('./src/modules');

app.use('/api/matriculas', matriculasRoutes);
app.use('/api/alumnos', alumnosRoutes);

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Servidor Forca-Fitness corriendo correctamente'
  });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});