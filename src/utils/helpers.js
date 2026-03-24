const crypto = require('crypto');

/**
 * Parsea JSON de forma segura verificando si la entrada es un string
 */
const safeJSONParse = (data) => {
    try {
        return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
        return data;
    }
};

/**
 * Sanitiza valores para evitar errores en tipos numéricos de la base de datos
 */
const sanitizeNumber = (val) => {
    if (val === '' || val === null || val === undefined) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
};

/**
 * Crea slugs amigables para URLs con un sufijo aleatorio para unicidad
 */
const createSlug = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        + '-' + Math.floor(Math.random() * 1000);
};

/**
 * Convierte strings a formato camelCase (normalizando acentos)
 */
const toCamelCase = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase())
        .replace(/\s+/g, '');
};

const calcularMaridajeCacaoCafe = (cacao, cafe) => {
    const pInt = 1 - (Math.abs((cacao.perfil_data.cacao || 0) - (cafe.perfil_data.sabor || 0)) / 10);
    const pAcid = 1 - (Math.abs((cacao.perfil_data.acidez || 0) - (cafe.perfil_data.acidez || 0)) / 10);
    const pDulz = 1 - (Math.abs((cacao.perfil_data.caramelo || 0) - (cafe.perfil_data.dulzura || 0)) / 10);
    const pComp = 1 - (Math.abs(((cacao.perfil_data.amargor || 0) + (cacao.perfil_data.madera || 0)) / 2 - ((cafe.perfil_data.cuerpo || 0) + (cafe.perfil_data.postgusto || 0)) / 2) / 10);
    return ((pInt * 0.4) + (((pAcid + pDulz + pComp) / 3) * 0.6)) * 100;
}

module.exports = {
    safeJSONParse,
    sanitizeNumber,
    createSlug,
    toCamelCase,
    calcularMaridajeCacaoCafe
};