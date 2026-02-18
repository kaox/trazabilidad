const app = {
    state: {
        view: 'companies',
        selectedCompany: null,
        companies: [], // Almacén para evitar peticiones repetidas
        currentFilter: 'all'
    },

    container: document.getElementById('app-container'),
    breadcrumbs: document.getElementById('breadcrumbs'),
    
    // Variables para el mapa de sugerencias
    map: null,

    init: async function() {
        // En esta vista solo cargamos las empresas y configuramos el formulario
        await this.loadCompanies();
        this.setupSuggestForm();
    },

    // --- ANALYTICS ---
    trackEvent: async function(type, companyId, productId = null) { 
        try { 
            await fetch('/api/public/analytics', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    event_type: type, 
                    target_user_id: companyId, 
                    target_product_id: productId, 
                    meta_data: { 
                        referrer: document.referrer, 
                        url: window.location.href, 
                        timestamp: new Date().toISOString() 
                    } 
                }) 
            }); 
        } catch(e){} 
    },

    // --- UTILS ---
    createSlug: function(text) { 
        if (!text) return '';
        return text.toString().toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-'); 
    },

    toTitleCase: function(str) {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
    },

    setFilter: function(filterType) {
        this.state.currentFilter = filterType;
        
        // Actualizar UI de botones
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (btn.getAttribute('data-filter') === filterType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.renderCompanies();
    },

    // --- NIVEL 1: LISTADO DE EMPRESAS (DISEÑO MEJORADO) ---
    loadCompanies: async function() {
        if (this.state.companies.length > 0) { this.renderCompanies(); return; }
        this.container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div></div>';
        try {
            const res = await fetch('/api/public/companies');
            this.state.companies = await res.json();
            this.renderCompanies();
        } catch (e) { this.container.innerHTML = '<p class="text-center py-20 text-stone-400">No se pudo cargar el directorio.</p>'; }
    },

    renderCompanies: function() {
        const filter = this.state.currentFilter;
        
        // Filtrar datos
        const filtered = filter === 'all' 
            ? this.state.companies 
            : this.state.companies.filter(c => c.type === filter);

        let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 fade-in">`;
        
        if (filtered.length > 0) {
            filtered.forEach(c => {
                const logo = c.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=f5f5f4&color=78350f&size=128`;
                const isFinca = c.type === 'finca';
                const typeColor = isFinca ? 'amber' : 'blue';
                const locationStr = [c.distrito, c.provincia, c.departamento, c.pais].filter(Boolean).map(p => this.toTitleCase(p)).join(', ') || 'Ubicación por verificar';

                const slug = this.createSlug(c.name) + '-' + c.id;
                const linkUrl = `/origen-unico/${slug}`;
                console.log(linkUrl);
                html += `
                    <a href="${linkUrl}" class="group relative bg-white rounded-3xl border border-stone-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col h-full text-left no-underline">
                        <div class="h-2 w-full bg-${typeColor}-600/20 group-hover:bg-${typeColor}-600 transition-colors duration-500"></div>
                        <div class="p-6 flex flex-col h-full">
                            <div class="flex justify-between items-start mb-6">
                                <img src="${logo}" class="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-md bg-white">
                                ${c.status === 'pending' ? '<span class="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">Sugerido</span>' : '<span class="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-100"><i class="fas fa-check-circle"></i> Verificado</span>'}
                            </div>
                            <div class="flex-grow">
                                <span class="text-[10px] font-black uppercase tracking-[0.15em] text-${typeColor}-600 mb-1 block">${isFinca ? '<i class="fas fa-leaf mr-1"></i> Productor' : '<i class="fas fa-industry mr-1"></i> Procesadora'}</span>
                                <h3 class="text-2xl font-display font-black text-stone-900 leading-tight group-hover:text-amber-900 transition-colors line-clamp-2">${c.name}</h3>
                                <p class="text-sm text-stone-500 mt-2 flex items-center gap-2 font-medium"><i class="fas fa-map-marker-alt text-stone-300 group-hover:text-amber-600 transition-colors"></i> ${locationStr}</p>
                            </div>
                            <div class="mt-8 pt-5 border-t border-stone-100 flex items-center justify-between">
                                <div class="flex flex-col"><span class="text-[10px] font-bold text-stone-400 uppercase"></span><span class="text-lg font-black text-stone-800"></span></div>
                                <div class="text-sm font-bold text-amber-800 opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0">Ver Perfil <i class="fas fa-arrow-right ml-1"></i></div>
                            </div>
                        </div>
                    </a>`;
            });
        } else {
            html += `<div class="col-span-full py-20 text-center">
                        <i class="fas fa-search text-stone-200 text-5xl mb-4"></i>
                        <p class="text-stone-400 font-medium">No se encontraron empresas en esta categoría.</p>
                     </div>`;
        }

        // Tarjeta "Tu Marca Aquí" (Solo aparece si filtramos 'all' o categorías específicas según desees)
        html += `
            <div onclick="app.openSuggestModal()" class="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-amber-200 bg-amber-50/30 hover:bg-amber-50 hover:border-amber-400 cursor-pointer transition-all duration-500 min-h-[280px]">
                <div class="w-16 h-16 rounded-2xl bg-white border border-amber-100 flex items-center justify-center mb-4 shadow-sm"><i class="fas fa-plus text-3xl text-amber-500"></i></div>
                <h3 class="text-xl font-display font-bold text-amber-900 mb-2">¿Tu Marca Aquí?</h3>
                <p class="text-sm text-stone-600 text-center mb-6 max-w-[200px]">Únete a la red de transparencia global.</p>
                <span class="bg-amber-800 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-amber-900 transition-all">Sugerir Empresa</span>
            </div></div>`;

        this.container.innerHTML = html;
    },

    // --- RESTO DE FUNCIONES (MAPAS, MODALES, ETC.) ---
    openSuggestModal: function() {
        const modal = document.getElementById('suggest-modal');
        if (!modal) return;

        // Inyectar dinámicamente el campo de logo si no existe en el HTML
        // Esto evita tener que editar el HTML manualmente si prefieres gestionarlo desde JS
        const form = document.getElementById('suggest-form');
        if (form && !document.getElementById('logo-container')) {
            const logoHtml = `
                <div id="logo-container" class="space-y-2">
                    <label class="block text-xs font-bold text-stone-500 uppercase">Logo de la Empresa (Máx 5MB)</label>
                    <div class="flex items-center gap-4">
                        <div id="logo-preview" class="w-16 h-16 rounded-xl border-2 border-dashed border-stone-200 flex items-center justify-center bg-stone-50 overflow-hidden">
                            <i class="fas fa-image text-stone-300"></i>
                        </div>
                        <div class="flex-grow">
                            <input type="file" id="input-logo" accept="image/*" class="block w-full text-xs text-stone-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-xs file:font-semibold
                                file:bg-amber-50 file:text-amber-700
                                hover:file:bg-amber-100 cursor-pointer">
                        </div>
                    </div>
                    <p id="logo-error" class="text-[10px] text-red-500 hidden font-bold">El archivo es demasiado grande (Máx 5MB)</p>
                </div>
            `;
            // Insertar antes de los campos de redes sociales
            const nameLabel = document.getElementById('name-label')?.parentElement;
            if (nameLabel) nameLabel.insertAdjacentHTML('afterend', logoHtml);
            
            this.bindLogoEvents();
        }

        modal.showModal();
    },

    bindLogoEvents: function() {
        const input = document.getElementById('input-logo');
        const preview = document.getElementById('logo-preview');
        const errorMsg = document.getElementById('logo-error');

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validación de tamaño (5MB = 5242880 bytes)
            if (file.size > 5 * 1024 * 1024) {
                errorMsg.classList.remove('hidden');
                input.value = "";
                this.pendingLogoBase64 = null;
                preview.innerHTML = '<i class="fas fa-times text-red-300"></i>';
                return;
            }

            errorMsg.classList.add('hidden');
            const reader = new FileReader();
            reader.onload = (event) => {
                this.pendingLogoBase64 = event.target.result;
                preview.innerHTML = `<img src="${this.pendingLogoBase64}" class="w-full h-full object-cover">`;
            };
            reader.readAsDataURL(file);
        });
    },

    setupSuggestForm: function() {
        const form = document.getElementById('suggest-form');
        if(!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-suggest');
            btn.disabled = true; 
            btn.innerHTML = '<i class="fas fa-spinner animate-spin mr-2"></i> Enviando...';

            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            // Mapear campos y agregar el logo
            data.type = data.suggest_type;
            data.logo = this.pendingLogoBase64; // Agregar el Base64
            delete data.suggest_type;

            if(data.coordenadas) {
                try { data.coordenadas = JSON.parse(data.coordenadas); } catch(e) { data.coordenadas = null; }
            }

            try {
                const res = await fetch('/api/public/suggest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if(!res.ok) throw new Error("Error al enviar la sugerencia");
                
                // Limpiar estado
                this.pendingLogoBase64 = null;
                e.target.reset();
                const preview = document.getElementById('logo-preview');
                if (preview) preview.innerHTML = '<i class="fas fa-image text-stone-300"></i>';

                alert("¡Gracias! Tu sugerencia ha sido enviada con éxito.");
                document.getElementById('suggest-modal').close();
                this.loadCompanies(); 

            } catch(err) {
                alert("Hubo un problema: " + err.message);
            } finally {
                btn.disabled = false; 
                btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Enviar Sugerencia';
            }
        });
    },

    resetToCompanies: function() {
        this.loadCompanies();
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());