-- 1. CATÁLOGO DE ETAPAS (Maestro de pasos estandarizados)
CREATE TABLE IF NOT EXISTS catalogo_etapas (
    id TEXT PRIMARY KEY, -- UUID
    nombre TEXT NOT NULL, -- Ej: 'Cosecha', 'Tueste', 'Conchado'
    icono TEXT, -- Nombre del icono para la web (ej: 'leaf', 'coffee')
    color TEXT, -- Clases de color para el frontend (opcional)
    
    -- Este campo JSONB es clave: aquí guardas un arreglo como '["CAFE", "CACAO"]' 
    -- que debe coincidir con el campo 'tipo_producto' de tu tabla 'productos'
    categorias_aplicables JSONB NOT NULL, 
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE LOTES (Batches de Trazabilidad)
CREATE TABLE IF NOT EXISTS lotes (
    id TEXT PRIMARY KEY, -- UUID
    codigo_lote TEXT NOT NULL,
    
    -- Relación ajustada a TEXT para coincidir con productos.id
    producto_id TEXT REFERENCES productos(id) ON DELETE CASCADE, 
    
    estado TEXT DEFAULT 'BORRADOR', -- 'BORRADOR' o 'ACTIVO'
    
    -- Blockchain y Seguridad
    blockchain_hash TEXT,
    is_locked BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(producto_id, codigo_lote)
);

-- 3. TABLA DE ETAPAS (Eventos de la ruta del lote)
CREATE TABLE IF NOT EXISTS etapas (
    id TEXT PRIMARY KEY, -- UUID
    lote_id TEXT NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
    catalogo_etapa_id TEXT REFERENCES catalogo_etapas(id) ON DELETE SET NULL,
    
    fecha DATE NOT NULL,
    notas TEXT,
    foto TEXT, -- Para almacenar la URL de la imagen del proceso
    orden INTEGER NOT NULL, -- Ej: 1, 2, 3... para ordenar la ruta
    
    -- RELACIÓN CON ACTORES (Solo se llena uno dependiendo de dónde ocurrió)
    finca_id TEXT REFERENCES fincas(id) ON DELETE SET NULL,
    procesadora_id TEXT REFERENCES procesadoras(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- REGLA DE INTEGRIDAD: Asegura que el paso se hizo en una finca O en una procesadora, pero no en ambas ni en ninguna.
    CONSTRAINT chk_actor_unico CHECK (
        (finca_id IS NOT NULL AND procesadora_id IS NULL) OR 
        (finca_id IS NULL AND procesadora_id IS NOT NULL)
    )
);
INSERT INTO catalogo_etapas (id, nombre, icono, color, categorias_aplicables) VALUES 
('cacao_1_cosecha', 'Cosecha', 'Leaf', 'text-green-600', '["Cacao"]'),
('cacao_2_fermentacion', 'Fermentación', 'Box', 'text-amber-600', '["Cacao"]'),
('cacao_3_secado', 'Secado', 'Sun', 'text-yellow-600', '["Cacao"]'),
('cacao_4_tostado', 'Tostado', 'Coffee', 'text-orange-700', '["Cacao"]'),
('cacao_5_molienda', 'Descascarillado & Molienda', 'Settings', 'text-gray-600', '["Cacao"]'),
('cacao_6_chocolate', 'Chocolate', 'Factory', 'text-purple-600', '["Cacao"]'),
('cacao_7_envasado', 'Envasado', 'Package', 'text-blue-600', '["Cacao"]');

INSERT INTO catalogo_etapas (id, nombre, icono, color, categorias_aplicables) VALUES 
('cafe_1_cosecha', 'Cosecha y Selección', 'Leaf', 'text-green-600', '["Cafe"]'),
('cafe_2_despulpado', 'Despulpado', 'Droplets', 'text-blue-400', '["Cafe"]'),
('cafe_3_fermentacion', 'Fermentación', 'Box', 'text-amber-600', '["Cafe"]'),
('cafe_4_lavado', 'Lavado', 'Droplet', 'text-blue-500', '["Cafe"]'),
('cafe_5_secado', 'Secado', 'Sun', 'text-yellow-600', '["Cafe"]'),
('cafe_6_trilla', 'Trilla y Selección', 'Settings', 'text-gray-600', '["Cafe"]'),
('cafe_7_tostado', 'Tostado', 'Coffee', 'text-orange-700', '["Cafe"]'),
('cafe_8_envasado', 'Molienda / Envasado', 'Package', 'text-blue-600', '["Cafe"]'),
('cafe_9_evaluacion', 'Evaluación en Taza / Calidad', 'Award', 'text-emerald-700', '["Cafe"]');