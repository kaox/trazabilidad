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
app.use(cookieParser());

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

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

// --- Rutas Públicas (API) ---
app.post('/api/register', db.registerUser);
app.post('/api/login', db.loginUser);
app.post('/api/logout', db.logoutUser);
app.get('/api/trazabilidad/:id', db.getTrazabilidad);

// Nueva ruta para servir los parciales de HTML
app.get('/partials/:partialName', (req, res) => {
    const { partialName } = req.params;
    // Añadimos una validación simple para seguridad
    if (partialName.match(/^[a-zA-Z0-9_-]+\.html$/)) {
        res.sendFile(path.join(__dirname, 'views', 'partials', partialName));
    } else {
        res.status(404).send('Partial not found');
    }
});

// --- Rutas Públicas (Páginas) ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'about.html')));

// Nueva ruta para trazabilidad pública con ID corto en la URL
app.get('/:loteId([A-Z]{3}-[A-Z0-9]{8})', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'trazabilidad.html'));
});

// Ruta anterior para compatibilidad o si se usa el formulario
app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'trazabilidad.html'));
});


// --- Rutas Protegidas de la Aplicación (Vistas) ---
app.get('/app/dashboard', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'dashboard.html')));
app.get('/app/trazabilidad', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'trazabilidad.html')));
app.get('/app/fincas', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'fincas.html')));
app.get('/app/perfiles', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'perfiles.html')));
app.get('/app/perfiles-cafe', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'perfiles-cafe.html')));
app.get('/app/procesadoras', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'procesadoras.html')));
app.get('/app/plantillas', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'plantillas.html')));
app.get('/app/ruedas-sabores', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'ruedas-sabores.html')));
app.get('/app/cuenta', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'cuenta.html')));
app.get('/app/maridaje', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'maridaje.html'))); // <-- Nueva ruta
app.get('/app/blends', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'blends.html'))); // <-- Nueva ruta
app.get('/app/recetas-chocolate', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'formulador.html'))); // <-- Nueva ruta

// --- Rutas Protegidas de la API ---
// Fincas
app.get('/api/fincas', authenticateApi, db.getFincas);
app.post('/api/fincas', authenticateApi, db.createFinca);
app.put('/api/fincas/:id', authenticateApi, db.updateFinca);
app.delete('/api/fincas/:id', authenticateApi, db.deleteFinca);

// Procesadoras
app.get('/api/procesadoras', authenticateApi, db.getProcesadoras);
app.post('/api/procesadoras', authenticateApi, db.createProcesadora);
app.put('/api/procesadoras/:id', authenticateApi, db.updateProcesadora);
app.delete('/api/procesadoras/:id', authenticateApi, db.deleteProcesadora);

// Perfiles Cacao
app.get('/api/perfiles', authenticateApi, db.getPerfiles);
app.post('/api/perfiles', authenticateApi, db.createPerfil);
app.put('/api/perfiles/:id', authenticateApi, db.updatePerfil);
app.delete('/api/perfiles/:id', authenticateApi, db.deletePerfil);

// Perfiles Café
app.get('/api/perfiles-cafe', authenticateApi, db.getPerfilesCafe);
app.post('/api/perfiles-cafe', authenticateApi, db.createPerfilCafe);
app.put('/api/perfiles-cafe/:id', authenticateApi, db.updatePerfilCafe);
app.delete('/api/perfiles-cafe/:id', authenticateApi, db.deletePerfilCafe);

// Ruedas de Sabores
app.get('/api/ruedas-sabores', authenticateApi, db.getRuedasSabores);
app.post('/api/ruedas-sabores', authenticateApi, db.createRuedaSabores);
app.put('/api/ruedas-sabores/:id', authenticateApi, db.updateRuedaSabores);
app.delete('/api/ruedas-sabores/:id', authenticateApi, db.deleteRuedaSabores);

// Plantillas y Etapas
app.get('/api/templates', authenticateApi, db.getTemplates);
app.post('/api/templates', authenticateApi, db.createTemplate);
app.put('/api/templates/:templateId', authenticateApi, db.updateTemplate);
app.delete('/api/templates/:templateId', authenticateApi, db.deleteTemplate);
app.get('/api/templates/:templateId/stages', authenticateApi, db.getStagesForTemplate);
app.post('/api/templates/:templateId/stages', authenticateApi, db.createStage);
app.put('/api/templates/stages/:stageId', authenticateApi, db.updateStage);
app.delete('/api/templates/stages/:stageId', authenticateApi, db.deleteStage);

// Lotes
app.get('/api/batches/tree', authenticateApi, db.getBatchesTree);
app.post('/api/batches', authenticateApi, db.createBatch);
app.put('/api/batches/:id', authenticateApi, db.updateBatch);
app.delete('/api/batches/:id', authenticateApi, db.deleteBatch);

// Cuenta de Usuario
app.get('/api/user/profile', authenticateApi, db.getUserProfile);
app.put('/api/user/profile', authenticateApi, db.updateUserProfile);
app.put('/api/user/password', authenticateApi, db.updateUserPassword);

// Nuevas rutas para Blends
app.get('/api/blends', authenticateApi, db.getBlends);
app.post('/api/blends', authenticateApi, db.createBlend);
app.delete('/api/blends/:id', authenticateApi, db.deleteBlend);
//app.put('/api/blends/:id', authenticateApi, db.updateBlend);

// Nuevas rutas para Recetas
app.get('/api/recetas-chocolate', authenticateApi, db.getRecetas);
app.post('/api/recetas-chocolate', authenticateApi, db.createReceta);
app.delete('/api/recetas-chocolate/:id', authenticateApi, db.deleteReceta);
app.put('/api/recetas-chocolate/:id', authenticateApi, db.updateReceta);

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en modo [${process.env.NODE_ENV || 'development'}] en http://localhost:${PORT}`);
});

