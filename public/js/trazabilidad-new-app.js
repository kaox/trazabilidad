// ==========================================
// CONFIGURACIÓN Y CATÁLOGO
// ==========================================
// Este catálogo refleja exactamente lo que insertaste en la BD
const CATALOGO_ETAPAS = [
    { id: 'cacao_1_cosecha', nombre: 'Cosecha', icon: 'fa-leaf', color: 'text-green-600', bg: 'bg-green-100', categorias: ['CACAO', 'cacao'] },
    { id: 'cacao_2_fermentacion', nombre: 'Fermentación', icon: 'fa-box', color: 'text-amber-600', bg: 'bg-amber-100', categorias: ['CACAO', 'cacao'] },
    { id: 'cacao_3_secado', nombre: 'Secado', icon: 'fa-sun', color: 'text-yellow-600', bg: 'bg-yellow-100', categorias: ['CACAO', 'cacao'] },
    { id: 'cacao_4_tostado', nombre: 'Tostado', icon: 'fa-fire', color: 'text-orange-700', bg: 'bg-orange-100', categorias: ['CACAO', 'cacao'] },
    { id: 'cacao_5_molienda', nombre: 'Descascarillado & Molienda', icon: 'fa-cog', color: 'text-gray-600', bg: 'bg-gray-100', categorias: ['CACAO', 'cacao'] },
    { id: 'cacao_6_chocolate', nombre: 'Chocolate', icon: 'fa-industry', color: 'text-purple-600', bg: 'bg-purple-100', categorias: ['CACAO', 'cacao'] },
    { id: 'cacao_7_envasado', nombre: 'Envasado', icon: 'fa-box-open', color: 'text-blue-600', bg: 'bg-blue-100', categorias: ['CACAO', 'cacao'] },

    { id: 'cafe_1_cosecha', nombre: 'Cosecha y Selección', icon: 'fa-leaf', color: 'text-green-600', bg: 'bg-green-100', categorias: ['CAFE', 'cafe', 'CAFÉ', 'café'] },
    { id: 'cafe_2_despulpado', nombre: 'Despulpado', icon: 'fa-tint', color: 'text-blue-400', bg: 'bg-blue-100', categorias: ['CAFE', 'cafe', 'CAFÉ', 'café'] },
    { id: 'cafe_3_fermentacion', nombre: 'Fermentación', icon: 'fa-box', color: 'text-amber-600', bg: 'bg-amber-100', categorias: ['CAFE', 'cafe', 'CAFÉ', 'café'] },
    { id: 'cafe_4_lavado', nombre: 'Lavado', icon: 'fa-water', color: 'text-blue-500', bg: 'bg-blue-100', categorias: ['CAFE', 'cafe', 'CAFÉ', 'café'] },
    { id: 'cafe_5_secado', nombre: 'Secado', icon: 'fa-sun', color: 'text-yellow-600', bg: 'bg-yellow-100', categorias: ['CAFE', 'cafe', 'CAFÉ', 'café'] },
    { id: 'cafe_6_trilla', nombre: 'Trilla y Selección', icon: 'fa-cogs', color: 'text-gray-600', bg: 'bg-gray-100', categorias: ['CAFE', 'cafe', 'CAFÉ', 'café'] },
    { id: 'cafe_7_tostado', nombre: 'Tostado', icon: 'fa-fire', color: 'text-orange-700', bg: 'bg-orange-100', categorias: ['CAFE', 'cafe', 'CAFÉ', 'café'] },
    { id: 'cafe_8_envasado', nombre: 'Molienda / Envasado', icon: 'fa-box-open', color: 'text-blue-600', bg: 'bg-blue-100', categorias: ['CAFE', 'cafe', 'CAFÉ', 'café'] },
    { id: 'cafe_9_evaluacion', nombre: 'Evaluación en Taza', icon: 'fa-award', color: 'text-emerald-700', bg: 'bg-emerald-100', categorias: ['CAFE', 'cafe', 'CAFÉ', 'café'] },
];

// ==========================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ==========================================
let lotes = [];
let productos = [];
let actores = []; // Combinación de Fincas y Procesadoras
let currentLote = null;
let editEtapaId = null; // Control para saber si creamos o editamos una etapa

// Mapa
let map;
let mapMarkers = [];
let mapPolyline = null;

// ==========================================
// UTILIDADES: COMPRESIÓN A WEBP
// ==========================================
async function compressImageToWebP(file, maxWidth = 1200) {
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

                // Redimensionar si supera el ancho máximo
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Exportar como WebP a 80% de calidad
                const dataUrl = canvas.toDataURL('image/webp', 0.8);
                resolve(dataUrl);
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
}

// ==========================================
// FUNCIÓN GLOBAL PARA GOOGLE MAPS
// ==========================================
// Definimos tanto initMapTrazabilidad como initMap apuntando al mismo inicializador 
// para prevenir que peticiones asíncronas o de caché de Google Maps arrojen errores en consola
window.initMapTrazabilidad = function () {
    const mapContainer = document.getElementById("mapa-ruta");
    if (!mapContainer) return;

    map = new google.maps.Map(mapContainer, {
        zoom: 6,
        center: { lat: -9.189, lng: -75.015 }, // Centro de Perú por defecto
        mapTypeId: 'terrain',
        disableDefaultUI: true,
        zoomControl: true,
    });
};

// Alias compatible para prevenir fallos si la API de Maps ya estaba configurada con initMap
window.initMap = window.initMapTrazabilidad;

document.addEventListener('DOMContentLoaded', async () => {
    // Referencias DOM principales
    const vistaLista = document.getElementById('vista-lista');
    const vistaEditor = document.getElementById('vista-editor');
    const btnNuevoLote = document.getElementById('btn-nuevo-lote');
    const btnVolver = document.getElementById('btn-volver');

    // Configurar Fetch Api Wrapper (asumiendo token JWT en localStorage)
    const fetchApi = async (url, options = {}) => {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(url, { ...options, headers });
        if (!res.ok) throw new Error(await res.text());
        // Tratar 204 No Content
        if (res.status === 204) return null;
        return res.json();
    };

    // Transformar dinámicamente el campo URL a Input de Archivo (Upload WebP)
    const fotoInputOriginal = document.getElementById('etapa-foto');
    if (fotoInputOriginal) {
        const fotoContainer = fotoInputOriginal.parentElement;
        fotoContainer.innerHTML = `
            <label class="block text-xs font-medium text-gray-600 mb-1">Foto de la etapa (Subir imagen)</label>
            <input type="file" id="etapa-foto-file" accept="image/*" class="w-full text-sm border border-gray-300 rounded-md p-1.5 outline-none focus:ring-1 focus:ring-[#8B4513] bg-white file:mr-3 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-[#8B4513] hover:file:bg-orange-100 transition-all cursor-pointer">
            <input type="hidden" id="etapa-foto-b64">
            <div id="etapa-foto-preview" class="mt-2 hidden rounded-lg overflow-hidden h-24 w-24 border border-gray-200 shadow-sm relative group">
                <img src="" class="w-full h-full object-cover">
                <button type="button" id="btn-remove-foto" class="absolute top-1 right-1 bg-red-500/90 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 shadow-md backdrop-blur-sm"><i class="fas fa-times text-[10px]"></i></button>
            </div>
        `;

        document.getElementById('etapa-foto-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const btnSubmit = document.querySelector('#form-etapa button[type="submit"]');
                    btnSubmit.disabled = true;
                    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

                    const webpBase64 = await compressImageToWebP(file, 1200);

                    document.getElementById('etapa-foto-b64').value = webpBase64;
                    const preview = document.getElementById('etapa-foto-preview');
                    preview.querySelector('img').src = webpBase64;
                    preview.classList.remove('hidden');

                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = editEtapaId ? 'Actualizar Etapa' : 'Agregar a la ruta';
                } catch (err) {
                    alert('Error al comprimir la imagen');
                    console.error(err);
                }
            }
        });

        document.getElementById('btn-remove-foto').addEventListener('click', () => {
            document.getElementById('etapa-foto-file').value = '';
            document.getElementById('etapa-foto-b64').value = '';
            document.getElementById('etapa-foto-preview').classList.add('hidden');
        });
    }

    // ==========================================
    // CARGA DE DATOS INICIALES
    // ==========================================
    async function initData() {
        try {
            // Cargar Lotes
            lotes = await fetchApi('/api/lotes');

            // Cargar Productos para el Select
            productos = await fetchApi('/api/productos');
            populateProductosSelect();

            // Cargar Actores (Fincas y Procesadoras)
            const [fincas, procesadoras] = await Promise.all([
                fetchApi('/api/fincas').catch(() => []),
                fetchApi('/api/procesadoras').catch(() => [])
            ]);

            actores = [
                ...fincas.map(f => ({ id: f.id, nombre: f.nombre_finca, tipo: 'finca', coords: f.coordenadas })),
                ...procesadoras.map(p => ({ id: p.id, nombre: p.razon_social || p.nombre_comercial, tipo: 'procesadora', coords: p.coordenadas }))
            ];
            populateActoresSelect();

            renderLotesGrid();
        } catch (error) {
            console.error("Error al cargar datos:", error);
            alert("Hubo un error cargando la información. Revisa la consola.");
        }
    }

    // ==========================================
    // RENDERIZADO DE VISTAS
    // ==========================================
    function renderLotesGrid() {
        // Limpiamos todo excepto el mensaje de vacío
        Array.from(vistaLista.children).forEach(child => {
            if (child.id !== 'lista-vacia') child.remove();
        });

        if (lotes.length === 0) {
            document.getElementById('lista-vacia').classList.remove('hidden');
            return;
        }

        document.getElementById('lista-vacia').classList.add('hidden');

        lotes.forEach(lote => {
            const card = document.createElement('div');
            card.className = `bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-all hover:shadow-md ${lote.is_locked ? 'border-emerald-200' : 'border-gray-100'}`;

            const lockBadge = lote.is_locked ? `<span class="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded flex items-center gap-1 font-bold whitespace-nowrap"><i class="fas fa-shield-check"></i> Sellado</span>` : '';
            const statusBadge = lote.estado === 'ACTIVO' && !lote.is_locked ? `<span class="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-full whitespace-nowrap"><i class="fas fa-check-circle"></i> Publicado</span>`
                : (lote.estado === 'BORRADOR' ? `<span class="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-full whitespace-nowrap">Borrador</span>` : '');

            // Extraemos la información del producto asociado desde el arreglo global de productos
            const productoObj = productos.find(p => p.id === lote.producto_id) || {};

            // Imagen con fallback a un placeholder general si el producto no tiene 'imagen_url'
            const imagenUrl = productoObj.imagen_url || 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?q=80&w=200&auto=format&fit=crop';
            // Tipo de producto (Prioridad: SQL -> Producto -> Catálogo Genérico)
            const tipoProducto = lote.categoria || productoObj.tipo_producto || productoObj.categoria || 'Especialidad';

            card.innerHTML = `
                <div class="p-5 border-b border-gray-50 flex gap-4 items-start">
                    <!-- Contenedor de la Minifoto -->
                    <div class="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-gray-100 shadow-sm bg-gray-50">
                        <img src="${imagenUrl}" alt="${lote.producto_nombre}" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1559525839-b184a4d698c7?q=80&w=200&auto=format&fit=crop'">
                    </div>
                    
                    <!-- Información del Lote -->
                    <div class="w-full">
                        <div class="flex items-center justify-between gap-2 mb-1">
                            <div class="flex gap-2 items-center flex-wrap">
                                <span class="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${lote.codigo_lote}</span>
                                <!-- Etiqueta del tipo de producto -->
                                <span class="text-[10px] uppercase font-bold text-[#8B4513] bg-orange-50 px-2 py-1 rounded-full border border-orange-100/50">${tipoProducto}</span>
                                ${lockBadge}
                            </div>
                            ${statusBadge}
                        </div>
                        <h3 class="font-serif text-lg font-bold text-[#4A2C2A] mt-1 leading-tight">${lote.producto_nombre || 'Producto Desconocido'}</h3>
                    </div>
                </div>
                <div class="p-4 bg-white flex justify-between flex-grow items-end">
                    <button class="btn-editar-lote text-[#8B4513] hover:text-[#6b350f] text-sm font-medium flex items-center gap-1 w-full justify-center" data-id="${lote.id}">
                        <i class="fas ${lote.is_locked ? 'fa-lock' : 'fa-pen'}"></i> ${lote.is_locked ? 'Ver Ruta Sellada' : 'Editar Ruta'}
                    </button>
                </div>
            `;

            card.querySelector('.btn-editar-lote').addEventListener('click', () => abrirEditor(lote.id));
            vistaLista.appendChild(card);
        });
    }

    async function abrirEditor(loteId = null) {
        vistaLista.classList.add('hidden');
        btnNuevoLote.classList.add('hidden');
        vistaEditor.classList.remove('hidden');
        document.getElementById('add-etapa-form').classList.add('hidden');
        document.getElementById('btn-show-form-etapa-container').classList.remove('hidden');
        editEtapaId = null;

        if (loteId) {
            // Cargar datos completos del lote (con etapas)
            try {
                currentLote = await fetchApi(`/api/lotes/${loteId}`);
                document.getElementById('editor-title').innerText = currentLote.is_locked ? `Lote Sellado: ${currentLote.codigo_lote}` : `Editando Lote: ${currentLote.codigo_lote}`;
                document.getElementById('editor-subtitle').innerHTML = currentLote.is_locked ? `<span class="text-emerald-600 font-mono"><i class="fas fa-link"></i> ${currentLote.blockchain_hash}</span>` : 'Configura la hoja de ruta';

                // Llenar Formulario
                document.getElementById('lote-codigo').value = currentLote.codigo_lote;
                document.getElementById('lote-estado').value = currentLote.estado;
                document.getElementById('lote-producto').value = currentLote.producto_id;

                aplicarEstadoBloqueo(currentLote.is_locked);
                actualizarFiltroEtapas();
                renderTimeline();
            } catch (e) {
                alert("Error cargando lote");
                cerrarEditor();
            }
        } else {
            // Lógica para Generar Código Automático LOT-[YYYYMM]-[SEC]
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const prefix = `LOT-${yyyy}${mm}-`;

            let maxSec = 0;
            lotes.forEach(l => {
                if (l.codigo_lote && l.codigo_lote.startsWith(prefix)) {
                    const secPart = l.codigo_lote.split('-')[2];
                    if (secPart) {
                        const secNum = parseInt(secPart, 10);
                        if (!isNaN(secNum) && secNum > maxSec) {
                            maxSec = secNum;
                        }
                    }
                }
            });

            const nextSec = String(maxSec + 1).padStart(3, '0');
            const autoCodigoLote = `${prefix}${nextSec}`;

            currentLote = { id: null, codigo_lote: autoCodigoLote, producto_id: '', estado: 'BORRADOR', is_locked: false, etapas: [] };
            document.getElementById('editor-title').innerText = 'Crear Nuevo Lote';
            document.getElementById('editor-subtitle').innerText = 'Guarda el lote primero para añadir etapas.';

            document.getElementById('lote-codigo').value = autoCodigoLote;
            document.getElementById('lote-estado').value = 'BORRADOR';
            document.getElementById('lote-producto').value = '';

            aplicarEstadoBloqueo(false);
            document.getElementById('btn-show-form-etapa-container').classList.add('hidden');
            renderTimeline();
        }
    }

    function cerrarEditor() {
        vistaEditor.classList.add('hidden');
        vistaLista.classList.remove('hidden');
        btnNuevoLote.classList.remove('hidden');
        currentLote = null;
        editEtapaId = null;
        limpiarMapa();
        initData(); // Refrescar lista
    }

    function aplicarEstadoBloqueo(isLocked) {
        const inputs = ['lote-codigo', 'lote-estado', 'lote-producto'];
        inputs.forEach(id => document.getElementById(id).disabled = isLocked);

        const lockOverlay = document.getElementById('lock-overlay');
        const btnSellar = document.getElementById('btn-sellar');
        const iconLocked = document.getElementById('icon-locked');
        const header = document.getElementById('editor-header');

        if (isLocked) {
            lockOverlay.classList.remove('hidden');
            btnSellar.classList.add('hidden');
            iconLocked.classList.remove('hidden');
            header.classList.replace('bg-[#FAF7F2]', 'bg-emerald-50');
            header.classList.replace('border-[#E8DFD8]', 'border-emerald-100');
            document.getElementById('btn-guardar').innerHTML = '<i class="fas fa-arrow-left"></i> Volver';
        } else {
            lockOverlay.classList.add('hidden');
            iconLocked.classList.add('hidden');
            header.classList.replace('bg-emerald-50', 'bg-[#FAF7F2]');
            header.classList.replace('border-emerald-100', 'border-[#E8DFD8]');
            document.getElementById('btn-guardar').innerHTML = '<i class="fas fa-save"></i> Guardar Lote';

            // Solo mostrar botón Sellar si el lote ya existe
            if (currentLote && currentLote.id) {
                btnSellar.classList.remove('hidden');
            } else {
                btnSellar.classList.add('hidden');
            }
        }
    }

    // ==========================================
    // GESTIÓN DEL FORMULARIO Y ETAPAS
    // ==========================================
    function populateProductosSelect() {
        const select = document.getElementById('lote-producto');
        select.innerHTML = '<option value="">-- Seleccionar Producto --</option>';
        productos.forEach(p => {
            select.innerHTML += `<option value="${p.id}" data-cat="${p.categoria || p.tipo_producto}">${p.nombre}</option>`;
        });
    }

    function populateActoresSelect() {
        const select = document.getElementById('etapa-actor');
        select.innerHTML = '<option value="">-- Seleccionar Dónde Ocurrió --</option>';

        let optgroupFincas = '<optgroup label="Fincas / Origen">';
        let optgroupPlantas = '<optgroup label="Procesadoras / Plantas">';

        actores.forEach(a => {
            if (a.tipo === 'finca') optgroupFincas += `<option value="finca_${a.id}">${a.nombre}</option>`;
            else optgroupPlantas += `<option value="procesadora_${a.id}">${a.nombre}</option>`;
        });

        select.innerHTML += optgroupFincas + '</optgroup>' + optgroupPlantas + '</optgroup>';
    }

    function actualizarFiltroEtapas() {
        const prodSelect = document.getElementById('lote-producto');
        const selectedOption = prodSelect.options[prodSelect.selectedIndex];
        const categoria = selectedOption ? selectedOption.getAttribute('data-cat') : null;

        const selectEtapa = document.getElementById('etapa-tipo');
        selectEtapa.innerHTML = '<option value="">- Tipo de Etapa -</option>';

        CATALOGO_ETAPAS.forEach(etapa => {
            if (!categoria || etapa.categorias.some(c => c.toLowerCase() === categoria.toLowerCase())) {
                selectEtapa.innerHTML += `<option value="${etapa.id}">${etapa.nombre}</option>`;
            }
        });
    }

    // Detectar cambio de producto para refrescar etapas
    document.getElementById('lote-producto').addEventListener('change', actualizarFiltroEtapas);

    // ==========================================
    // RENDERIZADO DEL TIMELINE
    // ==========================================
    function renderTimeline() {
        const container = document.getElementById('timeline-container');
        container.innerHTML = '';

        if (!currentLote || !currentLote.etapas || currentLote.etapas.length === 0) {
            document.getElementById('contador-etapas').innerText = '0 etapas';
            dibujarRutaMapa([]); // Limpiar mapa
            document.getElementById('mapa-empty-overlay').classList.remove('hidden');
            return;
        }

        document.getElementById('contador-etapas').innerText = `${currentLote.etapas.length} etapas`;
        document.getElementById('mapa-empty-overlay').classList.add('hidden');

        currentLote.etapas.forEach((etapa, idx) => {
            // Buscar info extra
            const cat = CATALOGO_ETAPAS.find(c => c.id === etapa.catalogo_etapa_id) || {};
            const actorId = etapa.finca_id || etapa.procesadora_id;
            const actor = actores.find(a => a.id === actorId) || {};

            const isLast = idx === currentLote.etapas.length - 1;

            const lineHtml = isLast ? '' : `<div class="absolute left-[19px] top-[40px] w-[2px] h-full bg-gray-200 z-0"></div>`;
            const iconHtml = `<div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${cat.bg || 'bg-gray-200'} ${cat.color || 'text-gray-600'} shadow-sm border-2 border-white"><i class="fas ${cat.icon || 'fa-map-marker-alt'}"></i></div>`;
            // Render de foto responsive
            const fotoHtml = etapa.foto ? `<div class="mt-3 w-full"><img src="${etapa.foto}" class="w-full max-w-full sm:max-w-[200px] h-32 object-cover rounded-lg border border-gray-200 shadow-sm" onerror="this.style.display='none'"></div>` : '';
            // Renderización Mobile First para los botones de acción: Siempre visibles en mobile, controlados por hover en desktop (lg:opacity-0 group-hover:opacity-100)
            const actionsHtml = currentLote.is_locked ? '' : `
                <div class="absolute -right-2 -top-2 flex gap-1.5 z-20 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all">
                    <button type="button" class="btn-edit-etapa bg-blue-100 text-blue-600 w-8 h-8 rounded-full shadow-md flex items-center justify-center hover:bg-blue-200" data-id="${etapa.id}"><i class="fas fa-pen text-xs"></i></button>
                    <button type="button" class="btn-delete-etapa bg-red-100 text-red-600 w-8 h-8 rounded-full shadow-md flex items-center justify-center hover:bg-red-200" data-id="${etapa.id}"><i class="fas fa-trash text-xs"></i></button>
                </div>
            `;

            const node = document.createElement('div');
            node.className = 'relative flex gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 group mt-4';
            node.innerHTML = `
                ${lineHtml}
                ${iconHtml}
                <div class="flex-grow min-w-0 pr-8">
                    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                        <div>
                            <h4 class="font-bold text-gray-800 break-words leading-tight">${cat.nombre || 'Etapa'}</h4>
                            <p class="text-sm text-[#8B4513] font-medium flex items-center gap-1 mt-0.5"><i class="fas fa-map-pin text-[10px]"></i> <span class="truncate">${actor.nombre || 'Desconocido'}</span></p>
                        </div>
                        <span class="text-[10px] sm:text-xs text-gray-500 bg-white px-2 py-1 rounded border shadow-sm w-fit">${etapa.fecha}</span>
                    </div>
                    ${etapa.notas ? `<p class="text-xs sm:text-sm text-gray-600 mt-2 italic bg-white p-2 rounded border border-gray-100">"${etapa.notas}"</p>` : ''}
                    ${fotoHtml}
                </div>
                ${actionsHtml}
            `;
            container.appendChild(node);
        });

        // Eventos Eliminar
        document.querySelectorAll('.btn-delete-etapa').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const etapaId = e.currentTarget.getAttribute('data-id');
                if (confirm('¿Eliminar esta etapa?')) {
                    try {
                        await fetchApi(`/api/etapas/${etapaId}`, {
                            method: 'DELETE',
                            body: JSON.stringify({ lote_id: currentLote.id })
                        });
                        // Recargar lote
                        await abrirEditor(currentLote.id);
                    } catch (err) { alert(err.message); }
                }
            });
        });

        // Eventos Editar
        document.querySelectorAll('.btn-edit-etapa').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const etapaId = e.currentTarget.getAttribute('data-id');
                const etapaToEdit = currentLote.etapas.find(et => et.id === etapaId);

                if (etapaToEdit) {
                    editEtapaId = etapaToEdit.id;

                    document.getElementById('etapa-tipo').value = etapaToEdit.catalogo_etapa_id;
                    document.getElementById('etapa-fecha').value = etapaToEdit.fecha;

                    const actorValue = etapaToEdit.finca_id ? `finca_${etapaToEdit.finca_id}` : `procesadora_${etapaToEdit.procesadora_id}`;
                    document.getElementById('etapa-actor').value = actorValue;
                    document.getElementById('etapa-notas').value = etapaToEdit.notas || '';

                    // Manejo del preview webp de edición
                    document.getElementById('etapa-foto-b64').value = etapaToEdit.foto || '';
                    document.getElementById('etapa-foto-file').value = '';
                    const preview = document.getElementById('etapa-foto-preview');
                    if (etapaToEdit.foto) {
                        preview.querySelector('img').src = etapaToEdit.foto;
                        preview.classList.remove('hidden');
                    } else {
                        preview.classList.add('hidden');
                    }

                    document.getElementById('btn-show-form-etapa-container').classList.add('hidden');
                    document.getElementById('add-etapa-form').classList.remove('hidden');
                    document.querySelector('#form-etapa button[type="submit"]').innerText = 'Actualizar Etapa';

                    // Scroll smooth al form en mobile
                    document.getElementById('add-etapa-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        });

        dibujarRutaMapa(currentLote.etapas);
    }

    // ==========================================
    // DIBUJAR EN GOOGLE MAPS
    // ==========================================
    function limpiarMapa() {
        if (mapPolyline) mapPolyline.setMap(null);
        mapMarkers.forEach(m => m.setMap(null));
        mapMarkers = [];
        mapPolyline = null;
    }

    function dibujarRutaMapa(etapasArr) {
        limpiarMapa();
        if (!map || etapasArr.length === 0) return;

        const pathCoords = [];
        const bounds = new google.maps.LatLngBounds();

        etapasArr.forEach((etapa, index) => {
            const actorId = etapa.finca_id || etapa.procesadora_id;
            const actor = actores.find(a => a.id === actorId);

            if (actor && actor.coords && actor.coords.lat && actor.coords.lng) {
                const pos = { lat: parseFloat(actor.coords.lat), lng: parseFloat(actor.coords.lng) };
                pathCoords.push(pos);
                bounds.extend(pos);

                // Marcador personalizado numérico
                const marker = new google.maps.Marker({
                    position: pos,
                    map: map,
                    label: { text: (index + 1).toString(), color: "white", fontWeight: "bold" },
                    title: actor.nombre,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: "#8B4513",
                        fillOpacity: 1,
                        strokeWeight: 2,
                        strokeColor: "#FFFFFF",
                        scale: 12
                    }
                });
                mapMarkers.push(marker);
            }
        });

        if (pathCoords.length > 1) {
            mapPolyline = new google.maps.Polyline({
                path: pathCoords,
                geodesic: true,
                strokeColor: '#8B4513',
                strokeOpacity: 0.8,
                strokeWeight: 3,
                map: map
            });
        }

        if (pathCoords.length > 0) {
            map.fitBounds(bounds);
            // Evitar zoom extremo si hay un solo punto
            if (pathCoords.length === 1) {
                setTimeout(() => map.setZoom(12), 100);
            }
        }
    }

    // ==========================================
    // EVENTOS DE LOS BOTONES
    // ==========================================
    // Corrección aquí: Escuchador del botón "+ Nuevo Lote" asignado correctamente para abrir el editor
    btnNuevoLote.addEventListener('click', () => abrirEditor());
    btnVolver.addEventListener('click', cerrarEditor);

    // Guardar Lote Base
    document.getElementById('btn-guardar').addEventListener('click', async () => {
        if (currentLote && currentLote.is_locked) { cerrarEditor(); return; }

        const payload = {
            codigo_lote: document.getElementById('lote-codigo').value,
            estado: document.getElementById('lote-estado').value,
            producto_id: document.getElementById('lote-producto').value
        };

        if (!payload.codigo_lote || !payload.producto_id) return alert('Completa Código y Producto');

        try {
            if (currentLote.id) {
                await fetchApi(`/api/lotes/${currentLote.id}`, { method: 'PUT', body: JSON.stringify(payload) });
            } else {
                const res = await fetchApi('/api/lotes', { method: 'POST', body: JSON.stringify(payload) });
                currentLote.id = res.id;
            }
            alert('Lote guardado correctamente.');
            await abrirEditor(currentLote.id);
        } catch (e) { alert("Error guardando lote: " + e.message); }
    });

    // Mostrar Formulario Etapa
    document.getElementById('btn-show-form-etapa').addEventListener('click', () => {
        if (!currentLote || !currentLote.id) {
            alert('Por favor, guarda el lote primero antes de añadir etapas.');
            return;
        }
        editEtapaId = null; // Modo Creación
        document.getElementById('form-etapa').reset();

        // Limpiar foto state
        const fotoB64 = document.getElementById('etapa-foto-b64');
        const fotoPreview = document.getElementById('etapa-foto-preview');
        if (fotoB64) fotoB64.value = '';
        if (fotoPreview) fotoPreview.classList.add('hidden');

        document.querySelector('#form-etapa button[type="submit"]').innerText = 'Agregar a la ruta';
        document.getElementById('btn-show-form-etapa-container').classList.add('hidden');
        document.getElementById('add-etapa-form').classList.remove('hidden');
    });

    // Ocultar Formulario Etapa
    document.getElementById('btn-cancel-etapa').addEventListener('click', () => {
        editEtapaId = null;
        document.getElementById('form-etapa').reset();

        const fotoB64 = document.getElementById('etapa-foto-b64');
        const fotoPreview = document.getElementById('etapa-foto-preview');
        if (fotoB64) fotoB64.value = '';
        if (fotoPreview) fotoPreview.classList.add('hidden');

        document.getElementById('add-etapa-form').classList.add('hidden');
        document.getElementById('btn-show-form-etapa-container').classList.remove('hidden');
    });

    // Guardar Etapa
    document.getElementById('form-etapa').addEventListener('submit', async (e) => {
        e.preventDefault();

        const actorValue = document.getElementById('etapa-actor').value;
        if (!actorValue) return alert("Selecciona el actor/locación.");

        const isFinca = actorValue.startsWith('finca_');
        const realId = actorValue.split('_')[1];

        // Si hay una foto cargada localmente y convertida a base64, usarla.
        let fotoVal = '';
        const b64Input = document.getElementById('etapa-foto-b64');
        if (b64Input) fotoVal = b64Input.value;

        const ordenActual = editEtapaId
            ? currentLote.etapas.find(et => et.id === editEtapaId).orden
            : currentLote.etapas.length + 1;

        const payload = {
            lote_id: currentLote.id,
            catalogo_etapa_id: document.getElementById('etapa-tipo').value,
            fecha: document.getElementById('etapa-fecha').value,
            notas: document.getElementById('etapa-notas').value,
            foto: fotoVal,
            orden: ordenActual,
            finca_id: isFinca ? realId : null,
            procesadora_id: !isFinca ? realId : null
        };

        try {
            if (editEtapaId) {
                await fetchApi(`/api/etapas/${editEtapaId}`, { method: 'PUT', body: JSON.stringify(payload) });
            } else {
                await fetchApi('/api/etapas', { method: 'POST', body: JSON.stringify(payload) });
            }

            document.getElementById('btn-cancel-etapa').click();
            await abrirEditor(currentLote.id);
        } catch (err) { alert(err.message); }
    });

    // Sellar Blockchain
    document.getElementById('btn-sellar').addEventListener('click', async () => {
        if (!currentLote || currentLote.etapas.length === 0) {
            return alert('Agrega al menos una etapa a la hoja de ruta antes de sellar.');
        }

        if (confirm('¿ESTÁS SEGURO? Sellar el lote lo bloqueará permanentemente y simulará un registro inmutable en blockchain. No podrás editar ni añadir más etapas.')) {
            try {
                const res = await fetchApi(`/api/lotes/${currentLote.id}/sellar`, { method: 'POST' });
                alert('¡Éxito! ' + res.message + '\nHash: ' + res.blockchain_hash);
                await abrirEditor(currentLote.id);
            } catch (err) { alert(err.message); }
        }
    });

    // Iniciar
    initData();
});