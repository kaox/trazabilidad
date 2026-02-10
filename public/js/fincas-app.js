// 1. Definir initMap globalmente para Google Maps Callback
window.initMap = function() {
    // Se sobrescribirá dentro de DOMContentLoaded si se necesita
};

document.addEventListener('DOMContentLoaded', () => {
    // Referencias al DOM
    const form = document.getElementById('finca-form');
    const fincasList = document.getElementById('fincas-list');
    const editIdInput = document.getElementById('edit-id');
    const submitButton = form.querySelector('button[type="submit"]');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const formTitle = document.getElementById('form-title');
    const countrySelect = document.getElementById('pais');
    const searchInput = document.getElementById('ciudad-search');
    const searchBtn = document.getElementById('search-btn');
    const locateBtn = document.getElementById('locate-btn');
    const fotosInput = document.getElementById('fotos');
    const fotosPreviewContainer = document.getElementById('fotos-preview-container');
    const certSelect = document.getElementById('certification-select');
    const certExpiryInput = document.getElementById('certification-expiry');
    const addCertBtn = document.getElementById('add-certification-btn');
    const certsListContainer = document.getElementById('certifications-list');
    const premioSelect = document.getElementById('premio-select');
    const premioYearInput = document.getElementById('premio-year');
    const addPremioBtn = document.getElementById('add-premio-btn');
    const premiosListContainer = document.getElementById('premios-list');
    const productorFotoInput = document.getElementById('productor-foto-input');
    const productorFotoPreview = document.getElementById('productor-foto-preview');
    const fotoProductorHiddenInput = document.getElementById('foto_productor');
    const validateDeforestationBtn = document.getElementById('validate-deforestation-btn');
    
    // Elementos del Modal de Análisis
    const analysisModal = document.getElementById('analysisModal');
    const analysisLoading = document.getElementById('analysis-loading');
    const analysisSuccess = document.getElementById('analysis-success');
    const closeAnalysisBtn = document.getElementById('close-analysis-btn');
    const scanLine = document.getElementById('satellite-scan-line');

    let allPremios = [];
    let currentFincaPremios = [];
    let allCertifications = [];
    let currentFincaCertifications = [];
    let currentImages = [];
    
    // Mapa Google
    let map;
    let drawingManager;
    let currentPolygon; // Instancia de google.maps.Polygon
    let geocoder; // Instancia de geocoding service

    init();

    async function init() {
        // Exponer initMap para callback y llamar si Gmaps ya cargó
        window.initMap = initMap;
        if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
            initMap();
        }
        
        await Promise.all([loadCountries(), loadCertifications(), loadPremios(), loadFincas()]);
        
        setupEventListeners();
    }

    // --- GOOGLE MAPS ---
    function initMap() {
        if (map) return; // Evitar reinicializar
        
        const mapContainer = document.getElementById('map');
        if (!mapContainer || typeof google === 'undefined') return;

        try {
            const defaultLoc = { lat: -9.19, lng: -75.015 }; // Centro Perú
            
            map = new google.maps.Map(mapContainer, {
                zoom: 5,
                center: defaultLoc,
                mapTypeId: 'hybrid', // Satélite con etiquetas
                streetViewControl: false
            });

            // Inicializar Geocoder (NUEVO)
            geocoder = new google.maps.Geocoder();

            // Drawing Manager
            drawingManager = new google.maps.drawing.DrawingManager({
                drawingMode: google.maps.drawing.OverlayType.POLYGON,
                drawingControl: true,
                drawingControlOptions: {
                    position: google.maps.ControlPosition.TOP_CENTER,
                    drawingModes: ['polygon']
                },
                polygonOptions: {
                    fillColor: '#854d0e',
                    fillOpacity: 0.4,
                    strokeColor: '#854d0e',
                    strokeWeight: 2,
                    editable: true,
                    draggable: false 
                }
            });
            drawingManager.setMap(map);

            // Evento: Polígono completado
            google.maps.event.addListener(drawingManager, 'overlaycomplete', function(event) {
                // Borrar polígono anterior si existe (solo 1 por finca)
                if (currentPolygon) {
                    currentPolygon.setMap(null);
                }
                
                // Desactivar modo dibujo para evitar múltiples polígonos
                drawingManager.setDrawingMode(null);

                currentPolygon = event.overlay;
                updateCoordenadasInput();
                
                // --- NUEVO: Autocompletar datos basados en el polígono ---
                autoPopulateFieldsFromPolygon(currentPolygon);

                // Listeners para edición (mover vértices) para recalcular área
                currentPolygon.getPath().addListener('set_at', () => {
                    updateCoordenadasInput();
                    autoPopulateFieldsFromPolygon(currentPolygon, true); // true = solo recalcular área
                });
                currentPolygon.getPath().addListener('insert_at', () => {
                    updateCoordenadasInput();
                    autoPopulateFieldsFromPolygon(currentPolygon, true);
                });
            });

        } catch(e) {
            console.error("Error inicializando Google Maps:", e);
        }
    }

    function updateCoordenadasInput() {
        if (!currentPolygon) {
            document.getElementById('coordenadas').value = '';
            return;
        }
        
        const path = currentPolygon.getPath();
        const coords = [];
        for (let i = 0; i < path.getLength(); i++) {
            const xy = path.getAt(i);
            coords.push([xy.lat(), xy.lng()]);
        }
        // Guardamos array de arrays [[lat, lng], [lat, lng]...] compatible con Leaflet anterior
        document.getElementById('coordenadas').value = JSON.stringify(coords);
    }

    // --- NUEVO: Lógica de Autocompletado Geográfico (Con Google Geocoding) ---
    async function autoPopulateFieldsFromPolygon(polygon, onlyArea = false) {
        if (!polygon) return;

        // 1. Calcular Superficie (Hectáreas)
        // Requiere la librería 'geometry' de Google Maps.
        try {
            if (google.maps.geometry && google.maps.geometry.spherical) {
                const areaM2 = google.maps.geometry.spherical.computeArea(polygon.getPath());
                const areaHa = (areaM2 / 10000).toFixed(2); // Convertir m2 a Hectáreas
                
                const superficieInput = document.getElementById('superficie');
                if (superficieInput) {
                    superficieInput.value = areaHa;
                    superficieInput.classList.add('bg-green-50', 'border-green-500');
                    setTimeout(() => {
                        superficieInput.classList.remove('bg-green-50', 'border-green-500');
                    }, 1000);
                }
            }
        } catch (e) {
            console.warn("No se pudo calcular el área automáticamente.", e);
        }

        if (onlyArea) return; // Ahorrar cuota de API si solo se mueve un vértice

        // 2. Calcular Centroide
        let latSum = 0;
        let lngSum = 0;
        const path = polygon.getPath();
        const len = path.getLength();
        
        for (let i = 0; i < len; i++) {
            latSum += path.getAt(i).lat();
            lngSum += path.getAt(i).lng();
        }
        const centerLat = latSum / len;
        const centerLng = lngSum / len;

        // 3. Obtener Altura (API Open-Meteo - Gratis)
        try {
            const elevRes = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${centerLat}&longitude=${centerLng}`);
            const elevData = await elevRes.json();
            
            if (elevData.elevation && elevData.elevation.length > 0) {
                const alturaInput = document.getElementById('altura');
                if (alturaInput) alturaInput.value = Math.round(elevData.elevation[0]);
            }
        } catch (e) {
            console.warn("Error obteniendo altura:", e);
        }

        // 4. Obtener Ubicación Administrativa (Google Geocoding API)
        // Usamos el geocoder nativo para obtener components precisos como administrative_area_level_2
        if (!geocoder) return;

        geocoder.geocode({ location: { lat: centerLat, lng: centerLng } }, (results, status) => {
            if (status === "OK" && results[0]) {
                const components = results[0].address_components;
                
                let pais = '';
                let region = '';   // Departamento (administrative_area_level_1)
                let provincia = ''; // Provincia (administrative_area_level_2)
                let distrito = '';  // Distrito (locality o administrative_area_level_3)

                for (const component of components) {
                    const type = component.types[0];
                    if (type === "country") pais = component.long_name;
                    if (type === "administrative_area_level_1") region = component.long_name;
                    if (type === "administrative_area_level_2") provincia = component.long_name;
                    if (type === "locality" || type === "administrative_area_level_3") {
                        // Priorizar locality si existe, sino nivel 3
                        if(!distrito || type === "locality") distrito = component.long_name;
                    }
                }

                // Actualizar inputs
                if (document.getElementById('departamento')) document.getElementById('departamento').value = region;
                if (document.getElementById('provincia')) document.getElementById('provincia').value = provincia;
                if (document.getElementById('distrito')) document.getElementById('distrito').value = distrito;
                
                // Actualizar Select de País
                const paisSelect = document.getElementById('pais');
                if (pais && paisSelect) {
                    for (let i = 0; i < paisSelect.options.length; i++) {
                        if (paisSelect.options[i].text.toLowerCase().includes(pais.toLowerCase())) {
                            paisSelect.selectedIndex = i;
                            break;
                        }
                    }
                }
            } else {
                console.warn("Geocode falló: " + status);
            }
        });
    }

    function setMapData(coordsJson) {
        // Limpiar mapa
        if (currentPolygon) {
            currentPolygon.setMap(null);
            currentPolygon = null;
        }
        
        if (!coordsJson || !map) return;

        try {
            // Esperar array de arrays: [[lat, lng], ...]
            const coordsArray = typeof coordsJson === 'string' ? JSON.parse(coordsJson) : coordsJson;
            
            if (Array.isArray(coordsArray) && coordsArray.length > 0) {
                const paths = coordsArray.map(p => ({ lat: p[0], lng: p[1] }));
                
                currentPolygon = new google.maps.Polygon({
                    paths: paths,
                    fillColor: '#854d0e',
                    fillOpacity: 0.4,
                    strokeColor: '#854d0e',
                    strokeWeight: 2,
                    editable: true,
                    map: map
                });

                // Centrar mapa
                const bounds = new google.maps.LatLngBounds();
                paths.forEach(p => bounds.extend(p));
                map.fitBounds(bounds);
                
                // Listeners de edición
                currentPolygon.getPath().addListener('set_at', () => {
                    updateCoordenadasInput();
                    // Recalcular solo área al editar vértices existentes
                    autoPopulateFieldsFromPolygon(currentPolygon, true);
                });
                currentPolygon.getPath().addListener('insert_at', () => {
                    updateCoordenadasInput();
                    // Recalcular solo área al insertar nuevos vértices
                    autoPopulateFieldsFromPolygon(currentPolygon, true);
                });
                
                // Switch a modo edición (no dibujo)
                if(drawingManager) drawingManager.setDrawingMode(null);
                
                updateCoordenadasInput();
            }
        } catch (e) {
            console.error("Error seteando datos de mapa:", e);
        }
    }

    // --- Búsqueda y Geolocalización ---
    async function searchLocation() {
        const query = searchInput.value;
        if (!query) return;
        
        // Usar Nominatim para ahorrar costos o Google Geocoding si prefieres
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                const latLng = { lat: parseFloat(lat), lng: parseFloat(lon) };
                map.setCenter(latLng);
                map.setZoom(15);
            } else {
                alert('Ubicación no encontrada.');
            }
        } catch(e) { console.error(e); }
    }

    function locateUser() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    map.setCenter(pos);
                    map.setZoom(16);
                },
                () => { alert("Error obteniendo ubicación."); }
            );
        } else {
            alert("Tu navegador no soporta geolocalización.");
        }
    }

    function setupEventListeners() {
        form.addEventListener('submit', handleFormSubmit);
        cancelEditBtn.addEventListener('click', resetForm);
        fincasList.addEventListener('click', handleFincaListClick);
        fotosInput.addEventListener('change', handleImageUpload);
        fotosPreviewContainer.addEventListener('click', handleImageDelete);
        addCertBtn.addEventListener('click', handleAddCertification);
        certsListContainer.addEventListener('click', handleCertificationAction);
        searchBtn.addEventListener('click', searchLocation);
        locateBtn.addEventListener('click', locateUser);
        addPremioBtn.addEventListener('click', handleAddPremio);
        premiosListContainer.addEventListener('click', handlePremioAction);
        productorFotoInput.addEventListener('change', handleProductorFotoUpload);
        // Nuevo Event Listener
        validateDeforestationBtn.addEventListener('click', handleDeforestationValidation);
        closeAnalysisBtn.addEventListener('click', () => analysisModal.classList.add('hidden'));
    }

    // --- LÓGICA DE VALIDACIÓN DE DEFORESTACIÓN CON GOOGLE EARTH ENGINE ---
    async function handleDeforestationValidation() {
        const coordsValue = document.getElementById('coordenadas').value;
        if (!coordsValue) { alert("Dibuja el polígono primero."); return; }
        
        let polygonCoords;
        try {
            // Google Maps coords vienen como [[lat, lng],...]
            // GeoJSON necesita [[lng, lat],...]
            const raw = JSON.parse(coordsValue);
            polygonCoords = raw.map(p => [p[1], p[0]]); 
            // Cerrar el anillo
            if (polygonCoords.length > 0) {
                 const first = polygonCoords[0];
                 const last = polygonCoords[polygonCoords.length - 1];
                 if (first[0] !== last[0] || first[1] !== last[1]) {
                     polygonCoords.push(first);
                 }
            }
        } catch(e) { return; }

        analysisModal.classList.remove('hidden');
        analysisLoading.classList.remove('hidden');
        analysisSuccess.classList.add('hidden');
        scanLine.classList.remove('hidden');

        // Textos para GEE
        const loadingText = analysisLoading.querySelector('p');
        if(loadingText) loadingText.textContent = "Conectando con Google Earth Engine (Dataset Hansen/UMD)...";

        try {
            const response = await api('/api/validate-deforestation', {
                method: 'POST',
                body: JSON.stringify({ type: 'Polygon', coordinates: [polygonCoords] })
            });

            analysisLoading.classList.add('hidden');
            scanLine.classList.add('hidden');

            if (response.compliant) {
                analysisSuccess.classList.remove('hidden');
                
                const successText = analysisSuccess.querySelector('p');
                const lossPercent = response.loss_percentage !== undefined ? response.loss_percentage.toFixed(4) : "0.0000";
                if(successText) successText.textContent = `Cobertura arbórea estable. Pérdida detectada: ${lossPercent}% (Umbral EUDR < 0.1%).`;

                const eudrCert = {
                    id: 9999,
                    nombre: "EUDR Compliant - GEE Verified",
                    logo_url: "https://upload.wikimedia.org/wikipedia/commons/b/b7/Flag_of_Europe.svg",
                    fecha_vencimiento: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
                };

                const exists = currentFincaCertifications.some(c => c.nombre.includes("EUDR") || c.nombre.includes("GEE"));
                if (!exists) {
                    currentFincaCertifications.push(eudrCert);
                    renderAddedCertifications();
                }
            } else {
                analysisModal.classList.add('hidden');
                alert(`Alerta: ${response.details}`);
            }
        } catch (error) {
            console.error(error);
            analysisModal.classList.add('hidden');
            if (error.message.includes("404")) alert("Servicio no disponible.");
            else alert("Error: " + error.message);
        }
    }

    async function loadPremios() {
        try {
            const data = await fetch('/data/premios-finca.json').then(res => res.json());
            allPremios = data.premios;
            premioSelect.innerHTML = `<option value="">Seleccionar premio...</option>` + allPremios.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        } catch (error) {
            console.error("Error cargando premios:", error);
        }
    }

    async function loadCountries() {
        try {
            const response = await fetch('/data/countries.json');
            const countries = await response.json();
            countrySelect.innerHTML = countries.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            countrySelect.value = 'Perú';
        } catch (error) {
            console.error("Error cargando países:", error);
        }
    }
    
    async function loadCertifications() {
        try {
            const data = await fetch('/data/certifications.json').then(res => res.json());
            allCertifications = data.certifications;
            certSelect.innerHTML = `<option value="">Seleccionar certificación...</option>` + allCertifications.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        } catch (error) {
            console.error("Error cargando certificaciones:", error);
        }
    }
    
    async function loadFincas() {
        try {
            const fincas = await api('/api/fincas');
            renderFincas(fincas);
        } catch (error) { fincasList.innerHTML = `<p class="text-red-500">Error al cargar fincas.</p>`; }
    }

    function renderFincas(fincas) {
        const countBadge = document.getElementById('finca-count');
        if(countBadge) countBadge.textContent = fincas.length;

        fincasList.innerHTML = fincas.length === 0 ? 
            '<div class="text-center py-8 text-stone-400 bg-stone-50 rounded-xl border-2 border-dashed border-stone-200"><i class="fas fa-seedling text-3xl mb-2"></i><p>No hay fincas registradas.</p></div>' : 
            fincas.map(finca => `
            <div class="bg-white p-4 rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition group">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="font-bold text-amber-900 text-lg leading-tight group-hover:text-amber-700 transition">${finca.nombre_finca}</h3>
                        <p class="text-xs text-stone-500 font-medium uppercase tracking-wide mt-1">${finca.propietario}</p>
                    </div>
                    <div class="flex gap-1">
                        ${finca.video_link ? `
                        <a href="${finca.video_link}" target="_blank" class="text-stone-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition" title="Ver Video">
                            <i class="fab fa-youtube"></i>
                        </a>` : ''}
                        <button onclick="shareFincaLink('${finca.id}', '${finca.nombre_finca}')" class="text-stone-400 hover:text-green-600 p-1.5 rounded-lg hover:bg-green-50 transition" title="Compartir con Productor">
                            <i class="fas fa-share-alt"></i>
                        </button>
                        <button data-id="${finca.id}" class="edit-btn text-stone-400 hover:text-sky-600 p-1.5 rounded-lg hover:bg-sky-50 transition" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button data-id="${finca.id}" class="delete-btn text-stone-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="text-xs text-stone-500 space-y-1">
                    <p><i class="fas fa-map-marker-alt w-4 text-center mr-1"></i> ${finca.distrito || '-'}, ${finca.departamento || '-'}</p>
                    <p><i class="fas fa-ruler-combined w-4 text-center mr-1"></i> ${finca.superficie || 0} ha / ${finca.altura || 0} msnm</p>
                </div>
            </div>`).join('');
    }

    function resetForm() {
        form.reset();
        editIdInput.value = '';
        document.getElementById('departamento').value = '';
        document.getElementById('provincia').value = '';
        document.getElementById('distrito').value = '';
        document.getElementById('ciudad').value = '';
        if(form.video_link) form.video_link.value = '';
        currentImages = [];
        currentFincaCertifications = [];
        currentFincaPremios = [];
        productorFotoPreview.src = 'https://placehold.co/100x100/e0e0e0/757575?text=Productor';
        fotoProductorHiddenInput.value = '';
        renderImagePreviews();
        renderAddedCertifications();
        renderAddedPremios();
        
        // Reset Map
        if (currentPolygon) { currentPolygon.setMap(null); currentPolygon = null; }
        if (drawingManager) drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
        if (map) { map.setCenter({ lat: -9.19, lng: -75.015 }); map.setZoom(5); }
        document.getElementById('coordenadas').value = '';

        formTitle.textContent = 'Nueva Finca';
        submitButton.textContent = 'Guardar Finca';
        submitButton.className = 'bg-amber-800 hover:bg-amber-900 text-white font-bold py-3 px-8 rounded-xl shadow-md';
        cancelEditBtn.classList.add('hidden');
    }

    async function populateFormForEdit(id) {
        try {
            const fincas = await api('/api/fincas');
            const finca = fincas.find(f => f.id === id);
            if (!finca) return;
            
            resetForm(); 

            form.propietario.value = finca.propietario || '';
            form.dni_ruc.value = finca.dni_ruc || '';
            form.nombre_finca.value = finca.nombre_finca || '';
            form.pais.value = finca.pais || '';
            form.departamento.value = finca.departamento || '';
            form.provincia.value = finca.provincia || '';
            form.distrito.value = finca.distrito || '';
            form.ciudad.value = finca.ciudad || ''; // Legacy/Referencia
            if(form.video_link) form.video_link.value = finca.video_link || '';

            form.altura.value = finca.altura || '';
            form.superficie.value = finca.superficie || '';
            form.telefono.value = finca.telefono || '';
            form.numero_trabajadores.value = finca.numero_trabajadores || '';
            form.historia.value = finca.historia || '';
            form.coordenadas.value = JSON.stringify(finca.coordenadas);
            editIdInput.value = finca.id;

            productorFotoPreview.src = finca.foto_productor || 'https://placehold.co/100x100/e0e0e0/757575?text=Productor';
            fotoProductorHiddenInput.value = finca.foto_productor || '';

            currentImages = finca.imagenes_json || [];
            currentFincaCertifications = finca.certificaciones_json || [];
            currentFincaPremios = finca.premios_json || [];
            renderImagePreviews();
            renderAddedCertifications();
            renderAddedPremios();
            
            if (finca.coordenadas) { 
                setMapData(finca.coordenadas);
            }
            formTitle.textContent = `Editando: ${finca.nombre_finca}`;
            submitButton.textContent = 'Actualizar Finca';
            submitButton.className = 'bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-md';
            cancelEditBtn.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) { alert('Error al cargar datos para editar.'); }
    }

    async function handleProductorFotoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert(`La imagen supera el límite de 5MB.`);
            e.target.value = '';
            return;
        }

        try {
            const compressedBase64 = await compressImage(file);
            productorFotoPreview.src = compressedBase64;
            fotoProductorHiddenInput.value = compressedBase64;
        } catch (error) {
            console.error("Error al procesar foto de productor:", error);
            alert("No se pudo procesar la imagen del productor.");
        }
    }

    // --- Lógica de Premios ---
    function handleAddPremio() {
        const premioId = parseInt(premioSelect.value, 10);
        const ano = premioYearInput.value;

        if (!premioId || !ano) {
            alert('Por favor, selecciona un premio y especifica el año.');
            return;
        }

        const premio = allPremios.find(p => p.id === premioId);
        if (premio) {
            const yaExiste = currentFincaPremios.some(p => p.id === premioId && p.ano === ano);
            if (yaExiste) {
                alert('Este premio ya ha sido añadido para el año especificado.');
                return;
            }
            currentFincaPremios.push({ id: premioId, nombre: premio.nombre, logo_url: premio.logo_url, ano });
            renderAddedPremios();
            premioSelect.value = '';
            premioYearInput.value = '';
        }
    }
    
    function handlePremioAction(e) {
        if (e.target.classList.contains('delete-premio-btn')) {
            const premioId = parseInt(e.target.dataset.id, 10);
            const ano = e.target.dataset.year;
            currentFincaPremios = currentFincaPremios.filter(p => !(p.id === premioId && p.ano === ano));
            renderAddedPremios();
        }
    }

    function renderAddedPremios() {
        premiosListContainer.innerHTML = currentFincaPremios.map(premio => `
            <div class="flex items-center justify-between p-2 border rounded-lg">
                <div class="flex items-center gap-3">
                    <img src="${premio.logo_url}" alt="${premio.nombre}" class="w-8 h-8 rounded-full">
                    <div>
                        <p class="font-semibold text-sm">${premio.nombre}</p>
                        <p class="text-xs text-stone-500">Año: ${premio.ano}</p>
                    </div>
                </div>
                <button type="button" data-id="${premio.id}" data-year="${premio.ano}" class="delete-premio-btn text-red-500 hover:text-red-700 font-bold">&times;</button>
            </div>
        `).join('');
    }
    
    // --- Manejo Galería de Fotos ---
    async function handleImageUpload(e) {
        const files = Array.from(e.target.files);
        if (!files || files.length === 0) return;

        if (currentImages.length + files.length > 5) {
            alert('Límite excedido: Solo se permiten un máximo de 5 fotos por finca.');
            e.target.value = ''; 
            return;
        }

        const submitButton = document.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = "Procesando imágenes...";
        submitButton.disabled = true;
        submitButton.classList.add('opacity-50', 'cursor-not-allowed');

        try {
            for (const file of files) {
                const fileSizeMB = file.size / (1024 * 1024);
                if (fileSizeMB > 5) {
                    alert(`La imagen "${file.name}" pesa ${fileSizeMB.toFixed(2)}MB. El límite es 5MB y será omitida.`);
                    continue; 
                }

                const compressedBase64 = await compressImage(file);
                currentImages.push(compressedBase64);
            }
            renderImagePreviews();
        } catch (error) {
            console.error("Error comprimiendo imagen:", error);
            alert("Hubo un error al procesar una de las imágenes.");
        } finally {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
            submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
            e.target.value = ''; 
        }
    }

    function handleImageDelete(e) {
        if (e.target.classList.contains('delete-img-btn')) {
            const index = parseInt(e.target.dataset.index, 10);
            currentImages.splice(index, 1);
            renderImagePreviews();
        }
    }

    function renderImagePreviews() {
        fotosPreviewContainer.innerHTML = currentImages.map((imgSrc, index) => `
            <div class="relative">
                <img src="${imgSrc}" class="w-full h-24 object-cover rounded-lg">
                <button type="button" data-index="${index}" class="delete-img-btn absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold">&times;</button>
            </div>
        `).join('');
    }
    
    function handleAddCertification() {
        const certId = parseInt(certSelect.value, 10);
        const expiryDate = certExpiryInput.value;

        if (!certId || !expiryDate) {
            alert('Por favor, selecciona una certificación y su fecha de vencimiento.');
            return;
        }
        
        if (currentFincaCertifications.some(c => c.id === certId)) {
            alert('Esta certificación ya ha sido añadida.');
            return;
        }

        const certification = allCertifications.find(c => c.id === certId);
        if (certification) {
            currentFincaCertifications.push({ id: certId, nombre: certification.nombre, logo_url: certification.logo_url, fecha_vencimiento: expiryDate });
            renderAddedCertifications();
            certSelect.value = '';
            certExpiryInput.value = '';
        }
    }
    
    function handleCertificationAction(e) {
        if (e.target.classList.contains('delete-cert-btn')) {
            const certId = parseInt(e.target.dataset.id, 10);
            currentFincaCertifications = currentFincaCertifications.filter(c => c.id !== certId);
            renderAddedCertifications();
        }
    }

    function renderAddedCertifications() {
        certsListContainer.innerHTML = currentFincaCertifications.map(cert => {
            const isExpired = new Date(cert.fecha_vencimiento) < new Date();
            const statusClass = isExpired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
            const statusText = isExpired ? 'Vencida' : 'Vigente';

            return `
                <div class="flex items-center justify-between p-2 border rounded-lg">
                    <div class="flex items-center gap-3">
                        <img src="${cert.logo_url}" alt="${cert.nombre}" class="w-8 h-8 rounded-full">
                        <div>
                            <p class="font-semibold text-sm">${cert.nombre}</p>
                            <p class="text-xs text-stone-500">Vence: ${cert.fecha_vencimiento}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                         <span class="text-xs font-medium px-2 py-1 rounded-full ${statusClass}">${statusText}</span>
                         <button type="button" data-id="${cert.id}" class="delete-cert-btn text-red-500 hover:text-red-700 font-bold">&times;</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const originalText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Guardando...';
        submitButton.classList.add('opacity-50', 'cursor-not-allowed');

        try {
            const formData = new FormData(form);
            const fincaData = Object.fromEntries(formData.entries());
            
            fincaData.imagenes_json = currentImages;
            fincaData.certificaciones_json = currentFincaCertifications;
            fincaData.premios_json = currentFincaPremios;
            
            if (fincaData.coordenadas) {
                try {
                    fincaData.coordenadas = JSON.parse(fincaData.coordenadas);
                } catch(e) {
                    fincaData.coordenadas = null;
                }
            } else {
                fincaData.coordenadas = null;
            }

            const payloadString = JSON.stringify(fincaData);
            const sizeInBytes = new TextEncoder().encode(payloadString).length;
            const sizeInMB = sizeInBytes / (1024 * 1024);

            if (sizeInMB > 4.0) {
                throw new Error(`El total de datos es demasiado pesado (${sizeInMB.toFixed(2)}MB). El límite es 4MB. Por favor reduce la cantidad de fotos.`);
            }

            const editId = editIdInput.value;
            
            if (editId) {
                await api(`/api/fincas/${editId}`, { 
                    method: 'PUT', 
                    body: payloadString 
                });
            } else {
                await api('/api/fincas', { 
                    method: 'POST', 
                    body: payloadString 
                });
            }
            
            alert('¡Finca guardada exitosamente!');
            resetForm();
            await loadFincas();

        } catch (error) { 
            console.error("Error al guardar:", error);
            alert('No se pudo guardar: ' + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
            submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    function handleFincaListClick(e) {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            populateFormForEdit(editBtn.dataset.id);
        }
        
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (confirm('¿Seguro que quieres eliminar esta finca?')) {
                api(`/api/fincas/${id}`, { method: 'DELETE' }).then(loadFincas);
            }
        }
    }

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1024;
                    const MAX_HEIGHT = 1024;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    // Helper API
    async function api(url, options = {}) {
        options.credentials = 'include'; 
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json'
        };
        
        const response = await fetch(url, options);
        if (response.status === 204) return null;
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    }

    window.shareFincaLink = async function(id, nombre) {
        try {
            // 1. Obtener Token
            const res = await api(`/api/fincas/${id}/share-token`, { method: 'POST' });
            const token = res.token;
            
            // 2. Construir URL
            const url = `${window.location.origin}/registro-productor?t=${token}`;
            
            // 3. Crear mensaje para WhatsApp
            const mensaje = `Hola! Por favor completa la información de la finca "${nombre}" en este enlace seguro: ${url}`;
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

            // 4. Mostrar opciones (Alert simple o Modal personalizado)
            // Usamos un prompt simple para permitir copiar rápido
            /*
            if(confirm(`Enlace generado:\n${url}\n\n¿Deseas enviar por WhatsApp ahora?`)) {
                window.open(whatsappUrl, '_blank');
            }
            */
           
           // Mejor UX: Copiar al portapapeles y avisar
           navigator.clipboard.writeText(mensaje).then(() => {
               if(confirm(`Enlace copiado al portapapeles.\n\n¿Quieres abrir WhatsApp para enviarlo?`)) {
                   window.open(whatsappUrl, '_blank');
               }
           });

        } catch (e) {
            alert("Error generando enlace: " + e.message);
        }
    };

});