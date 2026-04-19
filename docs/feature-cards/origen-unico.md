# 📌 Feature Card: Landing de Origen Único

## 📖 Resumen
**Nombre de la Función:** Landing Empresarial de Origen Único (Single Origin)  
**Descripción:** Plataforma de páginas públicas (landing pages) altamente optimizadas que actúan como la vitrina o página web oficial de las fincas y procesadoras. Permite a los productores contar su historia, mostrar su terroir, reconocimientos, y enlazar su propio catálogo de productos en un formato elegante e indexable para SEO.  
**Público Objetivo:** Productores de café y cacao, procesadoras, y compradores finales que desean verificar el origen exacto y la identidad detrás de un producto de especialidad.

---

## 🎯 Objetivos y Propuesta de Valor
- **Identidad Digital Transparente:** Ofrecer a fincas y procesadoras una "página web instantánea" y profesional sin que ellos tengan que programar ni configurar nada, donde pueden exponer de manera contundente la historia del lugar de cosecha.
- **Micro-Sitios y Subdominios:** Brindar presencia digital independiente. Soporta acceso mediante rutas amigables (ej: `/origen-unico/finca-el-paraiso`) e incluso dominios/subdominios dedicados (ej: `fincaelparaiso.rurulab.com`).
- **Verificación Geoespacial:** Situar al usuario geográficamente proporcionando mini-mapas y datos de altitud y terroir exactos para respaldar la calidad de origen.

---

## 📝 Historias de Usuario
- Como **Productor de Café**, quiero tener una URL propia con la historia de mi finca, galería de fotos y mi logo para poder enviársela a posibles clientes internacionales.
- Como **Comprador Mayorista**, quiero entrar a la página de origen de un productor y ver sus certificaciones, altitud, y ubicación exacta en Google Maps para verificar el origen real del grano.
- Como **Comunidad / Ruru Lab**, quiero poder generar "Perfiles Sugeridos" (Scraping) de fincas que existen pero aún no usan la app, con un botón para que el dueño real pueda "Reclamar este Perfil".
- Como **Consumidor**, quiero ver todo el catálogo actual de lotes disponibles de una finca en particular directamente desde su página de Origen Único.

---

## 💻 Elementos de UI / UX
- **Hero Image Dinámico:** Un banner principal inmersivo que expone la imagen de portada de la finca oscurecida con el logo resaltado al frente, el nombre y el tipo de establecimiento (Finca o Procesadora).
- **Sección de Identidad:** 
  - Descripción narrada (historia).
  - Galería interactiva in-page capaz de abrir un modal a pantalla completa (soporta imágenes y videos de YouTube).
  - Enlaces de compatibilidad integrados a WhatsApp, Instagram y Facebook.
- **Sección de Terroir e Infraestructura:**
  - Mini mapa interactivo (Google Maps Satelital) autogenerado partir de coordenadas o polígonos GPS.
  - Escudos/insignias de Certificaciones (Ej: Orgánico, Fair Trade) y Premios obtenidos con distintivos visuales de los años que los ganaron.
- **Catálogo Integrado:** Sección renderizada de tarjetas de producto que despliega únicamente los lotes activos de esa empresa, con botones de acción directa de compra vía WhatsApp o de visualización SEO detallada.
- **Banner de Verificación (Claim Profile):** (Solo si aplica) Un listón de advertencia si la finca fue "sugerida" animando al dueño a reclamar su control total.

---

## ⚙️ Arquitectura Técnica

### 1. Frontend (`landing-empresa.js`, `origen-unico.html`)
- **Gestión de Carga:** El script detecta si está bajo un subdominio (`window.IS_SUBDOMAIN`) o en una ruta convencional (parseando de la URL el sufijo `-ID`) y recupera los datos de la REST API dinámicamente.
- **Renderizado Dinámico:** 
  - La galería es pre-cargada con controles de teclado completos (flechas y ESC) para una experiencia inmersiva (`Carousel UI`).
  - Google Maps se instancia vía el Objeto API estático (`initMiniMap()`) si hay datos lat/lng.
- **Analíticas (Tracking):** Se acciona un colector invisible `trackEvent('landing_view')` para contar cuantas personas visualizan e interactúan con la vitrina de manera nativa en el dashboard.

### 2. Backend (`server.js`, `landingsController.js`, `empresasController.js`)
- **Endpoints:** 
  - `GET /origen-unico/:slug`: Renderizador Server-Side (SSR) que inyecta Meta-etiquetas ricas en SEO (Open Graph, Título, Imagen) del productor antes de servir la página base en HTML para previsualizaciones ricas en WhatsApp/Redes.
  - `GET /api/public/companies/:id/landing`: Devuelve el JSON orquestado con el Perfil (Finca), Empresa, Redes, Coordenadas y el vector de Productos activos asociados.
  - `GET /sitemap-origen-unico.xml`: Rutina sitemap que le expone explícitamente a Google todas las URLs dinámicas de fincas verídicas para ser indexadas.
- **Estrategia en Subdominios:** El middleware general evalúa el host; si difiere de dominios reservado (`www`, `app`, `api`), consulta a la DB de Inquilinos/Compañías para servir silenciosamente la landing (`landing-empresa.html`) a través del host subarrendado sin revelar `/origen-unico`.

---

## 🔗 Dependencias y Modelos de Datos
- **Tablas de la BD:** `users`, `empresas` (o procesadoras), `fincas`, `certificaciones`, `premios`, `productos`.
- **Activos Externos (APIs):** 
  - SDK de Geolocalización de Google Maps (`maps.googleapis.com`).
- **Integraciones:** JSON-LD de `Schema.org` (Entidad de tipo `Organization` / `LocalBusiness`) inyectado en background, vitalizando el "Local SEO" del productor para arrojar tarjetas ricas de Google (Rich Snippets).
