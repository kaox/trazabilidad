const db = require('./db');
const path = require('path');

/**
 * Resolver GS1 Digital Link
 * Estructura: /01/{gtin}/10/{loteId}
 */
const resolve = async (req, res) => {
    const { gtin, loteId } = req.params;

    // 1. Recolección de Variables de Contexto (Context-Awareness)
    // Vercel proporciona headers de geolocalización automáticamente
    const userCountry = req.headers['x-vercel-ip-country'] || 'XX'; 
    const userRegion = req.headers['x-vercel-ip-city'] || 'Unknown';
    
    // Idioma preferido del navegador (ej: 'es-ES,es;q=0.9,en;q=0.8')
    const acceptLanguage = req.headers['accept-language'] || '';
    const userLang = acceptLanguage.split(',')[0].split('-')[0] || 'es'; // 'es', 'en', etc.

    console.log(`[GS1 Scan] GTIN:${gtin} | LOTE:${loteId} | Pais:${userCountry} | Idioma:${userLang}`);

    try {
        // 2. Consulta a Base de Datos (Validación Cruzada)
        // Buscamos el lote y verificamos que pertenezca a un producto con ese GTIN
        const batchData = await db.getBatchByGtinAndLot(gtin, loteId);

        if (!batchData) {
            console.warn(`[GS1 404] No se encontró lote ${loteId} con GTIN ${gtin}`);
            // Podrías redirigir a una página de "Producto no encontrado" o búsqueda genérica
            return res.status(404).send(`
                <h1>Producto no encontrado</h1>
                <p>El código GTIN ${gtin} con lote ${loteId} no está registrado en Rurulab.</p>
                <a href="/">Ir al Inicio</a>
            `);
        }

        // 3. Gestión de Redirección por Estado (Safety Valve)
        
        // CASO A: RECALL (Retiro de producto) - Prioridad Máxima
        if (batchData.status === 'recall') {
            // Redirigir a pantalla de advertencia roja
            // Pasamos el motivo como query param para que el front lo muestre
            return res.redirect(`/recall-alert.html?lote=${loteId}&reason=${encodeURIComponent(batchData.recall_reason || 'Retiro preventivo de seguridad')}`);
        }

        // CASO B: EXPIRADO (Opcional)
        // Podríamos redirigir a una versión diferente o añadir un flag a la URL normal
        const isExpired = batchData.status === 'expired';
        
        // 4. Construcción de la URL de Destino (Resolver)
        // Por defecto, vamos a la página de trazabilidad pública que ya creaste
        let targetUrl = `/${loteId}`; 

        // Inyección de variables de contexto en la URL
        // Esto permite que tu frontend (tracking.html) adapte el contenido si es necesario
        // (ej. mostrar precios en moneda local o traducir textos)
        const queryParams = new URLSearchParams();
        if (userLang !== 'es') queryParams.append('lang', userLang);
        if (isExpired) queryParams.append('alert', 'expired');
        
        // Si hay params, los añadimos
        const queryString = queryParams.toString();
        if (queryString) targetUrl += `?${queryString}`;

        // 5. Ejecutar Redirección (302 Found - Temporal, para permitir cambios futuros)
        res.redirect(302, targetUrl);

        // Opcional: Aquí podrías disparar un evento de Analytics asíncrono guardando el país/idioma en la DB

    } catch (error) {
        console.error("GS1 Resolver Error:", error);
        res.status(500).send("Error interno del sistema de resolución.");
    }
};

module.exports = { resolve };