-- Script para crear las tablas en PostgreSQL

-- Tabla para Fincas
CREATE TABLE fincas (
    id VARCHAR(255) PRIMARY KEY,
    propietario VARCHAR(255),
    dni_ruc VARCHAR(50),
    nombre_finca VARCHAR(255) NOT NULL UNIQUE,
    superficie NUMERIC(10, 2),
    coordenadas JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla unificada para todos los lotes de procesos
CREATE TABLE lotes (
    id VARCHAR(255) PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL, -- 'cosecha', 'fermentacion', 'secado', 'tostado', 'molienda'
    parent_id VARCHAR(255) REFERENCES lotes(id) ON DELETE CASCADE, -- Clave foránea a sí misma
    data JSONB NOT NULL, -- Aquí se guardará toda la información específica del lote
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar el rendimiento de las búsquedas
CREATE INDEX idx_lotes_tipo ON lotes(tipo);
CREATE INDEX idx_lotes_parent_id ON lotes(parent_id);

-- Ejemplo de cómo se insertaría una cosecha:
-- INSERT INTO lotes (id, tipo, parent_id, data) VALUES ('COS-123', 'cosecha', NULL, '{"finca": "Finca La Esmeralda", "fechaCosecha": "2025-09-05", ...}');

-- Ejemplo de cómo se insertaría una fermentación hija de la cosecha anterior:
-- INSERT INTO lotes (id, tipo, parent_id, data) VALUES ('FER-456', 'fermentacion', 'COS-123', '{"fechaInicio": "2025-09-06", ...}');
