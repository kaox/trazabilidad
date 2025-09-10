-- Script para crear las tablas en una base de datos PostgreSQL

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

-- Tabla de Fincas
CREATE TABLE IF NOT EXISTS fincas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    propietario TEXT,
    dni_ruc TEXT,
    nombre_finca TEXT NOT NULL,
    pais TEXT,
    ciudad TEXT,
    altura INTEGER,
    superficie NUMERIC,
    coordenadas JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, nombre_finca)
);

-- Tabla de Procesadoras
CREATE TABLE IF NOT EXISTS procesadoras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ruc TEXT NOT NULL,
    razon_social TEXT NOT NULL,
    nombre_comercial TEXT,
    tipo_empresa TEXT,
    pais TEXT,
    ciudad TEXT,
    direccion TEXT,
    telefono TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, ruc)
);

-- Tabla de Lotes
CREATE TABLE IF NOT EXISTS lotes (
    id TEXT PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    parent_id TEXT REFERENCES lotes(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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

