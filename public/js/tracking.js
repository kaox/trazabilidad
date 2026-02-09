window.initMap = function() { };

document.addEventListener('DOMContentLoaded', () => {
    // --- Selectores del DOM ---
    const buscarBtn = document.getElementById('buscarBtn');
    const loteIdInput = document.getElementById('loteIdInput');
    const storyContainer = document.getElementById('story-container');
    const messageModal = document.getElementById('messageModal');
    const messageText = document.getElementById('messageText');
    const closeMessageModalBtn = document.querySelector('.close-message-modal');
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const closeImageModalBtn = document.querySelector('.close-image-modal');
    const locationModal = document.getElementById('locationModal');
    const locationModalContent = document.getElementById('locationModalContent');
    const closeLocationModalBtn = document.querySelector('.close-location-modal');
    const highlightsContainer = document.getElementById('highlights-container');
    const reviewsContainer = document.getElementById('reviews-container');
    const blockchainContainer = document.getElementById('blockchain-certificate');
    const hashDisplay = document.getElementById('hash-display');

    let FLAVOR_WHEELS_DATA = {};

    // --- Estado Global ---
    let globalHistory = {};
    let chartInstances = {};
    let currentRating = 0;

    if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }

    // Configurar initMap real
    window.initMap = function() {
        // Callback de Google Maps (si se necesita lógica global)
    };

    window.openImageModal = (src) => {
        const modal = document.getElementById('imageModal');
        const img = document.getElementById('modalImage');
        if(modal && img) {
            img.src = src;
            modal.classList.remove('hidden');
        }
    };

    // --- Lógica Principal ---

    async function handleSearch() {
        const loteId = loteIdInput.value.trim().toUpperCase();
        if (!loteId) {
            showMessageModal('Por favor, ingrese un número de lote.');
            return;
        }
        
        showMessageModal(`Buscando información para el lote: ${loteId}...`);

        try {
            // Buscar trazabilidad y reseñas en paralelo
            const [history, reviews, flavorData] = await Promise.all([
                fetch(`/api/trazabilidad/${loteId}`).then(res => res.ok ? res.json() : Promise.reject(res)),
                fetch(`/api/reviews/${loteId}`).then(res => res.ok ? res.json() : Promise.reject(res)),
                fetch('/data/flavor-wheels.json').then(res => res.ok ? res.json() : {})
            ]);

            globalHistory = history;
            FLAVOR_WHEELS_DATA = flavorData;
            renderStory(history, reviews); // Pasar reseñas al renderizador
            hideMessageModal();
        } catch (error) {
            console.error(error);
            storyContainer.innerHTML = '';
            highlightsContainer.innerHTML = '';
            reviewsContainer.innerHTML = '';
            if (blockchainContainer) blockchainContainer.classList.add('hidden'); // Ocultar certificado si hay error
            messageText.textContent = 'Lote no encontrado. Verifica el código e inténtalo de nuevo.';
        }
    }

    function renderStory(h, reviews) {

        let finalHTML = renderLogoCompany(h.ownerInfo);
        finalHTML += createProductDetailsSection(h);
        finalHTML += createMainContent(h);
        finalHTML += createTimelineSection(h);
        finalHTML += createAdditionalInfoSection(h);
        finalHTML += createShareSection(h);

        storyContainer.innerHTML = finalHTML;

        // Renderizar el encabezado personalizado
        renderLogoCompany(h.ownerInfo);

        const routePoints = getRoutePoints(h);
        const highlights = calculateHighlights(h);

        // Post-renderizado de componentes visuales y eventos
        renderHighlightsSection(highlights);
        renderBlockchainCertificate(h);
        renderReviewsSection(reviews);

        setupTabs(routePoints.length >= 1);
        setupGallery();
        setupIntersectionObserver();

        // Mapa Finca
        if (h.fincaData?.coordenadas) {
            setTimeout(() => {
                initializeMap('finca-map-container', h.fincaData.coordenadas);
            }, 100);
        }
        
        // Inicializar Pestañas de Producto y Gráficos
        setupProductTabs();

        // Inicializar Gráficos con retardo para asegurar dimensiones del DOM
        setTimeout(() => {
            if (h.perfilSensorialData) {
                const tipoProducto = h.productoFinal ? h.productoFinal.tipo_producto : '';
                initializePerfilChart('sensory-profile-chart', h.perfilSensorialData, tipoProducto);
            }
        }, 200);
    }

    function createProductDetailsSection(h) {
        const p = h.productoFinal;
        if (!p) return ''; 

        const mainImage = (p.imagenes_json && p.imagenes_json.length > 0) ? p.imagenes_json[0] : null;
        
        // Tabs de Navegación
        const hasSensory = h.perfilSensorialData ? true : false;
        const hasWheel = h.ruedaSaborData ? true : false;
        const hasNutrition = h.nutritionalData ? true : false;

        let tabsNav = `
            <div class="flex border-b border-stone-200 mb-6 overflow-x-auto">
                <button class="product-tab-btn active px-4 py-2 text-sm font-bold text-amber-900 border-b-2 border-amber-900 transition whitespace-nowrap" data-target="tab-story">
                    Detalle
                </button>
                ${hasSensory ? `
                <button class="product-tab-btn px-4 py-2 text-sm font-bold text-stone-500 hover:text-stone-800 border-b-2 border-transparent hover:border-stone-300 transition whitespace-nowrap" data-target="tab-sensory">
                    Perfil Sensorial
                </button>` : ''}
                ${hasNutrition ? `
                <button class="product-tab-btn px-4 py-2 text-sm font-bold text-stone-500 hover:text-stone-800 border-b-2 border-transparent hover:border-stone-300 transition whitespace-nowrap" data-target="tab-nutrition">
                    Nutrición
                </button>` : ''}
            </div>
        `;

        // --- LÓGICA TÉCNICA CAFÉ ---
        let coffeeTechHtml = '';
        const isCoffee = (p.tipo_producto || '').toLowerCase().includes('cafe') || (p.nombre || '').toLowerCase().includes('cafe');
        
        if (isCoffee) {
            // 1. Extraer Datos
            const rawRoast = findValueInStages(h.stages, 'nivelTueste') || findValueInStages(h.stages, 'tipoTueste'); // Intenta agtron o texto
            const roastLevel = normalizeRoastLevel(rawRoast);
            const grindLevel = findValueInStages(h.stages, 'tipoMolienda');
            const processMethod = findValueInStages(h.stages, 'metodoLavado') || findValueInStages(h.stages, 'tipoBeneficio') || 'Lavado'; // Default fallback si no encuentra
            const scaScore = findValueInStages(h.stages, 'puntuacionSCA');

            // 2. Construir HTML
            let techDetails = '';
            
            // Puntaje SCA (Badge destacado)
            if (scaScore) {
                techDetails += `
                    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-900 text-white p-4 rounded-xl mb-6 shadow-md text-center sm:text-left">
                        <div class="flex items-center gap-3">
                            <div class="bg-amber-500 p-2 rounded-lg text-stone-900"><i class="fas fa-medal text-xl"></i></div>
                            <div>
                                <p class="text-xs font-bold text-stone-400 uppercase tracking-widest">Puntaje SCA</p>
                                <p class="text-sm text-stone-300">Calidad de Taza</p>
                            </div>
                        </div>
                        <div class="text-3xl font-display font-bold text-amber-400">${parseFloat(scaScore).toFixed(2)}</div>
                    </div>
                `;
            }

            // Metodo Proceso
            if (processMethod) {
                 techDetails += `
                    <div class="mb-5">
                        <p class="text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Método de Proceso</p>
                        <div class="flex items-center gap-2 text-stone-800 font-bold bg-stone-50 p-3 rounded-lg border border-stone-200">
                            <i class="fas fa-water text-blue-500"></i> ${processMethod}
                        </div>
                    </div>
                 `;
            }

            // Sliders
            techDetails += createSegmentedSlider("Nivel de Tostado", ["Claro", "Medio", "Medio-Oscuro", "Oscuro"], roastLevel);
            techDetails += createSegmentedSlider("Nivel de Molienda", ["Fina", "Media-Fina", "Media", "Media-Gruesa", "Gruesa"], grindLevel);

            if (techDetails) {
                coffeeTechHtml = `
                    <div class="bg-white border border-stone-200 rounded-2xl p-6 mt-8 shadow-sm">
                        <h3 class="text-lg font-display font-bold text-amber-900 mb-6 flex items-center gap-2">
                            <i class="fas fa-sliders-h"></i> Ficha Técnica del Café
                        </h3>
                        ${techDetails}
                    </div>
                `;
            }
        }

        // Contenido Tab 1: Historia (Info General)
        let awardsHtml = '';
        if (p.premios_json && p.premios_json.length > 0) {
            awardsHtml = `<div class="flex flex-wrap gap-3 mt-6 mb-6">
                ${p.premios_json.map(prem => 
                    `<div class="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 px-4 py-2 rounded-xl shadow-sm transform hover:scale-105 transition-transform cursor-default">
                        <div class="bg-white p-1.5 rounded-full shadow-inner text-amber-500">
                            ${prem.logo_url ? `<img src="${prem.logo_url}" class="h-6 w-6 object-contain">` : `<i class="fas fa-trophy text-lg"></i>`}
                        </div>
                        <div class="flex flex-col">
                            <span class="font-bold text-amber-900 text-sm leading-none">${prem.name}</span>
                            ${prem.year ? `<span class="text-xs text-amber-700 font-medium">${prem.year}</span>` : ''}
                        </div>
                    </div>`
                ).join('')}
            </div>`;
        }

        const tabStory = `
            <div id="tab-story" class="product-tab-content animate-fade-in">
                ${p.descripcion ? `<p class="text-stone-600 text-lg leading-relaxed mb-6 font-light border-l-4 border-amber-500 pl-4">${p.descripcion}</p>` : ''}
                
                ${p.ingredientes ? `
                <div class="mb-6">
                    <h4 class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Ingredientes</h4>
                    <p class="text-stone-700 text-sm font-medium">${p.ingredientes}</p>
                </div>` : ''}

                <!-- INYECCIÓN FICHA TÉCNICA CAFÉ -->
                ${coffeeTechHtml}

                <div class="flex flex-wrap items-center justify-between mt-auto pt-6 border-t border-stone-100 w-full">
                    ${awardsHtml}
                </div>
            </div>
        `;

        // Contenido Tab 2: Perfil Sensorial (Radar)
        const tabSensory = `
            <div id="tab-sensory" class="product-tab-content hidden animate-fade-in">
                <div class="flex flex-col items-center justify-center h-full min-h-[300px]">
                    <div class="w-full max-w-sm h-80 relative">
                        <canvas id="sensory-profile-chart"></canvas>
                    </div>
                    <p class="text-xs text-stone-400 mt-4 text-center">Análisis de intensidad por atributo.</p>
                </div>
            </div>
        `;

        // Contenido Tab 3: Rueda de Sabor (Gráfico)
        const tabWheel = `
            <div id="tab-wheel" class="product-tab-content hidden animate-fade-in">
                <div class="flex flex-col items-center justify-center h-full min-h-[300px]">
                    <div class="w-full max-w-sm h-80 relative">
                        <canvas id="flavor-wheel-chart"></canvas>
                    </div>
                    <p class="text-xs text-stone-400 mt-4 text-center">Pasa el mouse para ver notas específicas.</p>
                </div>
            </div>
        `;

        // Contenido Tab 4: Nutrición (Etiqueta Generada)
        const tabNutrition = hasNutrition ? `
            <div id="tab-nutrition" class="product-tab-content hidden animate-fade-in">
                <div class="flex justify-center py-4">
                    <!-- Inyectamos la etiqueta directamente -->
                    ${generateNutritionalLabelHTML(h.nutritionalData)}
                </div>
            </div>
        ` : '';

        return `
            <section class="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden mb-12 animate-fade-in mx-4 md:mx-0">
                <div class="flex flex-col md:flex-row">
                    ${mainImage ? `
                    <div class="md:w-2/5 relative min-h-[300px] md:min-h-[500px] bg-stone-100">
                        <img src="${mainImage}" class="absolute inset-0 w-full h-full object-cover" alt="${p.nombre}">
                    </div>
                    ` : ''}
                    <div class="${mainImage ? 'md:w-3/5' : 'w-full'} p-8 md:p-10 flex flex-col">
                        <div class="mb-4 flex items-center gap-3">
                            <span class="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider border border-amber-200">
                                ${p.tipo_producto || 'Producto'}
                            </span>
                            ${p.gtin ? `<span class="text-xs font-mono text-stone-400 bg-stone-50 px-2 py-0.5 rounded border border-stone-100"><i class="fas fa-barcode mr-1"></i>${p.gtin}</span>` : ''}
                        </div>
                        
                        <h2 class="text-3xl md:text-4xl font-display font-bold text-stone-900 mb-6 leading-tight">
                            ${p.nombre} ${p.peso ? `<div class="text-stone-800 font-bold text-lg">${p.peso}</div>` : '<div></div>'}
                        </h2>

                        <!-- TABS NAVEGACIÓN -->
                        ${tabsNav}

                        <!-- TABS CONTENIDO -->
                        ${tabStory}
                        ${hasSensory ? tabSensory : ''}
                        ${hasWheel ? tabWheel : ''}
                        ${tabNutrition}

                    </div>
                </div>
            </section>
        `;
    }

    // --- LÓGICA DE PESTAÑAS ---
    function setupProductTabs() {
        const tabs = document.querySelectorAll('.product-tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Reset estilos tabs
                tabs.forEach(t => {
                    t.classList.remove('active', 'text-amber-900', 'border-amber-900');
                    t.classList.add('text-stone-500', 'border-transparent');
                });
                // Activar actual
                tab.classList.add('active', 'text-amber-900', 'border-amber-900');
                tab.classList.remove('text-stone-500', 'border-transparent');

                // Mostrar contenido
                const targetId = tab.dataset.target;
                document.querySelectorAll('.product-tab-content').forEach(content => {
                    content.classList.add('hidden');
                });
                document.getElementById(targetId).classList.remove('hidden');
            });
        });
    }

    function renderFlavorWheel(ruedaData, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        let notesHtml = '';
        const notas = ruedaData.notas_json || {};
        for (const [categoria, subnotas] of Object.entries(notas)) {
            if (Array.isArray(subnotas) && subnotas.length > 0) {
                let colorClass = 'bg-stone-100 text-stone-700';
                if (categoria.match(/frut/i)) colorClass = 'bg-red-50 text-red-700 border-red-100';
                if (categoria.match(/flor/i)) colorClass = 'bg-pink-50 text-pink-700 border-pink-100';
                if (categoria.match(/nuez|cacao|choc/i)) colorClass = 'bg-amber-50 text-amber-800 border-amber-100';
                if (categoria.match(/especi|herb/i)) colorClass = 'bg-green-50 text-green-700 border-green-100';
                const chips = subnotas.map(n => `<span class="inline-block bg-white px-2 py-1 rounded border border-black/5 text-xs shadow-sm">${n}</span>`).join('');
                notesHtml += `<div class="mb-3 ${colorClass} p-3 rounded-xl border"><h5 class="font-bold text-xs uppercase mb-2 flex items-center gap-2">${categoria}</h5><div class="flex flex-wrap gap-1">${chips}</div></div>`;
            }
        }
        if (!notesHtml) notesHtml = '<div class="text-center py-8"><i class="fas fa-cookie-bite text-stone-200 text-4xl mb-2"></i><p class="text-stone-400 italic text-sm">Sin notas de sabor registradas.</p></div>';
        container.innerHTML = notesHtml;
    }

    function renderBlockchainCertificate(h) {
        if (!blockchainContainer || !hashDisplay) return;

        // Resetear estado (ocultar por defecto)
        blockchainContainer.classList.add('hidden');

        // Buscar si alguna etapa de la cadena tiene un hash (está certificada)
        // Buscamos de atrás hacia adelante para encontrar el hash más reciente (el del producto final)
        const certifiedStage = h.stages.slice().reverse().find(s => s.blockchain_hash);

        if (certifiedStage) {
            // Inyectar el hash
            hashDisplay.textContent = certifiedStage.blockchain_hash;
            
            // Mostrar el contenedor
            blockchainContainer.classList.remove('hidden');
            
            // Opcional: Agregar un pequeño efecto visual o log
            console.log("🔒 Certificado Blockchain encontrado:", certifiedStage.blockchain_hash);
        }
    }

    function calculateHighlights(h) {
        const getFieldValue = (field) => (typeof field === 'object' && field !== null) ? field.value : field;
        const locations = new Set();
        let totalWorkers = 0;
        let daysSinceRoasting = null;
        let isExpired = false;
        let expirationDateString = '';
        let isEudrCompliant = false;

        // 1. Recolectar todas las ubicaciones únicas del proceso
        if (h.fincaData) {
            locations.add(h.fincaData.nombre_finca);
            
            // Verificar si la finca tiene certificación EUDR/GEE
            if (h.fincaData.certificaciones_json && Array.isArray(h.fincaData.certificaciones_json)) {
                isEudrCompliant = h.fincaData.certificaciones_json.some(c => {
                    // Buscar strings como "EUDR", "GEE", "Deforestation" en el nombre de la certificación
                    const name = (typeof c === 'string' ? c : (c.nombre || '')).toUpperCase();
                    return name.includes('EUDR') || name.includes('GEE') || name.includes('DEFORESTATION');
                });
            }
        }
        h.stages.forEach(stage => {
            const locationName = getFieldValue(stage.data.procesadora) || getFieldValue(stage.data.finca);
            if (locationName) {
                locations.add(locationName.replace('Finca: ', '').replace('Procesadora: ', ''));
            }
        });
        

        // 2. Sumar trabajadores de cada ubicación única
        locations.forEach(name => {
            if (h.fincaData && h.fincaData.nombre_finca === name) {
                totalWorkers += (h.fincaData.numero_trabajadores || 0);
            } else if (h.procesadorasData) {
                const p = h.procesadorasData.find(proc => proc.nombre_comercial === name || proc.razon_social === name);
                if (p) totalWorkers += (p.numero_trabajadores || 0);
            }
        });

        // 3. Calcular Días desde Tostado (Solo para Café)
        const product = h.productName ? h.productName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
        
        if (product.includes('cafe')) {
            const roastingStage = h.stages.find(s => s.nombre_etapa.toLowerCase().includes('tostado'));
            if (roastingStage) {
                const roastingDateStr = getFieldValue(roastingStage.data.fecha) || getFieldValue(roastingStage.data.fechaTostado);
                
                if (roastingDateStr) {
                    const roastingDate = new Date(roastingDateStr);
                    const today = new Date();
                    const diffTime = Math.abs(today - roastingDate);
                    daysSinceRoasting = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                }
            }
        }

        // 4. Validar Vencimiento (Nuevo)
        // Busca la etapa de envasado
        const packagingStage = h.stages.find(s => s.nombre_etapa.toLowerCase().includes('envasado'));
        if (packagingStage) {
            const expDateStr = getFieldValue(packagingStage.data.vencimiento);
            if (expDateStr) {
                // Comparamos fecha de vencimiento contra hoy
                // Usamos T23:59:59 para que venza al FINAL del día indicado
                const expDate = new Date(expDateStr + 'T23:59:59');
                const today = new Date();
                
                if (expDate < today) {
                    isExpired = true;
                    // Formato legible para el usuario
                    expirationDateString = new Date(expDateStr + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
                }
            }
        }

        return { totalWorkers, daysSinceRoasting, isExpired, expirationDateString, isEudrCompliant };
    }

    function renderHighlightsSection(highlights) {
        let contentHtml = '';

        // HIGHLIGHT 1: EUDR (Prioridad Alta)
        if (highlights.isEudrCompliant) {
            contentHtml += `
            <div class="bg-emerald-50 p-6 rounded-lg shadow-md text-center border-b-4 border-emerald-500 flex-1 min-w-[200px] animate-fade-in relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                <div class="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <i class="fas fa-globe-americas text-8xl text-emerald-700"></i>
                </div>
                <div class="flex justify-center mb-3 relative z-10">
                    <span class="bg-white text-emerald-600 rounded-full p-3 shadow-sm border border-emerald-100">
                        <i class="fas fa-satellite text-3xl"></i>
                    </span>
                </div>
                <p class="text-lg font-bold font-display text-emerald-900 leading-tight mb-1 relative z-10">EUDR Compliant</p>
                <div class="flex items-center justify-center gap-1 text-xs text-emerald-700 font-bold relative z-10">
                    <i class="fas fa-check-circle"></i> <span>GEE Verified</span>
                </div>
                <p class="text-[10px] text-emerald-600/70 mt-2 relative z-10 uppercase tracking-widest font-bold">100% Libre de Deforestación</p>
            </div>`;
        }

        // Tarjeta de Trabajadores (Existente)
        if (highlights.totalWorkers > 0) {
            contentHtml += `
                <div class="bg-white p-6 rounded-lg shadow-md text-center border-b-4 border-amber-800 flex-1 min-w-[200px]">
                    <i class="fas fa-users text-3xl text-amber-800 mb-2"></i>
                    <p class="text-4xl font-bold font-display text-amber-900">${highlights.totalWorkers}</p>
                    <p class="text-sm text-stone-500">Personas Beneficiadas</p>
                </div>
            `;
        }

        // Tarjeta de Días de Tostado (Nueva - Solo Café)
        if (highlights.daysSinceRoasting !== null) {
            contentHtml += `
                <div class="bg-white p-6 rounded-lg shadow-md text-center border-b-4 border-orange-700 flex-1 min-w-[200px]">
                    <i class="fas fa-fire-burner text-3xl text-orange-700 mb-2"></i>
                    <p class="text-4xl font-bold font-display text-amber-900">${highlights.daysSinceRoasting}</p>
                    <p class="text-sm text-stone-500">Días de Tostado</p>
                </div>
            `;
        }

        if (highlights.isExpired) {
            contentHtml += `
                <div class="bg-red-50 p-6 rounded-lg shadow-md text-center border-b-4 border-red-300 flex-1 min-w-[200px]">
                    <div class="flex justify-center mb-2">
                        <span class="bg-red-100 text-red-600 rounded-full p-3">
                            <i class="fas fa-triangle-exclamation text-xl"></i>
                        </span>
                    </div>
                    <p class="text-xl font-bold font-display text-red-900">Producto Vencido</p>
                    <p class="text-sm text-red-700 mt-1">Expiró el ${highlights.expirationDateString}</p>
                </div>
            `;
        }

        if (!contentHtml) {
            highlightsContainer.innerHTML = '';
            return;
        }

        highlightsContainer.innerHTML = `
            <div class="container mx-auto px-4 md:px-8 -mt-8 mb-8 relative z-10">
                <div class="max-w-4xl mx-auto flex flex-wrap justify-center gap-6">
                    ${contentHtml}
                </div>
            </div>
        `;
    }

    function renderLogoCompany(ownerInfo) {
        const headerContainer = document.getElementById('header-container');
        if (!ownerInfo) return '';

        const hasActiveTrial = ownerInfo.trial_ends_at && new Date(ownerInfo.trial_ends_at) > new Date();
        const isProfesional = ownerInfo.subscription_tier === 'profesional';

        if (isProfesional || hasActiveTrial) {
            return `
                <section class="my-16 text-center">
                <!-- Columna Izquierda: Info Productor -->
                <div class="flex justify-center">
                    ${ownerInfo.company_logo ? `<img src="${ownerInfo.company_logo}" alt="Logo de ${ownerInfo.empresa}" class="h-40 object-contain">` : ''}
                </div>
                <div>
                    <h2 class="text-3xl font-display text-amber-900 mb-4">${ownerInfo.empresa || 'RuruLab'}</h2>
                </div>
                </section>
            `;
        }
    }

    // --- Constructores de Secciones HTML ---

    function createMainContent(h) {
        const { stages, fincaData, perfilSensorialData } = h;
        const lastStage = stages?.[stages.length - 1]?.data || {};
        const firstStage = stages?.[0]?.data || {};

        const getFieldValue = (field) => (typeof field === 'object' && field !== null) ? field.value : field;

        let certsHtml = (fincaData?.certificaciones_json || []).map(cert => `<div class="flex items-center gap-2 p-2 rounded-md bg-stone-100"><img src="${cert.logo_url}" class="h-6 w-6 rounded-full"><span class="text-sm text-stone-600">${cert.nombre}</span></div>`).join('');

        let premiosHtml = (fincaData?.premios_json || []).map(premio => `<div class="flex items-center gap-2 p-2 rounded-md bg-stone-100"><img src="${premio.logo_url}" class="h-6 w-6 rounded-full"><span class="text-sm text-stone-600">${premio.nombre} (${premio.ano})</span></div>`).join('');

        const routePoints = getRoutePoints(h);

        return `
            <section class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                <!-- Columna Izquierda: Info Productor -->
                <div class="product-info bg-white p-6 rounded-lg shadow-md">
                    <img src="${fincaData?.foto_productor || 'https://placehold.co/600x400/3E2723/FFFFFF?text=Productor'}" alt="Foto del Productor" class="w-full h-80 object-cover rounded-md mb-4">
                    <h2 class="text-3xl font-display font-bold text-amber-900">${fincaData?.propietario || 'Nombre del Productor'}</h2>
                    <p class="text-stone-500 my-2 font-semibold">${fincaData?.nombre_finca || 'Nombre de la Finca'}</p>
                    <p class="text-stone-600 mt-4">${fincaData?.historia || 'La historia de este productor y su dedicación al cultivo de alta calidad.'}</p>
                </div>

                <!-- Columna Derecha: Pestañas de Trazabilidad -->
                <div class="traceability-tabs">
                    <div class="flex border-b border-stone-200 mb-4">
                        <button class="tab-button active flex-1 flex items-center justify-center gap-2 p-4 border-b-2" data-tab="terroir"><i class="fa-solid fa-cloud-sun"></i> Terroir</button>
                        <button class="tab-button flex-1 flex items-center justify-center gap-2 p-4 border-b-2 border-transparent" data-tab="productor"><i class="fas fa-leaf"></i> Productor</button>
                        ${routePoints.length >= 1 ? `<button class="tab-button flex-1 flex items-center justify-center gap-2 p-4 border-b-2 border-transparent" data-tab="ruta"><i class="fas fa-route"></i> Ruta</button>` : ''}
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow-md">
                        <div id="tab-terroir" class="tab-panel space-y-4">
                            <div><i class="fa-solid fa-globe"></i> <strong>País:</strong> ${fincaData?.pais || 'N/A'}</div>
                            <div><i class="fa-solid fa-location-dot"></i> <strong>Ciudad:</strong> ${fincaData?.distrito || ''} - ${fincaData?.provincia ||  ''} - ${fincaData?.departamento || ''}</div>
                            <div><i class="fa-solid fa-mountain"></i> <strong>Altura:</strong> ${fincaData?.altura || 'N/A'} msnm</div>
                            <div><i class="fa-solid fa-tag"></i> <strong>Variedad:</strong> ${getFieldValue(firstStage.variedad) || 'N/A'}</div>
                            <div id="finca-map-container" class="w-full h-48 rounded-md border mt-4"></div>
                        </div>
                        <div id="tab-productor" class="tab-panel hidden space-y-4">
                            <div><i class="fa-solid fa-sign-hanging"></i> <strong>Nombre Finca:</strong> ${fincaData?.nombre_finca || 'N/A'}</div>
                            <div><i class="fa-solid fa-user"></i> <strong>Productor:</strong> ${fincaData?.propietario || 'N/A'}</div>
                            ${certsHtml ? `<div><strong class="block mb-2"><i class="fa-solid fa-certificate"></i> Certificaciones:</strong><div class="flex flex-wrap gap-2">${certsHtml}</div></div>` : ''}
                            ${premiosHtml ? `<div><strong class="block mb-2"><i class="fa-solid fa-trophy"></i> Premios:</strong><div class="flex flex-wrap gap-2">${premiosHtml}</div></div>` : ''}
                            <div id="finca-gallery" class="grid grid-cols-3 gap-2 mt-4"></div>
                        </div>
                        ${routePoints.length >= 1 ? `<div id="tab-ruta" class="tab-panel hidden"><div id="route-map-container" class="w-full h-96 rounded-md border"></div></div>` : ''}
                    </div>
                </div>
            </section>
        `;
    }

    function createTimelineSection(h) {
        if (!h.stages || h.stages.length === 0) return '';
        return `
            <section class="my-16 traceability-timeline">
                <h2 class="text-3xl md:text-4xl font-display text-amber-900 mb-12 text-center">Línea de Tiempo del Proceso</h2>
                <div class="relative timeline max-w-3xl mx-auto">
                    ${h.stages.map(stage => createTimelineItem(stage)).join('')}
                </div>
            </section>
        `;
    }
    
    function createAdditionalInfoSection(h) {
        const { maridajesRecomendados, ruedaSaborData } = h;
        let maridajesHtml = '';

        if (maridajesRecomendados && Object.keys(maridajesRecomendados).length > 0) {
            const renderMaridajeGroup = (recs, type) => {
                const excepcionales = recs.filter(r => r.puntuacion >= 90);
                const recomendados = recs.filter(r => r.puntuacion >= 75 && r.puntuacion < 90);
                
                let groupHtml = '';
                if (excepcionales.length > 0) {
                    groupHtml += `<div class="mb-4">
                                    <h5 class="font-bold text-amber-800 text-sm mb-2 uppercase tracking-wide border-b border-amber-100 pb-1">Sinergia Excepcional</h5>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${excepcionales.map(createMaridajeCard).join('')}</div>
                                 </div>`;
                }
                if (recomendados.length > 0) {
                    groupHtml += `<div>
                                    <h5 class="font-bold text-stone-600 text-sm mb-2 uppercase tracking-wide border-b border-stone-100 pb-1">Muy Recomendado</h5>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${recomendados.map(createMaridajeCard).join('')}</div>
                                 </div>`;
                }
                return groupHtml;
            };

            // Construir HTML solo si hay contenido real
            const tempHtml = Object.entries(maridajesRecomendados).map(([type, recs]) => {
                if (!recs || recs.length === 0) return '';
                
                const groupContent = renderMaridajeGroup(recs, type);
                if(!groupContent) return ''; // Si no hay excepcionales ni recomendados, no mostrar nada para este tipo

                const title = type.charAt(0).toUpperCase() + type.slice(1);
                const colorClass = type === 'cafe' ? 'text-green-800' : (type === 'vino' ? 'text-red-800' : 'text-blue-800');
                const bgClass = type === 'cafe' ? 'bg-green-50' : (type === 'vino' ? 'bg-red-50' : 'bg-blue-50');
                const icon = type === 'cafe' ? '☕' : (type === 'vino' ? '🍷' : '🧀');

                return `<div class="mb-6 p-4 rounded-xl ${bgClass}">
                            <h4 class="text-xl font-display font-bold ${colorClass} mb-4 flex items-center gap-2">${icon} Con ${title}</h4>
                            ${groupContent}
                        </div>`;
            }).join('');

            maridajesHtml = tempHtml;
        }

        let ruedaHtml = '';
        if (ruedaSaborData) {
            const chartId = `rueda-sabor-chart-${ruedaSaborData.id}`;
            ruedaHtml = `
                <div class="bg-white rounded-2xl shadow-sm border border-stone-100 mb-8 overflow-hidden">
                    <div class="bg-stone-50 p-4 border-b border-stone-200">
                        <h3 class="font-bold font-display text-xl text-amber-900">Perfil de Sabor</h3>
                    </div>
                    <div class="p-6">
                        <p class="text-sm text-stone-500 mb-6 text-center">Perfil detectado: <strong class="text-amber-800">${ruedaSaborData.nombre_rueda}</strong></p>
                        
                        <div id="rueda-chart-container" class="relative w-full max-w-sm mx-auto aspect-square">
                            <canvas id="${chartId}-l1" class="absolute inset-0"></canvas>
                            <canvas id="${chartId}-l2" class="absolute inset-0" style="transform: scale(0.85)"></canvas>
                        </div>
                        <div id="rueda-chart-legend" class="mt-8 pt-6 border-t border-stone-100"></div>
                    </div>
                </div>
            `;
            setTimeout(() => initializeRuedaChart(chartId, ruedaSaborData), 100);
        }

        // Construir la sección de maridajes completa solo si hay contenido interno
        let maridajesSection = '';
        if (maridajesHtml) {
            maridajesSection = `
                <div class="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden w-full">
                    <div class="bg-amber-50 p-4 border-b border-amber-100">
                        <h3 class="font-bold font-display text-xl text-amber-900">Maridajes Sugeridos</h3>
                    </div>
                    <div class="p-6">
                        ${maridajesHtml}
                    </div>
                </div>
            `;
        }

        // Si no hay ninguno de los dos, no retornar nada
        if (!ruedaHtml && !maridajesSection) return '';

        // Determinar diseño: Grid de 2 si hay ambos, Flex centrado si solo hay uno
        const layoutClass = (ruedaHtml && maridajesSection) 
            ? "grid grid-cols-1 md:grid-cols-2 gap-8 items-start" 
            : "flex justify-center";

        return `
            <section class="additional-info max-w-4xl mx-auto my-16 px-4">
                <div class="${layoutClass}">
                    ${ruedaHtml}
                    ${maridajesSection}
                </div>
            </section>
        `;
    }

    function createMaridajeCard(rec) {
        const nombre = rec.producto.nombre || rec.producto.nombre_perfil;
        return `<div class="p-3 bg-stone-100 rounded-lg">
                    <p class="font-semibold text-sm text-stone-800">${nombre}</p>
                    <p class="text-xs text-green-700">Compatibilidad: ${rec.puntuacion.toFixed(0)}%</p>
                </div>`;
    }

    function createTimelineItem(stage) {
        const { nombre_etapa, descripcion, data, campos_json } = stage;
        const details = getChapterDetails(nombre_etapa, data);
        
        // --- INICIO DE LA CORRECCIÓN ---

        // 1. Crear un mapa de búsqueda para los labels de la plantilla
        const allFields = [
            ...(campos_json.entradas || []),
            ...(campos_json.salidas || []),
            ...(campos_json.variables || [])
        ];
        const fieldMap = new Map();
        allFields.forEach(f => fieldMap.set(f.name, f.label));

        // 2. Usar el mapa de búsqueda para obtener el label
        const dataPointsHtml = Object.entries(data)
            .filter(([key, fieldData]) => {
                // 1. Excluir campos de sistema
                if (['id', 'imageUrl', 'finca', 'lugarProceso', 'procesadora'].includes(key)) return false;
                if (key.toLowerCase().includes('fecha')) return false;
                if (!fieldData?.visible) return false;

                // 2. Excluir valores vacíos o nulos
                const val = fieldData.value;
                if (val === null || val === undefined || val === '') return false;
                if (val === 'N/A' || val === 'n/a') return false; // También filtrar strings "N/A" explícitos si los hubiera

                return true;
            })
            .map(([key, fieldData]) => {
                const label = fieldMap.get(key) || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); // Usa el label, o vuelve al método anterior como fallback
                return `<li><strong>${label}:</strong> ${fieldData.value || 'N/A'}</li>`;
            })
            .join('');
        
        // --- FIN DE LA CORRECCIÓN ---
            
        const imageUrl = data.imageUrl?.value;
        const isImageVisible = data.imageUrl?.visible;
        const locationName = data.lugarProceso?.value || data.finca?.value || data.procesadora?.value || 'N/A';
        const locationButton = `<button class="location-btn text-sky-700 hover:underline" data-location="${locationName}">${locationName}</button>`;

        return `
            <div class="timeline-item animate">
                <div class="bg-white p-6 rounded-lg shadow-lg">
                    <div class="flex items-center gap-3 mb-2">
                         <i class="fas ${details.icon} text-amber-800 text-2xl w-8 text-center"></i>
                         <h3 class="font-bold text-amber-900 font-display text-xl">${details.title}</h3>
                    </div>
                    
                    <p class="text-sm text-stone-500 mb-3 italic">${descripcion || ''}</p>
                    
                    ${imageUrl && isImageVisible ? `<img src="${imageUrl}" class="w-full h-40 object-cover rounded-md my-4">` : ''}
                    
                    <div class="text-sm text-stone-500 mb-3 flex items-center gap-4">
                        <span><i class="fas fa-calendar-alt mr-1"></i> ${details.date}</span>
                        <span><i class="fas fa-map-marker-alt mr-1"></i> ${locationButton}</span>
                    </div>
                    <ul class="text-sm text-stone-600 list-disc list-inside space-y-1">${dataPointsHtml}</ul>
                </div>
            </div>
        `;
    }

    function createShareSection(h) {
        const lastStage = h.stages?.[h.stages.length - 1]?.data || {};
        const loteId = lastStage.id;
        if (!loteId) return '';

        return `
            <section class="my-16 text-center">
                <h2 class="text-3xl font-display text-amber-900 mb-4">Comparte esta Historia</h2>
                <p class="text-stone-600 max-w-xl mx-auto mb-8">Si te ha gustado el viaje de este producto, compártelo con el mundo.</p>
                <div class="flex items-center justify-center gap-4">
                        <button data-lote-id="${loteId}" class="share-btn bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-full transition" title="Compartir en Facebook"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v2.385z"/></svg></button>
                        <button data-lote-id="${loteId}" class="share-btn bg-black hover:bg-gray-800 text-white font-bold p-3 rounded-full transition" title="Compartir en X"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 16 16"><path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z"/></svg></button>
                        <button data-lote-id="${loteId}" class="share-btn bg-green-500 hover:bg-green-600 text-white font-bold p-3 rounded-full transition" title="Compartir en WhatsApp"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.296-.999 1.001-.999 2.448s1.024 2.845 1.173 3.044c.149.198 2.003 3.044 4.851 4.223.713.364 1.364.576 1.84.733.523.172 1.053.148 1.488.099.463-.049 1.492-.612 1.701-1.217.208-.604.208-1.115.148-1.217z"/></svg></button>
                        <button data-lote-id="${loteId}" class="share-btn bg-gray-500 hover:bg-gray-600 text-white font-bold p-3 rounded-full transition" title="Copiar Enlace"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg></button>
                    </div>
            </section>
        `;
    }
    
    function renderFlavorProfile(perfilData) {
        const container = document.getElementById('flavor-profile-bars');
        if (!container) return;

        const attributesToShow = {
            cacao: 'Intensidad Cacao',
            acidez: 'Acidez',
            amargor: 'Amargor',
            astringencia: 'Astringencia',
            frutaFresca: 'Fruta Fresca',
            frutaMarron: 'Fruta Marrón',
            nuez: 'Nuez',
            caramelo: 'Caramelo'
        };

        container.innerHTML = Object.entries(attributesToShow).map(([key, label]) => {
            const value = perfilData[key] || 0;
            const percentage = (value / 10) * 100;
            return `
                <div>
                    <div class="flex justify-between mb-1">
                        <span class="text-sm font-medium text-stone-700">${label}</span>
                        <span class="text-sm font-medium text-amber-800">${value.toFixed(1)}</span>
                    </div>
                    <div class="w-full bg-stone-200 rounded-full h-2.5">
                        <div class="bg-amber-800 h-2.5 rounded-full" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabPanels = document.querySelectorAll('.tab-panel');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                tabPanels.forEach(panel => panel.classList.add('hidden'));
                document.getElementById(`tab-${button.dataset.tab}`).classList.remove('hidden');

                if (button.dataset.tab === 'ruta' && !chartInstances['route-map-container']) {
                    const routePoints = getRoutePoints(globalHistory);
                    initializeRouteMap('route-map-container', routePoints);
                }
            });
        });
    }

    function setupGallery() {
        const galleryContainer = document.getElementById('finca-gallery');
        if (galleryContainer && globalHistory.fincaData?.imagenes_json?.length > 0) {
            galleryContainer.innerHTML = globalHistory.fincaData.imagenes_json.map(img =>
                `<div class="relative"><img src="${img}" class="w-full h-24 object-cover rounded-md cursor-pointer hover:opacity-80 transition"><div class="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition"><i class="fas fa-search-plus text-white"></i></div></div>`
            ).join('');

            galleryContainer.addEventListener('click', (e) => {
                const thumbnailContainer = e.target.closest('.relative');
                if (thumbnailContainer) {
                    const img = thumbnailContainer.querySelector('img');
                    
                    if (img) {
                        modalImage.src = img.src;
                        imageModal.style.display = 'flex';
                    }
                }
            });
        }
    }
    
    function setupIntersectionObserver() {
        const items = document.querySelectorAll('.timeline-item.animate');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        items.forEach(item => observer.observe(item));
    }
    
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString + 'T00:00:00').toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function getChapterDetails(stageName, data) {
        const getFieldValue = (field) => (typeof field === 'object' && field !== null) ? field.value : field;

        const details = {
            title: stageName,
            date: formatDate(getFieldValue(data.fecha) || getFieldValue(data.fechaCosecha) || getFieldValue(data.fechaInicio)),
            icon: 'fa-cog',
            narrative: 'Se completó una etapa clave del proceso.',
        };
        const lowerCaseStageName = stageName.toLowerCase();
        if (lowerCaseStageName.includes('cosecha')) { details.icon = 'fa-leaf'; details.narrative = `Cosechado en la Finca <strong>${getFieldValue(data.finca)}</strong>.`; }
        else if (lowerCaseStageName.includes('fermenta')) { details.icon = 'fa-hourglass-half'; details.narrative = `Fermentado durante <strong>${getFieldValue(data.duracion) || getFieldValue(data.horas)} ${getFieldValue(data.duracion) ? 'días' : 'horas'}</strong>.`; }
        else if (lowerCaseStageName.includes('secado')) { details.icon = 'fa-sun'; details.narrative = `Secado por <strong>${getFieldValue(data.duracion) || getFieldValue(data.dias)} días</strong>.`; }
        else if (lowerCaseStageName.includes('tostado')) { details.icon = 'fa-fire'; details.narrative = `Tostado a <strong>${getFieldValue(data.tempMaxima)}°C</strong>, revelando un perfil de <strong>${getFieldValue(data.tipoPerfil)}</strong>.`; }
        else if (lowerCaseStageName.includes('molienda')) { details.icon = 'fa-mortar-pestle'; details.narrative = `Molienda finalizada, resultando en <strong>${getFieldValue(data.pesoProductoFinal)} kg</strong> de <strong>${getFieldValue(data.productoFinal)}</strong>.`; }
        
        return details;
    }

    // --- GENERADOR DE HTML ETIQUETA NUTRICIONAL ---
    function generateNutritionalLabelHTML(data) {
        const ingredients = data.ingredientes || [];
        const totalWeight = ingredients.reduce((sum, i) => sum + parseFloat(i.peso_gramos), 0);
        if (totalWeight === 0) return '<p class="text-center text-stone-500">Información no disponible</p>';

        let totals = { energy:0, protein:0, fat:0, satFat:0, transFat:0, chol:0, sod:0, carb:0, fiber:0, sugar:0, addedSugar:0, vitD:0, calcium:0, iron:0, pot:0 };
        ingredients.forEach(ing => {
            const factor = parseFloat(ing.peso_gramos) / 100; const n = ing.nutrientes_base_json;
            totals.energy += (n.energy || 0) * factor; totals.protein += (n.protein || 0) * factor; totals.fat += (n.fat || 0) * factor; totals.satFat += (n.satFat || 0) * factor; totals.transFat += (n.transFat || 0) * factor; totals.chol += (n.chol || 0) * factor; totals.sod += (n.sodium || 0) * factor; totals.carb += (n.carb || 0) * factor; totals.fiber += (n.fiber || 0) * factor; totals.sugar += (n.sugar || 0) * factor; totals.addedSugar += (n.addedSugar || 0) * factor; totals.vitD += (n.vitD || 0) * factor; totals.calcium += (n.calcium || 0) * factor; totals.iron += (n.iron || 0) * factor; totals.pot += (n.potassium || 0) * factor;
        });
        const portionSize = data.peso_porcion_gramos || 100; const servings = data.porciones_envase || 1; const val = {};
        for(let key in totals) val[key] = (totals[key] / totalWeight) * portionSize;
        
        // Helper %DV (Valores Diarios estándar FDA 2000 cal)
        const getPct = (v, k) => { const dvMap = { fat:78, satFat:20, chol:300, sod:2300, carb:275, fiber:28, addedSugar:50, vitD:20, calcium:1300, iron:18, pot:4700 }; return Math.round((v / dvMap[k]) * 100) + '%'; };

        // Estilos Inline para garantizar el look FDA independientemente de Tailwind externo
        const sContainer = 'font-family: Helvetica, Arial, sans-serif; border: 2px solid black; padding: 10px; background: white; max-width: 300px; margin: 0 auto; color: black;';
        const sTitle = 'font-weight: 900; font-size: 38px; line-height: 1; margin: 0;';
        const sLineHeavy = 'border-bottom: 10px solid black;';
        const sLineMedium = 'border-bottom: 5px solid black;';
        const sLineLight = 'border-bottom: 1px solid #888;';
        const sFlexBetween = 'display: flex; justify-content: space-between; align-items: flex-end;';
        const sBold = 'font-weight: 900;';
        const sIndent = 'padding-left: 15px;';

        return `
            <div style="${sContainer}">
                <h1 style="${sTitle}">Nutrition Facts</h1>
                <div style="${sLineLight}; margin-bottom: 6px;">
                    <p style="font-size: 16px; margin: 0; font-weight: bold;">${servings} servings per container</p>
                    <div style="${sFlexBetween} font-weight: 900; font-size: 18px; padding-bottom: 4px; border-top: 4px solid black;">
                        <span>Serving size</span>
                        <span>${portionSize}g</span>
                    </div>
                </div>
                <div style="${sLineHeavy}"></div>
                
                <div style="${sFlexBetween} padding-top: 4px; padding-bottom: 4px;">
                    <div>
                        <span style="font-weight: 900; font-size: 14px;">Amount per serving</span><br>
                        <span style="font-weight: 900; font-size: 26px;">Calories</span>
                    </div>
                    <span style="font-weight: 900; font-size: 42px; line-height: 1;">${Math.round(val.energy)}</span>
                </div>
                
                <div style="${sLineMedium}"></div>
                
                <div style="text-align: right; font-size: 13px; font-weight: bold; border-bottom: 1px solid black; padding: 2px 0;">
                    % Daily Value*
                </div>

                <div style="${sLineLight} padding: 3px 0; font-size: 14px; display: flex; justify-content: space-between;">
                    <span><span style="${sBold}">Total Fat</span> ${Math.round(val.fat)}g</span>
                    <span style="${sBold}">${getPct(val.fat, 'fat')}</span>
                </div>
                
                <div style="${sLineLight} padding: 3px 0; font-size: 14px; display: flex; justify-content: space-between; ${sIndent}">
                    <span>Saturated Fat ${Math.round(val.satFat)}g</span>
                    <span style="${sBold}">${getPct(val.satFat, 'satFat')}</span>
                </div>
                
                <div style="${sLineLight} padding: 3px 0; font-size: 14px; display: flex; justify-content: space-between; ${sIndent}">
                    <span>Trans Fat ${val.transFat.toFixed(1)}g</span>
                </div>
                
                <div style="${sLineLight} padding: 3px 0; font-size: 14px; display: flex; justify-content: space-between;">
                    <span><span style="${sBold}">Cholesterol</span> ${Math.round(val.chol)}mg</span>
                    <span style="${sBold}">${getPct(val.chol, 'chol')}</span>
                </div>
                
                <div style="${sLineLight} padding: 3px 0; font-size: 14px; display: flex; justify-content: space-between;">
                    <span><span style="${sBold}">Sodium</span> ${Math.round(val.sod)}mg</span>
                    <span style="${sBold}">${getPct(val.sod, 'sod')}</span>
                </div>
                
                <div style="${sLineLight} padding: 3px 0; font-size: 14px; display: flex; justify-content: space-between;">
                    <span><span style="${sBold}">Total Carbohydrate</span> ${Math.round(val.carb)}g</span>
                    <span style="${sBold}">${getPct(val.carb, 'carb')}</span>
                </div>
                
                <div style="${sLineLight} padding: 3px 0; font-size: 14px; display: flex; justify-content: space-between; ${sIndent}">
                    <span>Dietary Fiber ${Math.round(val.fiber)}g</span>
                    <span style="${sBold}">${getPct(val.fiber, 'fiber')}</span>
                </div>
                
                <div style="${sLineLight} padding: 3px 0; font-size: 14px; display: flex; justify-content: space-between; ${sIndent}">
                    <span>Total Sugars ${Math.round(val.sugar)}g</span>
                </div>
                
                <div style="${sLineLight} padding: 3px 0; font-size: 14px; display: flex; justify-content: space-between; ${sIndent}">
                    <span>Includes ${Math.round(val.addedSugar)}g Added Sugars</span>
                    <span style="${sBold}">${getPct(val.addedSugar, 'addedSugar')}</span>
                </div>
                
                <div style="${sLineHeavy} padding: 3px 0; font-size: 14px; display: flex; justify-content: space-between;">
                    <span style="${sBold}">Protein <span style="font-weight: normal;">${Math.round(val.protein)}g</span></span>
                </div>

                <div style="${sLineLight} padding: 3px 0; font-size: 14px; display: flex; justify-content: space-between;">
                    <span>Vitamin D ${Math.round(val.vitD)}mcg</span>
                    <span>${getPct(val.vitD, 'vitD')}</span>
                </div>
                <div style="${sLineLight} padding: 3px 0; font-size: 14px; display: flex; justify-content: space-between;">
                    <span>Calcium ${Math.round(val.calcium)}mg</span>
                    <span>${getPct(val.calcium, 'calcium')}</span>
                </div>
                <div style="${sLineLight} padding: 3px 0; font-size: 14px; display: flex; justify-content: space-between;">
                    <span>Iron ${Math.round(val.iron)}mg</span>
                    <span>${getPct(val.iron, 'iron')}</span>
                </div>
                <div style="${sLineMedium} padding: 3px 0; font-size: 14px; display: flex; justify-content: space-between;">
                    <span>Potassium ${Math.round(val.pot)}mg</span>
                    <span>${getPct(val.pot, 'pot')}</span>
                </div>

                <div style="font-size: 10px; margin-top: 6px; line-height: 1.3;">
                    * The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.
                </div>
            </div>
        `;
    }
    
    function initializeMap(containerId, coords) {
        const mapContainer = document.getElementById(containerId);
        if (!mapContainer || typeof google === 'undefined') return;

        // Limpiar mapa previo si existe en este contenedor
        // (Nota: Google Maps no tiene un método .remove() directo como Leaflet, 
        // simplemente sobrescribimos la referencia o limpiamos el div si fuera necesario, 
        // pero aquí sobrescribimos chartInstances[containerId])

        try {
            let map;
            
            // Detección: Punto vs Polígono
            // Coordenadas pueden venir como {lat, lng} o [[lat, lng], ...]
            
            // Caso 1: Punto
            if (coords && typeof coords.lat === 'number') {
                const latLng = { lat: coords.lat, lng: coords.lng };
                
                map = new google.maps.Map(mapContainer, {
                    zoom: 15,
                    center: latLng,
                    mapTypeId: 'satellite',
                    streetViewControl: false
                });
                
                new google.maps.Marker({
                    position: latLng,
                    map: map
                });
            }
            // Caso 2: Polígono (Array de arrays)
            else if (Array.isArray(coords) && coords.length > 0) {
                // Convertir array de arrays a objetos LatLngLiteral
                const polygonPath = coords.map(p => ({ lat: p[0], lng: p[1] }));
                
                // Calcular centro para inicializar
                const bounds = new google.maps.LatLngBounds();
                polygonPath.forEach(p => bounds.extend(p));
                
                map = new google.maps.Map(mapContainer, {
                    zoom: 15,
                    center: bounds.getCenter(),
                    mapTypeId: 'satellite',
                    streetViewControl: false
                });
                
                const polygon = new google.maps.Polygon({
                    paths: polygonPath,
                    strokeColor: '#8D6E63',
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: '#8D6E63',
                    fillOpacity: 0.35,
                    map: map
                });
                
                map.fitBounds(bounds);
            }

            chartInstances[containerId] = map;

        } catch (e) {
            console.error("Error al renderizar mapa:", e);
        }
    }

    function initializePerfilChart(canvasId, perfilData, tipoProducto = '') {
        const chartCanvas = document.getElementById(canvasId);
        if (!chartCanvas || !perfilData) return;
        
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }

        let atributos = [];
        let labelColor = 'rgb(141, 110, 99)'; // Marrón Cacao
        let bgColor = 'rgba(141, 110, 99, 0.2)';
        
        const type = (tipoProducto || '').toLowerCase();

        // Lógica de selección de atributos
        if (type.includes('caf')) {
             // Atributos SCA para Café (claves que suelen usarse)
             // Intentamos detectar las claves comunes
             const commonCoffeeKeys = ['aroma', 'sabor', 'postgusto', 'acidez', 'cuerpo', 'balance', 'dulzor', 'limpieza', 'uniformidad', 'general'];
             
             // Filtramos cuáles existen en la data
             atributos = commonCoffeeKeys.filter(key => perfilData[key] !== undefined);
             
             // Si no encontramos las claves estándar, intentamos fallback dinámico
             if (atributos.length === 0) {
                 atributos = Object.keys(perfilData).filter(k => typeof perfilData[k] === 'number' && !['id', 'user_id'].includes(k));
             }

             labelColor = 'rgb(180, 83, 9)'; // Amber-700 para café
             bgColor = 'rgba(180, 83, 9, 0.2)';
        } else {
             // Cacao (Por defecto)
             atributos = ['cacao', 'acidez', 'amargor', 'astringencia', 'frutaFresca', 'frutaMarron', 'vegetal', 'floral', 'madera', 'especia', 'nuez', 'caramelo'];
             // Filtrar solo los que existen para evitar gráfico con ceros innecesarios si el perfil es simple
             const existingAttrs = atributos.filter(key => perfilData[key] !== undefined);
             if (existingAttrs.length > 0) atributos = existingAttrs;
        }
        
        if (atributos.length === 0) return; // No hay datos para graficar

        const labels = atributos.map(a => a.charAt(0).toUpperCase() + a.slice(1).replace(/([A-Z])/g, ' $1').trim());
        const dataValues = atributos.map(attr => perfilData[attr] || 0);

        chartInstances[canvasId] = new Chart(chartCanvas, {
            type: 'radar',
            data: { 
                labels: labels, 
                datasets: [{ 
                    label: 'Intensidad', 
                    data: dataValues, 
                    fill: true, 
                    backgroundColor: bgColor, 
                    borderColor: labelColor, 
                    pointBackgroundColor: labelColor,
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: labelColor
                }] 
            },
            options: { 
                scales: { 
                    r: { 
                        angleLines: { color: 'rgba(0,0,0,0.1)'},
                        grid: { color: 'rgba(0,0,0,0.1)'},
                        pointLabels: { 
                            font: { size: 11, family: "'Inter', sans-serif", weight: 'bold' }, 
                            color: '#57534e' 
                        },
                        suggestedMin: 0, 
                        suggestedMax: 10, 
                        ticks: { display: false, stepSize: 2 },
                    } 
                }, 
                plugins: { 
                    legend: { display: false } 
                },
                maintainAspectRatio: false
            } 
        });
    }

    // --- NUEVA FUNCIÓN ---
    function initializeRuedaChart(baseId, ruedaData) {
        const ctxL1 = document.getElementById(`${baseId}-l1`);
        if (!ctxL1 || !ruedaData || !ruedaData.notas_json) return;

        // Destruir instancias anteriores si existen
        if (chartInstances[baseId + '-l1']) chartInstances[baseId + '-l1'].destroy();

        const notes = ruedaData.notas_json;
        const FLAVOR_DATA = ruedaData.tipo === 'cafe' ? FLAVOR_WHEELS_DATA.cafe : FLAVOR_WHEELS_DATA.cacao;

        const selectedCategories = {};
        notes.forEach(note => {
            if (!selectedCategories[note.category]) {
                selectedCategories[note.category] = { color: FLAVOR_DATA[note.category].color, children: [] };
            }
            selectedCategories[note.category].children.push(note.subnote);
        });

        // --- Data para Anillo Interior (Padres/Categorías) ---
        const l1_labels = Object.keys(FLAVOR_DATA);
        const l1_data = l1_labels.map(cat => FLAVOR_DATA[cat].children.length);
        const l1_colors = l1_labels.map(label => selectedCategories[label] ? FLAVOR_DATA[label].color : '#E5E7EB');

        // --- Data para Anillo Exterior (Hijos/Notas) ---
        const l2_labels = Object.values(FLAVOR_DATA).flatMap(d => d.children.map(c => c.name));
        const l2_data = Array(l2_labels.length).fill(1);
        const l2_colors = Object.values(FLAVOR_DATA).flatMap(d => {
            return d.children.map(child => {
                const isSelected = notes.some(n => n.category === Object.keys(FLAVOR_DATA).find(k => FLAVOR_DATA[k] === d) && n.subnote === child.name);
                return isSelected ? d.color : '#E5E7EB';
            });
        });

        new Chart(ctxL1, {
            type: 'doughnut',
            data: {
                labels: l2_labels, 
                datasets: [
                    // ANILLO EXTERIOR (Dataset 0)
                    {
                        data: l2_data,
                        backgroundColor: l2_colors,
                        borderColor: '#ffffff',
                        borderWidth: 1,
                        weight: 1.2 // Más grueso
                    },
                    // ANILLO INTERIOR (Dataset 1)
                    {
                        data: l1_data,
                        backgroundColor: l1_colors,
                        borderColor: '#ffffff',
                        borderWidth: 1,
                        weight: 0.8 
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '25%', // Agujero central
                layout: {
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const idx = context.dataIndex;
                                if(context.datasetIndex === 0) return l2_labels[idx];
                                return l1_labels[idx];
                            }
                        }
                    },
                    // CONFIGURACIÓN DATALABELS
                    datalabels: {
                        color: '#444444', // Gris oscuro para mejor contraste
                        font: function(context) {
                            var width = context.chart.width;
                            var size = Math.round(width / 45); // Tamaño dinámico basado en el ancho
                            // Límites para el tamaño de fuente
                            if (size > 14) size = 14;
                            if (size < 8) size = 8;
                            
                            return {
                                size: size,
                                family: 'Arial',
                                weight: 'bold'
                            };
                        },
                        formatter: function(value, context) {
                            if (context.datasetIndex === 0) {
                                const resultado = notes.find(item => {
                                    return item.subnote.toLowerCase().includes(l2_labels[context.dataIndex].toLowerCase());
                                });
                                return resultado ? l2_labels[context.dataIndex] : "";
                            } else {
                                return selectedCategories[l1_labels[context.dataIndex]] ? l1_labels[context.dataIndex] : "";
                            }
                        },
                        anchor: 'center',
                        align: 'center',
                        // Rotación del texto INTELIGENTE (Horizontal o Radial)
                        rotation: function(ctx) {
                            const valuesBefore = ctx.dataset.data.slice(0, ctx.dataIndex).reduce((a, b) => a + b, 0);
                            const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const currentVal = ctx.dataset.data[ctx.dataIndex];
                            
                            // 1. Calcular el ancho angular de la sección en grados
                            const spanAngle = (currentVal / sum) * 360;

                            // 2. Si el espacio es amplio (> 40 grados), mantener texto horizontal (0°)
                            // Esto evita que textos en secciones grandes queden inclinados innecesariamente
                            if (spanAngle > 40) {
                                return 0;
                            }

                            // 3. Si el espacio es estrecho, usar alineación RADIAL (desde el centro hacia afuera)
                            const angle = Math.PI * 2 * (valuesBefore + currentVal / 2) / sum - Math.PI / 2;
                            var degree = angle * 180 / Math.PI;
                            
                            let normalizedDegree = degree;
                            if (normalizedDegree < 0) normalizedDegree += 360;

                            let rotation = degree;

                            // Si está en el lado izquierdo (90 a 270 grados), girar 180 para que el texto no quede "cabeza abajo"
                            if (normalizedDegree > 90 && normalizedDegree < 270) {
                                rotation += 180;
                            }
                            
                            return rotation;
                        },
                        textStrokeColor: 'rgba(255,255,255,0.8)',
                        textStrokeWidth: 2
                    }
                }
            }
        });
        
        renderCustomLegend(selectedCategories, FLAVOR_DATA);
    }

    function renderCustomLegend(selectedCategories, FLAVOR_DATA) {
        const legendContainer = document.getElementById('rueda-chart-legend');
        if (!legendContainer) return;
        
        if (Object.keys(selectedCategories).length === 0) {
            legendContainer.innerHTML = `<p class="text-stone-500 text-center">Ninguna nota de sabor seleccionada.</p>`;
            return;
        }

        const legendHtml = Object.entries(selectedCategories).map(([category, data]) => `
            <div class="mb-3">
                <h4 class="font-semibold text-sm flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full" style="background-color: ${data.color}"></span>
                    <i class="fas ${FLAVOR_DATA[category].icon} w-4"></i>
                    ${category}
                </h4>
                <ul class="list-disc list-inside text-stone-600 pl-5 text-sm mt-1 space-y-1">
                    ${data.children.map(note => {
                        const noteIcon = FLAVOR_DATA[category].children.find(c => c.name === note)?.icon || 'fa-circle-dot';
                        return `<li><i class="fas ${noteIcon} w-4 text-stone-500 mr-1"></i>${note}</li>`;
                    }).join('')}
                </ul>
            </div>
        `).join('');
        
        legendContainer.innerHTML = `<div class="grid grid-cols-2 gap-x-4">${legendHtml}</div>`;
    }

    function openLocationModal(locationName) {
        const { fincaData, procesadorasData } = globalHistory;
        
        const cleanName = locationName.replace('Finca: ', '').replace('Procesadora: ', '');

        let contentHtml = '';

        // Intenta encontrar como Finca
        if (fincaData && fincaData.nombre_finca === cleanName) {
            let galleryHtml = (fincaData.imagenes_json || []).map(img => `<img src="${img}" class="w-full h-32 object-cover rounded-lg">`).join('');
            let certsHtml = (fincaData.certificaciones_json || []).map(cert => `<div class="flex items-center gap-2"><img src="${cert.logo_url}" class="h-6 w-6 rounded-full"><span class="text-sm">${cert.nombre}</span></div>`).join('');
            let premiosHtml = (fincaData.premios_json || []).map(p => `<div class="flex items-center gap-2"><img src="${p.logo_url}" class="h-6 w-6 rounded-full"><span class="text-sm">${p.nombre} (${p.ano})</span></div>`).join('');
            
            contentHtml = `
                <h2 class="text-3xl font-display text-amber-900 mb-4">${fincaData.nombre_finca}</h2>
                <div class="space-y-6">
                    <p><strong>Productor:</strong> ${fincaData.propietario}</p>
                    <p class="text-sm">${fincaData.historia}</p>
                    ${certsHtml ? `<div><h4 class="font-bold mb-2">Certificaciones</h4><div class="flex flex-wrap gap-4">${certsHtml}</div></div>` : ''}
                    ${premiosHtml ? `<div><h4 class="font-bold mb-2">Premios</h4><div class="flex flex-wrap gap-4">${premiosHtml}</div></div>` : ''}
                    ${galleryHtml ? `<div><h4 class="font-bold mb-2">Galería</h4><div class="grid grid-cols-3 gap-2">${galleryHtml}</div></div>` : ''}
                    ${fincaData.coordenadas ? `<div><h4 class="font-bold mb-2">Mapa</h4><div id="location-map-modal" class="w-full h-64 rounded-lg"></div></div>` : ''}
                </div>
            `;
            locationModalContent.innerHTML = contentHtml;
            locationModal.classList.remove('hidden');
            if (fincaData.coordenadas) {
                setTimeout(() => initializeMap('location-map-modal', fincaData.coordenadas), 100);
            }
            return; // Termina la función si se encontró la finca
        }

        // Si no es la finca principal, busca en las procesadoras
        const procesadora = procesadorasData?.find(p => p.nombre_comercial === cleanName || p.razon_social === cleanName);
        if (procesadora) {
            let galleryHtml = (procesadora.imagenes_json || []).map(img => `<img src="${img}" class="w-full h-32 object-cover rounded-lg">`).join('');
            let certsHtml = (procesadora.certificaciones_json || []).map(cert => `<div class="flex items-center gap-2 p-2 rounded-md bg-stone-100"><img src="${cert.logo_url}" class="h-6 w-6 rounded-full"><span class="text-sm text-stone-600">${cert.nombre}</span></div>`).join('');
            let premiosHtml = (procesadora.premios_json || []).map(p => `<div class="flex items-center gap-2 p-2 rounded-md bg-stone-100"><img src="${p.logo_url}" class="h-6 w-6 rounded-full"><span class="text-sm text-stone-600">${p.nombre} (${p.ano})</span></div>`).join('');
            contentHtml = `
                <h2 class="text-3xl font-display text-amber-900 mb-4">${procesadora.nombre_comercial || procesadora.razon_social}</h2>
                <div class="space-y-4 text-sm">
                    <p><strong>Ubicación:</strong> ${procesadora.ciudad}, ${procesadora.pais}</p>
                    <p><strong>Dirección:</strong> ${procesadora.direccion}</p>
                    ${certsHtml ? `<div><h4 class="font-bold mt-4 mb-2">Certificaciones</h4><div class="flex flex-wrap gap-4">${certsHtml}</div></div>` : ''}
                    ${premiosHtml ? `<div><h4 class="font-bold mt-4 mb-2">Premios</h4><div class="flex flex-wrap gap-4">${premiosHtml}</div></div>` : ''}
                    ${galleryHtml ? `<div><h4 class="font-bold mb-2">Galería</h4><div class="grid grid-cols-3 gap-2">${galleryHtml}</div></div>` : ''}
                    ${procesadora.coordenadas ? `<div><h4 class="font-bold mb-2">Mapa</h4><div id="location-map-modal" class="w-full h-64 rounded-lg"></div></div>` : ''}
                </div>`;
            locationModalContent.innerHTML = contentHtml;
            locationModal.classList.remove('hidden');
            if (procesadora.coordenadas) {
                setTimeout(() => initializeMap('location-map-modal', procesadora.coordenadas), 100);
            }
            return; // Termina la función si se encontró la procesadora
        }

        // Si no se encontró ni finca ni procesadora, muestra mensaje genérico
        locationModalContent.innerHTML = `
            <h2 class="text-3xl font-display text-amber-900 mb-4">${locationName}</h2>
            <p>Información detallada para esta ubicación no está disponible.</p>`;
        locationModal.classList.remove('hidden');
    }

    function getRoutePoints(h) {
        if (!h.stages) return [];

        const points = [];
        const addedLocations = new Set();
        
        const getFieldValue = (field) => (typeof field === 'object' && field !== null) ? field.value : field;

        h.stages.forEach(stage => {
            const locationName = getFieldValue(stage.data.lugarProceso) || getFieldValue(stage.data.finca)  || getFieldValue(stage.data.procesadora);
            
            if (locationName && !addedLocations.has(locationName)) {
                let locationData = null;
                
                if (h.fincaData && h.fincaData.nombre_finca === locationName) {
                    locationData = h.fincaData;
                } else if (h.procesadorasData) {
                    locationData = h.procesadorasData.find(p => p.nombre_comercial === locationName || p.razon_social === locationName);
                }
                
                if (locationData && locationData.coordenadas) {
                    let pointLatLng;
                    // Si es un polígono (array de arrays), calcular el centroide
                    if (Array.isArray(locationData.coordenadas) && Array.isArray(locationData.coordenadas[0])) {
                        let lat = 0, lng = 0;
                        locationData.coordenadas.forEach(p => { lat += p[0]; lng += p[1]; });
                        pointLatLng = [lat / locationData.coordenadas.length, lng / locationData.coordenadas.length];
                    } 
                    // Si es un punto (objeto con lat/lng)
                    else if (typeof locationData.coordenadas.lat === 'number' && typeof locationData.coordenadas.lng === 'number') {
                        pointLatLng = [locationData.coordenadas.lat, locationData.coordenadas.lng];
                    }

                    if (pointLatLng) {
                        points.push({
                            latlng: pointLatLng,
                            name: locationName,
                            stageName: stage.nombre_etapa,
                            date: formatDate(getFieldValue(stage.data.fecha) || getFieldValue(stage.data.fechaCosecha) || getFieldValue(stage.data.fechaInicio))
                        });
                        addedLocations.add(locationName);
                    }
                }
            }
        });
        return points;
    }

    // --- GOOGLE MAPS: Mapa de Ruta (Línea de Tiempo) ---
    function initializeRouteMap(containerId, routePoints) {
        const mapContainer = document.getElementById(containerId);
        if (!mapContainer || typeof google === 'undefined' || !routePoints) return;

        const pointsArray = Array.isArray(routePoints) ? routePoints : [routePoints];
        if (pointsArray.length === 0) return;

        // Convertir puntos a LatLng de Google
        // routePoints viene como [{ latlng: [lat, lng], name, ... }]
        const coordinates = pointsArray.map(p => ({ lat: p.latlng[0], lng: p.latlng[1] }));

        // Si ya existe, redimensionar
        if (chartInstances[containerId]) {
            const map = chartInstances[containerId];
            google.maps.event.trigger(map, 'resize');
            
            const bounds = new google.maps.LatLngBounds();
            coordinates.forEach(c => bounds.extend(c));
            
            if (coordinates.length > 1) map.fitBounds(bounds);
            else map.setCenter(coordinates[0]);
            
            return;
        }

        try {
            const map = new google.maps.Map(mapContainer, {
                zoom: 13,
                center: coordinates[0],
                mapTypeId: 'roadmap',
                streetViewControl: false
            });

            const bounds = new google.maps.LatLngBounds();

            // Marcadores
            pointsArray.forEach(point => {
                const pos = { lat: point.latlng[0], lng: point.latlng[1] };
                bounds.extend(pos);
                
                const marker = new google.maps.Marker({
                    position: pos,
                    map: map,
                    label: {
                        text: (Array.isArray(pointsArray) ? (pointsArray.indexOf(point) + 1).toString() : "1"),
                        color: "white",
                        fontWeight: "bold"
                    },
                    title: `${point.stageName} - ${point.name}`
                });

                // InfoWindow para detalles
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div class="p-2">
                            <h3 class="font-bold text-amber-900">${point.stageName}</h3>
                            <p class="text-sm">${point.name}</p>
                            <p class="text-xs text-stone-500">${point.date}</p>
                        </div>
                    `
                });

                marker.addListener("click", () => {
                    infoWindow.open(map, marker);
                });
            });

            if (coordinates.length > 1) {
                map.fitBounds(bounds);
                animateRoute(coordinates, map);
            } else {
                map.setCenter(coordinates[0]);
                map.setZoom(14);
            }

            chartInstances[containerId] = map;

        } catch(e) { console.error("Error al renderizar mapa de ruta:", e); }
    }
    
    // --- GOOGLE MAPS: Animación de Ruta ---
    function animateRoute(coordinates, map) {
        // Línea base (ruta estática)
        const lineSymbol = {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            strokeColor: '#3B82F6', // Blue-500
            fillColor: '#3B82F6',
            fillOpacity: 1
        };

        const polyline = new google.maps.Polyline({
            path: coordinates,
            geodesic: true,
            strokeColor: '#9CA3AF', // Gray line
            strokeOpacity: 0.6,
            strokeWeight: 4,
            map: map
        });

        // Marcador animado (simulando movimiento)
        // En Google Maps V3, la animación compleja sobre Polyline requiere librerías externas o 
        // manipulación de iconos. Una forma sencilla nativa es usar un 'Icon' que se mueve.
        
        // Versión simplificada: Dibujar una línea 'progresiva' o mover un marcador
        // Aquí usaremos un marcador que se mueve
        
        const animatedMarker = new google.maps.Marker({
            position: coordinates[0],
            map: map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 5,
                fillColor: "#F59E0B", // Amber
                fillOpacity: 1,
                strokeColor: "white",
                strokeWeight: 2,
            },
            zIndex: 100
        });

        let step = 0;
        let numSteps = 100; // Pasos entre puntos
        let index = 0;

        function animate() {
            if (index >= coordinates.length - 1) return; // Fin

            const start = coordinates[index];
            const end = coordinates[index + 1];

            step++;
            const progress = step / numSteps;
            
            const lat = start.lat + (end.lat - start.lat) * progress;
            const lng = start.lng + (end.lng - start.lng) * progress;
            
            animatedMarker.setPosition({ lat, lng });

            if (step >= numSteps) {
                step = 0;
                index++;
            }
            
            requestAnimationFrame(animate);
        }

        animate();
    }

    function renderReviewsSection(reviews) {
        const totalReviews = reviews.length;
        const avgRating = totalReviews > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) : 0;
        
        let existingReviewsHtml = '';
        if (totalReviews > 0) {
            existingReviewsHtml = reviews.map(review => {
                const stars = Array(5).fill(0).map((_, i) => 
                    i < review.rating ? '<i class="fas fa-star text-amber-500"></i>' : '<i class="fas fa-star text-stone-300"></i>'
                ).join('');
                const reviewerName = review.user_email.split('@')[0];
                return `
                    <div class="bg-white p-4 rounded-lg shadow-sm border">
                        <div class="flex justify-between items-center mb-2">
                            <span class="font-semibold text-sm">${reviewerName}</span>
                            <span class="text-xs text-stone-500">${new Date(review.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="flex gap-1">${stars}</div>
                        ${review.comment ? `<p class="text-stone-600 mt-2 text-sm italic">"${review.comment}"</p>` : ''}
                    </div>
                `;
            }).join('');
        } else {
            existingReviewsHtml = '<p class="text-sm text-stone-500 text-center">Aún no hay reseñas para este producto. ¡Sé el primero!</p>';
        }

        reviewsContainer.innerHTML = `
            <section class="max-w-3xl mx-auto my-16">
                <h2 class="text-3xl md:text-4xl font-display text-amber-900 mb-8 text-center">Reseñas del Producto</h2>
                
                <div class="bg-white p-6 rounded-lg shadow-md mb-8">
                    <h3 class="text-xl font-bold font-display text-amber-900">Deja tu Opinión</h3>
                    <p class="text-stone-600 text-sm mb-4">Valora este producto para ayudar a otros consumidores y al productor.</p>
                    
                    <div id="review-form-container">
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-stone-700 mb-2">Tu Valoración (1-5 estrellas)</label>
                            <div id="star-rating" class="star-rating text-3xl text-stone-300">
                                <i class="fas fa-star" data-value="1"></i>
                                <i class="fas fa-star" data-value="2"></i>
                                <i class="fas fa-star" data-value="3"></i>
                                <i class="fas fa-star" data-value="4"></i>
                                <i class="fas fa-star" data-value="5"></i>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <label for="review-comment" class="block text-sm font-medium text-stone-700 mb-2">Comentario (Opcional)</label>
                            <textarea id="review-comment" rows="3" class="w-full p-3 border border-stone-300 rounded-xl" placeholder="¿Qué te pareció este producto?"></textarea>
                        </div>

                        <!-- 2. Contenedor vacío donde renderizaremos el botón -->
                        <div id="google-signin-button-container" class="flex justify-center"></div>

                        <p id="review-error" class="text-red-600 text-sm mt-2 hidden"></p>
                    </div>
                    <div id="review-thanks" class="text-center p-8 hidden">
                        <h3 class="text-2xl font-display text-green-700">¡Gracias por tu reseña!</h3>
                        <p class="text-stone-600">Tu opinión ha sido registrada.</p>
                    </div>
                </div>

                <div class="space-y-4">
                    <h3 class="text-xl font-bold font-display text-amber-900">Opiniones de la Comunidad (${totalReviews})</h3>
                    ${existingReviewsHtml}
                </div>
            </section>
        `;

        // 3. Renderizar el botón de Google explícitamente
        try {
            if (typeof google !== 'undefined' && google.accounts) {

                // 1. Inicializar el cliente de Google con la configuración.
                google.accounts.id.initialize({
                    // IMPORTANTE: Asegúrate de que tu Client ID esté aquí
                    client_id: "1064687511845-vjel6sbn1cg4nbmgf2228s0u821gvua4.apps.googleusercontent.com",
                    callback: handleCredentialResponse,
                    context: "use"
                });

                google.accounts.id.renderButton(
                    document.getElementById('google-signin-button-container'),
                    {
                        theme: "outline",
                        size: "large",
                        type: "standard",
                        shape: "rectangular",
                        text: "continue_with",
                        logo_alignment: "left"
                    }
                );
            } else {
                console.error("La biblioteca de Google Sign-In no se ha cargado.");
            }
        } catch (e) {
            console.error("Error al renderizar el botón de Google:", e);
        }

        setupStarRating();
    }

    function setupStarRating() {
        const stars = document.querySelectorAll('#star-rating i');
        const ratingContainer = document.getElementById('star-rating');
        
        if (!ratingContainer) return;

        const setRating = (value) => {
            currentRating = value;
            stars.forEach(star => {
                if (star.dataset.value <= value) {
                    star.classList.add('selected');
                } else {
                    star.classList.remove('selected');
                }
            });
        };

        ratingContainer.addEventListener('click', e => {
            if (e.target.classList.contains('fa-star')) {
                setRating(parseInt(e.target.dataset.value));
            }
        });

        ratingContainer.addEventListener('mouseover', e => {
            if (e.target.classList.contains('fa-star')) {
                const hoverValue = parseInt(e.target.dataset.value);
                stars.forEach(star => {
                    star.classList.toggle('selected', star.dataset.value <= hoverValue);
                });
            }
        });

        ratingContainer.addEventListener('mouseout', () => {
            setRating(currentRating); // Volver a la selección actual
        });
    }

    function findValueInStages(stages, keySearch) {
        if (!stages) return null;
        // Buscar de atrás hacia adelante (dato más reciente)
        for (let i = stages.length - 1; i >= 0; i--) {
            const data = stages[i].data;
            if (data) {
                // Búsqueda directa
                if (data[keySearch]) return typeof data[keySearch] === 'object' ? data[keySearch].value : data[keySearch];
                // Búsqueda aproximada en claves
                const key = Object.keys(data).find(k => k.toLowerCase().includes(keySearch.toLowerCase()));
                if (key) return typeof data[key] === 'object' ? data[key].value : data[key];
            }
        }
        return null;
    }

    // --- NUEVO HELPER: Normalizar Nivel de Tueste (Agtron a Texto) ---
    function normalizeRoastLevel(val) {
        if (!val) return null;
        // Si es número (Agtron)
        const num = parseFloat(val);
        if (!isNaN(num)) {
            if (num > 85) return "Claro";
            if (num >= 70) return "Medio";
            if (num >= 55) return "Medio-Oscuro";
            return "Oscuro";
        }
        // Si es texto, intentar normalizar
        const s = val.toLowerCase();
        if (s.includes("claro") || s.includes("light")) return "Claro";
        if (s.includes("medio-oscuro") || s.includes("medium-dark")) return "Medio-Oscuro";
        if (s.includes("medio") || s.includes("medium")) return "Medio";
        if (s.includes("oscuro") || s.includes("dark")) return "Oscuro";
        return val; // Retornar original si no coincide
    }

    // --- NUEVO HELPER: Generar HTML Slider ---
    function createSegmentedSlider(label, options, currentValue) {
        if (!currentValue) return '';
        
        const segments = options.map(opt => {
            const isActive = opt.toLowerCase() === currentValue.toLowerCase();
            const bgClass = isActive ? 'bg-amber-800 text-white shadow-sm' : 'bg-stone-100 text-stone-400';
            const borderClass = isActive ? 'border-amber-800' : 'border-stone-200';
            
            return `
                <div class="flex-1 text-center py-2 px-2 border-r last:border-r-0 ${borderClass} ${bgClass} first:rounded-l-lg last:rounded-r-lg text-[10px] sm:text-xs font-bold transition-all uppercase tracking-wider whitespace-nowrap min-w-[80px] flex items-center justify-center">
                    ${opt}
                </div>
            `;
        }).join('');

        return `
            <div class="mb-5">
                <div class="flex justify-between items-end mb-2">
                    <span class="text-xs font-bold text-stone-500 uppercase tracking-widest">${label}</span>
                    <span class="text-xs font-bold text-amber-900">${currentValue}</span>
                </div>
                <div class="flex w-full border border-stone-200 rounded-lg overflow-hidden">
                    ${segments}
                </div>
            </div>
        `;
    }

    // --- CALLBACK GLOBAL PARA GOOGLE SIGN-IN ---
    window.handleCredentialResponse = async function(response) {
        const loteId = globalHistory.stages[globalHistory.stages.length - 1].data.id;
        const comment = document.getElementById('review-comment').value;
        const errorEl = document.getElementById('review-error');

        if (currentRating === 0) {
            errorEl.textContent = 'Por favor, selecciona de 1 a 5 estrellas.';
            errorEl.classList.remove('hidden');
            return;
        }
        errorEl.classList.add('hidden');

        try {
            const res = await fetch('/api/reviews/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idToken: response.credential,
                    lote_id: loteId,
                    rating: currentRating,
                    comment: comment
                })
            });

            if (res.ok) {
                document.getElementById('review-form-container').classList.add('hidden');
                document.getElementById('review-thanks').classList.remove('hidden');
                // Recargar las reseñas para mostrar la nueva
                const reviews = await fetch(`/api/reviews/${loteId}`).then(res => res.json());
                renderReviewsSection(reviews);
            } else {
                const error = await res.json();
                errorEl.textContent = error.error;
                errorEl.classList.remove('hidden');
            }
        } catch (err) {
            errorEl.textContent = 'Error de red. Por favor, inténtalo de nuevo.';
            errorEl.classList.remove('hidden');
        }
    }

    document.body.addEventListener('click', e => {
        if(e.target.id === 'open-finca-modal-btn') {
            openFincaModal();
        }
        const shareButton = e.target.closest('.share-btn');
        if (shareButton) {
            const loteId = shareButton.dataset.loteId;
            const pageUrl = `${window.location.origin}/${loteId}`;
            const shareText = `¡Descubre el ADN de mi producto! Lote: ${loteId}`;
            let shareUrl;
            if (shareButton.title.includes('Facebook')) shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
            else if (shareButton.title.includes('X')) shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(shareText)}`;
            else if (shareButton.title.includes('WhatsApp')) shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + pageUrl)}`;
            if(shareUrl) window.open(shareUrl, '_blank', 'width=600,height=400');
            else if (shareButton.title.includes('Copiar')) {
                navigator.clipboard.writeText(pageUrl).then(() => {
                    const originalIcon = shareButton.innerHTML;
                    shareButton.innerHTML = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
                    shareButton.title = "¡Copiado!";
                    setTimeout(() => { shareButton.innerHTML = originalIcon; shareButton.title = "Copiar Enlace"; }, 2000);
                }).catch(err => console.error('Error al copiar:', err));
            }
        }
    });

    function showMessageModal(text) {
        messageText.textContent = text;
        messageModal.classList.remove('hidden');
    }
    function hideMessageModal() {
        messageModal.classList.add('hidden');
    }
    closeMessageModalBtn.addEventListener('click', hideMessageModal);
    messageModal.addEventListener('click', (e) => { if(e.target === messageModal) hideMessageModal(); });
    closeImageModalBtn.addEventListener('click', () => imageModal.style.display = 'none');
    imageModal.addEventListener('click', (e) => { if(e.target === imageModal) imageModal.style.display = 'none'; });

    // Listener para el nuevo modal de ubicación
    if(closeLocationModalBtn) closeLocationModalBtn.addEventListener('click', () => locationModal.classList.add('hidden'));
    if(locationModal) locationModal.addEventListener('click', (e) => { if(e.target === locationModal) locationModal.classList.add('hidden'); });

    // Delegación de eventos en el contenedor principal
    storyContainer.addEventListener('click', e => {
        const locationBtn = e.target.closest('.location-btn');
        if (locationBtn) {
            openLocationModal(locationBtn.dataset.location);
        }
    });

    buscarBtn.addEventListener('click', handleSearch);
    loteIdInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleSearch(); });
    
    const params = new URLSearchParams(window.location.search);
    let loteIdFromUrl = params.get('lote');
    if (!loteIdFromUrl) {
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        const potentialId = pathSegments.find(s => /^[A-Z]{3}-[A-Z0-9]{8}$/.test(s.toUpperCase()));
        if (potentialId) loteIdFromUrl = potentialId;
    }
    if (loteIdFromUrl) {
        loteIdInput.value = loteIdFromUrl;
        handleSearch();
    }
});

