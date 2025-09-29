document.addEventListener('DOMContentLoaded', () => {
    const buscarBtn = document.getElementById('buscarBtn');
    const loteIdInput = document.getElementById('loteIdInput');
    const resultadoContainer = document.getElementById('resultado-container');
    const preTimelineContainer = document.getElementById('pre-timeline-container');
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalTitle = document.getElementById('modal-title');
    const closeModalBtn = document.getElementById('close-modal-btn');
    
    let chartInstances = {};
    let globalHistory = {};

    // --- Funciones Globales para Interacción ---
    window.openImageModal = (src, title) => {
        if (modalImage && modalTitle && imageModal) {
            modalImage.src = src;
            modalTitle.textContent = title;
            imageModal.showModal();
        }
    };

    async function handleSearch() {
        const loteId = loteIdInput.value.trim();
        if (!loteId) { alert("Ingresa un ID de lote."); return; }
        try {
            globalHistory = await fetch(`/api/trazabilidad/${loteId}`).then(res => res.ok ? res.json() : Promise.reject(res));
            renderHistory(globalHistory);
        } catch (error) {
            resultadoContainer.innerHTML = `<div class="container mx-auto px-6"><div class="text-center bg-red-100 text-red-800 p-6 rounded-2xl shadow-md"><h3 class="font-bold text-xl mb-2">Lote no encontrado</h3><p>Verifica el código e inténtalo de nuevo.</p></div></div>`;
        }
    }

    function renderHistory(h) {
        preTimelineContainer.innerHTML = createPreTimelineSections(h);
        
        let timelineHTML = '';
        if (h.stages && h.stages.length > 0) {
            timelineHTML = h.stages.map((stage, index) => createTimelineItem(stage.nombre_etapa, stage.data, h, index)).join('');
        }

        resultadoContainer.innerHTML = `<div class="timeline-container">${timelineHTML}</div>` + createSensoryProfileSection(h);
        
        if (h.fincaData && h.fincaData.coordenadas) {
            initializeMap('finca-map-pre-timeline', h.fincaData.coordenadas);
        }
        if (h.perfilSensorialData) {
            initializePerfilChart('final-radar-chart', h.perfilSensorialData);
        }
        
        setupCarousel();
    }

    function createPreTimelineSections(h) {
        if (!h.fincaData) return '';
        const { fincaData } = h;
        
        let galleryHtml = (fincaData.imagenes_json || []).map((img, index) => `
            <div class="carousel-item ${index === 0 ? '' : 'hidden'} w-full">
                <img src="${img}" class="w-full h-64 object-cover rounded-lg">
            </div>
        `).join('');

        let certsHtml = (fincaData.certificaciones_json || []).map(cert => {
            const isExpired = new Date(cert.fecha_vencimiento) < new Date();
            const statusClass = isExpired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
            return `<div class="flex items-center gap-2"><img src="${cert.logo_url}" class="h-6 w-6 rounded-full"><span class="text-sm">${cert.nombre}</span><span class="text-xs font-medium px-2 py-0.5 rounded-full ${statusClass}">${isExpired ? 'Vencida' : 'Vigente'}</span></div>`;
        }).join('');

        let premiosHtml = (fincaData.premios_json || []).map(premio => `
            <div class="flex items-center gap-2">
                <img src="${premio.logo_url}" alt="${premio.nombre}" class="h-6 w-6 rounded-full">
                <span class="text-sm">${premio.nombre} (${premio.ano})</span>
            </div>
        `).join('');

        return `
            <div class="container mx-auto px-4 md:px-8 mb-16">
                <!-- El Rostro Detrás del Sabor -->
                <div class="mb-12">
                    <h2 class="text-3xl font-display text-amber-900 mb-6 text-center">El Rostro Detrás del Sabor</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white p-8 rounded-2xl shadow-lg">
                        <div class="relative">
                            <div id="finca-carousel" class="relative h-64 overflow-hidden rounded-lg">
                                ${galleryHtml || '<div class="flex items-center justify-center h-full bg-gray-100 rounded-lg"><p class="text-stone-500">Sin imágenes</p></div>'}
                            </div>
                            <button id="prev-btn" class="absolute top-1/2 left-2 -translate-y-1/2 bg-white/50 hover:bg-white/80 rounded-full p-2">&lt;</button>
                            <button id="next-btn" class="absolute top-1/2 right-2 -translate-y-1/2 bg-white/50 hover:bg-white/80 rounded-full p-2">&gt;</button>
                        </div>
                        <div>
                            <h3 class="text-2xl font-bold font-display">${fincaData.propietario}</h3>
                            <p class="text-lg text-amber-800 font-semibold">${fincaData.nombre_finca}</p>
                            <p class="mt-4 text-stone-600 text-sm">${fincaData.historia || 'Una finca con una rica tradición en el cultivo de productos de alta calidad.'}</p>
                        </div>
                    </div>
                </div>

                <!-- Un Origen Único -->
                <div>
                    <h2 class="text-3xl font-display text-amber-900 mb-6 text-center">Un Origen Único</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white p-8 rounded-2xl shadow-lg">
                        <div class="space-y-4">
                            <div><dt class="text-sm text-stone-500">Nombre de la Finca</dt><dd class="font-semibold">${fincaData.nombre_finca}</dd></div>
                            <div><dt class="text-sm text-stone-500">Altitud</dt><dd class="font-semibold">${fincaData.altura} msnm</dd></div>
                            <div><dt class="text-sm text-stone-500">Certificaciones</dt><dd class="mt-2 flex flex-wrap gap-4">${certsHtml || 'Ninguna'}</dd></div>
                            <div><dt class="text-sm text-stone-500">Premios</dt><dd class="mt-2 flex flex-wrap gap-4">${premiosHtml || 'Ninguno'}</dd></div>
                        </div>
                        <div id="finca-map-pre-timeline" class="w-full h-64 rounded-lg border"></div>
                    </div>
                </div>
            </div>
        `;
    }

    function setupCarousel() {
        const carousel = document.getElementById('finca-carousel');
        if (!carousel) return;
        const items = carousel.querySelectorAll('.carousel-item');
        if (items.length <= 1) return;

        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        let currentSlide = 0;

        function showSlide(index) {
            items.forEach((item, i) => {
                item.classList.toggle('hidden', i !== index);
            });
        }

        prevBtn.addEventListener('click', () => {
            currentSlide = (currentSlide - 1 + items.length) % items.length;
            showSlide(currentSlide);
        });

        nextBtn.addEventListener('click', () => {
            currentSlide = (currentSlide + 1) % items.length;
            showSlide(currentSlide);
        });
    }

    function createTimelineItem(stageName, data, history, index) {
        const details = getChapterDetails(stageName, data, history, index + 1);
        const position = index % 2 === 0 ? 'left' : 'right';
        const hasImage = data.imageUrl;

        return `
            <div class="timeline-item ${position}">
                <div class="timeline-content">
                    <div class="flex gap-6">
                        <div class="flex-grow">
                            <h3 class="text-2xl font-display text-amber-900 mb-2">${details.title}</h3>
                            <p class="text-stone-600 leading-relaxed mb-4">${details.narrative}</p>
                            <div class="text-xs space-y-1 text-stone-500">
                                ${details.dataPoints.map(dp => `<div><strong>${dp.label}:</strong> ${dp.value}</div>`).join('')}
                            </div>
                        </div>
                        ${hasImage ? `
                            <div class="flex-shrink-0 w-24">
                                <img src="${data.imageUrl}" alt="Foto de ${stageName}" class="w-24 h-24 object-cover rounded-lg cursor-pointer shadow-md transition-transform hover:scale-105" onclick="openImageModal('${data.imageUrl}', 'Foto de ${stageName}')">
                            </div>
                        ` : ''}
                    </div>
                    ${details.visualContent || ''}
                </div>
            </div>
        `;
    }

    function getChapterDetails(stageName, data, history, chapterNum) {
        const { fincaData } = history;
        const details = {
            title: `Capítulo ${chapterNum}: ${stageName}`,
            narrative: 'Se completó una etapa clave del proceso.',
            dataPoints: Object.entries(data).filter(([key]) => key !== 'id' && key !== 'imageUrl').map(([key, value]) => ({ label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), value: value || 'N/A' })),
            visualContent: ''
        };
        const lowerCaseStageName = stageName.toLowerCase();

        if (lowerCaseStageName.includes('cosecha')) {
            details.title = `Origen: ${stageName}`;
            details.narrative = `El viaje de este producto comenzó en la Finca <strong>${data.finca}</strong>, un lugar donde la tradición y el cuidado por la tierra se unen para crear algo excepcional.`;
        } else if (lowerCaseStageName.includes('fermenta')) {
            details.title = `Transformación: ${stageName}`;
            details.narrative = `Aquí nació el alma del sabor. Durante <strong>${data.duracion || data.horas} ${data.duracion ? 'días' : 'horas'}</strong>, un proceso de fermentación controlada despertó las notas complejas que definen el carácter de este lote.`;
        } else if (lowerCaseStageName.includes('secado')) {
            details.title = `Paciencia: ${stageName}`;
            details.narrative = `Bajo el sol, los granos reposaron hasta alcanzar la perfección, concentrando su esencia y preparándose para su transformación final.`;
        } else if (lowerCaseStageName.includes('tostado')) {
            details.title = `Revelación: ${stageName}`;
            details.narrative = `En la danza con el fuego, el producto reveló su verdadero potencial. Un tueste preciso liberó los aromas y sabores que lo hacen único.`;
        } else if (lowerCaseStageName.includes('molienda')) {
            details.title = `Culminación: ${stageName}`;
            details.narrative = `La etapa final donde la materia prima se transforma en el producto final, listo para ofrecer una experiencia sensorial completa.`;
        }
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

    function createMaridajeCard(rec) {
        const nombre = rec.producto.nombre || rec.producto.nombre_perfil;
        return `<div class="p-3 bg-stone-100 rounded-lg">
                    <p class="font-semibold text-sm text-stone-800">${nombre}</p>
                    <p class="text-xs text-green-700">Compatibilidad: ${rec.puntuacion.toFixed(0)}%</p>
                </div>`;
    }

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString + 'T00:00:00').toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function calculateEndDate(startDateStr, durationDays) {
        if (!startDateStr || !durationDays) return 'N/A';
        const startDate = new Date(startDateStr + 'T00:00:00');
        startDate.setDate(startDate.getDate() + parseInt(durationDays, 10));
        return formatDate(startDate.toISOString().split('T')[0]);
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
                const polygon = L.polygon(coords, { color: '#854d0e' }).addTo(map);
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

        const atributos = ['Cacao', 'Acidez', 'Amargor', 'Astringencia', 'Fruta Fresca', 'Fruta Marrón', 'Vegetal', 'Floral', 'Madera', 'Especia', 'Nuez', 'Caramelo'];
        const data = atributos.map(attr => perfilData[attr.toLowerCase().replace(/ /g, '')] || 0);
        
        chartInstances[canvasId] = new Chart(chartCanvas, {
            type: 'radar',
            data: { 
                labels: atributos, 
                datasets: [{ 
                    label: 'Intensidad', 
                    data: data, 
                    fill: true, 
                    backgroundColor: 'rgba(120,53,15,0.2)', 
                    borderColor: 'rgb(120,53,15)', 
                    pointBackgroundColor: 'rgb(120,53,15)' 
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

    buscarBtn.addEventListener('click', handleSearch);
    loteIdInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleSearch(); });
    
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

    if(closeModalBtn) closeModalBtn.addEventListener('click', () => imageModal.close());
    if(imageModal) imageModal.addEventListener('click', (e) => { if (e.target.id === 'image-modal') imageModal.close(); });

    const params = new URLSearchParams(window.location.search);
    let loteIdFromUrl = params.get('lote');

    if (!loteIdFromUrl) {
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        const potentialId = pathSegments[pathSegments.length - 1];
        if (potentialId && /^[A-Z]{3}-[A-Z0-9]{8}$/.test(potentialId)) {
            loteIdFromUrl = potentialId;
        }
    }

    if (loteIdFromUrl) {
        loteIdInput.value = loteIdFromUrl;
        handleSearch();
    }
});

