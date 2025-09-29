document.addEventListener('DOMContentLoaded', () => {
    fetch('/partials/analytics.html')
        .then(response => {
            if (response.ok) {
                return response.text();
            }
            throw new Error('No se pudo cargar el script de analíticas.');
        })
        .then(html => {
            // Crear un div temporal para parsear el HTML y extraer los scripts
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            // Mover los scripts del div temporal al <head> del documento
            Array.from(tempDiv.children).forEach(node => {
                if (node.tagName === 'SCRIPT') {
                    const script = document.createElement('script');
                    // Copiar atributos (async, src, etc.)
                    for (const attr of node.attributes) {
                        script.setAttribute(attr.name, attr.value);
                    }
                    // Copiar contenido del script inline
                    if (node.innerHTML) {
                        script.innerHTML = node.innerHTML;
                    }
                    document.head.appendChild(script);
                } else {
                     // Añadir otros elementos como <!-- comentarios -->
                    document.head.appendChild(node.cloneNode(true));
                }
            });
        })
        .catch(error => console.error('Error al inyectar analíticas:', error));
});
