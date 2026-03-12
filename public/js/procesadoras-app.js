window.initMap = function() {
    // Se sobrescribirá dentro de DOMContentLoaded
};

document.addEventListener('DOMContentLoaded', () => {
    // Referencias al DOM
    const form = document.getElementById('procesadora-form');
    const procesadorasList = document.getElementById('procesadoras-list');
    const editIdInput = document.getElementById('edit-id');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const formTitle = document.getElementById('form-title');

    const btnShowForm = document.getElementById('btn-show-form');
    const btnCloseForm = document.getElementById('btn-close-form');
    const btnCancel = document.getElementById('cancel-edit-btn');
    const listSection = document.getElementById('procesadoras-list-section');
    const formSection = document.getElementById('procesadora-section');

    function toggleView(showForm) {
        if (showForm) {
            // Mostrar Formulario y reducir lista
            console.log(1);
            listSection.classList.replace('lg:col-span-12', 'lg:col-span-4');
            formSection.classList.remove('hidden');
            btnShowForm.classList.add('hidden');
        } else {
            // Ocultar Formulario y expandir lista
            console.log(2);
            listSection.classList.replace('lg:col-span-4', 'lg:col-span-12');
            formSection.classList.add('hidden');
            btnShowForm.classList.remove('hidden');
        }
        // Disparar evento de resize para que Google Maps se ajuste al nuevo tamaño del contenedor
        setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    }

    btnShowForm.addEventListener('click', () => {
        resetForm();
        toggleView(true);
        setTimeout(() => rucInput.focus(), 400); // El delay es para esperar que termine la animación de toggleView
    });
    btnCloseForm.addEventListener('click', () => toggleView(false));
    btnCancel.addEventListener('click', () => toggleView(false));

    
    
    // Inputs del formulario
    const rucInput = document.getElementById('ruc');
    const searchRucBtn = document.getElementById('search-ruc-btn');
    const razonSocialInput = document.getElementById('razon_social');
    const direccionInput = document.getElementById('direccion');
    const departamentoInput = document.getElementById('departamento');
    const provinciaInput = document.getElementById('provincia');
    const distritoInput = document.getElementById('distrito');
    const tipoInput = document.getElementById('tipo');
    const paisInput = document.getElementById('pais');
    const ciudadInput = document.getElementById('ciudad');
    const telefonoInput = document.getElementById('telefono');
    const numeroTrabajadoresInput = document.getElementById('numero_trabajadores');
    const nombreComercialInput = document.getElementById('nombre_comercial');

    // Búsqueda en Mapa
    const locationSearchInput = document.getElementById('location-search');

    // Listas dinámicas y sus contenedores
    const certSelect = document.getElementById('certification-select');
    const certExpiryInput = document.getElementById('certification-expiry');
    const addCertBtn = document.getElementById('add-certification-btn');
    const certsListContainer = document.getElementById('certifications-list');
    
    const premioSelect = document.getElementById('premio-select');
    const premioYearInput = document.getElementById('premio-year');
    const addPremioBtn = document.getElementById('add-premio-btn');
    const premiosListContainer = document.getElementById('premios-list');
    
    const fotosInput = document.getElementById('fotos');
    const fotosPreviewContainer = document.getElementById('fotos-preview-container');

    // Estado local
    let currentImages = [];
    let currentCertifications = [];
    let currentPremios = [];
    let allPremios = [];
    let allCertifications = [];
    
    // Mapa Google (procesadora principal)
    let map;
    let marker;

    // --- SUCURSALES ---
    const sucursalesSection = document.getElementById('sucursales-section');
    const sucursalesList = document.getElementById('sucursales-list');
    const sucursalesProcessadoraNombre = document.getElementById('sucursales-procesadora-nombre');
    const addSucursalBtn = document.getElementById('add-sucursal-btn');
    const sucursalFormContainer = document.getElementById('sucursal-form-container');
    const sucursalForm = document.getElementById('sucursal-form');
    const sucursalFormTitle = document.getElementById('sucursal-form-title');
    const cancelSucursalBtn = document.getElementById('cancel-sucursal-btn');
    const sucursalEditId = document.getElementById('sucursal-edit-id');
    const sucNombre = document.getElementById('suc-nombre');
    const sucTipo = document.getElementById('suc-tipo');
    const sucPais = document.getElementById('suc-pais');
    const sucDepartamento = document.getElementById('suc-departamento');
    const sucProvincia = document.getElementById('suc-provincia');
    const sucCiudad = document.getElementById('suc-ciudad');
    const sucDistrito = document.getElementById('suc-distrito');
    const sucDireccion = document.getElementById('suc-direccion');
    const sucTelefono = document.getElementById('suc-telefono');
    const sucCoordenadas = document.getElementById('suc-coordenadas');
    const sucLocationSearch = document.getElementById('suc-location-search');

    let currentProcesadoraId = null;
    let currentProcesadoraNombre = null;
    let mapSucursal = null;
    let markerSucursal = null;

    // Inicialización
    init();

    async function init() {
        // Exponer initMap globalmente para el callback de Google
        window.initMap = initMap;
        
        setupEventListeners();

        if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
            initMap();
        }
        
        // Cargar datos
        try {
            await Promise.all([
                loadCertificationsData().catch(e => console.error("Error certs:", e)), 
                loadPremiosData().catch(e => console.error("Error premios:", e)), 
                loadProcesadoras().catch(e => console.error("Error procesadoras:", e))
            ]);
        } catch (error) {
            console.error("Error en inicialización de datos:", error);
        }
    }

    // --- MAPA GOOGLE (Procesadora Principal & Sucursal) ---
    function initMap() {
        if (map) return;
        const mapContainer = document.getElementById('map');
        if (!mapContainer || typeof google === 'undefined') return;
        
        try {
            const defaultLoc = { lat: -9.189967, lng: -75.015152 }; // Centro de Perú
            map = new google.maps.Map(mapContainer, {
                zoom: 5,
                center: defaultLoc,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false
            });

            marker = new google.maps.Marker({
                map: map,
                draggable: true,
                animation: google.maps.Animation.DROP
            });

            // Autocompletado Principal
            if (locationSearchInput) {
                const autocomplete = new google.maps.places.Autocomplete(locationSearchInput);
                autocomplete.bindTo("bounds", map);
                autocomplete.addListener("place_changed", () => {
                    const place = autocomplete.getPlace();
                    if (!place.geometry || !place.geometry.location) return;
                    
                    map.setCenter(place.geometry.location);
                    map.setZoom(17);
                    
                    // SEGURIDAD: Verificar que marker exista antes de moverlo
                    if (marker) marker.setPosition(place.geometry.location);
                    
                    updateCoordinatesInput(place.geometry.location, 'coordenadas');
                    fillAddressFields(place, "");
                });
            }

            // Click en Mapa Principal
            map.addListener("click", (e) => {
                if (marker) marker.setPosition(e.latLng);
                map.panTo(e.latLng);
                updateCoordinatesInput(e.latLng, 'coordenadas');
                reverseGeocode(e.latLng, "", "location-search");
            });

            // Arrastrar Pinche Principal
            if (marker) {
                marker.addListener("dragend", (e) => {
                    map.panTo(e.latLng);
                    updateCoordinatesInput(e.latLng, 'coordenadas');
                    reverseGeocode(e.latLng, "", "location-search");
                });
            }
        } catch(e) {
            console.error("Error inicializando Google Maps:", e);
        }
    }

    function initMapSucursal() {
        if (mapSucursal) return;
        const mapContainer = document.getElementById('map-sucursal');
        if (!mapContainer || typeof google === 'undefined') return;
        
        try {
            const defaultLoc = { lat: -9.189967, lng: -75.015152 };
            mapSucursal = new google.maps.Map(mapContainer, {
                zoom: 5,
                center: defaultLoc,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false
            });

            markerSucursal = new google.maps.Marker({
                map: mapSucursal,
                draggable: true,
                animation: google.maps.Animation.DROP
            });

            // Autocompletado Sucursal
            if (sucLocationSearch) {
                const autocompleteSuc = new google.maps.places.Autocomplete(sucLocationSearch);
                autocompleteSuc.bindTo("bounds", mapSucursal);
                autocompleteSuc.addListener("place_changed", () => {
                    const place = autocompleteSuc.getPlace();
                    if (!place.geometry || !place.geometry.location) return;
                    
                    mapSucursal.setCenter(place.geometry.location);
                    mapSucursal.setZoom(17);
                    
                    // SEGURIDAD: Verificar que markerSucursal exista
                    if (markerSucursal) markerSucursal.setPosition(place.geometry.location);
                    
                    updateCoordinatesInput(place.geometry.location, 'suc-coordenadas');
                    fillAddressFields(place, "suc-");
                });
            }

            // Click en Mapa Sucursal
            mapSucursal.addListener("click", (e) => {
                if (markerSucursal) markerSucursal.setPosition(e.latLng);
                mapSucursal.panTo(e.latLng);
                updateCoordinatesInput(e.latLng, 'suc-coordenadas');
                reverseGeocode(e.latLng, "suc-", "suc-location-search");
            });

            // Arrastrar Pinche Sucursal
            if (markerSucursal) {
                markerSucursal.addListener("dragend", (e) => {
                    mapSucursal.panTo(e.latLng);
                    updateCoordinatesInput(e.latLng, 'suc-coordenadas');
                    reverseGeocode(e.latLng, "suc-", "suc-location-search");
                });
            }
        } catch(e) {
            console.error("Error inicializando mapa sucursal:", e);
        }
    }

    // --- Helpers Mapa ---
    function updateCoordinatesInput(latLng, inputId) {
        const coords = { lat: latLng.lat(), lng: latLng.lng() };
        const el = document.getElementById(inputId);
        if (el) el.value = JSON.stringify(coords);
    }

    function reverseGeocode(latLng, prefixId, searchInputId) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: latLng }, (results, status) => {
            if (status === 'OK' && results[0]) {
                const searchInput = document.getElementById(searchInputId);
                if (searchInput) searchInput.value = results[0].formatted_address;
                fillAddressFields(results[0], prefixId);
            }
        });
    }

    function fillAddressFields(place, prefixId = "") {
        let addressData = { pais: '', departamento: '', provincia: '', distrito: '', direccion: '', ciudad: '' };

        if (place.address_components) {
            place.address_components.forEach(component => {
                const types = component.types;
                if (types.includes('country')) addressData.pais = component.long_name;
                if (types.includes('administrative_area_level_1')) addressData.departamento = component.long_name;
                if (types.includes('administrative_area_level_2')) addressData.provincia = component.long_name;
                if (types.includes('locality') || types.includes('administrative_area_level_3')) {
                    addressData.ciudad = component.long_name;
                    if(!addressData.distrito) addressData.distrito = component.long_name;
                }
                if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
                    addressData.distrito = component.long_name;
                }
                if (types.includes('route')) addressData.direccion = component.long_name;
                if (types.includes('street_number')) addressData.direccion += ' ' + component.long_name;
            });
        }
        //console.log(addressData.direccion);
        if (!addressData.direccion && place.name && !place.name.includes(addressData.provincia)) {
            addressData.direccion = place.name; 
        }

        const fields = ['pais', 'departamento', 'provincia', 'ciudad', 'distrito', 'direccion'];
        fields.forEach(f => {
            const el = document.getElementById(prefixId + f);
            if (el) {
                el.value = addressData[f].trim();
                if (el.value !== "") {
                    el.classList.remove('field-updated');
                    void el.offsetWidth; // trigger reflow
                    el.classList.add('field-updated');
                }
            }
        });
    }

    function setupEventListeners() {
        if(form) form.addEventListener('submit', handleFormSubmit);
        if(cancelEditBtn) cancelEditBtn.addEventListener('click', resetForm);
        if(procesadorasList) procesadorasList.addEventListener('click', handleListClick);
        
        if(fotosInput) fotosInput.addEventListener('change', handleImageUpload);
        if(addCertBtn) addCertBtn.addEventListener('click', handleAddCertification);
        if(certsListContainer) certsListContainer.addEventListener('click', handleCertificationAction);
        if(addPremioBtn) addPremioBtn.addEventListener('click', handleAddPremio);
        if(premiosListContainer) premiosListContainer.addEventListener('click', handlePremioAction);
        if(fotosPreviewContainer) fotosPreviewContainer.addEventListener('click', handleImageDelete);

        if (searchRucBtn) searchRucBtn.addEventListener('click', handleSearchRuc);

        // Sucursales
        if (addSucursalBtn) addSucursalBtn.addEventListener('click', () => showSucursalForm(null));
        if (cancelSucursalBtn) cancelSucursalBtn.addEventListener('click', hideSucursalForm);
        if (sucursalForm) sucursalForm.addEventListener('submit', handleSucursalFormSubmit);
        if (sucursalesList) sucursalesList.addEventListener('click', handleSucursalListClick);
    }

    // --- LÓGICA: BÚSQUEDA RUC ---
    async function handleSearchRuc() {
        const ruc = rucInput.value.trim();
        if (!ruc || ruc.length !== 11) {
            alert("Por favor ingrese un RUC válido de 11 dígitos.");
            return;
        }
        const originalHtml = searchRucBtn.innerHTML;
        searchRucBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        searchRucBtn.disabled = true;
        try {
            const response = await api(`/api/proxy/ruc/${ruc}`);
            if (response) {
                razonSocialInput.value = response.razon_social || '';
                direccionInput.value = response.direccion || '';
                departamentoInput.value = response.departamento || '';
                provinciaInput.value = response.provincia || '';
                distritoInput.value = response.distrito || '';
                
                razonSocialInput.classList.remove('field-updated');
                void razonSocialInput.offsetWidth;
                razonSocialInput.classList.add('field-updated');
            }
        } catch (error) {
            console.error(error);
            alert("No se encontraron datos para este RUC o hubo un error en la consulta.");
        } finally {
            searchRucBtn.innerHTML = originalHtml;
            searchRucBtn.disabled = false;
        }
    }

    // --- API CALLS & CRUD PROCESADORAS ---
    async function loadProcesadoras() {
        try {
            const data = await api('/api/procesadoras');
            renderList(data);
        } catch(e) { console.error(e); }
    }

    const TIPO_LABELS = {
        ACOPIADORA: 'Acopiadora', TOSTADORA: 'Tostadora', CHOCOLATERIA: 'Chocolatería',
        CAFETERIA: 'Cafetería', LABORATORIO: 'Laboratorio', EXPORTADORA: 'Exportadora'
    };

    const TIPO_COLORS = {
        ACOPIADORA: 'bg-blue-100 text-blue-800', TOSTADORA: 'bg-orange-100 text-orange-800',
        CHOCOLATERIA: 'bg-amber-100 text-amber-800', CAFETERIA: 'bg-green-100 text-green-800',
        LABORATORIO: 'bg-purple-100 text-purple-800', EXPORTADORA: 'bg-sky-100 text-sky-800'
    };

    function renderList(list) {
        if (!procesadorasList) return;
        procesadorasList.innerHTML = list.length === 0 ? 
            '<p class="text-stone-500 text-center py-4">No hay procesadoras registradas.</p>' : 
            list.map(p => {
                const pid = p.id || p._id; // Soporte robusto si el backend devuelve _id
                const tipoLabel = p.tipo ? TIPO_LABELS[p.tipo] || p.tipo : null;
                const tipoColor = p.tipo ? (TIPO_COLORS[p.tipo] || 'bg-stone-100 text-stone-700') : '';
                const isActive = String(pid) === String(currentProcesadoraId); // Comparación estricta segura

                return `
                <div class="p-4 border rounded-xl ${isActive ? 'bg-amber-50 border-amber-300' : 'bg-stone-50'} hover:shadow-sm transition">
                    <div class="flex justify-between items-start">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <h3 class="font-bold text-amber-900 truncate">${p.nombre_comercial || p.razon_social}</h3>
                                ${tipoLabel ? `<span class="text-xs font-semibold px-2 py-0.5 rounded-full ${tipoColor}">${tipoLabel}</span>` : ''}
                            </div>
                            <p class="text-xs text-stone-500 mt-1">RUC: ${p.ruc}</p>
                            <p class="text-xs text-stone-500 truncate">${p.distrito || ''}${p.distrito && p.provincia ? ', ' : ''}${p.provincia || ''} ${p.departamento ? '- ' + p.departamento : ''}</p>
                        </div>
                        <div class="flex gap-1 flex-shrink-0 ml-2">
                            <button data-id="${pid}" data-nombre="${p.nombre_comercial || p.razon_social}" class="sucursales-btn text-green-600 hover:bg-green-100 p-2 rounded transition" title="Ver Sucursales"><i class="fas fa-store"></i></button>
                            <button data-id="${pid}" class="edit-btn text-sky-600 hover:bg-sky-100 p-2 rounded transition"><i class="fas fa-pen"></i></button>
                            <button data-id="${pid}" class="delete-btn text-red-600 hover:bg-red-100 p-2 rounded transition"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            `}).join('');
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn ? submitBtn.innerText : 'Guardar';
        if(submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.imagenes_json = currentImages;
        data.certificaciones_json = currentCertifications;
        data.premios_json = currentPremios;
        
        if (!data.coordenadas || data.coordenadas.trim() === "") {
             data.coordenadas = null;
        } else {
             try { JSON.parse(data.coordenadas); } catch(e) { data.coordenadas = null; }
        }
        if(data.numero_trabajadores === "") delete data.numero_trabajadores;
        if(!data.tipo) data.tipo = null;

        const editId = editIdInput.value;
        try {
            if (editId) {
                await api(`/api/procesadoras/${editId}`, { method: 'PUT', body: JSON.stringify(data) });
            } else {
                await api('/api/procesadoras', { method: 'POST', body: JSON.stringify(data) });
            }
            resetForm();
            await loadProcesadoras();
        } catch (error) {
            console.error("Error al guardar:", error);
            alert('Error al guardar: ' + error.message);
        } finally {
            if(submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = originalText;
            }
        }
    }

    async function handleListClick(e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        
        const id = btn.dataset.id;
        if (!id || id === "undefined" || id === "null") {
            console.error("El botón no tiene un ID válido asociado:", btn.dataset);
            alert("Error: No se pudo obtener el identificador de esta procesadora.");
            return;
        }

        if (btn.classList.contains('delete-btn')) {
            if (confirm("¿Eliminar procesadora? También se eliminarán sus sucursales.")) {
                await api(`/api/procesadoras/${id}`, { method: 'DELETE' });
                if (currentProcesadoraId === id) {
                    hideSucursalesSection();
                }
                loadProcesadoras();
            }
        }
        if (btn.classList.contains('edit-btn')) {
            populateForm(id);
            toggleView(true);
        }
        if (btn.classList.contains('sucursales-btn')) {
            const nombre = btn.dataset.nombre;
            loadSucursalesSection(id, nombre);
        }
    }

    async function populateForm(id) {
        try {
            const list = await api('/api/procesadoras');
            const item = list.find(x => String(x.id || x._id) === String(id)); // Búsqueda estricta corregida
            if (!item) return;

            resetForm();
            editIdInput.value = item.id || item._id;
            formTitle.textContent = "Editar Procesadora";
            cancelEditBtn.classList.remove('hidden');
            
            const submitBtn = form.querySelector('button[type="submit"]');
            if(submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar';

            // Llenar inputs
            ['ruc', 'razon_social', 'nombre_comercial', 'tipo', 'direccion', 'telefono', 
             'numero_trabajadores', 'ciudad', 'pais', 'departamento', 'provincia', 
             'distrito', 'historia', 'video_link'].forEach(field => {
                const el = document.getElementById(field);
                if (el) el.value = item[field] || '';
            });

            currentImages = item.imagenes_json || [];
            currentCertifications = item.certificaciones_json || [];
            currentPremios = item.premios_json || [];
            renderImages();
            renderAddedCertifications();
            renderAddedPremios();

            // Ubicar en el mapa
            if (item.coordenadas && item.coordenadas.lat && map) {
                const latLng = new google.maps.LatLng(item.coordenadas.lat, item.coordenadas.lng);
                if (marker) marker.setPosition(latLng);
                map.setCenter(latLng);
                map.setZoom(15);
                document.getElementById('coordenadas').value = JSON.stringify(item.coordenadas);
            }

            currentProcesadoraId = item.id || item._id;
            currentProcesadoraNombre = item.nombre_comercial || item.razon_social;
            sucursalesProcessadoraNombre.textContent = `Procesadora: ${currentProcesadoraNombre}`;
            sucursalesSection.classList.remove('hidden');
            hideSucursalForm();
            loadSucursales();

            form.scrollIntoView({ behavior: 'smooth' });
        } catch(e) { console.error("Error populando form:", e); }
    }

    function resetForm() {
        form.reset();
        editIdInput.value = '';
        currentImages = [];
        currentCertifications = [];
        currentPremios = [];
        
        // Reset Map Principal sin destruir el marker
        if (map) {
            map.setCenter({ lat: -9.189967, lng: -75.015152 }); 
            map.setZoom(5); 
        }
        if (marker) marker.setPosition(null); // Oculta el pinche, NO destruye la variable

        document.getElementById('coordenadas').value = '';
        if (locationSearchInput) locationSearchInput.value = '';
        if (document.getElementById('historia')) document.getElementById('historia').value = '';

        renderImages();
        renderAddedCertifications();
        renderAddedPremios();
        formTitle.textContent = "Nueva Procesadora";
        
        const submitBtn = form.querySelector('button[type="submit"]');
        if(submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Procesadora';
        cancelEditBtn.classList.add('hidden');

        hideSucursalesSection();
    }

    // ============================================================
    // --- SUCURSALES LOGIC ---
    // ============================================================

    async function loadSucursalesSection(procesadoraId, nombre) {
        currentProcesadoraId = procesadoraId; // Se asigna de forma segura aquí
        currentProcesadoraNombre = nombre;
        sucursalesProcessadoraNombre.textContent = `Procesadora: ${nombre}`;
        sucursalesSection.classList.remove('hidden');
        hideSucursalForm();
        await loadSucursales();
        sucursalesSection.scrollIntoView({ behavior: 'smooth' });
        
        // Highlight active
        const list = await api('/api/procesadoras').catch(() => []);
        renderList(list);
    }

    function hideSucursalesSection() {
        currentProcesadoraId = null;
        currentProcesadoraNombre = null;
        sucursalesSection.classList.add('hidden');
    }

    async function loadSucursales() {
        if (!currentProcesadoraId || currentProcesadoraId === "undefined" || currentProcesadoraId === "null") return;
        try {
            const data = await api(`/api/procesadoras/${currentProcesadoraId}/sucursales`);
            renderSucursalesList(data);
        } catch(e) {
            console.error(e);
            sucursalesList.innerHTML = '<p class="text-red-500 text-sm">Error al cargar sucursales.</p>';
        }
    }

    const TIPO_SUC_LABELS = {
        PLANTA: 'Planta', CAFETERIA: 'Cafetería', PUNTO_VENTA: 'Punto de Venta',
        LABORATORIO: 'Laboratorio', ALMACEN: 'Almacén', OFICINA: 'Oficina'
    };

    function renderSucursalesList(list) {
        if (list.length === 0) {
            sucursalesList.innerHTML = '<p class="text-stone-400 text-center py-4 text-sm bg-stone-50 border border-dashed rounded-xl">No hay sucursales registradas. Agrega la primera.</p>';
            return;
        }
        sucursalesList.innerHTML = list.map(s => {
            const sid = s.id || s._id; // Soporte _id para la sucursal también
            return `
            <div class="flex items-center justify-between p-4 bg-stone-50 border border-stone-200 rounded-xl hover:shadow-sm transition">
                <div>
                    <p class="font-bold text-stone-800 text-sm">${s.nombre_sucursal}</p>
                    <p class="text-xs text-stone-500 mt-1">${s.tipo_sucursal ? (TIPO_SUC_LABELS[s.tipo_sucursal] || s.tipo_sucursal) + ' · ' : ''}${s.direccion || ''}${s.ciudad ? ', ' + s.ciudad : ''}${s.distrito ? ' - ' + s.distrito : ''}</p>
                    ${s.telefono ? `<p class="text-xs text-stone-400 mt-1"><i class="fas fa-phone mr-1"></i>${s.telefono}</p>` : ''}
                </div>
                <div class="flex gap-1 flex-shrink-0 ml-2">
                    <button data-id="${sid}" class="edit-suc-btn text-sky-600 hover:bg-sky-100 p-2 rounded transition text-sm"><i class="fas fa-pen"></i></button>
                    <button data-id="${sid}" class="delete-suc-btn text-red-600 hover:bg-red-100 p-2 rounded transition text-sm"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `}).join('');
    }

    function showSucursalForm(sucursal = null) {
        sucursalFormContainer.classList.remove('hidden');
        sucursalEditId.value = '';
        sucursalForm.reset();
        sucCoordenadas.value = '';
        sucursalFormTitle.textContent = sucursal ? 'Editar Sucursal' : 'Nueva Sucursal';

        if (sucursal) {
            sucursalEditId.value = sucursal.id || sucursal._id;
            sucNombre.value = sucursal.nombre_sucursal || '';
            sucTipo.value = sucursal.tipo_sucursal || '';
            sucPais.value = sucursal.pais || 'Perú';
            sucDepartamento.value = sucursal.departamento || '';
            sucProvincia.value = sucursal.provincia || '';
            sucCiudad.value = sucursal.ciudad || '';
            sucDistrito.value = sucursal.distrito || '';
            sucDireccion.value = sucursal.direccion || '';
            sucTelefono.value = sucursal.telefono || '';
            if (sucursal.coordenadas && sucursal.coordenadas.lat) {
                sucCoordenadas.value = JSON.stringify(sucursal.coordenadas);
            }
        }

        // Init or re-center the sucursal map
        setTimeout(() => {
            if (!mapSucursal) {
                initMapSucursal();
            } else {
                google.maps.event.trigger(mapSucursal, 'resize');
            }

            if (sucursal && sucursal.coordenadas && sucursal.coordenadas.lat && mapSucursal) {
                const latLng = new google.maps.LatLng(sucursal.coordenadas.lat, sucursal.coordenadas.lng);
                if (markerSucursal) markerSucursal.setPosition(latLng);
                mapSucursal.setCenter(latLng);
                mapSucursal.setZoom(15);
            } else if (mapSucursal && (!sucursal || !sucursal.coordenadas)) {
                if (markerSucursal) markerSucursal.setPosition(null);
                mapSucursal.setCenter({ lat: -9.189967, lng: -75.015152 });
                mapSucursal.setZoom(5);
            }
        }, 100);

        sucursalFormContainer.scrollIntoView({ behavior: 'smooth' });
    }

    function hideSucursalForm() {
        sucursalFormContainer.classList.add('hidden');
        sucursalForm.reset();
        sucursalEditId.value = '';
        sucCoordenadas.value = '';
        if (sucLocationSearch) sucLocationSearch.value = '';
        if (markerSucursal) markerSucursal.setPosition(null); // Nunca hacer = null
    }

    async function handleSucursalFormSubmit(e) {
        e.preventDefault();

        // VALIDADOR ANTI-FALLO SILENCIOSO
        if (!currentProcesadoraId || currentProcesadoraId === "undefined" || currentProcesadoraId === "null") {
            console.error("No se puede guardar: currentProcesadoraId es inválido:", currentProcesadoraId);
            alert("Error crítico: No se ha detectado a qué procesadora pertenece esta sucursal. Por favor, selecciona la procesadora de la lista nuevamente.");
            return; 
        }

        const submitBtn = sucursalForm.querySelector('button[type="submit"]');
        const originalText = submitBtn ? submitBtn.innerText : 'Guardar Sucursal';
        if (submitBtn) { 
            submitBtn.disabled = true; 
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...'; 
        }

        let coordsValue = null;
        if (sucCoordenadas.value) {
            try { coordsValue = JSON.parse(sucCoordenadas.value); } catch(e) {}
        }

        const data = {
            nombre_sucursal: sucNombre.value,
            tipo_sucursal: sucTipo.value || null,
            pais: sucPais.value || null,
            departamento: sucDepartamento.value || null,
            provincia: sucProvincia.value || null,
            ciudad: sucCiudad.value || null,
            distrito: sucDistrito.value || null,
            direccion: sucDireccion.value || null,
            telefono: sucTelefono.value || null,
            coordenadas: coordsValue
        };

        const editId = sucursalEditId.value;
        try {
            if (editId) {
                await api(`/api/procesadoras/${currentProcesadoraId}/sucursales/${editId}`, { method: 'PUT', body: JSON.stringify(data) });
            } else {
                await api(`/api/procesadoras/${currentProcesadoraId}/sucursales`, { method: 'POST', body: JSON.stringify(data) });
            }
            hideSucursalForm();
            await loadSucursales();
        } catch (error) {
            console.error("Error al guardar sucursal:", error);
            alert('Error al guardar sucursal: ' + error.message);
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = originalText; }
        }
    }

    async function handleSucursalListClick(e) {
        const btn = e.target.closest('button');
        if (!btn || !currentProcesadoraId) return;
        
        const id = btn.dataset.id;
        if (!id || id === "undefined" || id === "null") {
            alert("Error: No se pudo identificar la sucursal seleccionada.");
            return;
        }

        if (btn.classList.contains('delete-suc-btn')) {
            if (confirm("¿Eliminar esta sucursal?")) {
                await api(`/api/procesadoras/${currentProcesadoraId}/sucursales/${id}`, { method: 'DELETE' });
                await loadSucursales();
            }
        }
        if (btn.classList.contains('edit-suc-btn')) {
            try {
                const list = await api(`/api/procesadoras/${currentProcesadoraId}/sucursales`);
                const suc = list.find(s => String(s.id || s._id) === String(id)); // Búsqueda estricta corregida
                if (suc) showSucursalForm(suc);
            } catch(e) { console.error(e); }
        }
    }

    // --- Helpers de Carga de Datos ---
    async function loadCertificationsData() {
        const res = await fetch('/data/certifications.json');
        if(!res.ok) throw new Error("Error loading certifications");
        const data = await res.json();
        allCertifications = data.certifications;
        if(certSelect) certSelect.innerHTML = `<option value="">Seleccionar...</option>` + allCertifications.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    }
    
    async function loadPremiosData() {
        const res = await fetch('/data/premios.json');
        if(!res.ok) throw new Error("Error loading premios");
        const data = await res.json();
        allPremios = data.premios;
        const flatPremios = [...(allPremios.chocolate || []), ...(allPremios.cafe || []), ...(allPremios.miel || [])];
        const uniquePremios = [...new Map(flatPremios.map(item => [item['nombre'], item])).values()];
        if(premioSelect) premioSelect.innerHTML = `<option value="">Seleccionar...</option>` + uniquePremios.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');
    }

    // --- Manejadores de Multimedia y Arrays ---
    async function handleImageUpload(e) {
        const files = Array.from(e.target.files);
        try {
            const compressionPromises = files.map(file => compressImage(file));
            const compressedImages = await Promise.all(compressionPromises);
            currentImages.push(...compressedImages);
            renderImages();
        } catch (error) {
            console.error("Error al procesar las imágenes:", error);
            alert("Hubo un error al comprimir alguna de las imágenes.");
        }
        e.target.value = '';
    }

    function handleImageDelete(e) {
        const btn = e.target.closest('.delete-img-btn');
        if (btn) {
            const index = parseInt(btn.dataset.index, 10);
            currentImages.splice(index, 1);
            renderImages();
        }
    }

    function renderImages() {
        if(!fotosPreviewContainer) return;
        fotosPreviewContainer.innerHTML = currentImages.map((img, i) => 
            `<div class="relative group">
                <img src="${img}" class="w-full h-24 object-cover rounded-lg">
                <button type="button" data-index="${i}" class="delete-img-btn absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition shadow-md">&times;</button>
             </div>`
        ).join('');
    }

    function handleAddCertification() {
        const certId = parseInt(certSelect.value);
        const expiry = certExpiryInput.value;
        const certObj = allCertifications.find(c => c.id === certId);
        if (certObj) {
            currentCertifications.push({ ...certObj, expiry });
            renderAddedCertifications();
        }
    }

    function handleCertificationAction(e) {
        const btn = e.target.closest('.delete-cert-btn');
        if (btn) {
            const index = parseInt(btn.dataset.index, 10);
            currentCertifications.splice(index, 1);
            renderAddedCertifications();
        }
    }

    function renderAddedCertifications() {
        if(!certsListContainer) return;
        certsListContainer.innerHTML = currentCertifications.map((c, i) => 
            `<div class="flex justify-between items-center bg-stone-100 p-2 px-3 rounded-lg mb-2 text-sm">
                <span><i class="fas fa-certificate text-amber-600 mr-2"></i>${c.nombre} ${c.expiry ? `(Vence: ${c.expiry})` : ''}</span>
                <button type="button" class="delete-cert-btn text-red-500 hover:bg-red-100 rounded-full w-6 h-6 flex items-center justify-center transition" data-index="${i}">&times;</button>
             </div>`
        ).join('');
    }

    function handleAddPremio() {
        const name = premioSelect.value;
        const year = premioYearInput.value;
        if (name && year) {
            const pObj = allPremios.chocolate?.find(p => p.nombre === name) || { nombre: name, logo_url: '' };
            currentPremios.push({ nombre: name, year, logo_url: pObj.logo_url });
            renderAddedPremios();
        }
    }

    function handlePremioAction(e) {
        const btn = e.target.closest('.delete-premio-btn');
        if (btn) {
            const index = parseInt(btn.dataset.index, 10);
            currentPremios.splice(index, 1);
            renderAddedPremios();
        }
    }

    function renderAddedPremios() {
        if(!premiosListContainer) return;
        premiosListContainer.innerHTML = currentPremios.map((p, i) => 
            `<div class="flex justify-between items-center bg-stone-100 p-2 px-3 rounded-lg mb-2 text-sm">
                <span><i class="fas fa-award text-amber-600 mr-2"></i>${p.nombre} (${p.year})</span>
                <button type="button" class="delete-premio-btn text-red-500 hover:bg-red-100 rounded-full w-6 h-6 flex items-center justify-center transition" data-index="${i}">&times;</button>
             </div>`
        ).join('');
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
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    } else {
                        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
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

    // API Helper
    async function api(url, options = {}) {
        options.credentials = 'include';
        options.headers = { ...options.headers, 'Content-Type': 'application/json' };
        const response = await fetch(url, options);
        if (response.status === 401) {
            window.location.href = '/login.html';
            throw new Error('No autorizado');
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error HTTP ${response.status}`);
        }
        if (response.status === 204) return null;
        return response.json();
    }
});