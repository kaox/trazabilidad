document.addEventListener('DOMContentLoaded', () => {
    const buscarBtn = document.getElementById('buscarBtn');
    const loteIdInput = document.getElementById('loteIdInput');
    const resultadoContainer = document.getElementById('resultado-container');
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalTitle = document.getElementById('modal-title');
    const closeModalBtn = document.getElementById('close-modal-btn');
    
    let chartInstances = {};

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
            const history = await fetch(`/api/trazabilidad/${loteId}`).then(res => res.ok ? res.json() : Promise.reject(res));
            renderHistory(history);
        } catch (error) {
            resultadoContainer.innerHTML = `<div class="container mx-auto px-6"><div class="text-center bg-red-100 text-red-800 p-6 rounded-2xl shadow-md"><h3 class="font-bold text-xl mb-2">Lote no encontrado</h3><p>Verifica el código e inténtalo de nuevo.</p></div></div>`;
        }
    }

    function renderHistory(h) {
        let timelineHTML = '';
        if (h.stages && h.stages.length > 0) {
            timelineHTML = h.stages.map((stage, index) => createTimelineItem(stage.nombre_etapa, stage.data, h, index)).join('');
        }
        
        resultadoContainer.innerHTML = `<div class="timeline-container">${timelineHTML}${createFinalReportCard(h)}</div>`;
        
        // Inicializar componentes visuales después de que el HTML esté en el DOM
        if (h.fincaData && h.fincaData.coordenadas) initializeCosechaMap(h.fincaData.coordenadas);
        if (h.perfilSensorialData) {
            initializePerfilChart('final-radar-chart', h.perfilSensorialData);
        }
    }

    function createTimelineItem(stageName, data, history, index) {
        const details = getChapterDetails(stageName, data, history);
        const position = index % 2 === 0 ? 'left' : 'right';
        const hasImage = data.imageUrl;
        const isCosecha = stageName.toLowerCase().includes('cosecha');
        const hasMap = isCosecha && history.fincaData?.coordenadas;

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
                    ${hasMap ? `
                        <div class="mt-6 pt-4 border-t">
                            <h4 class="font-semibold text-stone-700 mb-2">Ubicación Geográfica</h4>
                            <div id="map-cosecha" class="w-full h-[250px] rounded-xl border border-stone-300"></div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    function getChapterDetails(stageName, data, history) {
        const { fincaData } = history;
        const details = {
            title: stageName,
            narrative: 'Se completó una etapa clave del proceso.',
            dataPoints: Object.entries(data).filter(([key]) => key !== 'id' && key !== 'imageUrl').map(([key, value]) => ({ label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), value: value || 'N/A' })),
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
    
    function createFinalReportCard(h) {
        const { fincaData, perfilSensorialData, stages } = h;
        if (!stages || stages.length === 0) return '';
        
        const firstStageData = stages[0].data;
        const lastStageData = stages[stages.length - 1].data;
        const fermentacion = stages.find(s => s.nombre_etapa.toLowerCase().includes('fermenta'))?.data;
        const secado = stages.find(s => s.nombre_etapa.toLowerCase().includes('secado'))?.data;
        const tostado = stages.find(s => s.nombre_etapa.toLowerCase().includes('tostado'))?.data;
        const loteId = lastStageData.id;

        return `
            <div class="timeline-item ${stages.length % 2 === 0 ? 'left' : 'right'}">
                <div class="timeline-content bg-amber-900 text-white">
                    <h2 class="text-3xl font-display mb-4 text-amber-100">El Alma del Producto</h2>
                    <div class="space-y-6">
                        <div>
                            <h3 class="text-xl font-bold text-amber-200 border-b border-amber-700 pb-2 mb-3">Origen</h3>
                            <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div><dt class="opacity-70">País</dt><dd>${fincaData?.pais || 'N/A'}</dd></div>
                                <div><dt class="opacity-70">Ciudad</dt><dd>${fincaData?.ciudad || 'N/A'}</dd></div>
                                <div><dt class="opacity-70">Finca</dt><dd>${firstStageData?.finca || 'N/A'}</dd></div>
                                <div><dt class="opacity-70">Altitud</dt><dd>${fincaData?.altura ? fincaData.altura + ' msnm' : 'N/A'}</dd></div>
                                <div class="col-span-2"><dt class="opacity-70">Productor</dt><dd>${fincaData?.propietario || 'N/A'}</dd></div>
                                <div class="col-span-2"><dt class="opacity-70">Historia</dt><dd class="opacity-90">${fincaData?.historia || 'Sin historia registrada.'}</dd></div>
                            </dl>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-amber-200 border-b border-amber-700 pb-2 mb-3">Proceso</h3>
                            <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div><dt class="opacity-70">Cosecha</dt><dd>${formatDate(firstStageData?.fechaCosecha || firstStageData?.fecha)}</dd></div>
                                <div><dt class="opacity-70">Tostado</dt><dd>${formatDate(tostado?.fechaTostado)}</dd></div>
                                <div><dt class="opacity-70">Fermentación</dt><dd>${fermentacion ? `${fermentacion.duracion} días` : 'N/A'}</dd></div>
                                <div><dt class="opacity-70">Tiempo Tueste</dt><dd>${tostado?.duracion ? tostado.duracion + ' min' : 'N/A'}</dd></div>
                                <div><dt class="opacity-70">Secado</dt><dd>${secado ? `${secado.duracion} días` : 'N/A'}</dd></div>
                            </dl>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-amber-200 border-b border-amber-700 pb-2 mb-3">Perfil y Maridaje</h3>
                            <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div><dt class="opacity-70">Variedad</dt><dd>${firstStageData?.variedad || 'N/A'}</dd></div>
                                 <div><dt class="opacity-70">Perfil</dt><dd>${tostado?.tipoPerfil || 'N/A'}</dd></div>
                                <div class="col-span-2"><dt class="opacity-70">Aroma y Sabor</dt><dd class="opacity-90">${tostado?.perfilAroma || 'No especificado.'}</dd></div>
                                <div class="col-span-2"><dt class="opacity-70">Maridaje</dt><dd class="opacity-90">Ideal con vinos tintos, quesos añejos y postres de chocolate.</dd></div>
                            </dl>
                            ${perfilSensorialData ? `<div class="pt-4 mt-4 border-t border-amber-700"><div class="w-full max-w-sm mx-auto bg-white/10 rounded-lg p-2"><canvas id="final-radar-chart"></canvas></div></div>` : ''}
                        </div>
                    </div>
                    <div class="mt-8 text-center">
                         <h4 class="font-bold text-amber-200 mb-3">Comparte esta Historia</h4>
                         <div class="flex items-center justify-center gap-4">
                            <button data-lote-id="${loteId}" class="share-btn bg-white/20 hover:bg-white/30 text-white font-bold p-3 rounded-full transition" title="Compartir en Facebook"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v2.385z"/></svg></button>
                            <button data-lote-id="${loteId}" class="share-btn bg-white/20 hover:bg-white/30 text-white font-bold p-3 rounded-full transition" title="Compartir en X"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 16 16"><path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z"/></svg></button>
                            <button data-lote-id="${loteId}" class="share-btn bg-white/20 hover:bg-white/30 text-white font-bold p-3 rounded-full transition" title="Compartir en WhatsApp"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.296-.999 1.001-.999 2.448s1.024 2.845 1.173 3.044c.149.198 2.003 3.044 4.851 4.223.713.364 1.364.576 1.84.733.523.172 1.053.148 1.488.099.463-.049 1.492-.612 1.701-1.217.208-.604.208-1.115.148-1.217z"/></svg></button>
                            <button data-lote-id="${loteId}" class="share-btn bg-white/20 hover:bg-white/30 text-white font-bold p-3 rounded-full transition" title="Copiar Enlace"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg></button>
                         </div>
                    </div>
                </div>
            </div>
            `;
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
    
    function initializeCosechaMap(coords) {
        const mapContainer = document.getElementById('map-cosecha');
        if (!mapContainer) return;
        if (chartInstances.cosechaMap) { chartInstances.cosechaMap.remove(); }
        try {
            if (!Array.isArray(coords) || coords.length === 0) throw new Error("Coordenadas inválidas");
            requestAnimationFrame(() => {
                chartInstances.cosechaMap = L.map('map-cosecha').setView(coords[0], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(chartInstances.cosechaMap);
                const polygon = L.polygon(coords, { color: '#854d0e' }).addTo(chartInstances.cosechaMap);
                chartInstances.cosechaMap.fitBounds(polygon.getBounds());
                setTimeout(() => chartInstances.cosechaMap.invalidateSize(), 100);
            });
        } catch(e) { console.error("Error al renderizar mapa:", e); mapContainer.innerHTML = '<p class="text-red-600">Error al mostrar mapa.</p>'; }
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
                        angleLines: { color: 'rgba(255,255,255,0.2)'},
                        grid: { color: 'rgba(255,255,255,0.2)'},
                        pointLabels: { font: { size: 10, family: "'Inter', sans-serif" }, color: '#f5f5f4' },
                        suggestedMin: 0, 
                        suggestedMax: 10, 
                        ticks: { display: false, stepSize: 2, backdropColor: 'transparent' },
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
    resultadoContainer.addEventListener('click', e => {
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

    closeModalBtn.addEventListener('click', () => imageModal.close());
    imageModal.addEventListener('click', (e) => { if (e.target.id === 'image-modal') imageModal.close(); });

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

