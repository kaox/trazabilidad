// Lógica para la página pública del blog (blog.html)
document.addEventListener('DOMContentLoaded', () => {
    const blogGrid = document.getElementById('blog-grid');
    const paginationContainer = document.getElementById('pagination');
    
    // Obtener el número de página actual de la URL (ej: blog.html?page=2)
    // Si no existe, por defecto es la página 1
    const urlParams = new URLSearchParams(window.location.search);
    const currentPage = parseInt(urlParams.get('page')) || 1;

    // Cargar los posts al iniciar
    loadPosts(currentPage);

    async function loadPosts(page) {
        try {
            // Llamada a la API pública con paginación
            const response = await fetch(`/api/blog?page=${page}&limit=9`); // Limit 9 para una grilla 3x3 ordenada
            
            if (!response.ok) throw new Error('Error en la red');

            const { data, pagination } = await response.json();
            
            renderGrid(data);
            renderPagination(pagination);
        } catch (error) {
            console.error("Error cargando el blog:", error);
            blogGrid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-exclamation-circle text-4xl text-stone-300 mb-4"></i>
                    <p class="text-stone-500">No se pudieron cargar las historias. Intenta recargar la página.</p>
                </div>
            `;
        }
    }

    function renderGrid(posts) {
        // Limpiar el estado de carga
        blogGrid.innerHTML = '';

        if (posts.length === 0) {
            blogGrid.innerHTML = `
                <div class="col-span-full text-center py-20 bg-stone-50 rounded-2xl border border-stone-100">
                    <i class="fas fa-feather-alt text-4xl text-stone-300 mb-4"></i>
                    <h3 class="text-xl font-display font-bold text-stone-600">Aún no hay historias</h3>
                    <p class="text-stone-500 mt-2">Estamos escribiendo el próximo capítulo. Vuelve pronto.</p>
                </div>
            `;
            return;
        }

        // Generar HTML para cada tarjeta
        const cardsHTML = posts.map(post => {
            // Formatear fecha
            const date = new Date(post.created_at).toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });

            // Imagen por defecto si no hay cover
            const imageSrc = post.cover_image || 'https://placehold.co/600x400/78350f/ffffff?text=Rurulab';

            return `
            <article class="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full group">
                <a href="/blog/${post.slug}" class="block h-56 overflow-hidden relative">
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10"></div>
                    <img src="${imageSrc}" 
                         alt="${post.title}" 
                         class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                         loading="lazy">
                </a>
                <div class="p-6 flex-grow flex flex-col">
                    <div class="flex items-center gap-2 text-xs text-amber-700 font-bold mb-3 uppercase tracking-wide">
                        <i class="far fa-calendar-alt"></i> ${date}
                    </div>
                    
                    <h3 class="text-xl font-display font-bold text-stone-900 mb-3 leading-snug group-hover:text-amber-800 transition-colors">
                        <a href="/blog/${post.slug}">
                            ${post.title}
                        </a>
                    </h3>
                    
                    <p class="text-stone-600 text-sm mb-6 line-clamp-3 leading-relaxed flex-grow">
                        ${post.summary || 'Sin resumen disponible.'}
                    </p>
                    
                    <div class="mt-auto border-t border-stone-100 pt-4 flex justify-between items-center">
                        <a href="/blog/${post.slug}" class="text-sm font-bold text-amber-800 hover:text-amber-900 flex items-center gap-2 group/link">
                            Leer artículo <i class="fas fa-arrow-right text-xs transform group-hover/link:translate-x-1 transition-transform"></i>
                        </a>
                    </div>
                </div>
            </article>
            `;
        }).join('');

        blogGrid.innerHTML = cardsHTML;
    }

    function renderPagination({ page, totalPages }) {
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let html = '';

        // Botón Anterior
        if (page > 1) {
            html += `
                <a href="?page=${page - 1}" class="flex items-center gap-2 px-5 py-2.5 bg-white border border-stone-200 rounded-xl text-stone-600 font-medium hover:bg-stone-50 hover:text-amber-800 transition-colors shadow-sm">
                    <i class="fas fa-chevron-left text-xs"></i> Anterior
                </a>
            `;
        } else {
            html += `
                <span class="flex items-center gap-2 px-5 py-2.5 bg-stone-50 border border-stone-100 rounded-xl text-stone-300 font-medium cursor-not-allowed">
                    <i class="fas fa-chevron-left text-xs"></i> Anterior
                </span>
            `;
        }
        
        // Indicador de página
        html += `
            <span class="px-4 font-display font-bold text-stone-800">
                ${page} <span class="text-stone-400 font-sans font-normal mx-1">de</span> ${totalPages}
            </span>
        `;

        // Botón Siguiente
        if (page < totalPages) {
            html += `
                <a href="?page=${page + 1}" class="flex items-center gap-2 px-5 py-2.5 bg-white border border-stone-200 rounded-xl text-stone-600 font-medium hover:bg-stone-50 hover:text-amber-800 transition-colors shadow-sm">
                    Siguiente <i class="fas fa-chevron-right text-xs"></i>
                </a>
            `;
        } else {
            html += `
                <span class="flex items-center gap-2 px-5 py-2.5 bg-stone-50 border border-stone-100 rounded-xl text-stone-300 font-medium cursor-not-allowed">
                    Siguiente <i class="fas fa-chevron-right text-xs"></i>
                </span>
            `;
        }

        paginationContainer.innerHTML = html;
    }
});