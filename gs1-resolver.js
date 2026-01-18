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
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Producto No Encontrado</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                </head>
                <body class="bg-gray-50 flex flex-col items-center justify-center h-screen text-center p-4 font-sans">
                    <div class="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
                        <div class="text-red-500 text-6xl mb-6"><i class="fas fa-search-minus"></i></div>
                        <h1 class="text-2xl font-bold text-gray-800 mb-2">Producto no encontrado</h1>
                        <p class="text-gray-500 mb-6 text-sm">
                            El código GTIN <span class="font-mono bg-gray-100 px-1 rounded text-gray-700">${gtin}</span> 
                            con lote <span class="font-mono bg-gray-100 px-1 rounded text-gray-700">${loteId}</span> 
                            no está registrado o no coincide en nuestro sistema.
                        </p>
                        <a href="/" class="block w-full bg-stone-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition shadow-lg">
                            Ir al Inicio
                        </a>
                    </div>
                </body>
                </html>
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