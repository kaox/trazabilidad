window.initMap = function() {
    // Se sobrescribirá dentro de DOMContentLoaded
};

document.addEventListener('DOMContentLoaded', () => {
    // Referencias al DOM
    const form = document.getElementById('procesadora-form');
    const procesadorasList = document.getElementById('procesadoras-list');
    const editIdInput = document.getElementById('edit-id');
    const submitButton = form.querySelector('button[type="submit"]');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const formTitle = document.getElementById('form-title');
    
    // Inputs del formulario
    const rucInput = document.getElementById('ruc');
    const searchRucBtn = document.getElementById('search-ruc-btn');
    const razonSocialInput = document.getElementById('razon_social');
    const direccionInput = document.getElementById('direccion');
    const departamentoInput = document.getElementById('departamento');
    const provinciaInput = document.getElementById('provincia');
    const distritoInput = document.getElementById('distrito');
    // Otros inputs
    const paisInput = document.getElementById('pais');
    const ciudadInput = document.getElementById('ciudad');
    const telefonoInput = document.getElementById('telefono');
    const numeroTrabajadoresInput = document.getElementById('numero_trabajadores');
    const nombreComercialInput = document.getElementById('nombre_comercial');

    // Búsqueda en Mapa
    const locationSearchInput = document.getElementById('location-search');
    const searchLocationBtn = document.getElementById('search-btn');

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
    
    // Mapa Google
    let map;
    let marker;

    // Inicialización
    init();

    async function init() {
        // Exponer initMap globalmente para el callback de Google si fuera necesario
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

    // --- MAPA GOOGLE ---
    function initMap() {
        // Evitar reinicializar si ya existe
        if (map) return;

        const mapContainer = document.getElementById('map');
        if (!mapContainer || typeof google === 'undefined') return;

        try {
            // Coordenadas por defecto (Centro de Perú)
            const defaultLoc = { lat: -9.19, lng: -75.015 };
            
            map = new google.maps.Map(mapContainer, {
                zoom: 5,
                center: defaultLoc,
                mapTypeId: 'roadmap',
                streetViewControl: false
            });

            // Listener para clic en el mapa
            map.addListener("click", (e) => {
                placeMarker(e.latLng);
            });

        } catch(e) {
            console.error("Error inicializando Google Maps:", e);
        }
    }

    function placeMarker(latLng) {
        // Eliminar marcador anterior si existe
        if (marker) {
            marker.setMap(null);
        }
        
        // Crear nuevo marcador
        marker = new google.maps.Marker({
            position: latLng,
            map: map,
            draggable: true
        });

        // Actualizar input al arrastrar
        marker.addListener('dragend', (e) => {
            updateCoordinatesInput(e.latLng);
        });

        // Actualizar input inicial
        updateCoordinatesInput(latLng);
        
        // Centrar mapa si se desea
        // map.panTo(latLng);
    }

    function updateCoordinatesInput(latLng) {
        // Google Maps usa funciones .lat() y .lng()
        const coords = { lat: latLng.lat(), lng: latLng.lng() };
        document.getElementById('coordenadas').value = JSON.stringify(coords);
    }

    // Búsqueda en Mapa (Usando Nominatim como en el código original para no gastar cuota de Google Geocoding)
    async function handleSearchLocation() {
        const query = locationSearchInput.value;
        if (!query) return;
        
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                const latLng = new google.maps.LatLng(parseFloat(lat), parseFloat(lon));
                
                // Actualizar mapa
                map.setCenter(latLng);
                map.setZoom(15);
                
                // Poner marcador
                placeMarker(latLng);
                
            } else {
                alert('Ubicación no encontrada.');
            }
        } catch (e) {
            console.error(e);
            alert('Error al buscar ubicación.');
        }
    }

    function setupEventListeners() {
        if(form) form.addEventListener('submit', handleFormSubmit);
        if(cancelEditBtn) cancelEditBtn.addEventListener('click', resetForm);
        if(procesadorasList) procesadorasList.addEventListener('click', handleListClick);
        
        // Listeners Listas Dinámicas
        if(fotosInput) fotosInput.addEventListener('change', handleImageUpload);
        if(addCertBtn) addCertBtn.addEventListener('click', handleAddCertification);
        if(certsListContainer) certsListContainer.addEventListener('click', handleCertificationAction);
        if(addPremioBtn) addPremioBtn.addEventListener('click', handleAddPremio);
        if(premiosListContainer) premiosListContainer.addEventListener('click', handlePremioAction);
        if(fotosPreviewContainer) fotosPreviewContainer.addEventListener('click', handleImageDelete);

        // Listener para búsqueda de RUC
        if (searchRucBtn) {
            searchRucBtn.addEventListener('click', handleSearchRuc);
        }

        // Listener para búsqueda en Mapa
        if (searchLocationBtn) {
            searchLocationBtn.addEventListener('click', handleSearchLocation);
        }
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

                razonSocialInput.classList.add('bg-green-50');
                setTimeout(() => razonSocialInput.classList.remove('bg-green-50'), 1000);
            }
        } catch (error) {
            console.error(error);
            alert("No se encontraron datos para este RUC o hubo un error en la consulta.");
        } finally {
            searchRucBtn.innerHTML = originalHtml;
            searchRucBtn.disabled = false;
        }
    }

    // --- API CALLS ---
    async function loadProcesadoras() {
        try {
            const data = await api('/api/procesadoras');
            renderList(data);
        } catch(e) { console.error(e); }
    }

    function renderList(list) {
        if (!procesadorasList) return;
        
        procesadorasList.innerHTML = list.length === 0 ? 
            '<p class="text-stone-500 text-center py-4">No hay procesadoras registradas.</p>' : 
            list.map(p => `
                <div class="p-4 border rounded-xl bg-stone-50 flex justify-between items-center hover:shadow-sm transition">
                    <div>
                        <h3 class="font-bold text-amber-900">${p.nombre_comercial || p.razon_social}</h3>
                        <p class="text-xs text-stone-500">RUC: ${p.ruc}</p>
                        <p class="text-xs text-stone-500">${p.distrito || ''}, ${p.provincia || ''} - ${p.departamento || ''}</p>
                    </div>
                    <div class="flex gap-2">
                        <button data-id="${p.id}" class="edit-btn text-sky-600 hover:bg-sky-100 p-2 rounded transition"><i class="fas fa-pen"></i></button>
                        <button data-id="${p.id}" class="delete-btn text-red-600 hover:bg-red-100 p-2 rounded transition"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `).join('');
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
        
        // Manejo de coordenadas (ya viene como string JSON desde updateCoordinatesInput)
        if (!data.coordenadas || data.coordenadas.trim() === "") {
             data.coordenadas = null;
        } else {
             try {
                 JSON.parse(data.coordenadas);
             } catch(e) {
                 console.warn("Coordenadas inválidas, se limpian");
                 data.coordenadas = null;
             }
        }

        if(data.numero_trabajadores === "") delete data.numero_trabajadores;

        const editId = editIdInput.value;

        try {
            if (editId) {
                await api(`/api/procesadoras/${editId}`, { method: 'PUT', body: JSON.stringify(data) });
            } else {
                await api('/api/procesadoras', { method: 'POST', body: JSON.stringify(data) });
            }
            
            resetForm();
            await loadProcesadoras();
            alert('Procesadora guardada exitosamente.');
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

        if (btn.classList.contains('delete-btn')) {
            if (confirm("¿Eliminar procesadora?")) {
                await api(`/api/procesadoras/${id}`, { method: 'DELETE' });
                loadProcesadoras();
            }
        }
        if (btn.classList.contains('edit-btn')) {
            populateForm(id);
        }
    }

    async function populateForm(id) {
        try {
            const list = await api('/api/procesadoras');
            const item = list.find(x => x.id === id);
            if (!item) return;

            resetForm();
            editIdInput.value = item.id;
            formTitle.textContent = "Editar Procesadora";
            cancelEditBtn.classList.remove('hidden');
            
            const submitBtn = form.querySelector('button[type="submit"]');
            if(submitBtn) submitBtn.textContent = "Actualizar";

            // Campos Base
            if(document.getElementById('ruc')) document.getElementById('ruc').value = item.ruc;
            if(document.getElementById('razon_social')) document.getElementById('razon_social').value = item.razon_social;
            if(document.getElementById('nombre_comercial')) document.getElementById('nombre_comercial').value = item.nombre_comercial || '';
            if(document.getElementById('direccion')) document.getElementById('direccion').value = item.direccion || '';
            if(document.getElementById('telefono')) document.getElementById('telefono').value = item.telefono || '';
            if(document.getElementById('numero_trabajadores')) document.getElementById('numero_trabajadores').value = item.numero_trabajadores || '';
            if(document.getElementById('ciudad')) document.getElementById('ciudad').value = item.ciudad || '';
            if(document.getElementById('pais')) document.getElementById('pais').value = item.pais || '';

            // Nuevos Campos
            if(document.getElementById('departamento')) document.getElementById('departamento').value = item.departamento || '';
            if(document.getElementById('provincia')) document.getElementById('provincia').value = item.provincia || '';
            if(document.getElementById('distrito')) document.getElementById('distrito').value = item.distrito || '';

            // Listas
            currentImages = item.imagenes_json || [];
            currentCertifications = item.certificaciones_json || [];
            currentPremios = item.premios_json || [];
            renderImages();
            renderAddedCertifications();
            renderAddedPremios();

            // Mapa (Google Maps)
            if (item.coordenadas && item.coordenadas.lat && map) {
                const latLng = new google.maps.LatLng(item.coordenadas.lat, item.coordenadas.lng);
                placeMarker(latLng);
                map.setCenter(latLng);
                map.setZoom(15);
            }

            form.scrollIntoView({ behavior: 'smooth' });
        } catch(e) { console.error("Error populando form:", e); }
    }

    function resetForm() {
        form.reset();
        editIdInput.value = '';
        currentImages = [];
        currentCertifications = [];
        currentPremios = [];
        
        // Limpiar mapa Google
        if (marker) {
            marker.setMap(null);
            marker = null;
        }
        if (map) {
             map.setCenter({ lat: -9.19, lng: -75.015 });
             map.setZoom(5);
        }

        document.getElementById('coordenadas').value = '';
        renderImages();
        renderAddedCertifications();
        renderAddedPremios();
        formTitle.textContent = "Nueva Procesadora";
        const submitBtn = form.querySelector('button[type="submit"]');
        if(submitBtn) submitBtn.textContent = "Guardar Procesadora";
        cancelEditBtn.classList.add('hidden');
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

    // --- Manejadores de Listas ---
    
    function handleImageUpload(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = () => { currentImages.push(reader.result); renderImages(); };
            reader.readAsDataURL(file);
        });
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
                <button type="button" data-index="${i}" class="delete-img-btn absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition">&times;</button>
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
            `<div class="flex justify-between items-center bg-stone-100 p-2 rounded mb-2">
                <span>${c.nombre}</span>
                <button type="button" class="delete-cert-btn text-red-500 hover:text-red-700 font-bold" data-index="${i}">&times;</button>
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
            `<div class="flex justify-between items-center bg-stone-100 p-2 rounded mb-2">
                <span>${p.nombre} (${p.year})</span>
                <button type="button" class="delete-premio-btn text-red-500 hover:text-red-700 font-bold" data-index="${i}">&times;</button>
             </div>`
        ).join('');
    }

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
        return response.json();
    }
});