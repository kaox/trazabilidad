# Research: White Label Landing Page

**Date**: 2026-05-13 | **Plan**: [plan.md](plan.md)

## R1: Almacenamiento de Configuración White Label

**Decision**: Campo `white_label_config` tipo TEXT (JSON serializado) en la tabla existente `company_profiles`.

**Rationale**: La tabla `company_profiles` ya contiene `subdomain`, `contact_email`, `contact_phone`, `logo_url`, `cover_image_url`, `history_text`. Agregar un campo JSON flexible permite almacenar `accent_color`, `primary_color`, `whatsapp_number`, y futuras extensiones sin migraciones adicionales. SQLite no soporta JSONB nativo, pero un campo TEXT con JSON serializado es compatible tanto con SQLite como con PostgreSQL (que lo parseará como JSONB si se declara así).

**Alternatives Considered**:
- Tabla separada `white_label_configs`: Rechazada por complejidad innecesaria (relación 1:1 con company_profiles).
- Variables de entorno por subdominio: Rechazada por falta de escalabilidad y gestión dinámica.

---

## R2: Routing Multi-Página (SPA vs MPA)

**Decision**: SPA con hash routing client-side (`#inicio`, `#tienda`, `#contacto`) dentro de `landing-empresa.html`.

**Rationale**: El sistema actual ya inyecta `window.INITIAL_DATA` con todos los datos necesarios (productos, entidad, perfil) en una sola carga SSR. Usar routing client-side evita llamadas adicionales al servidor y mantiene la experiencia de carga rápida (FCP < 1.2s). El SEO se mantiene porque el contenido principal ya está pre-renderizado por `landingRenderer.js`.

**Alternatives Considered**:
- Rutas Express separadas (`/tienda`, `/contacto`): Rechazada porque requiere múltiples lecturas de archivos y llamadas a DB por cada navegación, duplicando la lógica de SSR.
- Framework SPA (React/Vue): Rechazada por violación de la constitución (Vanilla JS/HTML5/CSS3).

---

## R3: Inyección de Paleta de Colores Dinámica

**Decision**: CSS Custom Properties (`--accent-color`, `--primary-color`, `--accent-hover`) inyectadas como inline style en el `<html>` o `<body>` durante SSR.

**Rationale**: Las CSS Variables se heredan por cascada a todos los elementos hijos. Inyectarlas en el elemento raíz durante el renderizado SSR asegura que todo el CSS (botones, iconos, hovers) adopte la paleta del cliente sin JavaScript adicional. Esto es compatible con el enfoque de "CSS Vanilla" de la constitución.

**Alternatives Considered**:
- Generación dinámica de archivo CSS por empresa: Rechazada por complejidad de caché y servicio de archivos.
- Clases de Tailwind dinámicas: Rechazada porque Tailwind compila las clases estáticamente y no soporta valores dinámicos en runtime sin JIT.

---

## R4: Subdomain Middleware — Soporte Multi-Ruta

**Decision**: Extender el middleware existente (server.js:35-71) para servir `landing-empresa.html` no solo en `/` sino también en `/tienda` y `/contacto` cuando se detecta un subdominio de cliente.

**Rationale**: El middleware actual solo intercepta `req.path === '/'`. Para que las rutas `/tienda` y `/contacto` funcionen bajo subdominio, se debe ampliar la condición a un set de rutas conocidas del portal White Label. Esto evita conflictar con rutas de la API o assets estáticos.

**Alternatives Considered**:
- Catch-all para subdominio: Rechazada porque interferiría con `/api/*`, `/js/*`, `/css/*`.

---

## R5: Formulario de Contacto — Backend

**Decision**: Endpoint `POST /api/public/contact` que recibe `{name, email, message, companyId}` y envía un correo al `contact_email` del `white_label_config`. Fallback: si no hay servicio de correo configurado, almacenar en tabla `contact_leads`.

**Rationale**: Los productores artesanales necesitan un canal de leads profesional. El formulario debe funcionar incluso si no se configura un servicio de email externo (se almacena localmente para consulta posterior).

**Alternatives Considered**:
- Solo WhatsApp: Rechazada porque A-007 explícitamente requiere formulario + WhatsApp.
- Servicio externo (Formspree, EmailJS): Rechazada por dependencia externa innecesaria.
