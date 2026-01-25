const app = {
    state: {
        view: 'companies', // 'companies', 'products', 'batches'
        selectedCompany: null,
        selectedProduct: null
    },

    container: document.getElementById('app-container'),
    breadcrumbs: document.getElementById('breadcrumbs'),
    
    init: async function() {
        await this.loadCompanies();
    },

    // --- NIVEL 1: EMPRESAS ---
    loadCompanies: async function() {
        this.state.view = 'companies';
        this.updateBreadcrumbs();
        this.container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div></div>';

        try {
            const res = await fetch('/api/public/companies');
            const companies = await res.json();

            // Mensaje si no hay datos (pero con CTA)
            if (companies.length === 0) {
                this.container.innerHTML = `
                    <div class="text-center text-stone-500 py-10 bg-stone-50 rounded-xl border-2 border-dashed border-stone-200">
                        <i class="fas fa-users text-4xl text-stone-300 mb-4"></i>
                        <p class="mb-4">Aún no hay empresas públicas. ¡Sé el primero!</p>
                        <a href="/login.html" class="text-amber-700 font-bold hover:underline">Registrar mi Empresa</a>
                    </div>`;
                return;
            }

            let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 fade-in">`;
            
            companies.forEach(c => {
                // Placeholder si no hay logo
                const logo = c.company_logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.empresa)}&background=f5f5f4&color=78350f&size=128`;
                
                html += `
                    <div onclick="app.loadProducts('${c.id}', '${c.empresa}')" class="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 cursor-pointer card-hover transition-all duration-300 group relative overflow-hidden">
                        <div class="flex items-center gap-4 mb-4">
                            <img src="${logo}" alt="${c.empresa}" class="w-16 h-16 rounded-full object-cover border border-stone-100 group-hover:border-amber-200 transition">
                            <div>
                                <h3 class="text-xl font-display font-bold text-stone-900 group-hover:text-amber-800 transition">${c.empresa}</h3>
                                <p class="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full inline-block mt-1">
                                    <i class="fas fa-check-circle mr-1"></i> ${c.total_lotes_certificados} Lotes Verificados
                                </p>
                            </div>
                        </div>
                        <p class="text-sm text-stone-500 line-clamp-3 mb-4">${c.historia_empresa || 'Empresa productora comprometida con la calidad y la trazabilidad.'}</p>
                        <div class="text-right">
                            <span class="text-sm font-bold text-amber-700 group-hover:underline">Ver Productos <i class="fas fa-arrow-right ml-1"></i></span>
                        </div>
                    </div>
                `;
            });

            // --- GROWTH HACK: Tarjeta "Tu Empresa Aquí" ---
            html += `
                <a href="/login.html" class="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-50 cursor-pointer transition-all group opacity-80 hover:opacity-100">
                    <div class="w-16 h-16 rounded-full bg-white border border-amber-200 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition">
                        <i class="fas fa-plus text-2xl text-amber-500"></i>
                    </div>
                    <h3 class="text-xl font-display font-bold text-amber-900 mb-2">¿Tu Marca Aquí?</h3>
                    <p class="text-sm text-amber-700 text-center mb-4">Únete al directorio de empresas verificadas y demuestra tu origen.</p>
                    <span class="bg-amber-600 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-md hover:bg-amber-700 transition">
                        Certificar mis Productos
                    </span>
                </a>
            `;

            html += `</div>`;
            this.container.innerHTML = html;

        } catch (e) {
            console.error(e);
            this.container.innerHTML = `<div class="text-center text-red-500">Error al cargar empresas.</div>`;
        }
    },

    // --- NIVEL 2: PRODUCTOS ---
    loadProducts: async function(userId, companyName) {
        this.state.view = 'products';
        this.state.selectedCompany = { id: userId, name: companyName };
        this.updateBreadcrumbs();
        
        this.container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div></div>';

        try {
            const res = await fetch(`/api/public/companies/${userId}/products`);
            const products = await res.json();

            if (products.length === 0) {
                this.container.innerHTML = `<div class="text-center text-stone-500 py-10">Esta empresa no tiene productos públicos visibles actualmente.</div>`;
                return;
            }

            let html = `
                <h2 class="text-2xl font-bold text-stone-800 mb-6 border-b border-stone-200 pb-2">Productos de ${companyName}</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 fade-in">
            `;

            products.forEach(p => {
                let image = 'https://placehold.co/400x300/f5f5f4/a8a29e?text=Sin+Imagen';
                if (p.imagenes_json && p.imagenes_json.length > 0) image = p.imagenes_json[0];

                html += `
                    <div onclick="app.loadBatches('${p.id}', '${p.nombre}')" class="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden cursor-pointer card-hover transition group">
                        <div class="h-48 w-full bg-stone-100 relative">
                            <img src="${image}" class="w-full h-full object-cover">
                            <div class="absolute top-2 right-2 bg-stone-900/80 text-white text-xs px-2 py-1 rounded font-bold">
                                ${p.lotes_count} Lotes
                            </div>
                        </div>
                        <div class="p-4">
                            <h3 class="font-bold text-lg text-stone-900 mb-1 group-hover:text-amber-800 transition">${p.nombre}</h3>
                            <p class="text-xs text-stone-500 uppercase tracking-wide mb-3">${p.tipo_producto || 'Producto'}</p>
                            <p class="text-sm text-stone-600 line-clamp-2">${p.descripcion || ''}</p>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            this.container.innerHTML = html;

        } catch (e) {
            console.error(e);
            this.container.innerHTML = `<div class="text-center text-red-500">Error cargando productos.</div>`;
        }
    },

    // --- NIVEL 3: LOTES ---
    loadBatches: async function(productId, productName) {
        this.state.view = 'batches';
        this.state.selectedProduct = { id: productId, name: productName };
        this.updateBreadcrumbs();

        this.container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div></div>';

        try {
            const res = await fetch(`/api/public/products/${productId}/batches`);
            const batches = await res.json();

            let html = `
                <h2 class="text-2xl font-bold text-stone-800 mb-6 border-b border-stone-200 pb-2">Lotes Certificados: ${productName}</h2>
                <div class="space-y-4 fade-in max-w-4xl mx-auto">
            `;

            if (batches.length === 0) {
                html += `<div class="p-8 text-center text-stone-500 italic bg-stone-50 rounded-xl">No hay lotes públicos disponibles para este producto.</div>`;
            } else {
                batches.forEach(b => {
                    const date = new Date(b.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
                    const hashShort = b.hash.substring(0, 12) + '...';
                    
                    // URL Pública de Trazabilidad
                    const publicUrl = `/${b.id}`; // O http://localhost:3000/ENV... según tu routing

                    html += `
                        <a href="${publicUrl}" target="_blank" class="block bg-white rounded-xl border border-stone-200 p-5 hover:border-amber-500 hover:shadow-md transition group">
                            <div class="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <div class="flex items-center gap-4">
                                    <div class="h-12 w-12 rounded-lg bg-stone-100 text-stone-400 flex items-center justify-center border border-stone-200 group-hover:bg-amber-50 group-hover:text-amber-600 transition">
                                        <i class="fas fa-box-open text-xl"></i>
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <h4 class="font-bold text-lg text-stone-800 group-hover:text-amber-900">Lote: <span class="font-mono">${b.id}</span></h4>
                                            <span class="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded border border-green-200 uppercase">Inmutable</span>
                                        </div>
                                        <p class="text-sm text-stone-500"><i class="fas fa-map-marker-alt text-amber-700 mr-1"></i> ${b.origen}</p>
                                    </div>
                                </div>
                                <div class="text-left md:text-right pl-16 md:pl-0">
                                    <p class="text-xs text-stone-400 mb-1">Certificado el ${date}</p>
                                    <div class="text-xs font-mono text-stone-300 bg-stone-800 px-2 py-1 rounded inline-block" title="${b.hash}">
                                        <i class="fas fa-link mr-1"></i> ${hashShort}
                                    </div>
                                </div>
                            </div>
                        </a>
                    `;
                });
            }
            html += `</div>`;
            this.container.innerHTML = html;

        } catch (e) {
            console.error(e);
            this.container.innerHTML = `<div class="text-center text-red-500">Error cargando lotes.</div>`;
        }
    },

    // --- UTILIDADES ---
    updateBreadcrumbs: function() {
        if (this.state.view === 'companies') {
            this.breadcrumbs.classList.add('hidden');
        } else {
            this.breadcrumbs.classList.remove('hidden');
            const compSpan = document.getElementById('breadcrumb-company');
            const prodPart = document.getElementById('breadcrumb-product-part');
            const prodSpan = document.getElementById('breadcrumb-product');

            compSpan.textContent = this.state.selectedCompany?.name || 'Empresa';
            
            if (this.state.view === 'batches') {
                prodPart.classList.remove('hidden');
                prodSpan.textContent = this.state.selectedProduct?.name || 'Producto';
            } else {
                prodPart.classList.add('hidden');
            }
        }
    },

    resetToCompanies: function() {
        this.loadCompanies();
    }
};

// Iniciar aplicación
document.addEventListener('DOMContentLoaded', () => app.init());