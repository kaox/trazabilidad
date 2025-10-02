document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const form = document.getElementById('procesadora-form');
    const procesadorasList = document.getElementById('procesadoras-list');
    const editIdInput = document.getElementById('edit-id');
    const submitButton = form.querySelector('button[type="submit"]');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const formTitle = document.getElementById('form-title');
    const countrySelect = document.getElementById('pais');
    const premioSelect = document.getElementById('premio-select');
    const premioYearInput = document.getElementById('premio-year');
    const addPremioBtn = document.getElementById('add-premio-btn');
    const premiosListContainer = document.getElementById('premios-list');
    const certSelect = document.getElementById('certification-select');
    const certExpiryInput = document.getElementById('certification-expiry');
    const addCertBtn = document.getElementById('add-certification-btn');
    const certsListContainer = document.getElementById('certifications-list');

    // Estado de la aplicación
    let allPremios = [];
    let currentProcesadoraPremios = [];
    let allCertifications = [];
    let currentProcesadoraCerts = [];

    async function init() {
        await Promise.all([
            loadCountries(),
            loadPremios(),
            loadCertifications(),
            loadProcesadoras()
        ]);
        setupEventListeners();
    }

    function setupEventListeners() {
        form.addEventListener('submit', handleFormSubmit);
        cancelEditBtn.addEventListener('click', resetForm);
        procesadorasList.addEventListener('click', handleProcesadoraListClick);
        addPremioBtn.addEventListener('click', handleAddPremio);
        premiosListContainer.addEventListener('click', handlePremioAction);
        addCertBtn.addEventListener('click', handleAddCertification);
        certsListContainer.addEventListener('click', handleCertificationAction);
    }

    // --- Carga de Datos ---
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

    async function loadPremios() {
        try {
            const data = await fetch('/data/premios.json').then(res => res.json());
            allPremios = data.premios;
            premioSelect.innerHTML = `<option value="">Seleccionar premio...</option>` + allPremios.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        } catch (error) {
            console.error("Error cargando premios:", error);
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

    async function loadProcesadoras() {
        try {
            const procesadoras = await api('/api/procesadoras');
            renderProcesadoras(procesadoras);
        } catch (error) {
            procesadorasList.innerHTML = `<p class="text-red-500">Error al cargar las procesadoras.</p>`;
        }
    }

    // --- Renderizado ---
    function renderProcesadoras(procesadoras) {
        procesadorasList.innerHTML = procesadoras.length === 0 
            ? '<p class="text-stone-500 text-center">No hay procesadoras registradas.</p>' 
            : procesadoras.map(p => `
                <div class="p-4 border rounded-xl bg-stone-50">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-bold text-lg text-amber-900">${p.nombre_comercial || p.razon_social}</h3>
                            <p class="text-sm text-stone-600">RUC: ${p.ruc}</p>
                            <p class="text-sm text-stone-500">${p.ciudad || 'N/A'}, ${p.pais || 'N/A'}</p>
                        </div>
                        <div class="flex gap-2 flex-shrink-0">
                            <button data-id="${p.id}" class="edit-btn text-sm bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded-lg">Editar</button>
                            <button data-id="${p.id}" class="delete-btn text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg">Eliminar</button>
                        </div>
                    </div>
                </div>
            `).join('');
    }

    function renderAddedPremios() {
        premiosListContainer.innerHTML = currentProcesadoraPremios.map(premio => `
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

    function renderAddedCertifications() {
        certsListContainer.innerHTML = currentProcesadoraCerts.map(cert => {
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

    // --- Manejo del Formulario ---
    function resetForm() {
        form.reset();
        editIdInput.value = '';
        currentProcesadoraPremios = [];
        currentProcesadoraCerts = [];
        renderAddedPremios();
        renderAddedCertifications();
        formTitle.textContent = 'Nueva Procesadora';
        submitButton.textContent = 'Guardar Procesadora';
        submitButton.className = 'bg-amber-800 hover:bg-amber-900 text-white font-bold py-3 px-8 rounded-xl shadow-md';
        cancelEditBtn.classList.add('hidden');
    }

    async function populateFormForEdit(id) {
        try {
            const procesadoras = await api('/api/procesadoras');
            const procesadora = procesadoras.find(p => p.id === id);
            if (!procesadora) return;

            resetForm();
            form.ruc.value = procesadora.ruc || '';
            form.razon_social.value = procesadora.razon_social || '';
            form.nombre_comercial.value = procesadora.nombre_comercial || '';
            form.tipo_empresa.value = procesadora.tipo_empresa || '';
            form.pais.value = procesadora.pais || '';
            form.ciudad.value = procesadora.ciudad || '';
            form.direccion.value = procesadora.direccion || '';
            form.telefono.value = procesadora.telefono || '';
            editIdInput.value = procesadora.id;

            currentProcesadoraPremios = procesadora.premios_json || [];
            currentProcesadoraCerts = procesadora.certificaciones_json || [];
            renderAddedPremios();
            renderAddedCertifications();

            formTitle.textContent = `Editando: ${procesadora.nombre_comercial || procesadora.razon_social}`;
            submitButton.textContent = 'Actualizar Procesadora';
            submitButton.className = 'bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-md';
            cancelEditBtn.classList.add('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            alert('Error al cargar datos para editar.');
        }
    }

    // --- Gestores de Eventos ---
    async function handleFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.premios_json = currentProcesadoraPremios;
        data.certificaciones_json = currentProcesadoraCerts;

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
            alert('Error al guardar la procesadora.');
        }
    }

    function handleProcesadoraListClick(e) {
        const target = e.target;
        if (target.classList.contains('edit-btn')) {
            populateFormForEdit(target.dataset.id);
        }
        if (target.classList.contains('delete-btn')) {
            const id = target.dataset.id;
            if (confirm('¿Seguro que quieres eliminar esta procesadora?')) {
                api(`/api/procesadoras/${id}`, { method: 'DELETE' }).then(loadProcesadoras);
            }
        }
    }

    function handleAddPremio() {
        const premioId = parseInt(premioSelect.value, 10);
        const ano = premioYearInput.value;

        if (!premioId || !ano) {
            alert('Por favor, selecciona un premio y especifica el año.');
            return;
        }

        const premio = allPremios.find(p => p.id === premioId);
        if (premio) {
            // Verificar si ya existe el mismo premio en el mismo año
            const yaExiste = currentProcesadoraPremios.some(p => p.id === premioId && p.ano === ano);
            if (yaExiste) {
                alert('Este premio ya ha sido añadido para el año especificado.');
                return;
            }

            currentProcesadoraPremios.push({ id: premioId, nombre: premio.nombre, logo_url: premio.logo_url, ano: ano });
            renderAddedPremios();
            premioSelect.value = '';
            premioYearInput.value = '';
        }
    }
    
    function handlePremioAction(e) {
        if (e.target.classList.contains('delete-premio-btn')) {
            const premioId = parseInt(e.target.dataset.id, 10);
            const ano = e.target.dataset.year;
            currentProcesadoraPremios = currentProcesadoraPremios.filter(p => !(p.id === premioId && p.ano === ano));
            renderAddedPremios();
        }
    }

    function handleAddCertification() {
        const certId = parseInt(certSelect.value, 10);
        const expiryDate = certExpiryInput.value;

        if (!certId || !expiryDate) {
            alert('Por favor, selecciona una certificación y su fecha de vencimiento.');
            return;
        }
        
        if (currentProcesadoraCerts.some(c => c.id === certId)) {
            alert('Esta certificación ya ha sido añadida.');
            return;
        }

        const certification = allCertifications.find(c => c.id === certId);
        if (certification) {
            currentProcesadoraCerts.push({ id: certId, nombre: certification.nombre, logo_url: certification.logo_url, fecha_vencimiento: expiryDate });
            renderAddedCertifications();
            certSelect.value = '';
            certExpiryInput.value = '';
        }
    }
    
    function handleCertificationAction(e) {
        if (e.target.classList.contains('delete-cert-btn')) {
            const certId = parseInt(e.target.dataset.id, 10);
            currentProcesadoraCerts = currentProcesadoraCerts.filter(c => c.id !== certId);
            renderAddedCertifications();
        }
    }

    init();
});

