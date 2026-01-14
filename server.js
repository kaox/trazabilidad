// Carga las variables de entorno desde el archivo .env al inicio
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const gs1Resolver = require('./gs1-resolver');

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

// --- Middleware de Control de Acceso por Nivel ---
const checkSubscription = (requiredTier) => async (req, res, next) => {
    const userId = req.user.id;
    try {
        // Llama a la nueva función centralizada en db.js
        const user = await db.getUserSubscriptionStatus(userId);
        if (!user) return res.status(403).json({ error: 'Acceso denegado.' });

        const hasActiveTrial = user.trial_ends_at && new Date(user.trial_ends_at) > new Date();
        const hasProfesionalTier = user.subscription_tier === 'profesional';

        if (hasProfesionalTier || hasActiveTrial) {
            return next();
        }

        return res.status(403).json({ error: 'Esta funcionalidad requiere un plan Profesional. Mejora tu cuenta para acceder.' });
    } catch (error) {
        console.error(`Error al verificar la suscripción para el usuario ${userId}:`, error);
        res.status(500).json({ error: 'Error del servidor al verificar la suscripción.' });
    }
};

// --- Middleware de Control de Acceso por Rol ---
const checkAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        // Para páginas, redirigir a una página de no autorizado o al inicio
        if (req.accepts('html')) {
            return res.status(403).send('<h1>403 Forbidden: Acceso denegado</h1><p>No tienes permisos para ver esta página.</p><a href="/app/dashboard">Volver al Dashboard</a>');
        }
        // Para API, devolver JSON
        res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
};

// --- Rutas Públicas (API) ---
app.post('/api/register', db.registerUser);
app.post('/api/login', db.loginUser);
app.post('/api/login/google', db.handleGoogleLogin);
app.post('/api/logout', db.logoutUser);
app.get('/api/trazabilidad/:id', db.getTrazabilidad);
app.get('/use-case.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'use-case.html')));
app.get('/pricing-public.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pricing-public.html')));

// Nuevas rutas para el módulo de reseñas
app.get('/api/reviews/:lote_id', db.getReviews);
app.post('/api/reviews/submit', db.submitReview);

app.get('/api/blog', db.getBlogPosts);
app.get('/api/blog/:slug', db.getBlogPostBySlug);

app.get('/blog/:slug', (req, res) => {
    // Servimos el HTML plantilla. El JS del cliente leerá el slug de la URL y pedirá los datos.
    res.sendFile(path.join(__dirname, 'public', 'article.html'));
});

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

// --- PROXY PARA CONSULTA RUC (Protege el Token y evita CORS) ---
app.get('/api/proxy/ruc/:numero', authenticateApi, async (req, res) => {
    const { numero } = req.params;
    const token = process.env.DECOLECTA_TOKEN;

    if (!token) return res.status(500).json({ error: "Token de API RUC no configurado" });

    try {
        const response = await fetch(`https://api.decolecta.com/v1/sunat/ruc?numero=${numero}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
             const errorText = await response.text();
             return res.status(response.status).json({ error: "Error en servicio externo", details: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error Proxy RUC:", error);
        res.status(500).json({ error: "Error interno al consultar RUC" });
    }
});

// --- Rutas Públicas (Páginas) ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Nueva ruta para trazabilidad pública con ID corto en la URL
app.get('/:loteId([A-Z]{3}-[A-Z0-9]{8})', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tracking.html'));
});

// RUTA GS1 DIGITAL LINK
// Estándar: /01/{GTIN}/10/{Lote}
// Ejemplo: https://rurulab.com/01/95012345678903/10/COS-X82A
app.get('/01/:gtin/10/:loteId', gs1Resolver.resolve);

// Ruta anterior para compatibilidad o si se usa el formulario
app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tracking.html'));
});


// --- Rutas Protegidas de la Aplicación (Vistas) ---
app.get('/app/trazabilidad', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'trazabilidad.html')));
app.get('/app/fincas', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'fincas.html')));
app.get('/app/perfiles', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'perfiles.html')));
app.get('/app/procesadoras', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'procesadoras.html')));
app.get('/app/plantillas', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'plantillas.html')));
app.get('/app/ruedas-sabores', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'ruedas-sabores.html')));
app.get('/app/cuenta', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'cuenta.html')));
app.get('/app/maridaje', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'maridaje.html'))); // <-- Nueva ruta
app.get('/app/blends', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'blends.html'))); // <-- Nueva ruta
app.get('/app/recetas-chocolate', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'formulador.html'))); // <-- Nueva ruta
app.get('/app/pricing', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'pricing.html'))); // Nueva ruta
app.get('/app/costos', authenticatePage, checkSubscription('profesional'), (req, res) => res.sendFile(path.join(__dirname, 'views', 'costos.html'))); // Nueva ruta
app.get('/app/admin-dashboard', authenticatePage, checkAdmin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin-dashboard.html')));
app.get('/app/cms', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin-blog-list.html')));
app.get('/app/costos', authenticatePage, checkSubscription('profesional'), (req, res) => res.sendFile(path.join(__dirname, 'views', 'costos.html')));
app.get('/app/trazabilidad-inmutable', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'trazabilidad-inmutable.html')));
app.get('/app/productos', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'productos.html')));
app.get('/app/acopio', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'acopio.html'))); // <-- NUEVA RUTA DE ACOPIO


// --- NUEVAS RUTAS VISTAS ADMIN BLOG ---
app.get('/app/admin-blog', authenticatePage, checkAdmin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin-blog-list.html')));
app.get('/app/admin-blog/editor', authenticatePage, checkAdmin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin-blog-editor.html')));


// Nuevas rutas para el flujo de pago
app.get('/app/payment-success', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'payment-success.html')));
app.get('/app/payment-failure', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'payment-failure.html')));


// --- Rutas Protegidas de la API ---
// Fincas
app.get('/api/fincas', authenticateApi, db.getFincas);
app.post('/api/fincas', authenticateApi, db.createFinca);
app.put('/api/fincas/:id', authenticateApi, db.updateFinca);
app.delete('/api/fincas/:id', authenticateApi, db.deleteFinca);

app.post('/api/validate-deforestation', authenticateApi, db.validateDeforestation);

// Productos (SKUs)
app.get('/api/productos', authenticateApi, db.getProductos);
app.post('/api/productos', authenticateApi, db.createProducto);
app.put('/api/productos/:id', authenticateApi, db.updateProducto);
app.delete('/api/productos/:id', authenticateApi, db.deleteProducto);

// Procesadoras
app.get('/api/procesadoras', authenticateApi, db.getProcesadoras);
app.post('/api/procesadoras', authenticateApi, db.createProcesadora);
app.put('/api/procesadoras/:id', authenticateApi, db.updateProcesadora);
app.delete('/api/procesadoras/:id', authenticateApi, db.deleteProcesadora);

// Perfiles
app.get('/api/perfiles', authenticateApi, db.getPerfiles);
app.post('/api/perfiles', authenticateApi, db.createPerfil);
app.put('/api/perfiles/:id', authenticateApi, db.updatePerfil);
app.delete('/api/perfiles/:id', authenticateApi, db.deletePerfil);

// Ruedas de Sabores
app.get('/api/ruedas-sabores', authenticateApi, db.getRuedasSabores);
app.post('/api/ruedas-sabores', authenticateApi, db.createRuedaSabores);
app.put('/api/ruedas-sabores/:id', authenticateApi, db.updateRuedaSabores);
app.delete('/api/ruedas-sabores/:id', authenticateApi, db.deleteRuedaSabores);

// Plantillas y Etapas
app.get('/api/templates', authenticateApi, db.getTemplates);
app.get('/api/templates/system', authenticateApi, db.getSystemTemplates);
app.post('/api/templates/clone', authenticateApi, db.cloneTemplate);
// -------------------------------------------------------------
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
app.post('/api/batches/:id/finalize', authenticateApi, db.finalizeBatch);
app.get('/api/batches/immutable', authenticateApi, db.getImmutableBatches);



// Cuenta de Usuario
app.get('/api/user/profile', authenticateApi, db.getUserProfile);
app.put('/api/user/profile', authenticateApi, db.updateUserProfile);
app.put('/api/user/password', authenticateApi, db.updateUserPassword);

// Aplicar middleware a las rutas premium
app.get('/app/dashboard', authenticatePage, checkSubscription('profesional'), (req, res) => res.sendFile(path.join(__dirname, 'views', 'dashboard.html')));

// Nuevas rutas para Blends
app.get('/api/blends', authenticateApi, checkSubscription('profesional'), db.getBlends);
app.post('/api/blends', authenticateApi, checkSubscription('profesional'), db.createBlend);
app.delete('/api/blends/:id', authenticateApi, checkSubscription('profesional'), db.deleteBlend);
//app.put('/api/blends/:id', authenticateApi, db.updateBlend);

// Nuevas rutas para Recetas
app.get('/api/recetas-chocolate', authenticateApi, checkSubscription('profesional'), db.getRecetas);
app.post('/api/recetas-chocolate', authenticateApi, checkSubscription('profesional'), db.createReceta);
app.delete('/api/recetas-chocolate/:id', authenticateApi, checkSubscription('profesional'), db.deleteReceta);
app.put('/api/recetas-chocolate/:id', authenticateApi, checkSubscription('profesional'), db.updateReceta);

// Nueva ruta para datos del dashboard administrativo
app.get('/api/admin/dashboard-data', authenticateApi, checkAdmin, db.getAdminDashboardData);

// Nuevas rutas para el Módulo de Costos
app.get('/api/costs/:lote_id', authenticateApi, checkSubscription('profesional'), db.getLoteCosts);
app.post('/api/costs/:lote_id', authenticateApi, checkSubscription('profesional'), db.saveLoteCosts);

// Nuevas rutas para Pagos con Mercado Pago
app.post('/api/payments/create-preference', authenticateApi, db.createPaymentPreference);
app.post('/api/payments/webhook', express.raw({type: 'application/json'}), db.handlePaymentWebhook);

// Nueva ruta para consolidar los datos del dashboard
app.get('/api/dashboard/data', authenticateApi, checkSubscription('profesional'), db.getDashboardData);

// --- NUEVAS RUTAS API ADMIN BLOG (CRUD) ---
app.get('/api/admin/blog', authenticateApi, checkAdmin, db.getAdminBlogPosts);
app.get('/api/admin/blog/:id', authenticateApi, checkAdmin, db.getBlogPostById); // Para editar
app.post('/api/admin/blog', authenticateApi, checkAdmin, db.createBlogPost);
app.put('/api/admin/blog/:id', authenticateApi, checkAdmin, db.updateBlogPost);
app.delete('/api/admin/blog/:id', authenticateApi, checkAdmin, db.deleteBlogPost);

// --- MÓDULO NUTRICIÓN ---
// Vistas
app.get('/app/nutricion', authenticatePage, checkSubscription('profesional'), (req, res) => res.sendFile(path.join(__dirname, 'views', 'nutricion.html')));

// MÓDULO NUTRICIÓN (API)
app.get('/api/nutricion/recetas', authenticateApi, db.getRecetasNutricionales);
app.post('/api/nutricion/recetas', authenticateApi, db.createRecetaNutricional);
app.put('/api/nutricion/recetas/:id', authenticateApi, db.updateRecetaNutricional);
app.delete('/api/nutricion/recetas/:id', authenticateApi, db.deleteReceta);
app.post('/api/nutricion/recetas/:receta_id/ingredientes', authenticateApi, db.addIngredienteReceta);
app.put('/api/nutricion/ingredientes/:id', authenticateApi, db.updateIngredientePeso);
app.delete('/api/nutricion/ingredientes/:id', authenticateApi, db.deleteIngrediente);

// PROXY USDA API
app.get('/api/proxy/usda/search', authenticateApi, db.searchUSDA);
app.get('/api/proxy/usda/food/:fdcId', authenticateApi, db.getUSDADetails);

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en modo [${process.env.NODE_ENV || 'development'}] en http://localhost:${PORT}`);
});