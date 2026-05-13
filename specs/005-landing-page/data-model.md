# Data Model: White Label Landing Page

**Date**: 2026-05-13 | **Plan**: [plan.md](plan.md)

## Cambios en Entidades Existentes

### company_profiles (MODIFY)

**Nuevo campo**:

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `white_label_config` | TEXT (JSON) | YES | NULL | Configuración de personalización visual y contacto para Marca Blanca |

**Estructura del JSON `white_label_config`**:

```json
{
  "accent_color": "#C8A96E",
  "primary_color": "#3B1F0B",
  "whatsapp_number": "+51987654321",
  "contact_email": "ventas@burgoschocolate.com",
  "hero_title": "Chocolate de Origen Único",
  "hero_subtitle": "Del grano a la barra, con trazabilidad verificada"
}
```

| Propiedad | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `accent_color` | String (Hex) | No | Color de acento para botones, iconos y hovers. Default: `#78350f` (ámbar) |
| `primary_color` | String (Hex) | No | Color primario para textos y fondos. Default: `#1c1917` (stone-900) |
| `whatsapp_number` | String (E.164) | No | Número de WhatsApp con código de país. Si es null, se oculta el botón de WhatsApp |
| `contact_email` | String (Email) | No | Email para recibir leads del formulario de contacto. Fallback: `contact_email` de `company_profiles` |
| `hero_title` | String | No | Título personalizado del Hero. Fallback: nombre de la empresa |
| `hero_subtitle` | String | No | Subtítulo del Hero. Fallback: tipo de empresa + ubicación |

**Migración SQL**:

```sql
-- SQLite
ALTER TABLE company_profiles ADD COLUMN white_label_config TEXT DEFAULT NULL;

-- PostgreSQL
ALTER TABLE company_profiles ADD COLUMN white_label_config JSONB DEFAULT NULL;
```

---

## Nueva Entidad (Opcional)

### contact_leads (NEW)

Para almacenar mensajes del formulario de contacto cuando no hay servicio de email configurado.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | TEXT (UUID) | NO | UUID | Identificador único |
| `company_id` | TEXT | NO | - | ID del usuario/empresa destino |
| `name` | TEXT | NO | - | Nombre del remitente |
| `email` | TEXT | NO | - | Email del remitente |
| `message` | TEXT | NO | - | Mensaje del formulario |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Fecha de creación |
| `is_read` | BOOLEAN | NO | FALSE | Si el dueño ya leyó el mensaje |

```sql
CREATE TABLE IF NOT EXISTS contact_leads (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (company_id) REFERENCES users(id)
);
```

---

## Relaciones

```text
company_profiles 1──1 white_label_config (campo JSONB interno)
company_profiles 1──N contact_leads (via company_id → users.id)
company_profiles 1──N productos (via user_id, ya existente)
```

## Datos Existentes Reutilizados (Sin Cambios)

Los siguientes datos ya están disponibles en `getCompanyLandingDataInternal()` y no requieren modificación:

- `user.logo` → Logo del cliente (header)
- `user.cover` → Banner del Hero
- `user.history` → Sección "Sobre Nosotros"
- `entity.certificaciones` → Sección de Certificaciones
- `entity.premios` → Sección de Premios
- `entity.coordenadas` → Mapa de Fincas
- `products[]` → Catálogo de Tienda
- `user.phone` → Fallback para WhatsApp si `white_label_config.whatsapp_number` no existe
