document.addEventListener('DOMContentLoaded', () => {
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
        await Promise.all([loadCountries(), loadCertifications(), loadFincas()]);
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
        renderImagePreviews();
        renderAddedCertifications();
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
            
            resetForm(); // Limpia el formulario antes de poblarlo

            form.propietario.value = finca.propietario || '';
            form.dni_ruc.value = finca.dni_ruc || '';
            form.nombre_finca.value = finca.nombre_finca || '';
            form.pais.value = finca.pais || '';
            form.ciudad.value = finca.ciudad || '';
            form.altura.value = finca.altura || '';
            form.superficie.value = finca.superficie || '';
            form.telefono.value = finca.telefono || '';
            form.historia.value = finca.historia || '';
            form.coordenadas.value = JSON.stringify(finca.coordenadas);
            editIdInput.value = finca.id;

            currentImages = finca.imagenes_json || [];
            currentFincaCertifications = finca.certificaciones_json || [];
            renderImagePreviews();
            renderAddedCertifications();
            
            if (finca.coordenadas) { 
                const polygon = L.polygon(finca.coordenadas); 
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
    
    function handleImageUpload(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                currentImages.push(reader.result);
                renderImagePreviews();
            };
            reader.readAsDataURL(file);
        });
        e.target.value = ''; // Reset input para poder subir el mismo archivo otra vez
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

