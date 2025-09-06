// --- Dependencias ---
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db'); // Importamos la configuración de la base de datos

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Middleware para parsear JSON y aumentar el límite para las imágenes
app.use(express.static(path.join(__dirname, 'public'))); // Servir archivos estáticos del frontend

// --- API Endpoints ---

// FINCAS API
app.get('/api/fincas', db.getFincas);
app.post('/api/fincas', db.createFinca);
app.put('/api/fincas/:id', db.updateFinca);
app.delete('/api/fincas/:id', db.deleteFinca);

// BATCHES (TRAZABILIDAD) API
app.get('/api/batches/tree', db.getBatchesTree);
app.post('/api/batches', db.createBatch);
app.put('/api/batches/:id', db.updateBatch);
app.delete('/api/batches/:id', db.deleteBatch);

// TRAZABILIDAD PÚBLICA API
app.get('/api/trazabilidad/:id', db.getTrazabilidad);


// --- Rutas del Frontend ---
// Redirige a la página principal de trazabilidad
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
