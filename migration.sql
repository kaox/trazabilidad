-- 1. Asegurar que la extensión UUID esté activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Crear la tabla de Productos (SKUs) si no existe
CREATE TABLE IF NOT EXISTS productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    tipo_producto TEXT, -- 'cacao', 'cafe', 'miel', 'otro'
    peso TEXT, -- Ej: '250g'
    gtin TEXT, -- Código de barras
    is_formal_gtin BOOLEAN DEFAULT FALSE,
    imagenes_json JSONB DEFAULT '[]',
    ingredientes TEXT,
    premios_json JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, gtin)
);

-- 3. Crear la tabla de Blog (CMS) si no existe
CREATE TABLE IF NOT EXISTS blog_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    summary TEXT,
    content TEXT NOT NULL,
    cover_image TEXT,
    author_id INTEGER REFERENCES users(id),
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Actualizar tabla LOTES (Agregar columnas nuevas una por una de forma segura)

-- Agregar columna producto_id (Vinculación con SKU)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lotes' AND column_name='producto_id') THEN
        ALTER TABLE lotes ADD COLUMN producto_id UUID REFERENCES productos(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Agregar columna blockchain_hash (Certificación)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lotes' AND column_name='blockchain_hash') THEN
        ALTER TABLE lotes ADD COLUMN blockchain_hash TEXT;
    END IF;
END $$;

-- Agregar columna is_locked (Inmutabilidad)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lotes' AND column_name='is_locked') THEN
        ALTER TABLE lotes ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Agregar columna views (Contador de vistas)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lotes' AND column_name='views') THEN
        ALTER TABLE lotes ADD COLUMN views INTEGER DEFAULT 0;
    END IF;
END $$;

-- 5. Actualizar tabla FINCAS (Actualizar tipos de datos si es necesario o agregar campos faltantes)
-- Asegurar que imagenes_json sea JSONB (si antes era TEXT, esto podría requerir casting, pero asumimos compatibilidad o creación nueva)
-- Si necesitas agregar campos específicos a fincas que no estaban en versiones viejas:

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fincas' AND column_name='imagenes_json') THEN
        ALTER TABLE fincas ADD COLUMN imagenes_json JSONB DEFAULT '[]';
    END IF;
END $$;

-- NUEVO

-- Agregar columna status (active, recall, expired)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lotes' AND column_name='status') THEN
        ALTER TABLE lotes ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- Agregar columna recall_reason (Razón del retiro)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lotes' AND column_name='recall_reason') THEN
        ALTER TABLE lotes ADD COLUMN recall_reason TEXT;
    END IF;
END $$;

-- Agregar campos de ubicación
ALTER TABLE procesadoras ADD COLUMN departamento TEXT;
ALTER TABLE procesadoras ADD COLUMN provincia TEXT;
ALTER TABLE procesadoras ADD COLUMN distrito TEXT;

-- Eliminar tipo_empresa (PostgreSQL)
ALTER TABLE procesadoras DROP COLUMN tipo_empresa;

-- Agregar campos de ubicación ISO 3166 a la tabla fincas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fincas' AND column_name='departamento') THEN
        ALTER TABLE fincas ADD COLUMN departamento TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fincas' AND column_name='provincia') THEN
        ALTER TABLE fincas ADD COLUMN provincia TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fincas' AND column_name='distrito') THEN
        ALTER TABLE fincas ADD COLUMN distrito TEXT;
    END IF;
END $$;

-- Vincular Productos con Recetas Nutricionales
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='productos' AND column_name='receta_nutricional_id') THEN
        ALTER TABLE productos ADD COLUMN receta_nutricional_id UUID REFERENCES recetas_nutricionales(id) ON DELETE SET NULL;
    END IF;
END $$;