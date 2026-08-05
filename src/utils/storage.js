const { put, del } = require('@vercel/blob');

/**
 * Elimina una imagen del almacenamiento dado su URL pública
 */
const deleteImageByUrl = async (url, provider = 'supabase') => {
    try {
        if (url.includes('supabase.co')) {
            // Eliminar de Supabase
            const { createClient } = require('@supabase/supabase-js');
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
            const bucketName = process.env.SUPABASE_BUCKET_NAME || 'rurulab';

            if (supabaseUrl && supabaseKey) {
                const supabase = createClient(supabaseUrl, supabaseKey);
                const publicUrlPath = `/storage/v1/object/public/${bucketName}/`;
                if (url.includes(publicUrlPath)) {
                    const filePath = url.split(publicUrlPath)[1];
                    if (filePath) {
                        await supabase.storage.from(bucketName).remove([filePath]);
                        console.log("Imagen eliminada de Supabase:", filePath);
                    }
                }
            }
        } else if (url.includes('public.blob.vercel-storage.com') || url.includes('.vercel-storage.com')) {
            // Eliminar de Vercel Blob
            await del(url);
            console.log("Imagen eliminada de Vercel Blob:", url);
        }
    } catch (err) {
        console.error("Error al intentar eliminar la imagen del storage:", url, err);
    }
};

/**
 * Elimina un arreglo de imágenes
 */
const deleteImagesArray = async (imagenesArray, provider = 'vercel') => {
    if (imagenesArray && Array.isArray(imagenesArray)) {
        for (const url of imagenesArray) {
            if (typeof url === 'string' && url.startsWith('http')) {
                await deleteImageByUrl(url, provider);
            }
        }
    }
};

/**
 * Sube una imagen en base64 al proveedor de almacenamiento de archivos configurado.
 * @param {string} base64String - La cadena o data URL de la imagen en base64
 * @param {string} filename - El nombre base del archivo destino (será concatenado con su extensión)
 * @returns {Promise<string>} - La URL pública de la imagen subida
 */
const uploadImageBase64 = async (base64String, filename, provider = 'vercel') => {
    // Extraer Buffer desde el string Base64
    const matches = base64String.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        throw new Error("Formato base64 inválido.");
    }

    let extension = matches[1];
    if (extension === 'jpeg') extension = 'jpg';
    const buffer = Buffer.from(matches[2], 'base64');

    // Asegurar que el filename termine con la extensión detectada
    if (!filename.endsWith(`.${extension}`)) {
        filename = `${filename}.${extension}`;
    }

    // Función interna para intentar subir a Supabase
    const trySupabase = async () => {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
        const bucketName = process.env.SUPABASE_BUCKET_NAME || 'rurulab';

        if (!supabaseUrl || !supabaseKey || !supabaseKey.startsWith("eyJ")) {
            throw new Error("Credenciales de Supabase inválidas.");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const uint8Array = new Uint8Array(buffer);

        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(filename, uint8Array, {
                contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
                upsert: true
            });

        if (error) throw new Error(`Supabase Error: ${error.message}`);

        const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filename);
        return publicUrlData.publicUrl;
    };

    // Función interna para intentar subir a Vercel Blob
    const tryVercelBlob = async () => {
        const blob = await put(filename, buffer, { access: 'public' });
        return blob.url;
    };

    if (provider === 'supabase') {
        try {
            console.log("Intentando guardar en Supabase...");
            return await trySupabase();
        } catch (supabaseError) {
            console.warn("⚠️ Supabase falló (posible cuota o error). Cambiando a Vercel Blob como respaldo...", supabaseError.message);
            try {
                return await tryVercelBlob();
            } catch (vercelError) {
                throw new Error(`Ambos almacenamientos fallaron. Supabase: ${supabaseError.message} | Vercel: ${vercelError.message}`);
            }
        }

    } else {
        try {
            console.log("Intentando guardar en Vercel Blob...");
            return await tryVercelBlob();
        } catch (vercelError) {
            console.warn("⚠️ Vercel Blob falló. Cambiando a Supabase como respaldo...", vercelError.message);
            try {
                return await trySupabase();
            } catch (supabaseError) {
                throw new Error(`Ambos almacenamientos fallaron. Vercel: ${vercelError.message} | Supabase: ${supabaseError.message}`);
            }
        }
    }
};

/**
 * Procesa un arreglo de imágenes (mezcla de URLs y base64) y sube las que están en base64.
 * Conserva intactas las imágenes que ya son URLs válidas.
 * 
 * @param {Array} imagenesArray - Arreglo con imágenes
 * @param {string} folder - Carpeta destino (ej. 'productos' o 'company-logos')
 * @param {string|number} userId - ID del usuario
 * @returns {Promise<Array>} - Arreglo de URLs finalmente generadas o conservadas
 */
const processImagesArray = async (imagenesArray, folder, userId, provider = 'vercel') => {
    console.log(provider);
    let procesadasImagenes = [];

    if (imagenesArray && Array.isArray(imagenesArray)) {
        for (let i = 0; i < imagenesArray.length; i++) {
            let img = imagenesArray[i];

            if (typeof img === 'string' && img.startsWith('data:image/')) {
                try {
                    const filenameBase = `${folder}/user-${userId}-${Date.now()}-${i}`;
                    const url = await uploadImageBase64(img, filenameBase, provider);
                    procesadasImagenes.push(url);
                } catch (err) {
                    console.error(`Error subiendo imagen a storage en carpeta [${folder}]:`, err);
                    procesadasImagenes.push(img); // Fallback: guardar lo original si falla
                }
            } else {
                procesadasImagenes.push(img); // Ya es URL generada previamente o tiene formato ignorado
            }
        }
    }

    return procesadasImagenes;
};

module.exports = {
    uploadImageBase64,
    processImagesArray,
    deleteImageByUrl,
    deleteImagesArray
};
