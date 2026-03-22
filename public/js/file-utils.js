/**
 * Comprime una imagen y devuelve una cadena Base64.
 * @param {File} file - El archivo de imagen original.
 * @param {Object} options - Opciones de personalización.
 */
export const compressImage = (file, { maxWidth = 1024, maxHeight = 1024, quality = 0.7 } = {}) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Mejora 1: Cálculo de proporciones más limpio
                const ratio = Math.min(maxWidth / width, maxHeight / height);

                // Solo redimensionar si la imagen es más grande que los límites
                if (ratio < 1) {
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');

                // Mejora 2: Suavizado de imagen para evitar pixelado (Aliasing)
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                ctx.drawImage(img, 0, 0, width, height);

                // Mejora 3: Uso de WebP si es posible, o JPEG como fallback
                // WebP es mucho más ligero que JPEG con la misma calidad
                const dataUrl = canvas.toDataURL('image/webp', quality);

                // Si el navegador no soporta WebP, toDataURL devolverá PNG por defecto,
                // así que forzamos JPEG si el resultado es muy pesado o preferimos consistencia.
                resolve(dataUrl.includes('webp') ? dataUrl : canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => reject(new Error("Error al cargar la imagen en el objeto Image."));
        };
        reader.onerror = () => reject(new Error("Error al leer el archivo."));
    });
};