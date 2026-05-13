# Quickstart: White Label Landing Page

## Prerequisitos

- Node.js 18+
- SQLite (desarrollo local) o PostgreSQL (producción)
- Acceso al repositorio `trazabilidad`

## Setup Local

```bash
# 1. Clonar e instalar
git clone https://github.com/kaox/trazabilidad.git
cd trazabilidad
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con credenciales locales

# 3. Ejecutar migración de White Label
sqlite3 data/trazabilidad.db < migrations/add_white_label_config.sql

# 4. Iniciar servidor de desarrollo
npm run dev
# → http://localhost:3000
```

## Probar Subdominio Local

Para simular un subdominio en desarrollo local:

```bash
# Editar /etc/hosts (requiere sudo)
sudo echo "127.0.0.1 burgoschocolate.localhost" >> /etc/hosts

# Acceder a:
# http://burgoschocolate.localhost:3000       → Inicio (White Label)
# http://burgoschocolate.localhost:3000/#tienda   → Tienda
# http://burgoschocolate.localhost:3000/#contacto → Contáctanos
```

## Probar Ruta Directa

Sin necesidad de configurar subdominio:

```
http://localhost:3000/origen-unico/burgos-chocolate-1
```

## Configurar White Label para una Empresa

```sql
-- Ejemplo: Configurar Burgos Chocolate (user_id conocido)
UPDATE company_profiles 
SET white_label_config = '{"accent_color":"#C8A96E","primary_color":"#3B1F0B","whatsapp_number":"+51987654321","contact_email":"ventas@burgos.com","hero_title":"Chocolate de Origen Único"}'
WHERE user_id = '<USER_ID>';
```

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `server.js:35-71` | Middleware de detección de subdominio |
| `server.js:522+` | Handler de `/origen-unico/:slug` |
| `public/landing-empresa.html` | Template HTML del portal White Label |
| `public/js/landing-empresa.js` | Lógica client-side (SPA router, catálogo, contacto) |
| `public/css/landing.css` | CSS Variables dinámicas por cliente |
| `src/utils/landingRenderer.js` | SSR renderer (Inicio, Tienda) |
| `src/controllers/landingsController.js` | Data aggregation para el landing |
| `src/models/CompanyProfile.js` | CRUD de company_profiles + white_label_config |

## Verificación

```bash
# Lighthouse audit (requiere Chrome)
npx lighthouse http://localhost:3000/origen-unico/burgos-chocolate-1 --output json --output-path ./lighthouse.json

# Verificar que Performance > 90 y SEO > 95
```
