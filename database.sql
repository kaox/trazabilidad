-- EXTENSIONES
--CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
DROP TABLE IF EXISTS traceability_registry CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS ingredientes_receta CASCADE;
DROP TABLE IF EXISTS recetas_nutricionales CASCADE;
DROP TABLE IF EXISTS ingredientes_catalogo CASCADE;
DROP TABLE IF EXISTS acquisitions CASCADE;

-- =======================================================
-- ESQUEMA DE BASE DE DATOS - RURULAB v2.0 (PostgreSQL Production)
-- =======================================================

-- 1. USUARIOS Y ACCESO
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
    default_currency TEXT DEFAULT 'PEN',
    default_unit TEXT DEFAULT 'KG',
    role TEXT DEFAULT 'user', -- 'user', 'admin'
    subscription_tier TEXT DEFAULT 'artesano', -- 'artesano', 'profesional'
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. UNIDADES PRODUCTIVAS (FINCAS)
CREATE TABLE IF NOT EXISTS fincas (
    id TEXT PRIMARY KEY, -- UUID
    user_id INTEGER NOT NULL,
    propietario TEXT,
    dni_ruc TEXT,
    nombre_finca TEXT NOT NULL,
    pais TEXT,
    departamento TEXT,
    provincia TEXT,
    distrito TEXT,
    ciudad TEXT,
    altura INTEGER,
    superficie DOUBLE PRECISION,
    coordenadas JSONB, -- GeoJSON o {lat, lng}
    telefono TEXT,
    historia TEXT,
    imagenes_json JSONB DEFAULT '[]', -- Array de URLs
    certificaciones_json JSONB DEFAULT '[]',
    premios_json JSONB DEFAULT '[]',
    foto_productor TEXT,
    numero_trabajadores INTEGER,
    access_token TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, nombre_finca)
);

-- 3. UNIDADES DE PROCESAMIENTO (PLANTAS)
CREATE TABLE IF NOT EXISTS procesadoras (
    id TEXT PRIMARY KEY, -- UUID
    user_id INTEGER NOT NULL,
    ruc TEXT NOT NULL,
    razon_social TEXT NOT NULL,
    nombre_comercial TEXT,
    tipo_empresa TEXT,
    pais TEXT,
    ciudad TEXT,
    departamento TEXT,
    provincia TEXT,
    distrito TEXT,
    direccion TEXT,
    telefono TEXT,
    coordenadas JSONB,
    premios_json JSONB DEFAULT '[]',
    certificaciones_json JSONB DEFAULT '[]',
    imagenes_json JSONB DEFAULT '[]',
    numero_trabajadores INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, ruc)
);

-- 4. CONFIGURACIÓN DE PROCESOS (PLANTILLAS)
CREATE TABLE IF NOT EXISTS plantillas_proceso (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    nombre_producto TEXT NOT NULL, -- Ej: 'Cacao', 'Café'
    descripcion TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, nombre_producto)
);

-- 5. ETAPAS DEL PROCESO
CREATE TABLE IF NOT EXISTS etapas_plantilla (
    id SERIAL PRIMARY KEY,
    plantilla_id INTEGER NOT NULL,
    nombre_etapa TEXT NOT NULL, -- Ej: 'Cosecha', 'Secado'
    orden INTEGER NOT NULL,
    descripcion TEXT,
    campos_json JSONB NOT NULL, -- Configuración de inputs del formulario
    fase TEXT DEFAULT 'procesamiento', -- 'acopio' o 'procesamiento'
    FOREIGN KEY (plantilla_id) REFERENCES plantillas_proceso(id) ON DELETE CASCADE
);

-- 6. MÓDULO NUTRICIÓN: RECETAS
CREATE TABLE IF NOT EXISTS recetas_nutricionales (
    id TEXT PRIMARY KEY, -- UUID
    user_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    peso_porcion_gramos DOUBLE PRECISION DEFAULT 100,
    porciones_envase DOUBLE PRECISION DEFAULT 1,
    deleted_at TIMESTAMPTZ, -- Soft Delete
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. MÓDULO NUTRICIÓN: INGREDIENTES DE RECETA
CREATE TABLE IF NOT EXISTS ingredientes_receta (
    id TEXT PRIMARY KEY, -- UUID
    receta_id TEXT NOT NULL,
    usda_id TEXT, -- ID de referencia (USDA/OFF)
    nombre TEXT NOT NULL,
    peso_gramos DOUBLE PRECISION NOT NULL,
    nutrientes_base_json JSONB NOT NULL, -- Caché de nutrientes del ingrediente
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (receta_id) REFERENCES recetas_nutricionales(id) ON DELETE CASCADE
);

-- 8. MÓDULO NUTRICIÓN: CATÁLOGO LOCAL (CACHÉ)
CREATE TABLE IF NOT EXISTS ingredientes_catalogo (
    id TEXT PRIMARY KEY, -- UUID
    nombre TEXT NOT NULL,
    origen TEXT DEFAULT 'off', -- 'local', 'off', 'usda'
    codigo_externo TEXT, -- Barcode o FDC ID
    nutrientes_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(codigo_externo)
);

-- 9. CATÁLOGO COMERCIAL (SKUs)
CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY, -- UUID
    user_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    tipo_producto TEXT, -- 'cacao', 'cafe', etc.
    peso TEXT,
    gtin TEXT, -- Código de barras global (GS1)
    is_formal_gtin BOOLEAN DEFAULT FALSE,
    imagen_url TEXT, -- Legacy
    imagenes_json JSONB DEFAULT '[]', -- Array de URLs
    ingredientes TEXT,
    premios_json JSONB DEFAULT '[]',
    receta_nutricional_id TEXT, -- Vinculación con Módulo Nutrición
    deleted_at TIMESTAMPTZ, -- Soft Delete
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receta_nutricional_id) REFERENCES recetas_nutricionales(id) ON DELETE SET NULL,
    UNIQUE(user_id, gtin)
);

-- 10. MÓDULO DE ACOPIO (MATERIA PRIMA)
CREATE TABLE IF NOT EXISTS acquisitions (
    id TEXT PRIMARY KEY, -- Ej: ACP-XXXX
    user_id INTEGER NOT NULL,
    nombre_producto TEXT NOT NULL, -- 'Cacao', 'Café'
    tipo_acopio TEXT NOT NULL, -- 'Baba', 'Grano Seco'
    subtipo TEXT, -- 'Lavado', 'Honey'
    fecha_acopio DATE,
    peso_kg DOUBLE PRECISION,
    precio_unitario DOUBLE PRECISION,

    -- DATOS ORIGINALES (Lo que ingresó el usuario)
    original_quantity DOUBLE PRECISION,
    original_price DOUBLE PRECISION,
    unit_id INTEGER REFERENCES units_of_measure(id),
    currency_id INTEGER REFERENCES currencies(id),

    finca_origen TEXT,
    observaciones TEXT,
    imagenes_json JSONB,
    data_adicional JSONB, -- Campos dinámicos del formulario
    estado TEXT DEFAULT 'disponible', -- 'disponible', 'procesado', 'agotado'
    deleted_at TIMESTAMPTZ, -- Soft Delete
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 11. MÓDULO DE PROCESAMIENTO (LOTES/BATCHES)
CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY, -- Ej: TOS-XXXX
    plantilla_id INTEGER,
    etapa_id INTEGER NOT NULL,
    user_id INTEGER, -- Dueño del lote raíz
    parent_id TEXT, -- ID del lote padre (si es continuación)
    
    producto_id TEXT, -- Vinculación opcional a un SKU comercial
    acquisition_id TEXT, -- Vinculación al Acopio de origen
    
    data JSONB NOT NULL, -- Datos técnicos del proceso
    
    -- Blockchain y Seguridad
    blockchain_hash TEXT,
    is_locked BOOLEAN DEFAULT FALSE,
    views INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    recall_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plantilla_id) REFERENCES plantillas_proceso(id) ON DELETE CASCADE,
    FOREIGN KEY (etapa_id) REFERENCES etapas_plantilla(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES batches(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL,
    FOREIGN KEY (acquisition_id) REFERENCES acquisitions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS batch_outputs (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    product_type VARCHAR(100) NOT NULL, -- Ej: 'CAFE_ORO', 'CASCARILLA', 'MERMA'
    quantity NUMERIC(10, 2) NOT NULL,
    unit_id INTEGER,
    unit_cost NUMERIC(10, 2),
    currency_id INTEGER,
    output_category VARCHAR(20) DEFAULT 'principal', -- 'principal', 'subproducto', 'merma'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_batch
      FOREIGN KEY(batch_id) 
      REFERENCES batches(id)
      ON DELETE CASCADE,
      
    CONSTRAINT fk_unit
      FOREIGN KEY(unit_id) 
      REFERENCES units_of_measure(id)
      ON DELETE SET NULL,
      
    CONSTRAINT fk_currency
      FOREIGN KEY(currency_id) 
      REFERENCES currencies(id)
      ON DELETE SET NULL
);

-- 12. TABLA OPTIMIZADA DE LECTURA (TRAZABILIDAD PÚBLICA)
CREATE TABLE IF NOT EXISTS traceability_registry (
    id TEXT PRIMARY KEY, -- Mismo ID que el lote final
    batch_id TEXT,
    user_id INTEGER,
    nombre_producto TEXT,
    gtin TEXT,
    fecha_finalizacion DATE,
    snapshot_data JSONB NOT NULL, -- JSON con toda la historia pre-calculada
    blockchain_hash TEXT,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 13. TABLAS COMPLEMENTARIAS (CALIDAD Y COSTOS)

CREATE TABLE IF NOT EXISTS perfiles (
    id SERIAL PRIMARY KEY, 
    user_id INTEGER NOT NULL, 
    nombre TEXT NOT NULL, 
    tipo TEXT NOT NULL, 
    perfil_data JSONB NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ruedas_sabores (
    id SERIAL PRIMARY KEY, 
    user_id INTEGER NOT NULL, 
    nombre_rueda TEXT NOT NULL, 
    tipo TEXT NOT NULL, 
    notas_json JSONB NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS blends (
    id TEXT PRIMARY KEY, 
    user_id INTEGER NOT NULL, 
    nombre_blend TEXT NOT NULL, 
    tipo_producto TEXT NOT NULL, 
    componentes_json JSONB NOT NULL, 
    perfil_final_json JSONB NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recetas_chocolate (
    id TEXT PRIMARY KEY, 
    user_id INTEGER NOT NULL, 
    nombre_receta TEXT NOT NULL, 
    componentes_json JSONB NOT NULL, 
    perfil_final_json JSONB NOT NULL, 
    tiempo_conchado INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batch_costs (
    batch_id TEXT PRIMARY KEY, 
    user_id INTEGER NOT NULL, 
    cost_data JSONB NOT NULL, 
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_reviews (
    id SERIAL PRIMARY KEY, 
    batch_id TEXT NOT NULL, 
    user_email TEXT NOT NULL, 
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), 
    comment TEXT, 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, 
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE, 
    UNIQUE(batch_id, user_email)
);

CREATE TABLE IF NOT EXISTS blog_posts (
    id TEXT PRIMARY KEY, 
    title TEXT NOT NULL, 
    slug TEXT NOT NULL UNIQUE, 
    summary TEXT, 
    content TEXT NOT NULL, 
    cover_image TEXT, 
    author_id INTEGER, 
    is_published BOOLEAN DEFAULT FALSE, 
    published_at TIMESTAMPTZ, 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lote_costs (
    batch_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    cost_data JSONB NOT NULL,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

-- -----------------------------------------------------
-- Tabla: units_of_measure
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS units_of_measure (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT,
    type TEXT NOT NULL, -- 'MASA', 'VOLUMEN', 'UNIDAD'
    base_factor REAL DEFAULT 1.0, -- Factor para convertir a la unidad base (KG para masa, L para volumen)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Carga inicial: Unidades de Medida
INSERT INTO units_of_measure (code, name, type, base_factor) VALUES
    ('KG', 'Kilogramo', 'MASA', 1.0),
    ('LB', 'Libra', 'MASA', 0.453592),
    ('G', 'Gramo', 'MASA', 0.001),
    ('TON', 'Tonelada', 'MASA', 1000.0),
    ('QQ', 'Quintal (46kg)', 'MASA', 46.0),
    ('L', 'Litro', 'VOLUMEN', 1.0),
    ('ML', 'Mililitro', 'VOLUMEN', 0.001),
    ('GAL', 'Galón (US)', 'VOLUMEN', 3.78541),
    ('Un', 'Unidad', 'UNIDAD', 1.0)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------
-- Tabla: currencies
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS currencies (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    symbol TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Carga inicial: Monedas
INSERT INTO currencies (code, name, symbol) VALUES
    ('USD', 'Dólar Estadounidense', '$'),
    ('PEN', 'Sol Peruano', 'S/'),
    ('EUR', 'Euro', '€'),
    ('COP', 'Peso Colombiano', '$'),
    ('CLP', 'Peso Chileno', '$'),
    ('MXN', 'Peso Mexicano', '$'),
    ('BRL', 'Real Brasileño', 'R$')
ON CONFLICT (code) DO NOTHING;

-- ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_batches_user ON batches(user_id);
CREATE INDEX IF NOT EXISTS idx_batches_parent ON batches(parent_id);
CREATE INDEX IF NOT EXISTS idx_acquisitions_user ON acquisitions(user_id);
CREATE INDEX IF NOT EXISTS idx_trace_gtin ON traceability_registry(gtin);