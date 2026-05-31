/**
 * productSlug.js
 * Utilidad compartida para construir y parsear URLs SEO-friendly de productos.
 *
 * Estructura de URL canónica:
 *   /origen-unico/{empresa-slug}-{empresa-id}/{producto-slug}-{8-chars-uuid}
 *
 * Ejemplo:
 *   /origen-unico/burgos-chocolates-5/cafe-tsonkari-402f6653
 */

/**
 * Convierte texto a slug URL-safe.
 * @param {string} text
 * @returns {string}
 */
const toSlug = (text) =>
    (text || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');

/**
 * Construye el segmento de empresa para la URL:
 *   {empresa-slug}-{empresa-id}
 *
 * @param {string} companyName - Nombre de la empresa o finca
 * @param {string|number} companyId  - ID numérico de la empresa (user_id)
 * @returns {string}
 */
const buildCompanySegment = (companyName, companyId) =>
    `${toSlug(companyName)}-${companyId}`;

/**
 * Construye el segmento de producto para la URL:
 *   {producto-slug}-{8-chars-uuid}
 *
 * @param {string} productName - Nombre del producto
 * @param {string} productId   - UUID completo del producto
 * @returns {string}
 */
const buildProductSegment = (productName, productId) =>
    `${toSlug(productName)}-${productId.substring(0, 8)}`;

/**
 * Construye la URL completa canónica de un producto:
 *   /origen-unico/{empresa-slug}-{empresa-id}/{producto-slug}-{8-chars-uuid}
 *
 * @param {string} companyName
 * @param {string|number} companyId
 * @param {string} productName
 * @param {string} productId
 * @returns {string}
 */
const buildProductUrl = (companyName, companyId, productName, productId) =>
    `/origen-unico/${buildCompanySegment(companyName, companyId)}/${buildProductSegment(productName, productId)}`;

/**
 * Extrae el short ID (primeros 8 chars del UUID) desde el segmento de producto de la URL.
 * El short ID siempre es el último bloque separado por guion con exactamente 8 chars hex.
 *
 * @param {string} productSlug - p.ej. "cafe-tsonkari-402f6653"
 * @returns {string|null} - "402f6653" o null si no se encuentra
 */
const extractShortId = (productSlug) => {
    const match = (productSlug || '').match(/([a-f0-9]{8})$/i);
    return match ? match[1] : null;
};

module.exports = { toSlug, buildCompanySegment, buildProductSegment, buildProductUrl, extractShortId };
