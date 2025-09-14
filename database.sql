-- Elimina las tablas anteriores si existen para asegurar un esquema limpio.
DROP TABLE IF EXISTS perfiles_cacao, lotes, procesadoras, fincas, etapas_plantilla, plantillas_proceso, users CASCADE;

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
    celular TEXT,
    correo TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Plantillas de Proceso (Productos)
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
    campos_json JSONB NOT NULL
);

-- Tabla de Lotes (Modificada)
CREATE TABLE IF NOT EXISTS lotes (
    id TEXT PRIMARY KEY,
    plantilla_id INTEGER REFERENCES plantillas_proceso(id) ON DELETE CASCADE,
    etapa_id INTEGER NOT NULL REFERENCES etapas_plantilla(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES lotes(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Otras tablas
CREATE TABLE IF NOT EXISTS fincas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    propietario TEXT,
    dni_ruc TEXT,
    nombre_finca TEXT NOT NULL,
    pais TEXT, ciudad TEXT, altura INTEGER, superficie NUMERIC, coordenadas JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, nombre_finca)
);
CREATE TABLE IF NOT EXISTS procesadoras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ruc TEXT NOT NULL, razon_social TEXT NOT NULL, nombre_comercial TEXT, tipo_empresa TEXT, pais TEXT, ciudad TEXT, direccion TEXT, telefono TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, ruc)
);
CREATE TABLE IF NOT EXISTS perfiles_cacao (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    perfil_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, nombre)
);

-- SEEDING: Precarga de plantillas por defecto para el primer usuario (user_id = 1)
WITH cacao_template AS (
    INSERT INTO plantillas_proceso (user_id, nombre_producto, descripcion)
    VALUES (1, 'Cacao Fino de Aroma', 'Plantilla estándar para el proceso de cacao.')
    RETURNING id
)
INSERT INTO etapas_plantilla (plantilla_id, nombre_etapa, orden, campos_json)
VALUES
    ((SELECT id FROM cacao_template), 'Cosecha', 1, '{"entradas": ["pesoMazorcas"], "salidas": ["pesoGranosFrescos"], "variables": ["Finca", "fechaCosecha", "Foto"]}'),
    ((SELECT id FROM cacao_template), 'Fermentación', 2, '{"entradas": ["pesoGranosFrescos"], "salidas": ["pesoFermentadoHumedo"], "variables": ["lugarProceso", "fechaInicio", "metodo", "duracion", "Foto"]}'),
    ((SELECT id FROM cacao_template), 'Secado', 3, '{"entradas": ["pesoFermentadoHumedo"], "salidas": ["pesoSeco"], "variables": ["lugarProceso", "fechaInicio", "metodo", "duracion", "Foto"]}'),
    ((SELECT id FROM cacao_template), 'Tostado', 4, '{"entradas": ["pesoSeco"], "salidas": ["pesoTostado"], "variables": ["Procesadora", "tipoPerfil", "fechaTostado", "clasificacion", "tempMinima", "tempMaxima", "duracion", "perfilAroma", "Foto"]}'),
    ((SELECT id FROM cacao_template), 'Descascarillado & Molienda', 5, '{"entradas": ["pesoTostado"], "salidas": ["pesoProductoFinal", "pesoCascarilla"], "variables": ["Procesadora", "productoFinal", "fecha"]}');

WITH cafe_template AS (
    INSERT INTO plantillas_proceso (user_id, nombre_producto, descripcion)
    VALUES (1, 'Café de Altura', 'Plantilla estándar para el proceso de café lavado.')
    RETURNING id
)
INSERT INTO etapas_plantilla (plantilla_id, nombre_etapa, orden, campos_json)
VALUES
    ((SELECT id FROM cafe_template), 'Cosecha', 1, '{"entradas": ["pesoCereza"], "salidas": [], "variables": ["Finca", "variedad", "fecha"]}'),
    ((SELECT id FROM cafe_template), 'Despulpado', 2, '{"entradas": ["pesoCereza"], "salidas": ["pesoPergaminoHumedo"], "variables": ["metodo", "fecha"]}'),
    ((SELECT id FROM cafe_template), 'Fermentación', 3, '{"entradas": ["pesoPergaminoHumedo"], "salidas": ["pesoFermentado"], "variables": ["tipoTanque", "horas", "fecha"]}'),
    ((SELECT id FROM cafe_template), 'Lavado', 4, '{"entradas": ["pesoFermentado"], "salidas": ["pesoLavado"], "variables": ["metodo", "fecha"]}'),
    ((SELECT id FROM cafe_template), 'Secado', 5, '{"entradas": ["pesoLavado"], "salidas": ["pesoPergaminoSeco"], "variables": ["tipoSecado", "dias", "fecha"]}');

