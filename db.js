const { Pool } = require('pg');

// --- Configuración de la Conexión a PostgreSQL ---
// Asegúrate de que estas variables de entorno estén configuradas
// o reemplázalas con tus credenciales.
const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'chocolate_db',
    password: process.env.PGPASSWORD || 'password',
    port: process.env.PGPORT || 5432,
});

// --- Funciones para la API ---

// FINCAS
const getFincas = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM fincas ORDER BY nombre_finca');
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createFinca = async (req, res) => {
    const { id, propietario, dni_ruc, nombre_finca, superficie, coordenadas } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO fincas (id, propietario, dni_ruc, nombre_finca, superficie, coordenadas) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [id, propietario, dni_ruc, nombre_finca, superficie, coordenadas]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateFinca = async (req, res) => {
    const id = req.params.id;
    const { propietario, dni_ruc, nombre_finca, superficie, coordenadas } = req.body;
    try {
        const result = await pool.query(
            'UPDATE fincas SET propietario = $1, dni_ruc = $2, nombre_finca = $3, superficie = $4, coordenadas = $5 WHERE id = $6 RETURNING *',
            [propietario, dni_ruc, nombre_finca, superficie, coordenadas, id]
        );
        res.status(200).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteFinca = async (req, res) => {
    const id = req.params.id;
    try {
        await pool.query('DELETE FROM fincas WHERE id = $1', [id]);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// BATCHES (Lotes de procesos)
const getBatchesTree = async (req, res) => {
    try {
        // Esta es una consulta compleja que une todas las tablas para reconstruir el árbol
        const query = `
            SELECT 
                c.id as cosecha_id, c.data as cosecha_data,
                f.id as fermentacion_id, f.data as fermentacion_data,
                s.id as secado_id, s.data as secado_data,
                t.id as tostado_id, t.data as tostado_data,
                m.id as molienda_id, m.data as molienda_data
            FROM lotes c
            LEFT JOIN lotes f ON c.id = f.parent_id AND f.tipo = 'fermentacion'
            LEFT JOIN lotes s ON f.id = s.parent_id AND s.tipo = 'secado'
            LEFT JOIN lotes t ON s.id = t.parent_id AND t.tipo = 'tostado'
            LEFT JOIN lotes m ON t.id = m.parent_id AND m.tipo = 'molienda'
            WHERE c.tipo = 'cosecha'
            ORDER BY c.data->>'fechaCosecha' DESC;
        `;
        const { rows } = await pool.query(query);
        
        // Procesar las filas planas para reconstruir la estructura anidada
        const tree = {};
        rows.forEach(row => {
            if (!tree[row.cosecha_id]) {
                tree[row.cosecha_id] = { ...row.cosecha_data, fermentaciones: {} };
            }
            if (row.fermentacion_id && !tree[row.cosecha_id].fermentaciones[row.fermentacion_id]) {
                tree[row.cosecha_id].fermentaciones[row.fermentacion_id] = { ...row.fermentacion_data, secados: {} };
            }
            if (row.secado_id && !tree[row.cosecha_id].fermentaciones[row.fermentacion_id].secados[row.secado_id]) {
                tree[row.cosecha_id].fermentaciones[row.fermentacion_id].secados[row.secado_id] = { ...row.secado_data, tostados: {} };
            }
            if (row.tostado_id && !tree[row.cosecha_id].fermentaciones[row.fermentacion_id].secados[row.secado_id].tostados[row.tostado_id]) {
                tree[row.cosecha_id].fermentaciones[row.fermentacion_id].secados[row.secado_id].tostados[row.tostado_id] = { ...row.tostado_data, moliendas: {} };
            }
            if (row.molienda_id && !tree[row.cosecha_id].fermentaciones[row.fermentacion_id].secados[row.secado_id].tostados[row.tostado_id].moliendas[row.molienda_id]) {
                tree[row.cosecha_id].fermentaciones[row.fermentacion_id].secados[row.secado_id].tostados[row.tostado_id].moliendas[row.molienda_id] = { ...row.molienda_data };
            }
        });

        // Convertir los objetos anidados en arrays como espera el frontend
        const result = Object.values(tree).map(c => ({
            ...c,
            fermentaciones: Object.values(c.fermentaciones).map(f => ({
                ...f,
                secados: Object.values(f.secados).map(s => ({
                    ...s,
                    tostados: Object.values(s.tostados).map(t => ({
                        ...t,
                        moliendas: Object.values(t.moliendas)
                    }))
                }))
            }))
        }));

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createBatch = async (req, res) => {
    const { id, tipo, parent_id, data } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO lotes (id, tipo, parent_id, data) VALUES ($1, $2, $3, $4) RETURNING *',
            [id, tipo, parent_id, data]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateBatch = async (req, res) => {
    const id = req.params.id;
    const { data } = req.body;
    try {
        const result = await pool.query(
            'UPDATE lotes SET data = $1 WHERE id = $2 RETURNING *',
            [data, id]
        );
        res.status(200).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteBatch = async (req, res) => {
    const id = req.params.id;
    try {
        // Eliminar en cascada (requiere configuración en la DB o lógica aquí)
        // Por simplicidad, esta query elimina el lote y sus descendientes directos e indirectos.
        await pool.query(`
            WITH RECURSIVE descendientes AS (
                SELECT id FROM lotes WHERE id = $1
                UNION
                SELECT l.id FROM lotes l
                INNER JOIN descendientes d ON l.parent_id = d.id
            )
            DELETE FROM lotes WHERE id IN (SELECT id FROM descendientes);
        `, [id]);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getTrazabilidad = async (req, res) => {
    const id = req.params.id;
    try {
        // Consulta recursiva para encontrar la historia completa de un lote de molienda
        const query = `
            WITH RECURSIVE trazabilidad_completa AS (
                SELECT id, tipo, parent_id, data FROM lotes WHERE id = $1
                UNION
                SELECT l.id, l.tipo, l.parent_id, l.data FROM lotes l
                INNER JOIN trazabilidad_completa tc ON l.id = tc.parent_id
            )
            SELECT * FROM trazabilidad_completa;
        `;
        const { rows } = await pool.query(query, [id]);

        if(rows.length === 0) {
            return res.status(404).json({ error: 'Lote no encontrado'});
        }

        // Estructurar la respuesta para el frontend
        const history = {};
        rows.forEach(row => {
            history[row.tipo] = row.data;
        });

        // Obtener datos de la finca si existe
        if (history.cosecha && history.cosecha.finca) {
            const fincaRes = await pool.query('SELECT * FROM fincas WHERE nombre_finca = $1', [history.cosecha.finca]);
            if(fincaRes.rows.length > 0) {
                history.fincaData = fincaRes.rows[0];
            }
        }
        
        res.status(200).json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getFincas,
    createFinca,
    updateFinca,
    deleteFinca,
    getBatchesTree,
    createBatch,
    updateBatch,
    deleteBatch,
    getTrazabilidad,
};
