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

const suggestionsController = require('./src/controllers/admin-suggestionsController');
const productosController = require('./src/controllers/productosController');

const RESERVED_SUBDOMAINS = ['www', 'app', 'api', 'admin', 'localhost', 'rurulab', 'mail', 'smtp'];

app.use(async (req, res, next) => {
    const host = req.headers.host; // ej: pepito.rurulab.com o pepito.localhost:3000
    
    let subdomain = null;
    
    // Lógica para extraer subdominio (Prod y Local)
    if (host.includes('.rurulab.com')) {
        const parts = host.split('.');
        if (parts.length > 2) subdomain = parts[0];
    } else if (host.endsWith('localhost:3000') && host !== 'localhost:3000') {
        // Para probar en local: editar /etc/hosts y entrar a pepito.localhost:3000
        subdomain = host.split('.')[0];
    }

    // Si no hay subdominio o es reservado, continuar flujo normal (ir al Home/App)
    if (!subdomain || RESERVED_SUBDOMAINS.includes(subdomain)) {
        return next();
    }

    // --- ES UN SUBDOMINIO DE CLIENTE ---
    try {
        console.log(`🔍 Detectado subdominio: ${subdomain}`);
        
        // Obtener todas las empresas (Idealmente crear una función db.findCompanyBySlug para optimizar)
        const companies = await db.getPublicCompaniesDataInternal();
        
        // Buscar empresa cuyo slug coincida con el subdominio
        const company = companies.find(c => createSlug(c.empresa) === subdomain);

        if (!company) {
            console.log(`❌ Empresa no encontrada para subdominio: ${subdomain}`);
            return res.redirect('https://rurulab.com'); // O mostrar 404
        }

        console.log(`✅ Sirviendo landing para: ${company.empresa}`);

        // Leer el archivo HTML de la landing
        const filePath = path.join(__dirname, 'public', 'landing-empresa.html');
        
        fs.readFile(filePath, 'utf8', async (err, htmlData) => {
            if (err) return next();

            // Metadatos SEO personalizados
            const title = `${company.empresa} | Sitio Oficial`;
            const description = `Bienvenido al sitio oficial de ${company.empresa}. Conoce nuestra historia, productos y trazabilidad.`;
            
            // Inyección de Script de Configuración Global
            // Esto le dice al JS del frontend qué ID cargar sin mirar la URL
            const injectionScript = `
                <script>
                    window.IS_SUBDOMAIN = true;
                    window.CURRENT_COMPANY_ID = "${company.id}";
                </script>
            `;

            // Reemplazar en el HTML
            let injectedHtml = htmlData
                .replace('<head>', `<head>${injectionScript}`) // Inyectar script ID
                .replace('<title>Detalle de Empresa - Ruru Lab</title>', `<title>${title}</title>`)
                .replace(/content="Descubre el origen y trazabilidad."/g, `content="${description}"`)
                .replace(/content="RuruLab - Trazabilidad y Pasaporte Digital para Café y Cacao"/g, `content="${title}"`);

            // Servir el HTML modificado
            res.send(injectedHtml);
        });

    } catch (error) {
        console.error("Error procesando subdominio:", error);
        next(); // En caso de error crítico, dejar pasar al flujo normal
    }
});

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
app.get('/api/public/companies/:id/logo', db.serveCompanyLogo);
app.get('/api/public/products/:id/image', db.serveProductImage);

// 6. RUTAS PÚBLICAS (PÁGINAS Y SEO)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/use-case.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'use-case.html')));
app.get('/pricing-public.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pricing-public.html')));
app.get('/qr', (req, res) => res.sendFile(path.join(__dirname, 'public', 'tracking.html')));
app.get('/registro-productor', (req, res) => res.sendFile(path.join(__dirname, 'public', 'registro-productor.html')));
app.get('/blog/:slug', (req, res) => res.sendFile(path.join(__dirname, 'public', 'article.html')));
app.get('/magic-login/:token', suggestionsController.handleMagicLogin);

// 2. Obtener datos para precargar formulario (API)
app.get('/api/public/magic-data/:token', suggestionsController.getMagicLinkData);
app.post('/api/public/magic-register', suggestionsController.completeMagicRegistration);
app.post('/api/public/claim-register', suggestionsController.registerAndClaimPublic);

// Trazabilidad corta (Ej: ABC-12345678)
//app.get('/:loteId([A-Z]{3}-[A-Z0-9]{8})', (req, res) => res.sendFile(path.join(__dirname, 'public', 'tracking.html')));
app.get('/:loteId([A-Z]{3}-[A-Z0-9]{8})', async (req, res) => {
    const { loteId } = req.params;
    const filePath = path.join(__dirname, 'public', 'tracking.html');

    fs.readFile(filePath, 'utf8', async (err, htmlData) => {
        if (err) {
            console.error('Error leyendo tracking.html:', err);
            return res.status(500).send('Error interno');
        }

        try {
            // 2. Obtener metadatos del lote (foto del producto, nombre)
            const metadata = await db.getBatchMetadata(loteId);

            let title = "Pasaporte Digital: Origen y Trazabilidad Verificada | Ruru Lab";
            let description = `He escaneado el lote ${loteId} y he descubierto su historia completa: desde la finca hasta mis manos.`;
            // Imagen por defecto absoluta
            let image = "https://rurulab.com/images/banner_1.png";

            if (metadata) {
                if (metadata.title) {
                    // Título optimizado: Producto + Lote + Branding (~50-60 caracteres)
                    title = `Trazabilidad de ${metadata.title} (Lote: ${loteId}) | Ruru Lab`;
                }
                if (metadata.description) {
                    // Descripción truncada con Llamada a la Acción (CTA) al final
                    const cleanDesc = metadata.description.substring(0, 110).trim();
                    description = `${cleanDesc}... Descubre el origen y certificaciones. ¡Mira la historia completa aquí!`;
                }
                
                // --- LÓGICA DE REEMPLAZO DE IMAGEN (ACTUALIZADA) ---
                if (metadata.image) {
                    if (metadata.image.startsWith('http')) {
                        // URL Externa (ej. Cloudinary)
                        image = metadata.image;
                    } else if (metadata.id) {
                        // Base64: Generamos la URL virtual que WhatsApp sí puede leer
                        // Usamos headers para detectar protocolo y host correctos (útil tras proxys/vercel)
                        const protocol = req.headers['x-forwarded-proto'] || req.protocol; 
                        const host = req.get('host');
                        image = `${protocol}://${host}/api/public/products/${metadata.id}/image`;
                    }
                }
            }

            // 3. Reemplazar Meta Tags en el HTML
            let injectedHtml = htmlData
                .replace(/<title>.*<\/title>/, `<title>${title}</title>`)
                .replace(/property="og:title" content="[^"]*"/, `property="og:title" content="${title}"`)
                .replace(/property="og:description" content="[^"]*"/, `property="og:description" content="${description}"`)
                .replace(/content="https:\/\/rurulab\.com\/images\/banner_1\.png"/g, `content="${image}"`) // Reemplazo global (og:image, twitter:image)
                .replace(/name="twitter:title" content="[^"]*"/, `name="twitter:title" content="${title}"`)
                .replace(/name="twitter:description" content="[^"]*"/, `name="twitter:description" content="${description}"`);

            res.send(injectedHtml);

        } catch (error) {
            console.error("Error inyectando metadatos tracking:", error);
            res.send(htmlData);
        }
    });
});

// GS1 Digital Link
app.get('/01/:gtin/10/:loteId', gs1Resolver.resolve);

// 7. SECCIÓN ORIGEN ÚNICO (Con inyección de metadatos)
app.get('/origen-unico', (req, res) => res.sendFile(path.join(__dirname, 'public', 'origen-unico.html')));

app.get('/origen-unico/:slug', async (req, res) => {
    const slugParam = req.params.slug;
    const filePath = path.join(__dirname, 'public', 'landing-empresa.html');

    fs.readFile(filePath, 'utf8', async (err, htmlData) => {
        if (err) return res.status(500).send('Error interno');
        try {
            const companies = await db.getPublicCompaniesDataInternal();
            
            // --- NUEVA LÓGICA DE BÚSQUEDA HÍBRIDA ---
            let company = null;

            // 1. Intentar buscar por ID al final del string (Formato nuevo: nombre-123)
            const lastHyphenIndex = slugParam.lastIndexOf('-');
            if (lastHyphenIndex !== -1) {
                const potentialId = slugParam.substring(lastHyphenIndex + 1);
                // Verificamos si lo que hay después del guion parece un ID (número o string corto)
                company = companies.find(c => String(c.id) === potentialId);
            }

            // 2. Si no se encuentra por ID, buscar por Slug tradicional (Compatibilidad hacia atrás)
            if (!company) {
                company = companies.find(c => createSlug(c.empresa) === slugParam);
            }

            if (company) {
                const title = `${company.empresa} - Origen Único Verificado`;
                const description = `Conoce la trazabilidad y origen de ${company.empresa} en Ruru Lab.`;
                
                const protocol = req.headers['x-forwarded-proto'] || req.protocol; 
                const host = req.get('host');
                let image = `https://rurulab.com/images/banner_1.png`;

                if (company.company_logo) {
                    if (company.company_logo.startsWith('http')) {
                        image = company.company_logo;
                    } else {
                        image = `${protocol}://${host}/api/public/companies/${company.id}/logo`;
                    }
                }

                let injectedHtml = htmlData
                    .replace('<title>Empresas con Origen Único - Ruru Lab</title>', `<title>${title}</title>`)
                    .replace(/content="RuruLab - Trazabilidad y Pasaporte Digital para Cacao y Café"/g, `content="${title}"`)
                    .replace(/content="Crea un pasaporte digital para tu producto..."/g, `content="${description}"`)
                    .replace(/content="https:\/\/rurulab\.com\/images\/banner_1\.png"/g, `content="${image}"`);
                
                res.send(injectedHtml);
            } else {
                // Si no se encuentra, enviamos el HTML base. 
                // El frontend se encargará de mostrar "Empresa no encontrada" al no poder cargar la API.
                res.send(htmlData);
            }
        } catch (error) {
            console.error("Error inyectando metadatos:", error);
            res.send(htmlData);
        }
    });
});

// --- SITEMAP DINÁMICO PARA ORIGEN ÚNICO ---
app.get('/sitemap-origen-unico.xml', async (req, res) => {
    try {
        // 1. Obtener todas las empresas (Verificadas y Sugeridas)
        // Reutilizamos la función que ya creaste en db.js
        const companies = await db.getPublicCompaniesDataInternal();

        // 2. Configurar el inicio del XML
        let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
        sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        // 3. Añadir la página principal del directorio
        sitemap += '  <url>\n';
        sitemap += '    <loc>https://rurulab.com/origen-unico</loc>\n';
        sitemap += '    <changefreq>daily</changefreq>\n';
        sitemap += '    <priority>0.9</priority>\n';
        sitemap += '  </url>\n';

        // 4. Generar URL por cada empresa
        companies.forEach(company => {
            // Usamos la misma lógica de slug que usas en origen-unico-app.js
            const slug = createSlug(company.empresa) + '-' + company.id;
            const url = `https://rurulab.com/origen-unico/${slug}`;
            
            sitemap += '  <url>\n';
            sitemap += `    <loc>${url}</loc>\n`;
            sitemap += '    <changefreq>weekly</changefreq>\n';
            sitemap += '    <priority>0.8</priority>\n';
            sitemap += '  </url>\n';
        });

        sitemap += '</urlset>';

        // 5. Enviar respuesta con el tipo de contenido correcto
        res.header('Content-Type', 'application/xml');
        res.send(sitemap);

    } catch (error) {
        console.error("Error generando sitemap dinámico:", error);
        res.status(500).end();
    }
});

app.get('/api/public/companies', db.getPublicCompaniesWithImmutable);
app.get('/api/public/companies/:userId/products', db.getPublicProductsWithImmutable);
app.get('/api/public/products/:productId/batches', db.getPublicBatchesForProduct);
app.get('/api/public/companies/:userId/landing', db.getCompanyLandingData);

// 8. RUTAS PROTEGIDAS (VISTAS APP)
//app.get('/app/dashboard', authenticatePage, checkSubscription('profesional'), (req, res) => res.sendFile(path.join(__dirname, 'views', 'dashboard.html')));
app.get('/app/dashboard', authenticatePage, (req, res) => res.sendFile(path.join(__dirname, 'views', 'dashboard.html')));
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
app.get('/app/admin-suggestions', authenticatePage, checkAdmin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin-suggestions.html')));
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
app.get('/api/productos', authenticateApi, productosController.getProductos);
app.post('/api/productos', authenticateApi, productosController.createProducto);
app.put('/api/productos/:id', authenticateApi, productosController.updateProducto);
app.delete('/api/productos/:id', authenticateApi, productosController.deleteProducto);
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
app.get('/api/admin/suggestions', authenticateApi, checkAdmin, suggestionsController.getAdminSuggestions);
app.delete('/api/admin/suggestions/:id', authenticateApi, checkAdmin, suggestionsController.deleteSuggestion);
app.post('/api/admin/suggestions/:id/magic-link', authenticateApi, checkAdmin, suggestionsController.generateMagicLink);
app.put('/api/admin/suggestions/:id', authenticateApi, checkAdmin, suggestionsController.updateSuggestion);

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