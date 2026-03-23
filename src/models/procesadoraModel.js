const db = require('../config/db');

const getById = async (id) => {
    return await db.get('SELECT * FROM procesadoras WHERE id = ?', [id]);
};

const getAllByUserId = async (userId) => {
    return await db.all('SELECT * FROM procesadoras WHERE user_id = ? ORDER BY nombre_comercial', [userId]);
};

const getByIdAndUserId = async (id, userId) => {
    return await db.get('SELECT * FROM procesadoras WHERE id = ? AND user_id = ?', [id, userId]);
};

const create = async (data) => {
    const sql = 'INSERT INTO procesadoras (id, user_id, ruc, razon_social, nombre_comercial, tipo, pais, ciudad, departamento, provincia, distrito, direccion, telefono, premios_json, certificaciones_json, coordenadas, imagenes_json, historia, video_link, numero_trabajadores) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const params = [
        data.id, data.user_id, data.ruc, data.razon_social, data.nombre_comercial, data.tipo || null,
        data.pais, data.ciudad, data.departamento, data.provincia, data.distrito, data.direccion, data.telefono,
        JSON.stringify(data.premios_json || []), JSON.stringify(data.certificaciones_json || []),
        data.coordenadas, JSON.stringify(data.imagenes_json || []),
        data.historia, data.video_link, data.numero_trabajadores
    ];
    return await db.run(sql, params);
};

const update = async (id, userId, data) => {
    const sql = 'UPDATE procesadoras SET ruc = ?, razon_social = ?, nombre_comercial = ?, tipo = ?, pais = ?, ciudad = ?, departamento = ?, provincia = ?, distrito = ?, direccion = ?, telefono = ?, premios_json = ?, certificaciones_json = ?, coordenadas = ?, imagenes_json = ?, historia = ?, video_link = ?, numero_trabajadores = ? WHERE id = ? AND user_id = ?';
    const params = [
        data.ruc, data.razon_social, data.nombre_comercial, data.tipo || null,
        data.pais, data.ciudad, data.departamento, data.provincia, data.distrito, data.direccion, data.telefono,
        JSON.stringify(data.premios_json || []), JSON.stringify(data.certificaciones_json || []),
        data.coordenadas, JSON.stringify(data.imagenes_json || []),
        data.historia, data.video_link, data.numero_trabajadores,
        id, userId
    ];
    return await db.run(sql, params);
};

const deleteById = async (id, userId) => {
    return await db.run('DELETE FROM procesadoras WHERE id = ? AND user_id = ?', [id, userId]);
};

module.exports = {
    getAllByUserId,
    getByIdAndUserId,
    getById,
    create,
    update,
    deleteById
};
