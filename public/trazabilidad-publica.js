document.addEventListener('DOMContentLoaded', () => {
    const buscarBtn = document.getElementById('buscarBtn');
    const loteIdInput = document.getElementById('loteIdInput');
    const resultadoContainer = document.getElementById('resultado-container');
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalTitle = document.getElementById('modal-title');
    const closeModalBtn = document.getElementById('close-modal-btn');
    
    let cosechaMapInstance = null;
    let perfilRadarChartInstance = null;
    let finalRadarChartInstance = null;

    const chapterIcons = {
        cosecha: `<svg class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.0001 2.34315C15.8236 2.34315 19.3444 3.86134 21.848 6.36488C24.3516 8.86842 25.8698 12.3892 25.8698 16.2127C25.8698 20.0361 24.3516 23.5569 21.848 26.0605C19.3444 28.564 15.8236 30.0822 12.0001 30.0822C8.1766 30.0822 4.65582 28.564 2.15228 26.0605C-0.351261 23.5569 -1.86945 20.0361 -1.86945 16.2127C-1.86945 12.3892 -0.351261 8.86842 2.15228 6.36488C4.65582 3.86134 8.1766 2.34315 12.0001 2.34315Z M12.0001 4.75971C8.94977 4.75971 6.03578 5.92023 3.82424 8.13177C1.6127 10.3433 0.452176 13.2573 0.452176 16.3077C0.452176 19.3582 1.6127 22.2722 3.82424 24.4837C6.03578 26.6952 8.94977 27.8558 12.0001 27.8558C15.0506 27.8558 17.9646 26.6952 20.1761 24.4837C22.3876 22.2722 23.5482 19.3582 23.5482 16.3077C23.5482 13.2573 22.3876 10.3433 20.1761 8.13177C17.9646 5.92023 15.0506 4.75971 12.0001 4.75971Z" /></svg>`,
        fermentacion: `<svg class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4 4H20V6H4V4ZM4 8H20V10H4V8ZM4 12H20V14H4V12ZM4 16H20V18H4V16Z" /></svg>`,
        secado: `<svg class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4ZM11 7V11H7V13H11V17H13V13H17V11H13V7H11Z" /></svg>`,
        tostado: `<svg class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>`,
        molienda: `<svg class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 6L12 20M12 6C10.8954 6 10 5.10457 10 4C10 2.89543 10.8954 2 12 2C13.1046 2 14 2.89543 14 4C14 5.10457 13.1046 6 12 6ZM8 9H16V7H8V9ZM6 13H18V11H6V13Z" /></svg>`
    };

    async function handleSearch() {
        const loteId = loteIdInput.value.trim();
        if (!loteId) { alert("Ingresa un ID de lote."); return; }
        try {
            const history = await fetch(`/api/trazabilidad/${loteId}`).then(res => res.ok ? res.json() : Promise.reject(res));
            renderHistory(history);
        } catch (error) {
            resultadoContainer.innerHTML = `<div class="text-center bg-red-100 text-red-800 p-6 rounded-2xl shadow-md"><h3 class="font-bold text-xl mb-2">Lote no encontrado</h3><p>Verifica el código e inténtalo de nuevo.</p></div>`;
        }
    }

    function renderHistory(h) {
        resultadoContainer.innerHTML = '';
        
        const stageOrder = [
            { key: 'cosecha', title: 'La Cuna - El Origen de Todo', func: createChapterCosecha, icon: 'cosecha' },
            { key: 'fermentacion', title: 'La Metamorfosis - El Despertar del Sabor', func: createChapterFermentacion, icon: 'fermentacion' },
            { key: 'secado', title: 'El Reposo - El Abrazo del Sol y el Aire', func: createChapterSecado, icon: 'secado' },
            { key: 'tostado', title: 'La Danza de Fuego - La Revelación del Aroma', func: createChapterTostado, icon: 'tostado' },
            { key: 'descascarillado_and_molienda', title: 'La Liberación - La Esencia Pura', func: createChapterMolienda, icon: 'molienda' }
        ];

        let finalHTML = '';
        let chapterNum = 1;

        stageOrder.forEach(stageInfo => {
            if (h[stageInfo.key]) {
                finalHTML += stageInfo.func(h, chapterNum, stageInfo.title, stageInfo.icon);
                chapterNum++;
            }
        });
        
        if (h.descascarillado_and_molienda || h.secado) {
             finalHTML += createFinalReport(h);
        }
        
        resultadoContainer.innerHTML = finalHTML;
        
        if (h.fincaData && h.fincaData.coordenadas) initializeCosechaMap(h.fincaData.coordenadas);
        if (h.tostado && h.tostado.perfilSensorialData) {
            initializePerfilChart('perfil-radar-chart', h.tostado.perfilSensorialData);
            if (document.getElementById('final-radar-chart')) {
                initializePerfilChart('final-radar-chart', h.tostado.perfilSensorialData);
            }
        }
    }
    
    function createChapterHTML(type, chapterNum, title, narrative, visualContent = '') {
        return `<div class="mb-12 relative pt-8"><div class="chapter-icon">${chapterIcons[type]}</div><div class="bg-white p-6 md:p-8 rounded-2xl shadow-lg"><h3 class="text-stone-500 font-semibold">Capítulo ${chapterNum}</h3><h2 class="text-3xl font-display text-amber-900 mt-1 mb-4">${title}</h2>${narrative}${visualContent}</div></div>`;
    }

    function createChapterCosecha(h, num, title, icon) {
        const cosecha = h.cosecha;
        const fincaData = h.fincaData;
        const fecha = cosecha.fechaCosecha ? new Date(cosecha.fechaCosecha + 'T00:00:00').toLocaleDateString('es-ES',{year:'numeric',month:'long',day:'numeric'}) : 'una fecha memorable';
        const narrative = `<div class="flex justify-between items-start gap-6"><div class="prose max-w-none text-stone-600 leading-relaxed flex-grow"><p>Mi historia comenzó en <strong>${cosecha.finca}</strong>, un santuario de tierra fértil donde fui nutrido hasta la perfección. Las manos expertas de <strong>${fincaData?.propietario || 'nuestros agricultores'}</strong> me cuidaron y supieron reconocer el momento exacto de mi madurez. Fui cosechado el <strong>${fecha}</strong>, un día que marcó el inicio de mi destino: llegar hasta ti.</p></div>${cosecha.imageUrl ? `<div class="ml-4 flex-shrink-0"><button data-img-src="${cosecha.imageUrl}" data-img-title="Foto de Cosecha" class="view-photo-btn group block"><img src="${cosecha.imageUrl}" alt="Miniatura de la cosecha" class="w-24 h-24 rounded-lg object-cover shadow-md transition-transform group-hover:scale-105"></button></div>` : ''}</div>`;
        const visualContent = `<div class="mt-6 pt-4 border-t"><h4 class="font-semibold text-stone-700 mb-2">Ubicación de la Finca</h4><div id="map-cosecha" class="w-full h-[250px] rounded-xl border border-stone-300"></div></div>`;
        return createChapterHTML(icon, num, title, narrative, visualContent);
    }

    function createChapterFermentacion(h, num, title, icon) {
        const fermentacion = h.fermentacion;
        const narrative = `<div class="flex justify-between items-start gap-6"><div class="prose max-w-none text-stone-600 leading-relaxed flex-grow"><p>Mi alma se forjó en un sueño profundo y cálido. Durante <strong>${fermentacion.duracion} días</strong>, descansé, siguiendo el tradicional método de <strong>${fermentacion.metodo}</strong>. Fue un proceso de paciencia y magia, donde los azúcares de mi pulpa se transformaron, despertando las notas complejas y afrutadas que definen mi carácter. Fue mi verdadero nacimiento.</p></div>${fermentacion.imageUrl ? `<div class="ml-4 flex-shrink-0"><button data-img-src="${fermentacion.imageUrl}" data-img-title="Foto de Fermentación" class="view-photo-btn group block"><img src="${fermentacion.imageUrl}" alt="Miniatura de la fermentación" class="w-24 h-24 rounded-lg object-cover shadow-md transition-transform group-hover:scale-105"></button></div>` : ''}</div>`;
        return createChapterHTML(icon, num, title, narrative);
    }

    function createChapterSecado(h, num, title, icon) {
        const secado = h.secado;
        const narrative = `<div class="flex justify-between items-start gap-6"><div class="prose max-w-none text-stone-600 leading-relaxed flex-grow"><p>Después de mi despertar, me entregaron al sol. Mi reposo duró <strong>${secado.duracion} días</strong>, utilizando un método de <strong>${secado.metodo}</strong> que garantiza el equilibrio perfecto. Cada grano fue removido con cuidado para que el calor y el aire nos abrazaran por igual, sellando los sabores que nacieron en la fermentación y preparándome para la prueba de fuego.</p></div>${secado.imageUrl ? `<div class="ml-4 flex-shrink-0"><button data-img-src="${secado.imageUrl}" data-img-title="Foto de Secado" class="view-photo-btn group block"><img src="${secado.imageUrl}" alt="Miniatura del secado" class="w-24 h-24 rounded-lg object-cover shadow-md transition-transform group-hover:scale-105"></button></div>` : ''}</div>`;
        return createChapterHTML(icon, num, title, narrative);
    }
    
    function createChapterTostado(h, num, title, icon) {
        const tostado = h.tostado;
        const narrative = `<div class="flex justify-between items-start gap-6"><div class="prose max-w-none text-stone-600 leading-relaxed flex-grow"><p>Llegó el momento de la verdad. Dancé con el fuego durante <strong>${tostado.duracion} minutos</strong>, alcanzando un clímax de <strong>${tostado.tempMaxima}°C</strong>. Este ritual reveló mi perfil de aroma a <strong>${tostado.perfilAroma || 'notas únicas'}</strong>, liberando fragancias que cuentan la historia de mi origen. El resultado es un perfil sensorial de tipo <strong>${tostado.tipoPerfil}</strong>, una personalidad forjada en el calor para tu deleite.</p></div>${tostado.imageUrl ? `<div class="ml-4 flex-shrink-0"><button data-img-src="${tostado.imageUrl}" data-img-title="Foto de Tostado" class="view-photo-btn group block"><img src="${tostado.imageUrl}" alt="Miniatura del tostado" class="w-24 h-24 rounded-lg object-cover shadow-md transition-transform group-hover:scale-105"></button></div>` : ''}</div>`;
        const visualContent = tostado.perfilSensorialData ? `<div class="mt-6 pt-4 border-t"><h4 class="font-semibold text-stone-700 text-center mb-2">Perfil Sensorial: ${tostado.tipoPerfil}</h4><div class="w-full max-w-xs mx-auto"><canvas id="perfil-radar-chart"></canvas></div></div>` : '';
        return createChapterHTML(icon, num, title, narrative, visualContent);
    }

    function createChapterMolienda(h, num, title, icon) {
        const molienda = h.descascarillado_and_molienda;
        const narrative = `<p>Finalmente, fui liberado de mi cáscara. En el proceso, se desprendieron <strong>${molienda.pesoCascarilla} kg</strong> de mi cubierta protectora, dejando solo mi corazón puro. Este núcleo se transformó en <strong>${molienda.pesoProductoFinal} kg</strong> de <strong>${molienda.productoFinal}</strong>, la esencia misma de mi viaje, lista para convertirse en la obra de arte que ahora sostienes.</p>`;
        return createChapterHTML(icon, num, title, narrative, '');
    }

    function createFinalReport(h) {
        const { fincaData, cosecha, tostado } = h;
        const molienda = h.descascarillado_and_molienda;
        const secado = h.secado;
        const loteId = molienda?.id || secado?.id;
        if (!loteId) return '';

        return `
            <div class="mt-16 text-center">
                <h2 class="text-3xl font-display text-amber-900 mb-4">El Certificado de Identidad de tu Chocolate</h2>
                <p class="text-stone-600 max-w-2xl mx-auto mb-8">Esta es la huella digital de tu chocolate. Única e irrepetible.</p>
                <div class="bg-white p-8 rounded-2xl shadow-xl border border-amber-800/20 max-w-2xl mx-auto">
                    <div class="grid grid-cols-2 gap-6 text-left">
                        <div><h4 class="text-sm text-stone-500">Lote</h4><p class="font-semibold">${loteId}</p></div>
                        <div><h4 class="text-sm text-stone-500">Origen</h4><p class="font-semibold">${fincaData?.ciudad || cosecha.finca}, ${fincaData?.pais || 'N/A'}</p></div>
                        <div><h4 class="text-sm text-stone-500">Cosecha</h4><p class="font-semibold">${new Date(cosecha.fechaCosecha + 'T00:00:00').toLocaleDateString('es-ES',{year:'numeric',month:'long',day:'numeric'})}</p></div>
                        ${tostado ? `<div><h4 class="text-sm text-stone-500">Notas Dominantes</h4><p class="font-semibold">${tostado.perfilAroma || 'No especificado'}</p></div>` : ''}
                        ${tostado && tostado.tipoPerfil ? `<div class="col-span-2"><h4 class="text-sm text-stone-500 text-center mb-2">Perfil Sensorial: ${tostado.tipoPerfil}</h4><div class="w-full max-w-md mx-auto"><canvas id="final-radar-chart"></canvas></div></div>` : ''}
                    </div>
                </div>
            </div>
            <div class="mt-12 text-center">
                <h3 class="text-2xl font-display text-amber-900 mb-4">Comparte esta Historia</h3>
                <div class="flex items-center justify-center gap-4">
                    <button data-lote-id="${loteId}" class="share-btn bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-full transition" title="Compartir en Facebook"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v2.385z"/></svg></button>
                    <button data-lote-id="${loteId}" class="share-btn bg-black hover:bg-gray-800 text-white font-bold p-3 rounded-full transition" title="Compartir en X"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 16 16"><path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z"/></svg></button>
                    <button data-lote-id="${loteId}" class="share-btn bg-green-500 hover:bg-green-600 text-white font-bold p-3 rounded-full transition" title="Compartir en WhatsApp"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.296-.999 1.001-.999 2.448s1.024 2.845 1.173 3.044c.149.198 2.003 3.044 4.851 4.223.713.364 1.364.576 1.84.733.523.172 1.053.148 1.488.099.463-.049 1.492-.612 1.701-1.217.208-.604.208-1.115.148-1.217z"/></svg></button>
                    <button data-lote-id="${loteId}" class="share-btn bg-gray-500 hover:bg-gray-600 text-white font-bold p-3 rounded-full transition" title="Copiar Enlace"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg></button>
                </div>
            </div>`;
    }
    function initializeCosechaMap(coords) {
        const mapContainer = document.getElementById('map-cosecha');
        if (!mapContainer) return;
        if (cosechaMapInstance) { cosechaMapInstance.remove(); cosechaMapInstance = null; }
        try {
            if (!Array.isArray(coords) || coords.length === 0) throw new Error("Coordenadas inválidas");
            requestAnimationFrame(() => {
                cosechaMapInstance = L.map('map-cosecha').setView(coords[0], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(cosechaMapInstance);
                const polygon = L.polygon(coords, { color: '#854d0e' }).addTo(cosechaMapInstance);
                cosechaMapInstance.fitBounds(polygon.getBounds());
                setTimeout(() => cosechaMapInstance.invalidateSize(), 100);
            });
        } catch(e) { console.error("Error al renderizar mapa:", e); mapContainer.innerHTML = '<p class="text-red-600">Error al mostrar mapa.</p>'; }
    }
    
    function initializePerfilChart(canvasId, perfilData) {
        const chartCanvas = document.getElementById(canvasId);
        if (!chartCanvas || !perfilData) return;
        
        let chartInstanceToDestroy = null;
        if (canvasId === 'perfil-radar-chart' && perfilRadarChartInstance) {
            chartInstanceToDestroy = perfilRadarChartInstance;
        } else if (canvasId === 'final-radar-chart' && finalRadarChartInstance) {
            chartInstanceToDestroy = finalRadarChartInstance;
        }
        if (chartInstanceToDestroy) {
            chartInstanceToDestroy.destroy();
        }

        const atributos = ['Cacao', 'Acidez', 'Amargor', 'Astringencia', 'Fruta Fresca', 'Fruta Marrón', 'Vegetal', 'Floral', 'Madera', 'Especia', 'Nuez', 'Caramelo'];
        const data = atributos.map(attr => perfilData[attr.toLowerCase().replace(/ /g, '')] || 0);
        
        const newChart = new Chart(chartCanvas, {
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
                        suggestedMin: 0, 
                        suggestedMax: 10, 
                        ticks: { display: false },
                        pointLabels: { font: { size: 10 } }
                    } 
                }, 
                plugins: { 
                    legend: { display: false } 
                } 
            }
        });

        if (canvasId === 'perfil-radar-chart') {
            perfilRadarChartInstance = newChart;
        } else if (canvasId === 'final-radar-chart') {
            finalRadarChartInstance = newChart;
        }
    }

    buscarBtn.addEventListener('click', handleSearch);
    loteIdInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleSearch(); });
    resultadoContainer.addEventListener('click', e => {
        const imageButton = e.target.closest('.view-photo-btn');
        if (imageButton) {
            modalImage.src = imageButton.dataset.imgSrc;
            modalTitle.textContent = imageButton.dataset.imgTitle;
            imageModal.showModal();
            return;
        }
        const shareButton = e.target.closest('.share-btn');
        if (shareButton) {
            const loteId = shareButton.dataset.loteId;
            const pageUrl = `${window.location.origin}/trazabilidad.html?lote=${loteId}`;
            const shareText = `¡Descubre el ADN de mi chocolate! Lote: ${loteId}`;
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
    const loteIdFromUrl = params.get('lote');
    if (loteIdFromUrl) { loteIdInput.value = loteIdFromUrl; handleSearch(); }
});

