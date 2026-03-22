const { put, del } = require('@vercel/blob');

/**
 * Elimina una imagen del almacenamiento dado su URL pública
 */
const deleteImageByUrl = async (url, provider = 'vercel') => {
    try {
        if (provider === 'supabase') {
            const { createClient } = require('@supabase/supabase-js');
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_KEY;
            const bucketName = process.env.SUPABASE_BUCKET_NAME || 'public-bucket';

            if (!supabaseUrl || !supabaseKey) {
                console.warn("Credenciales de Supabase no configuradas para eliminar:", url);
                return;
            }

            const supabase = createClient(supabaseUrl, supabaseKey);
            const publicUrlPath = `/storage/v1/object/public/${bucketName}/`;
            if (url.includes(publicUrlPath)) {
                const filePath = url.split(publicUrlPath)[1];
                if (filePath) {
                    const { error } = await supabase.storage.from(bucketName).remove([filePath]);
                    if (error) console.error("Error eliminando en Supabase:", error);
                    else console.log("Imagen eliminada de Supabase:", filePath);
                }
            }
        } else {
            // Vercel Blob
            if (url.includes('public.blob.vercel-storage.com') || url.includes('.vercel-storage.com')) {
                await del(url);
                console.log("Imagen eliminada de Vercel Blob:", url);
            }
        }
    } catch (err) {
        console.error("Error al intentar eliminar la imagen:", url, err);
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

    if (provider === 'supabase') {
        console.log("Guardando en Supabase");
        // Implementación para Supabase Storage
        // Nota: Asegúrate de tener instalado @supabase/supabase-js
        const { createClient } = require('@supabase/supabase-js');

        // ATENCIÓN: Para usar createClient() necesitas la URL y Key del API REST, NO las de S3.
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY; // Usa la "service_role key" que empieza con eyJ...
        const bucketName = process.env.SUPABASE_BUCKET_NAME || 'rurulab';

        if (!supabaseUrl || !supabaseKey || !supabaseKey.startsWith("eyJ")) {
            throw new Error("Credenciales de Supabase incorrectas. Deben estar en el archivo .env, la Key debe empezar con 'eyJ...' (project API key).");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // En Node.js (especialmente con fetch nativo v18+), pasar un Buffer puede
        // causar problemas. Uint8Array o Blob es más seguro.
        const uint8Array = new Uint8Array(buffer);

        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(filename, uint8Array, {
                contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
                upsert: true
            });

        if (error) {
            console.error("Supabase Upload Error:", error.message, "| Bucket:", bucketName);
            throw new Error(`Error de Supabase: ${error.message} (Asegúrate de que el bucket '${bucketName}' exista).`);
        }

        // Obtener URL pública desde el Storage de Supabase
        const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filename);
        return publicUrlData.publicUrl;

    } else {
        // Implementación por defecto: Vercel Blob
        const blob = await put(filename, buffer, { access: 'public' });
        return blob.url;
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
