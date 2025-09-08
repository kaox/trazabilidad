// Carga las variables de entorno desde el archivo .env al inicio
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'))); // Sirve archivos públicos
app.use(cookieParser()); // Middleware para parsear cookies

// --- Middleware de Autenticación Unificado ---
const authenticate = (req, res, next, isPageRequest = false) => {
    // 1. Prioriza la cookie, que es más segura.
    let token = req.cookies.token;

    // 2. Si no hay cookie, busca en el header 'Authorization' como respaldo.
    if (!token) {
        const authHeader = req.headers['authorization'];
        if (authHeader) {
            token = authHeader.split(' ')[1];
        }
    }

    if (token == null) {
        // Si no hay token por ninguna vía
        if (isPageRequest) {
            return res.redirect(`/login.html?redirect=${req.originalUrl}`);
        }
        return res.sendStatus(401); // Para peticiones de API
    }

    jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey', (err, user) => {
        if (err) {
            // Si el token es inválido o expiró
            if (isPageRequest) {
                return res.clearCookie('token', { path: '/' }).redirect(`/login.html?redirect=${req.originalUrl}`);
            }
            return res.sendStatus(403); // Para peticiones de API
        }
        req.user = user;
        next();
    });
};

const authenticatePage = (req, res, next) => authenticate(req, res, next, true);
const authenticateApi = (req, res, next) => authenticate(req, res, next, false);

// --- Rutas Públicas (API y Páginas) ---
app.post('/api/register', db.registerUser);
app.post('/api/login', db.loginUser);
app.post('/api/logout', db.logoutUser);
app.get('/api/trazabilidad/:id', db.getTrazabilidad);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

// --- Rutas Protegidas de la Aplicación (Vistas) ---
app.get('/app/trazabilidad', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/app/fincas', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'fincas.html')));
app.get('/app/dashboard', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'dashboard.html')));
app.get('/app/perfiles', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'perfiles.html'))); // Nueva ruta

// --- Rutas Protegidas de la API ---
app.get('/api/fincas', authenticateApi, db.getFincas);
app.post('/api/fincas', authenticateApi, db.createFinca);
app.put('/api/fincas/:id', authenticateApi, db.updateFinca);
app.delete('/api/fincas/:id', authenticateApi, db.deleteFinca);
app.get('/api/batches/tree', authenticateApi, db.getBatchesTree);
app.post('/api/batches', authenticateApi, db.createBatch);
app.put('/api/batches/:id', authenticateApi, db.updateBatch);
app.delete('/api/batches/:id', authenticateApi, db.deleteBatch);
app.get('/api/perfiles', authenticateApi, db.getPerfiles);
app.post('/api/perfiles', authenticateApi, db.createPerfil);

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en modo [${process.env.NODE_ENV || 'development'}] en http://localhost:${PORT}`);
});

