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
    
    let map = L.map('map').setView([-12.046374, -77.042793], 6); // Centrado en Perú
    let drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    let currentPolygon = null;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItems },
        draw: {
            polyline: false, marker: false, circle: false,
            rectangle: false, circlemarker: false,
            polygon: {
                allowIntersection: false,
                shapeOptions: { color: '#854d0e' }
            }
        }
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e) => {
        drawnItems.clearLayers();
        currentPolygon = e.layer;
        drawnItems.addLayer(currentPolygon);
        const latlngs = currentPolygon.getLatLngs()[0].map(p => [p.lat, p.lng]);
        document.getElementById('coordenadas').value = JSON.stringify(latlngs);
    });
    
    map.on(L.Draw.Event.EDITED, (e) => {
        const layers = e.layers;
        layers.eachLayer(layer => {
            currentPolygon = layer;
            const latlngs = currentPolygon.getLatLngs()[0].map(p => [p.lat, p.lng]);
            document.getElementById('coordenadas').value = JSON.stringify(latlngs);
        });
    });

    async function init() {
        await Promise.all([loadCountries(), loadCertifications(), loadPremios(), loadFincas()]);
        setupEventListeners();
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
        
        if (!coordsValue) {
            alert("Por favor, dibuja el polígono de la finca en el mapa antes de validar.");
            return;
        }

        // Preparar polígono para el backend (formato GeoJSON para GEE)
        let polygonCoords;
        try {
            const parsed = JSON.parse(coordsValue);
            // Leaflet usa [lat, lng], pero GeoJSON usa [lng, lat]
            if (Array.isArray(parsed)) {
                polygonCoords = parsed.map(p => [p[1], p[0]]); // Invertir a [lng, lat]
                // Cerrar el polígono (primer punto = último punto)
                if (polygonCoords.length > 0) {
                    const first = polygonCoords[0];
                    const last = polygonCoords[polygonCoords.length - 1];
                    if (first[0] !== last[0] || first[1] !== last[1]) {
                        polygonCoords.push(first);
                    }
                }
            } else {
                alert("Para la validación de deforestación se requiere dibujar un área (polígono), no un punto.");
                return;
            }
        } catch(e) {
            console.error("Error procesando coordenadas:", e);
            alert("Error en el formato de coordenadas.");
            return;
        }

        // 1. Mostrar Modal y Estado de Carga
        analysisModal.classList.remove('hidden');
        analysisLoading.classList.remove('hidden');
        analysisSuccess.classList.add('hidden');
        scanLine.classList.remove('hidden'); // Activar efecto de escaneo en mapa

        // Actualizar textos para reflejar la integración con GEE
        const loadingText = analysisLoading.querySelector('p');
        if(loadingText) loadingText.textContent = "Conectando con Google Earth Engine (Dataset Hansen/UMD)...";

        try {
            // 2. Llamada real al Backend (Proxy a GEE)
            // Se asume que existe el endpoint POST /api/validate-deforestation
            const response = await api('/api/validate-deforestation', {
                method: 'POST',
                body: JSON.stringify({ 
                    type: 'Polygon', 
                    coordinates: [polygonCoords] 
                })
            });

            // 3. Procesar Resultado
            analysisLoading.classList.add('hidden');
            scanLine.classList.add('hidden');

            if (response.compliant) {
                analysisSuccess.classList.remove('hidden');
                
                const successText = analysisSuccess.querySelector('p');
                const lossPercent = response.loss_percentage !== undefined ? response.loss_percentage.toFixed(4) : "0.0000";
                
                if(successText) successText.textContent = `Cobertura arbórea estable. Pérdida detectada: ${lossPercent}% (Umbral EUDR < 0.1%).`;

                // 4. Agregar Certificado Automáticamente
                const eudrCert = {
                    id: Date.now(), // ID temporal único
                    nombre: "EUDR Compliant - GEE Verified",
                    logo_url: "https://placehold.co/50x50/34a853/ffffff?text=GEE", // Logo placeholder
                    fecha_vencimiento: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], // Vence en 1 año
                    metadata: {
                        source: "Google Earth Engine",
                        dataset: "UMD/hansen/global_forest_change_2023_v1_11",
                        validation_date: new Date().toISOString()
                    }
                };

                // Verificar si ya existe para no duplicar
                const exists = currentFincaCertifications.some(c => c.nombre.includes("EUDR") || c.nombre.includes("GEE"));
                if (!exists) {
                    currentFincaCertifications.push(eudrCert);
                    renderAddedCertifications();
                }
            } else {
                // Caso: No cumple (Deforestación detectada) o Error en análisis
                analysisModal.classList.add('hidden');
                const lossMsg = response.loss_percentage ? `(${response.loss_percentage}% detectado)` : '';
                alert(`⚠️ ALERTA: Se detectó pérdida de cobertura arbórea en el área ${lossMsg}. No se puede emitir el certificado automático.`);
            }

        } catch (error) {
            console.error("Error en validación GEE:", error);
            analysisLoading.classList.add('hidden');
            scanLine.classList.add('hidden');
            analysisModal.classList.add('hidden');
            
            // Mensaje amigable si el backend aún no tiene el endpoint
            if (error.message.includes("404")) {
                alert("El servicio de validación satelital no está disponible en este momento (Endpoint no configurado).");
            } else {
                alert("Error al conectar con el servicio de validación: " + error.message);
            }
        }
    }

    async function loadPremios() {
        try {
            const data = await fetch('/data/premios.json').then(res => res.json());
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
        fincasList.innerHTML = fincas.length === 0 ? '<p class="text-stone-500 text-center">No hay fincas registradas.</p>' : fincas.map(finca => `
            <div class="p-4 border rounded-xl bg-stone-50">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold text-lg text-amber-900">${finca.nombre_finca}</h3>
                        <p class="text-sm text-stone-600">${finca.propietario} - ${finca.dni_ruc}</p>
                        <p class="text-sm text-stone-500">${finca.ciudad || 'N/A'}, ${finca.pais || 'N/A'} - ${finca.altura || 'S/A'} msnm</p>
                        <p class="text-sm text-stone-500">Tel: ${finca.telefono || 'N/A'}</p>
                    </div>
                    <div class="flex gap-2 flex-shrink-0">
                        <button data-id="${finca.id}" class="edit-btn text-sm bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded-lg">Editar</button>
                        <button data-id="${finca.id}" class="delete-btn text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg">Eliminar</button>
                    </div>
                </div>
            </div>`).join('');
    }

    function resetForm() {
        form.reset();
        editIdInput.value = '';
        currentImages = [];
        currentFincaCertifications = [];
        currentFincaPremios = [];
        productorFotoPreview.src = 'https://placehold.co/100x100/e0e0e0/757575?text=Productor';
        fotoProductorHiddenInput.value = '';
        renderImagePreviews();
        renderAddedCertifications();
        renderAddedPremios();
        if (currentPolygon) drawnItems.removeLayer(currentPolygon);
        drawnItems.clearLayers(); currentPolygon = null;
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
            form.ciudad.value = finca.ciudad || '';
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
                // Asegurarse de que Leaflet entienda las coordenadas (si son polígono)
                // Tu código backend guarda [[lat,lng],...]
                // Leaflet.polygon espera ese mismo formato
                const polygon = L.polygon(finca.coordenadas, { color: '#854d0e' }); 
                drawnItems.addLayer(polygon); 
                currentPolygon = polygon; 
                map.fitBounds(polygon.getBounds()); 
            }
            formTitle.textContent = `Editando: ${finca.nombre_finca}`;
            submitButton.textContent = 'Actualizar Finca';
            submitButton.className = 'bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-md';
            cancelEditBtn.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) { alert('Error al cargar datos para editar.'); }
    }

    function handleProductorFotoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            productorFotoPreview.src = reader.result;
            fotoProductorHiddenInput.value = reader.result;
        };
        reader.readAsDataURL(file);
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
    
    function handleImageUpload(e) {
        const files = Array.from(e.target.files);
        if (!files) return;

        if (currentImages.length + files.length > 5) {
            alert('Puedes subir un máximo de 5 fotos.');
            return;
        }
        
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                currentImages.push(reader.result);
                renderImagePreviews();
            };
            reader.readAsDataURL(file);
        });
        e.target.value = ''; 
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
        const formData = new FormData(form);
        const fincaData = Object.fromEntries(formData.entries());
        
        fincaData.imagenes_json = currentImages;
        fincaData.certificaciones_json = currentFincaCertifications;
        fincaData.premios_json = currentFincaPremios;
        
        if (fincaData.coordenadas) fincaData.coordenadas = JSON.parse(fincaData.coordenadas);
        else fincaData.coordenadas = null;

        const editId = editIdInput.value;
        try {
            if (editId) {
                await api(`/api/fincas/${editId}`, { method: 'PUT', body: JSON.stringify(fincaData) });
            } else {
                await api('/api/fincas', { method: 'POST', body: JSON.stringify(fincaData) });
            }
            resetForm();
            await loadFincas();
            alert('Finca guardada exitosamente.');
        } catch (error) { 
            console.error("Error al guardar:", error);
            alert('Error al guardar la finca.'); 
        }
    }

    function handleFincaListClick(e) {
        if (e.target.classList.contains('edit-btn')) {
            populateFormForEdit(e.target.dataset.id);
        }
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            if (confirm('¿Seguro que quieres eliminar esta finca?')) {
                api(`/api/fincas/${id}`, { method: 'DELETE' }).then(loadFincas);
            }
        }
    }
    
    async function searchLocation() {
        const query = searchInput.value;
        if (!query) return;
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
        const data = await response.json();
        if (data && data.length > 0) {
            const { lat, lon } = data[0];
            map.setView([lat, lon], 13);
        } else {
            alert('Ubicación no encontrada.');
        }
    }

    function locateUser() {
        map.locate({ setView: true, maxZoom: 16 });
    }

    init();
});