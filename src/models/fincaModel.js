const db = require('../config/db');

const getAllByUserId = async (userId) => {
    return await db.all('SELECT * FROM fincas WHERE user_id = ? ORDER BY nombre_finca', [userId]);
};

const create = async (data) => {
    const sql = 'INSERT INTO fincas (id, user_id, propietario, dni_ruc, nombre_finca, pais, departamento, provincia, distrito, ciudad, altura, superficie, coordenadas, telefono, historia, imagenes_json, video_link, certificaciones_json, premios_json, foto_productor, numero_trabajadores) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const params = [
        data.id, data.user_id, data.propietario, data.dni_ruc, data.nombre_finca, data.pais, data.departamento, data.provincia, data.distrito, data.ciudad, data.altura, data.superficie, JSON.stringify(data.coordenadas), data.telefono, data.historia, JSON.stringify(data.imagenes_json || []), data.video_link, JSON.stringify(data.certificaciones_json || []), JSON.stringify(data.premios_json || []), data.foto_productor, data.numero_trabajadores
    ];
    return await db.run(sql, params);
};

const update = async (id, userId, data) => {
    const sql = 'UPDATE fincas SET propietario = ?, dni_ruc = ?, nombre_finca = ?, pais = ?, departamento = ?, provincia = ?, distrito = ?, ciudad = ?, altura = ?, superficie = ?, coordenadas = ?, telefono = ?, historia = ?, imagenes_json = ?, video_link = ?, certificaciones_json = ?, premios_json = ?, foto_productor = ?, numero_trabajadores = ? WHERE id = ? AND user_id = ?';
    const params = [
        data.propietario, data.dni_ruc, data.nombre_finca, data.pais, data.departamento, data.provincia, data.distrito, data.ciudad, data.altura, data.superficie, JSON.stringify(data.coordenadas), data.telefono, data.historia, JSON.stringify(data.imagenes_json || []), data.video_link, JSON.stringify(data.certificaciones_json || []), JSON.stringify(data.premios_json || []), data.foto_productor, data.numero_trabajadores, id, userId
    ];
    return await db.run(sql, params);
};

const deleteById = async (id, userId) => {
    return await db.run('DELETE FROM fincas WHERE id = ? AND user_id = ?', [id, userId]);
};

// Lógica para Tokens (Compartir)
const getByIdAndUserId = async (id, userId) => {
    return await db.get('SELECT * FROM fincas WHERE id = ? AND user_id = ?', [id, userId]);
};

const updateToken = async (id, token) => {
    return await db.run('UPDATE fincas SET access_token = ? WHERE id = ?', [token, id]);
};

const getByToken = async (token) => {
    return await db.get('SELECT * FROM fincas WHERE access_token = ?', [token]);
};

const updateByToken = async (fincaId, data) => {
    const sql = `UPDATE fincas SET propietario = ?, dni_ruc = ?, nombre_finca = ?, telefono = ?, historia = ?, imagenes_json = ?, coordenadas = ?, altura = ?, superficie = ?, pais = ?, departamento = ?, provincia = ?, distrito = ?, ciudad = ? WHERE id = ?`;
    const params = [
        data.propietario, data.dni_ruc, data.nombre_finca, data.telefono, data.historia, JSON.stringify(data.imagenes_json || []), JSON.stringify(data.coordenadas), data.altura, data.superficie, data.pais, data.departamento, data.provincia, data.distrito, data.ciudad, fincaId
    ];
    return await db.run(sql, params);
};

module.exports = {
    getAllByUserId,
    create,
    update,
    deleteById,
    getByIdAndUserId,
    updateToken,
    getByToken,
    updateByToken
};
