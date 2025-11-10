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

    // --- Estado Global ---
    let globalHistory = {};
    let chartInstances = {};
    let currentRating = 0;

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
            const [history, reviews] = await Promise.all([
                fetch(`/api/trazabilidad/${loteId}`).then(res => res.ok ? res.json() : Promise.reject(res)),
                fetch(`/api/reviews/${loteId}`).then(res => res.ok ? res.json() : Promise.reject(res))
            ]);

            globalHistory = history;
            renderStory(history, reviews); // Pasar reseñas al renderizador
            hideMessageModal();
        } catch (error) {
            storyContainer.innerHTML = '';
            highlightsContainer.innerHTML = '';
            reviewsContainer.innerHTML = '';
            messageText.textContent = 'Lote no encontrado. Verifica el código e inténtalo de nuevo.';
        }
    }

    function renderStory(h, reviews) {

        let finalHTML = renderLogoCompany(h.ownerInfo);
        finalHTML += createMainContent(h);
        finalHTML += createTimelineSection(h);
        finalHTML += createAdditionalInfoSection(h);
        finalHTML += createShareSection(h);

        storyContainer.innerHTML = finalHTML;

        // Renderizar el encabezado personalizado
        //renderLogoCompany(h.ownerInfo);

        const routePoints = getRoutePoints(h);
        const highlights = calculateHighlights(h);

        // Post-renderizado de componentes visuales y eventos
        renderHighlightsSection(highlights);
        renderReviewsSection(reviews);

        setupTabs(routePoints.length >= 1);
        setupGallery();
        setupIntersectionObserver();
        if (h.fincaData?.coordenadas) {
            initializeMap('finca-map-container', h.fincaData.coordenadas);
        }
        if (h.perfilSensorialData) {
            renderFlavorProfile(h.perfilSensorialData);
            initializePerfilChart('sensory-profile-chart', h.perfilSensorialData);
        }
    }

    function calculateHighlights(h) {
        const getFieldValue = (field) => (typeof field === 'object' && field !== null) ? field.value : field;
        const locations = new Set();
        let totalWorkers = 0;

        // 1. Recolectar todas las ubicaciones únicas del proceso
        if (h.fincaData) {
            locations.add(h.fincaData.nombre_finca);
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

        return { totalWorkers };
    }

    function renderHighlightsSection(highlights) {
        if (highlights.totalWorkers <= 0) {
            highlightsContainer.innerHTML = '';
            return;
        }

        highlightsContainer.innerHTML = `
            <div class="container mx-auto px-4 md:px-8 -mt-8 mb-16 relative z-10">
                <div class="max-w-xs mx-auto">
                    <div class="bg-white p-6 rounded-lg shadow-md text-center">
                        <i class="fas fa-users text-3xl text-amber-800 mb-2"></i>
                        <p class="text-4xl font-bold font-display text-amber-900">${highlights.totalWorkers}</p>
                        <p class="text-sm text-stone-500">Personas Beneficiadas en el Proceso</p>
                    </div>
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
                        <button class="tab-button active flex-1 flex items-center justify-center gap-2 p-4 border-b-2" data-tab="terroir"><i class="fas fa-globe"></i> Terroir</button>
                        <button class="tab-button flex-1 flex items-center justify-center gap-2 p-4 border-b-2 border-transparent" data-tab="productor"><i class="fas fa-leaf"></i> Productor</button>
                        ${perfilSensorialData ? `<button class="tab-button flex-1 flex items-center justify-center gap-2 p-4 border-b-2 border-transparent" data-tab="perfil"><i class="fas fa-chart-pie"></i> Perfil</button>` : ''}
                        ${routePoints.length >= 1 ? `<button class="tab-button flex-1 flex items-center justify-center gap-2 p-4 border-b-2 border-transparent" data-tab="ruta"><i class="fas fa-route"></i> Ruta</button>` : ''}
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow-md">
                        <div id="tab-terroir" class="tab-panel space-y-4">
                            <div><strong>País:</strong> ${fincaData?.pais || 'N/A'}</div>
                            <div><strong>Ciudad:</strong> ${fincaData?.ciudad || 'N/A'}</div>
                            <div><strong>Altura:</strong> ${fincaData?.altura || 'N/A'} msnm</div>
                            <div><strong>Variedad de Cacao:</strong> ${getFieldValue(firstStage.variedad) || 'N/A'}</div>
                            <div id="finca-map-container" class="w-full h-48 rounded-md border mt-4"></div>
                        </div>
                        <div id="tab-productor" class="tab-panel hidden space-y-4">
                            <div><strong>Nombre Finca:</strong> ${fincaData?.nombre_finca || 'N/A'}</div>
                            <div><strong>Productor:</strong> ${fincaData?.propietario || 'N/A'}</div>
                            ${certsHtml ? `<div><strong class="block mb-2">Certificaciones:</strong><div class="flex flex-wrap gap-2">${certsHtml}</div></div>` : ''}
                            ${premiosHtml ? `<div><strong class="block mb-2">Premios:</strong><div class="flex flex-wrap gap-2">${premiosHtml}</div></div>` : ''}
                            <div id="finca-gallery" class="grid grid-cols-3 gap-2 mt-4"></div>
                        </div>
                        ${perfilSensorialData ? `
                        <div id="tab-perfil" class="tab-panel hidden space-y-6">
                            <div>
                                <h4 class="font-bold text-lg mb-2 text-center">Perfil Sensorial del Cacao</h4>
                                <div class="w-full max-w-sm mx-auto"><canvas id="sensory-profile-chart"></canvas></div>
                            </div>
                        </div>
                        ` : ''}
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
        const { maridajesRecomendados } = h;
        let maridajesHtml = '<p>No se encontraron recomendaciones automáticas.</p>';

        if (maridajesRecomendados && Object.keys(maridajesRecomendados).length > 0) {
            const renderMaridajeGroup = (recs, type) => {
                const excepcionales = recs.filter(r => r.puntuacion >= 90);
                const recomendados = recs.filter(r => r.puntuacion >= 75 && r.puntuacion < 90);
                
                let groupHtml = '';
                if (excepcionales.length > 0) {
                    groupHtml += `<div class="mb-4">
                                    <h5 class="font-semibold text-stone-600 mb-2">Sinergia Excepcional (Maridaje "Mágico")</h5>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${excepcionales.map(createMaridajeCard).join('')}</div>
                                 </div>`;
                }
                if (recomendados.length > 0) {
                    groupHtml += `<div>
                                    <h5 class="font-semibold text-stone-600 mb-2">Muy Buen Maridaje (Recomendado)</h5>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${recomendados.map(createMaridajeCard).join('')}</div>
                                 </div>`;
                }
                return groupHtml;
            };

            maridajesHtml = Object.entries(maridajesRecomendados).map(([type, recs]) => {
                if (!recs || recs.length === 0) return '';
                const title = type.charAt(0).toUpperCase() + type.slice(1);
                const colorClass = type === 'cafe' ? 'text-green-800' : (type === 'vino' ? 'text-red-800' : 'text-blue-800');
                const icon = type === 'cafe' ? '☕' : (type === 'vino' ? '🍷' : '🧀');

                const groupContent = renderMaridajeGroup(recs, type);
                if(!groupContent) return '';

                return `<div class="mb-6">
                            <h4 class="text-lg font-bold ${colorClass}">Con ${title} ${icon}</h4>
                            ${groupContent}
                        </div>`;
            }).join('');
        }

        return `
            <section class="additional-info max-w-3xl mx-auto my-16">
                <details class="bg-white rounded-lg shadow-md mb-4">
                    <summary class="font-bold font-display text-lg p-4 cursor-pointer">Maridajes Sugeridos</summary>
                    <div class="p-4 border-t space-y-4">${maridajesHtml}</div>
                </details>
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
        const stageName = stage.nombre_etapa;
        const data = stage.data;
        
        const details = getChapterDetails(stageName, data);
        
        const getFieldValue = (field) => (typeof field === 'object' && field !== null) ? field.value : field;
        const isFieldVisible = (field) => (typeof field === 'object' && field !== null) ? field.visible : true;

        const dataPointsHtml = Object.entries(data)
            .filter(([key, fieldData]) => isFieldVisible(fieldData) && !['id', 'imageUrl', 'finca', 'lugarProceso'].includes(key) && !key.toLowerCase().includes('fecha'))
            .map(([key, fieldData]) => `<li><strong>${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong> ${getFieldValue(fieldData) || 'N/A'}</li>`)
            .join('');
            
        const imageUrl = getFieldValue(data.imageUrl);
        const isImageVisible = isFieldVisible(data.imageUrl);
        const locationName = getFieldValue(data.lugarProceso) || getFieldValue(data.finca) || getFieldValue(data.procesadora) || 'N/A';

        const locationButton = `<button class="location-btn text-sky-700 hover:underline" data-location="${locationName}">${locationName}</button>`;

        return `
            <div class="timeline-item animate">
                <div class="bg-white p-6 rounded-lg shadow-lg">
                    <div class="flex items-center gap-3 mb-2">
                         <i class="fas ${details.icon} text-amber-800 text-2xl w-8 text-center"></i>
                         <h3 class="font-bold text-amber-900 font-display text-xl">${details.title}</h3>
                    </div>
                    <p class="text-sm text-stone-500 mb-3 italic">${stage.descripcion || ''}</p>
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
                const img = e.target.closest('img');
                if (img) {
                    modalImage.src = img.src;
                    imageModal.style.display = 'flex';
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

    function createSensoryProfileSection(h) {
        const { perfilSensorialData, stages, maridajesRecomendados } = h;
        if (!stages || stages.length === 0) return '';
        
        const tostado = stages.find(s => s.nombre_etapa.toLowerCase().includes('tostado'))?.data;
        const loteId = stages[stages.length - 1].data.id;
    
        let maridajeHtml = '';
        if (maridajesRecomendados && Object.keys(maridajesRecomendados).length > 0) {
            
            const renderMaridajeGroup = (recs, type) => {
                const excepcionales = recs.filter(r => r.puntuacion >= 90);
                const recomendados = recs.filter(r => r.puntuacion >= 75 && r.puntuacion < 90);
                
                let groupHtml = '';
                if (excepcionales.length > 0) {
                    groupHtml += `<div class="mb-4">
                                    <h5 class="font-semibold text-stone-600 mb-2">Sinergia Excepcional (Maridaje "Mágico")</h5>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${excepcionales.map(rec => createMaridajeCard(rec)).join('')}</div>
                                 </div>`;
                }
                if (recomendados.length > 0) {
                    groupHtml += `<div>
                                    <h5 class="font-semibold text-stone-600 mb-2">Muy Buen Maridaje (Recomendado)</h5>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${recomendados.map(rec => createMaridajeCard(rec)).join('')}</div>
                                 </div>`;
                }
                return groupHtml;
            };

            const allRecsHtml = Object.entries(maridajesRecomendados).map(([type, recs]) => {
                if (!recs || recs.length === 0) return '';
                const title = type.charAt(0).toUpperCase() + type.slice(1);
                const colorClass = type === 'cafe' ? 'text-green-800' : (type === 'vino' ? 'text-red-800' : 'text-blue-800');
                const icon = type === 'cafe' ? '☕' : (type === 'vino' ? '🍷' : '🧀');

                const groupContent = renderMaridajeGroup(recs, type);
                if(!groupContent) return '';

                return `<div class="mb-6">
                            <h4 class="text-lg font-bold ${colorClass}">Con ${title} ${icon}</h4>
                            ${groupContent}
                        </div>`;
            }).join('');
            maridajeHtml = allRecsHtml;
        } else {
            maridajeHtml = '<p class="text-sm text-stone-500">Ideal con vinos tintos, quesos añejos y postres de chocolate.</p>';
        }
    
        return `
            <div class="container mx-auto px-4 md:px-8 mt-16">
                <h2 class="text-3xl md:text-4xl font-display text-amber-900 mb-8 text-center">Perfil Sensorial y Maridajes</h2>
                <div class="bg-white p-8 rounded-2xl shadow-xl border max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    
                    <div class="space-y-8">
                        <div>
                            <h3 class="font-bold text-xl text-amber-800 mb-3">Notas de Aroma y Sabor</h3>
                            <p class="text-stone-600">${tostado?.perfilAroma || 'No especificadas.'}</p>
                        </div>
                    </div>
    
                    <div class="w-full max-w-sm mx-auto">
                        ${perfilSensorialData ? `<canvas id="final-radar-chart"></canvas>` : '<p class="text-stone-500 text-center">Sin perfil sensorial disponible.</p>'}
                    </div>
    
                </div>
                <div class="bg-white p-8 rounded-2xl shadow-xl border max-w-4xl mx-auto mt-8">
                    <h3 class="text-2xl font-display text-amber-800 mb-6 border-b pb-3">Maridaje Sugerido</h3>
                    ${maridajeHtml}
                </div>

                <div class="mt-12 text-center">
                    <h3 class="text-2xl font-display text-amber-900 mb-4">Comparte esta Ficha Técnica</h3>
                    <div class="flex items-center justify-center gap-4">
                        <button data-lote-id="${loteId}" class="share-btn bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-full transition" title="Compartir en Facebook"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v2.385z"/></svg></button>
                        <button data-lote-id="${loteId}" class="share-btn bg-black hover:bg-gray-800 text-white font-bold p-3 rounded-full transition" title="Compartir en X"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 16 16"><path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z"/></svg></button>
                        <button data-lote-id="${loteId}" class="share-btn bg-green-500 hover:bg-green-600 text-white font-bold p-3 rounded-full transition" title="Compartir en WhatsApp"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.296-.999 1.001-.999 2.448s1.024 2.845 1.173 3.044c.149.198 2.003 3.044 4.851 4.223.713.364 1.364.576 1.84.733.523.172 1.053.148 1.488.099.463-.049 1.492-.612 1.701-1.217.208-.604.208-1.115.148-1.217z"/></svg></button>
                        <button data-lote-id="${loteId}" class="share-btn bg-gray-500 hover:bg-gray-600 text-white font-bold p-3 rounded-full transition" title="Copiar Enlace"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg></button>
                    </div>
                </div>
            </div>
        `;
    }
    
    function initializeMap(containerId, coords) {
        const mapContainer = document.getElementById(containerId);
        if (!mapContainer) return;
        if (chartInstances[containerId]) { chartInstances[containerId].remove(); }
        try {
            if (!Array.isArray(coords) || coords.length === 0) throw new Error("Coordenadas inválidas");
            requestAnimationFrame(() => {
                const map = L.map(mapContainer).setView(coords[0], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                const polygon = L.polygon(coords, { color: '#8D6E63' }).addTo(map);
                map.fitBounds(polygon.getBounds());
                setTimeout(() => map.invalidateSize(), 100);
                chartInstances[containerId] = map;
            });
        } catch(e) { console.error("Error al renderizar mapa:", e); }
    }

    function initializePerfilChart(canvasId, perfilData) {
        const chartCanvas = document.getElementById(canvasId);
        if (!chartCanvas || !perfilData) return;
        
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }
        
        const atributos = ['cacao', 'acidez', 'amargor', 'astringencia', 'frutaFresca', 'frutaMarron', 'vegetal', 'floral', 'madera', 'especia', 'nuez', 'caramelo'];
        const data = atributos.map(attr => perfilData[attr] || 0);

        chartInstances[canvasId] = new Chart(chartCanvas, {
            type: 'radar',
            data: { 
                labels: atributos.map(a => a.charAt(0).toUpperCase() + a.slice(1)), 
                datasets: [{ 
                    label: 'Intensidad', 
                    data: data, 
                    fill: true, 
                    backgroundColor: 'rgba(141, 110, 99, 0.2)', 
                    borderColor: 'rgb(141, 110, 99)', 
                    pointBackgroundColor: 'rgb(141, 110, 99)' 
                }] 
            },
            options: { 
                scales: { 
                    r: { 
                        angleLines: { color: 'rgba(0,0,0,0.1)'},
                        grid: { color: 'rgba(0,0,0,0.1)'},
                        pointLabels: { font: { size: 10, family: "'Inter', sans-serif" }, color: '#57534e' },
                        suggestedMin: 0, 
                        suggestedMax: 10, 
                        ticks: { display: false, stepSize: 2 },
                    } 
                }, 
                plugins: { 
                    legend: { display: false } 
                } 
            }
        });
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
            let certsHtml = (procesadora.certificaciones_json || []).map(cert => `<div class="flex items-center gap-2 p-2 rounded-md bg-stone-100"><img src="${cert.logo_url}" class="h-6 w-6 rounded-full"><span class="text-sm text-stone-600">${cert.nombre}</span></div>`).join('');
            let premiosHtml = (procesadora.premios_json || []).map(p => `<div class="flex items-center gap-2 p-2 rounded-md bg-stone-100"><img src="${p.logo_url}" class="h-6 w-6 rounded-full"><span class="text-sm text-stone-600">${p.nombre} (${p.ano})</span></div>`).join('');
            contentHtml = `
                <h2 class="text-3xl font-display text-amber-900 mb-4">${procesadora.nombre_comercial || procesadora.razon_social}</h2>
                <div class="space-y-4 text-sm">
                    <p><strong>Ubicación:</strong> ${procesadora.ciudad}, ${procesadora.pais}</p>
                    <p><strong>Dirección:</strong> ${procesadora.direccion}</p>
                    ${certsHtml ? `<div><h4 class="font-bold mt-4 mb-2">Certificaciones</h4><div class="flex flex-wrap gap-4">${certsHtml}</div></div>` : ''}
                    ${premiosHtml ? `<div><h4 class="font-bold mt-4 mb-2">Premios</h4><div class="flex flex-wrap gap-4">${premiosHtml}</div></div>` : ''}
                </div>`;
            locationModalContent.innerHTML = contentHtml;
            locationModal.classList.remove('hidden');
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

    // Nueva función refactorizada que renderiza el mapa y sus elementos
    function initializeRouteMap(containerId, routePoints) {
        const mapContainer = document.getElementById(containerId);
        if (!mapContainer || !routePoints || routePoints.length < 2) return;

        // Si el mapa ya existe, solo refresca su tamaño y vista.
        if (chartInstances[containerId]) { 
            console.log("Refrescando mapa...");
            setTimeout(() => {
                chartInstances[containerId].invalidateSize();
                chartInstances[containerId].fitBounds(routePoints.map(p => p.latlng), { padding: [50, 50] });
            }, 100);
            return;
        }

        try {
        
            let routeLayers = L.layerGroup();

            const coordinates = routePoints.map(point => point.latlng);

            // Crea la instancia del mapa
            map = L.map(containerId).setView(coordinates[0], 13);
            
            // Añade la capa de tiles (el fondo del mapa)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

            // Ajusta el zoom para que todos los puntos sean visibles
            map.fitBounds(coordinates, { padding: [50, 50] });
            
            // Añade los marcadores estáticos con tooltips permanentes
            routePoints.forEach(point => {
                const marker = L.marker(point.latlng);
                
                // El tooltip se mostrará permanentemente para que la información sea visible al inicio
                marker.bindTooltip(`<b>${point.stageName}</b><br>${point.date}<br>${point.name}`, {
                    permanent: true,
                    direction: 'top',
                    className: 'my-leaflet-tooltip' // Clase CSS personalizada
                });
                
                // El popup tradicional seguirá disponible al hacer clic para ver más detalles como la fecha
                marker.bindPopup(`<b>${point.stageName}</b><br>${point.name}<br>Fecha: ${point.date}`);

                routeLayers.addLayer(marker);
            });

            map.addLayer(routeLayers);
            
            // Inicia la animación de la ruta
            animateRoute(coordinates, routeLayers);

            chartInstances[containerId] = map;

        } catch(e) { console.error("Error al renderizar mapa de ruta:", e); }
    }
    
    // 4. Animación de la Ruta
    function animateRoute(coordinates, routeLayers) {
        let currentAnimation;

        // Detiene cualquier animación en curso antes de empezar una nueva
        if (currentAnimation) {
            cancelAnimationFrame(currentAnimation);
        }

        // Limpia cualquier trazo o marcador animado anterior
        routeLayers.eachLayer(layer => {
            if (layer instanceof L.Polyline || (layer.options.icon && layer.options.icon.options.className === 'moving-icon')) {
                routeLayers.removeLayer(layer);
            }
        });

        let polyline = L.polyline([], { color: 'blue', weight: 5, opacity: 0.8 }).addTo(routeLayers);
        let animatedMarker = L.marker(coordinates[0], {
            icon: L.divIcon({
                className: 'moving-icon',
                html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        }).addTo(routeLayers);

        let i = 0;
        let j = 0;
        const totalSteps = 100; // Pasos entre cada punto para una animación más suave
        
        function move() {
            if (i >= coordinates.length - 1) { // Animación completada
                cancelAnimationFrame(currentAnimation);
                return;
            }

            const start = L.latLng(coordinates[i]);
            const end = L.latLng(coordinates[i+1]);
            
            // Añadir el punto actual a la polilínea
            polyline.addLatLng(start);
            
            // Mover el marcador animado
            const lat = start.lat + (end.lat - start.lat) * (j / totalSteps);
            const lng = start.lng + (end.lng - start.lng) * (j / totalSteps);
            animatedMarker.setLatLng([lat, lng]);

            j++;
            if (j > totalSteps) {
                j = 0;
                i++;
                if (i === coordinates.length - 1) {
                    // Asegurarse de que termine en el punto final exacto
                    polyline.addLatLng(coordinates[i]);
                    animatedMarker.setLatLng(coordinates[i]);
                }
            }
            
            currentAnimation = requestAnimationFrame(move);
        }
        
        move();
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

                        <div id="g_id_onload"
                            data-client_id="1064687511845-vjel6sbn1cg4nbmgf2228s0u821gvua4.apps.googleusercontent.com"
                            data-callback="handleCredentialResponse"
                            data-context="use">
                        </div>
                        <div class="g_id_signin"
                            data-type="standard"
                            data-shape="rectangular"
                            data-theme="outline"
                            data-text="continue_with"
                            data-size="large"
                            data-logo_alignment="left">
                        </div>
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

    // --- CALLBACK GLOBAL PARA GOOGLE SIGN-IN ---
    window.handleCredentialResponse = async function(response) {
        const loteId = globalHistory.stages[globalHistory.stages.length - 1].data.id.value;
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

