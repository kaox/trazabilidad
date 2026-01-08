-- EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Paso 1: Eliminar las tablas existentes en el orden correcto para evitar errores de dependencia.
-- La cláusula "CASCADE" asegura que también se eliminen las relaciones.
DROP TABLE IF EXISTS blog_posts CASCADE;
DROP TABLE IF EXISTS product_reviews CASCADE;
DROP TABLE IF EXISTS lote_costs CASCADE;
DROP TABLE IF EXISTS recetas_chocolate CASCADE;
DROP TABLE IF EXISTS blends CASCADE;
DROP TABLE IF EXISTS ruedas_sabores CASCADE;
DROP TABLE IF EXISTS perfiles CASCADE;
DROP TABLE IF EXISTS perfiles_cacao CASCADE;
DROP TABLE IF EXISTS perfiles_cafe CASCADE;
DROP TABLE IF EXISTS lotes CASCADE; -- Lotes depende de productos, plantillas y etapas
DROP TABLE IF EXISTS productos CASCADE; -- Nueva tabla
DROP TABLE IF EXISTS etapas_plantilla CASCADE;
DROP TABLE IF EXISTS plantillas_proceso CASCADE;
DROP TABLE IF EXISTS procesadoras CASCADE;
DROP TABLE IF EXISTS fincas CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Paso 2: Crear las tablas con la estructura más reciente y correcta.

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    usuario TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nombre TEXT,
    apellido TEXT,
    dni TEXT,
    ruc TEXT,
    empresa TEXT,
    company_logo TEXT,
    celular TEXT,
    correo TEXT,
    role TEXT DEFAULT 'user',
    subscription_tier TEXT DEFAULT 'artesano',
    trial_ends_at TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Fincas
CREATE TABLE IF NOT EXISTS fincas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    propietario TEXT,
    dni_ruc TEXT,
    nombre_finca TEXT NOT NULL,
    pais TEXT,
    departamento TEXT, -- Estado/Region
    provincia TEXT,    -- Ciudad/Provincia
    distrito TEXT,     -- Municipio/Localidad
    ciudad TEXT,       -- (Campo legacy o ciudad principal)
    altura INTEGER,
    superficie NUMERIC,
    coordenadas JSONB,
    telefono TEXT,
    historia TEXT,
    imagenes_json JSONB DEFAULT '[]',
    certificaciones_json JSONB DEFAULT '[]',
    premios_json JSONB DEFAULT '[]',
    foto_productor TEXT,
    numero_trabajadores INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, nombre_finca)
);

-- Tabla de Procesadoras
CREATE TABLE IF NOT EXISTS procesadoras (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ruc TEXT NOT NULL,
    razon_social TEXT NOT NULL,
    nombre_comercial TEXT,
    -- tipo_empresa ELIMINADO
    pais TEXT,
    ciudad TEXT,
    departamento TEXT, -- NUEVO
    provincia TEXT,    -- NUEVO
    distrito TEXT,     -- NUEVO
    direccion TEXT,
    telefono TEXT,
    coordenadas JSONB,
    premios_json JSONB DEFAULT '[]',
    certificaciones_json JSONB DEFAULT '[]',
    imagenes_json JSONB DEFAULT '[]',
    numero_trabajadores INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, ruc)
);

-- Tabla de Plantillas de Proceso (Productos Base)
CREATE TABLE IF NOT EXISTS plantillas_proceso (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre_producto TEXT NOT NULL,
    descripcion TEXT,
    UNIQUE(user_id, nombre_producto)
);

-- Tabla de Etapas de cada Plantilla
CREATE TABLE IF NOT EXISTS etapas_plantilla (
    id SERIAL PRIMARY KEY,
    plantilla_id INTEGER NOT NULL REFERENCES plantillas_proceso(id) ON DELETE CASCADE,
    nombre_etapa TEXT NOT NULL,
    orden INTEGER NOT NULL,
    descripcion TEXT,
    campos_json JSONB NOT NULL
);

-- Tabla de Productos Comerciales (SKUs)
-- Esta tabla define las presentaciones finales (ej. Tableta 70%, Café Tostado 250g)
CREATE TABLE IF NOT EXISTS productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    tipo_producto TEXT, -- 'cacao', 'cafe', 'miel', 'otro'
    peso TEXT, -- Ej: '250g'
    gtin TEXT, -- Código de barras
    is_formal_gtin BOOLEAN DEFAULT FALSE,
    imagenes_json JSONB DEFAULT '[]', -- Array de strings Base64
    ingredientes TEXT,
    premios_json JSONB DEFAULT '[]', -- Array de objetos premio
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, gtin)
);

-- Tabla de Lotes
CREATE TABLE IF NOT EXISTS lotes (
    id TEXT PRIMARY KEY, -- IDs personalizados (ej: 'COS-123')
    plantilla_id INTEGER REFERENCES plantillas_proceso(id) ON DELETE CASCADE,
    etapa_id INTEGER NOT NULL REFERENCES etapas_plantilla(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES lotes(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES productos(id) ON DELETE SET NULL, -- Vinculación con el SKU final
    data JSONB NOT NULL,
    
    -- Campos Certificación Blockchain
    blockchain_hash TEXT,
    is_locked BOOLEAN DEFAULT FALSE,
    
    -- Analytics
    views INTEGER DEFAULT 0,
    
    -- Estados GS1 / Seguridad
    status TEXT DEFAULT 'active', -- 'active', 'recall', 'expired', 'quarantine'
    recall_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Perfiles
CREATE TABLE IF NOT EXISTS perfiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'cacao', 'cafe', 'miel', etc.
    perfil_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, nombre, tipo)
);

-- Tabla de Ruedas de Sabores
CREATE TABLE IF NOT EXISTS ruedas_sabores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre_rueda TEXT NOT NULL,
    tipo TEXT NOT NULL,
    notas_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, nombre_rueda)
);

-- Tabla de Blends (I+D)
CREATE TABLE IF NOT EXISTS blends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre_blend TEXT NOT NULL,
    tipo_producto TEXT NOT NULL,
    componentes_json JSONB NOT NULL,
    perfil_final_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, nombre_blend)
);

-- Tabla de Recetas de Chocolate (I+D)
CREATE TABLE IF NOT EXISTS recetas_chocolate (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre_receta TEXT NOT NULL,
    componentes_json JSONB NOT NULL,
    perfil_final_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, nombre_receta)
);

-- Tabla de Costos de Lotes
CREATE TABLE IF NOT EXISTS lote_costs (
    lote_id TEXT PRIMARY KEY REFERENCES lotes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cost_data JSONB NOT NULL
);

-- Tabla de Reseñas de Productos
CREATE TABLE IF NOT EXISTS product_reviews (
    id SERIAL PRIMARY KEY,
    lote_id TEXT NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lote_id, user_email)
);

-- Tabla de Blog (CMS)
CREATE TABLE IF NOT EXISTS blog_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    summary TEXT, 
    content TEXT NOT NULL,
    cover_image TEXT,
    author_id INTEGER REFERENCES users(id),
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 15. MODULO NUTRICIÓN: RECETAS
CREATE TABLE IF NOT EXISTS recetas_nutricionales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    peso_porcion_gramos NUMERIC DEFAULT 100, -- Tamaño de porción
    porciones_envase NUMERIC DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 16. MODULO NUTRICIÓN: INGREDIENTES DE RECETA
CREATE TABLE IF NOT EXISTS ingredientes_receta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receta_id UUID NOT NULL REFERENCES recetas_nutricionales(id) ON DELETE CASCADE,
    usda_id TEXT, -- ID oficial de la USDA FoodData Central
    nombre TEXT NOT NULL,
    peso_gramos NUMERIC NOT NULL,
    -- Guardamos la data nutricional base (por 100g) en JSON para no depender de la API siempre
    nutrientes_base_json JSONB NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);