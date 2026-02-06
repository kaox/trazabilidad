// 1. CONFIGURACIÓN Y CARGA DE MÓDULOS
require('dotenv').config();
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const db = require('./db');
const gs1Resolver = require('./gs1-resolver');

const app = express();
const PORT = process.env.PORT || 3000;

// 2. MIDDLEWARES GLOBALES
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 3. FUNCIONES HELPER (Definidas antes de su uso en rutas)
const createSlug = (text) => {
    if (!text) return '';
    return text.toString().toLowerCase().trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
};

// 4. MIDDLEWARES DE AUTENTICACIÓN Y CONTROL DE ACCESO
const authenticate = (req, res, next, isPageRequest = false) => {
    let token = req.cookies.token;
    if (!token) {
        const authHeader = req.headers['authorization'];
        if (authHeader) token = authHeader.split(' ')[1];
    }

    if (token == null) {
        if (isPageRequest) return res.redirect(`/login.html?redirect=${req.originalUrl}`);
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey', (err, user) => {
        if (err) {
            if (isPageRequest) return res.clearCookie('token', { path: '/' }).redirect(`/login.html?redirect=${req.originalUrl}`);
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

const authenticatePage = (req, res, next) => authenticate(req, res, next, true);
const authenticateApi = (req, res, next) => authenticate(req, res, next, false);

const checkSubscription = (requiredTier) => async (req, res, next) => {
    const userId = req.user.id;
    try {
        const user = await db.getUserSubscriptionStatus(userId);
        if (!user) return res.status(403).json({ error: 'Acceso denegado.' });

        const hasActiveTrial = user.trial_ends_at && new Date(user.trial_ends_at) > new Date();
        const hasProfesionalTier = user.subscription_tier === 'profesional';

        if (hasProfesionalTier || hasActiveTrial) return next();

        return res.status(403).json({ error: 'Esta funcionalidad requiere un plan Profesional. Mejora tu cuenta para acceder.' });
    } catch (error) {
        console.error(`Error al verificar la suscripción para el usuario ${userId}:`, error);
        res.status(500).json({ error: 'Error del servidor al verificar la suscripción.' });
    }
};

const checkAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        if (req.accepts('html')) {
            return res.status(403).send('<h1>403 Forbidden: Acceso denegado</h1><p>No tienes permisos para ver esta página.</p><a href="/app/dashboard">Volver al Dashboard</a>');
        }
        res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
};

// 5. RUTAS PÚBLICAS (API & AUTH)
app.post('/api/register', db.registerUser);
app.post('/api/login', db.loginUser);
app.post('/api/login/google', db.handleGoogleLogin);
app.post('/api/logout', db.logoutUser);
app.get('/api/trazabilidad/:id', db.getTrazabilidad);
app.get('/api/reviews/:lote_id', db.getReviews);
app.post('/api/reviews/submit', db.submitReview);
app.get('/api/blog', db.getBlogPosts);
app.get('/api/blog/:slug', db.getBlogPostBySlug);
app.post('/api/public/analytics', db.trackAnalyticsEvent);
app.post('/api/public/suggest', db.createSuggestion);
app.get('/api/public/suggestions/:id', db.getSuggestionById);

// 6. RUTAS PÚBLICAS (PÁGINAS Y SEO)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/use-case.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'use-case.html')));
app.get('/pricing-public.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pricing-public.html')));
app.get('/qr', (req, res) => res.sendFile(path.join(__dirname, 'public', 'tracking.html')));
app.get('/registro-productor', (req, res) => res.sendFile(path.join(__dirname, 'public', 'registro-productor.html')));
app.get('/blog/:slug', (req, res) => res.sendFile(path.join(__dirname, 'public', 'article.html')));

// Trazabilidad corta (Ej: ABC-12345678)
app.get('/:loteId([A-Z]{3}-[A-Z0-9]{8})', (req, res) => res.sendFile(path.join(__dirname, 'public', 'tracking.html')));

// GS1 Digital Link
app.get('/01/:gtin/10/:loteId', gs1Resolver.resolve);

// 7. SECCIÓN ORIGEN ÚNICO (Con inyección de metadatos)
app.get('/origen-unico', (req, res) => res.sendFile(path.join(__dirname, 'public', 'origen-unico.html')));

app.get('/origen-unico/:slug', async (req, res) => {
    const slug = req.params.slug;
    const filePath = path.join(__dirname, 'public', 'origen-unico.html');

    fs.readFile(filePath, 'utf8', async (err, htmlData) => {
        if (err) return res.status(500).send('Error interno');
        try {
            const companies = await db.getPublicCompaniesDataInternal();
            const company = companies.find(c => createSlug(c.empresa) === slug);
            
            if (company) {
                console.log(company);
                const title = `${company.empresa} - Origen Único Verificado`;
                const description = `Conoce la trazabilidad y origen de ${company.empresa} en Ruru Lab.`;
                let image = "https://rurulab.com/images/banner_1.png";
                if (company.company_logo) {
                    image = company.company_logo;
                }

                let injectedHtml = htmlData
                    .replace('<title>Empresas con Origen Único - Rurulab</title>', `<title>${title}</title>`)
                    .replace(/content="RuruLab - Trazabilidad y Pasaporte Digital para Café y Cacao"/g, `content="${title}"`)
                    .replace(/content="Crea un pasaporte digital para tu producto..."/g, `content="${description}"`)
                    .replace(/content="https:\/\/rurulab\.com\/images\/banner_1\.png"/g, `content="${image}"`);
                
                res.send(injectedHtml);
            } else {
                res.send(htmlData);
            }
        } catch (error) {
            console.error("Error inyectando metadatos:", error);
            res.send(htmlData);
        }
    });
});

app.get('/api/public/companies', db.getPublicCompaniesWithImmutable);
app.get('/api/public/companies/:userId/products', db.getPublicProductsWithImmutable);
app.get('/api/public/products/:productId/batches', db.getPublicBatchesForProduct);
app.get('/api/public/companies/:userId/landing', db.getCompanyLandingData);

// 8. RUTAS PROTEGIDAS (VISTAS APP)
app.get('/app/dashboard', authenticatePage, checkSubscription('profesional'), (req, res) => res.sendFile(path.join(__dirname, 'views', 'dashboard.html')));
app.get('/app/trazabilidad', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'trazabilidad.html')));
app.get('/app/fincas', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'fincas.html')));
app.get('/app/perfiles', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'perfiles.html')));
app.get('/app/procesadoras', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'procesadoras.html')));
app.get('/app/plantillas', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'plantillas.html')));
app.get('/app/ruedas-sabores', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'ruedas-sabores.html')));
app.get('/app/cuenta', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'cuenta.html')));
app.get('/app/maridaje', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'maridaje.html')));
app.get('/app/blends', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'blends.html')));
app.get('/app/recetas-chocolate', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'formulador.html')));
app.get('/app/pricing', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'pricing.html')));
app.get('/app/costos', authenticatePage, checkSubscription('profesional'), (req, res) => res.sendFile(path.join(__dirname, 'views', 'costos.html')));
app.get('/app/admin-dashboard', authenticatePage, checkAdmin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin-dashboard.html')));
app.get('/app/cms', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin-blog-list.html')));
app.get('/app/trazabilidad-inmutable', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'trazabilidad-inmutable.html')));
app.get('/app/productos', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'productos.html')));
app.get('/app/acopio', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'acopio.html')));
app.get('/app/procesamiento', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'procesamiento.html')));
app.get('/app/estimacion-cosecha', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'estimacion-cosecha.html')));
app.get('/app/admin-blog', authenticatePage, checkAdmin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin-blog-list.html')));
app.get('/app/admin-blog/editor', authenticatePage, checkAdmin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin-blog-editor.html')));
app.get('/app/payment-success', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'payment-success.html')));
app.get('/app/payment-failure', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'payment-failure.html')));
app.get('/app/nutricion', authenticatePage, checkSubscription('profesional'), (req, res) => res.sendFile(path.join(__dirname, 'views', 'nutricion.html')));
app.get('/app/existencias', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'existencias.html')));

// Parciales HTML
app.get('/partials/:partialName', (req, res) => {
    const { partialName } = req.params;
    if (partialName.match(/^[a-zA-Z0-9_-]+\.html$/)) {
        res.sendFile(path.join(__dirname, 'views', 'partials', partialName));
    } else {
        res.status(404).send('Partial not found');
    }
});

// 9. RUTAS DE API PROTEGIDAS
// Fincas & Deforestación
app.get('/api/fincas', authenticateApi, db.getFincas);
app.post('/api/fincas', authenticateApi, db.createFinca);
app.put('/api/fincas/:id', authenticateApi, db.updateFinca);
app.delete('/api/fincas/:id', authenticateApi, db.deleteFinca);
app.post('/api/validate-deforestation', authenticateApi, db.validateDeforestation);

// Productos, Procesadoras, Perfiles, Ruedas
app.get('/api/productos', authenticateApi, db.getProductos);
app.post('/api/productos', authenticateApi, db.createProducto);
app.put('/api/productos/:id', authenticateApi, db.updateProducto);
app.delete('/api/productos/:id', authenticateApi, db.deleteProducto);
app.get('/api/procesadoras', authenticateApi, db.getProcesadoras);
app.post('/api/procesadoras', authenticateApi, db.createProcesadora);
app.put('/api/procesadoras/:id', authenticateApi, db.updateProcesadora);
app.delete('/api/procesadoras/:id', authenticateApi, db.deleteProcesadora);
app.get('/api/perfiles', authenticateApi, db.getPerfiles);
app.post('/api/perfiles', authenticateApi, db.createPerfil);
app.put('/api/perfiles/:id', authenticateApi, db.updatePerfil);
app.delete('/api/perfiles/:id', authenticateApi, db.deletePerfil);
app.get('/api/ruedas-sabores', authenticateApi, db.getRuedasSabores);
app.post('/api/ruedas-sabores', authenticateApi, db.createRuedaSabores);
app.put('/api/ruedas-sabores/:id', authenticateApi, db.updateRuedaSabores);
app.delete('/api/ruedas-sabores/:id', authenticateApi, db.deleteRuedaSabores);

// Plantillas & Etapas
app.get('/api/templates', authenticateApi, db.getTemplates);
app.get('/api/templates/system', authenticateApi, db.getSystemTemplates);
app.post('/api/templates/clone', authenticateApi, db.cloneTemplate);
app.post('/api/templates', authenticateApi, db.createTemplate);
app.put('/api/templates/:templateId', authenticateApi, db.updateTemplate);
app.delete('/api/templates/:templateId', authenticateApi, db.deleteTemplate);
app.get('/api/templates/:templateId/stages', authenticateApi, db.getStagesForTemplate);
app.post('/api/templates/:templateId/stages', authenticateApi, db.createStage);
app.put('/api/templates/stages/:stageId', authenticateApi, db.updateStage);
app.delete('/api/templates/stages/:stageId', authenticateApi, db.deleteStage);

// Lotes & Acopio
app.get('/api/batches/tree', authenticateApi, db.getBatchesTree);
app.post('/api/batches', authenticateApi, db.createBatch);
app.put('/api/batches/:id', authenticateApi, db.updateBatch);
app.delete('/api/batches/:id', authenticateApi, db.deleteBatch);
app.post('/api/batches/:id/finalize', authenticateApi, db.finalizeBatch);
app.get('/api/batches/immutable', authenticateApi, db.getImmutableBatches);
app.get('/api/acquisitions', authenticateApi, db.getAcquisitions);
app.post('/api/acquisitions', authenticateApi, db.createAcquisition);
app.delete('/api/acquisitions/:id', authenticateApi, db.deleteAcquisition);
app.put('/api/acquisitions/:id', authenticateApi, db.updateAcquisition);

// Perfil de Usuario & Config
app.get('/api/user/profile', authenticateApi, db.getUserProfile);
app.put('/api/user/profile', authenticateApi, db.updateUserProfile);
app.put('/api/user/password', authenticateApi, db.updateUserPassword);
app.get('/api/config/currencies', authenticateApi, db.getCurrencies);
app.get('/api/config/units', authenticateApi, db.getUnits);

// 10. RUTAS PREMIUM / ADMIN / PROXY
// Dashboard & Analytics
app.get('/api/dashboard/data', authenticateApi, checkSubscription('profesional'), db.getDashboardData);
app.get('/api/admin/dashboard-data', authenticateApi, checkAdmin, db.getAdminDashboardData);

// Blends & Recetas (Profesional)
app.get('/api/blends', authenticateApi, checkSubscription('profesional'), db.getBlends);
app.post('/api/blends', authenticateApi, checkSubscription('profesional'), db.createBlend);
app.delete('/api/blends/:id', authenticateApi, checkSubscription('profesional'), db.deleteBlend);
app.get('/api/recetas-chocolate', authenticateApi, checkSubscription('profesional'), db.getRecetas);
app.post('/api/recetas-chocolate', authenticateApi, checkSubscription('profesional'), db.createReceta);
app.delete('/api/recetas-chocolate/:id', authenticateApi, checkSubscription('profesional'), db.deleteReceta);
app.put('/api/recetas-chocolate/:id', authenticateApi, checkSubscription('profesional'), db.updateReceta);

// Costos & Pagos
app.get('/api/costs/:lote_id', authenticateApi, checkSubscription('profesional'), db.getLoteCosts);
app.post('/api/costs/:lote_id', authenticateApi, checkSubscription('profesional'), db.saveLoteCosts);
app.post('/api/payments/create-preference', authenticateApi, db.createPaymentPreference);
app.post('/api/payments/webhook', express.raw({type: 'application/json'}), db.handlePaymentWebhook);

// Admin Blog CRUD
app.get('/api/admin/blog', authenticateApi, checkAdmin, db.getAdminBlogPosts);
app.get('/api/admin/blog/:id', authenticateApi, checkAdmin, db.getBlogPostById);
app.post('/api/admin/blog', authenticateApi, checkAdmin, db.createBlogPost);
app.put('/api/admin/blog/:id', authenticateApi, checkAdmin, db.updateBlogPost);
app.delete('/api/admin/blog/:id', authenticateApi, checkAdmin, db.deleteBlogPost);

// Nutrición API
app.get('/api/nutricion/recetas', authenticateApi, db.getRecetasNutricionales);
app.post('/api/nutricion/recetas', authenticateApi, db.createRecetaNutricional);
app.put('/api/nutricion/recetas/:id', authenticateApi, db.updateRecetaNutricional);
app.delete('/api/nutricion/recetas/:id', authenticateApi, db.deleteReceta);
app.post('/api/nutricion/recetas/:receta_id/ingredientes', authenticateApi, db.addIngredienteReceta);
app.put('/api/nutricion/ingredientes/:id', authenticateApi, db.updateIngredientePeso);
app.delete('/api/nutricion/ingredientes/:id', authenticateApi, db.deleteIngrediente);

// Proxies (RUC & USDA)
app.get('/api/proxy/ruc/:numero', authenticateApi, async (req, res) => {
    const { numero } = req.params;
    const token = process.env.DECOLECTA_TOKEN;
    if (!token) return res.status(500).json({ error: "Token de API RUC no configurado" });
    try {
        const response = await fetch(`https://api.decolecta.com/v1/sunat/ruc?numero=${numero}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
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
app.get('/api/proxy/usda/search', authenticateApi, db.searchUSDA);
app.get('/api/proxy/usda/food/:fdcId', authenticateApi, db.getUSDADetails);

// 11. RUTAS DE COMPARTICIÓN Y SUGERENCIAS
app.post('/api/fincas/:id/share-token', authenticateApi, db.generateFincaToken);
app.get('/api/public/fincas/:token', db.getFincaByToken);
app.put('/api/public/fincas/:token', db.updateFincaByToken);
app.put('/api/public/suggestions/:id/claim', authenticateApi, db.claimSuggestion);

// 12. INICIO DEL SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor corriendo en modo [${process.env.NODE_ENV || 'development'}] en http://localhost:${PORT}`);
});