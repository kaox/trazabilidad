-- Paso 1: Eliminar las tablas existentes en el orden correcto para evitar errores de dependencia.
-- La cláusula "CASCADE" asegura que también se eliminen las relaciones.
DROP TABLE IF EXISTS perfiles_cacao CASCADE;
DROP TABLE IF EXISTS ruedas_sabores CASCADE;
DROP TABLE IF EXISTS lotes CASCADE;
DROP TABLE IF EXISTS etapas_plantilla CASCADE;
DROP TABLE IF EXISTS plantillas_proceso CASCADE;
DROP TABLE IF EXISTS procesadoras CASCADE;
DROP TABLE IF EXISTS fincas CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Paso 2: Crear las tablas con la estructura más reciente y correcta.

-- Habilitar la extensión para UUIDs si no está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Tabla de Lotes
CREATE TABLE IF NOT EXISTS lotes (
    id TEXT PRIMARY KEY,
    plantilla_id INTEGER REFERENCES plantillas_proceso(id) ON DELETE CASCADE,
    etapa_id INTEGER NOT NULL REFERENCES etapas_plantilla(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES lotes(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Fincas
CREATE TABLE IF NOT EXISTS fincas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    propietario TEXT,
    dni_ruc TEXT,
    nombre_finca TEXT NOT NULL,
    pais TEXT, ciudad TEXT, altura INTEGER, superficie NUMERIC, coordenadas JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, nombre_finca)
);
-- Tabla de Procesadoras
CREATE TABLE IF NOT EXISTS procesadoras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ruc TEXT NOT NULL, razon_social TEXT NOT NULL, nombre_comercial TEXT, tipo_empresa TEXT, pais TEXT, ciudad TEXT, direccion TEXT, telefono TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, ruc)
);
-- Tabla de Perfiles de Cacao
CREATE TABLE IF NOT EXISTS perfiles_cacao (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    perfil_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, nombre)
);
-- Tabla de Ruedas de Sabores
CREATE TABLE IF NOT EXISTS ruedas_sabores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre_rueda TEXT NOT NULL,
    notas_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, nombre_rueda)
);