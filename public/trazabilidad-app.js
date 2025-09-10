document.addEventListener('DOMContentLoaded', () => {
    let state = { batches: [] };
    const crearCosechaBtn = document.getElementById('crearCosechaBtn');
    const dashboardView = document.getElementById('dashboard-view');
    const welcomeScreen = document.getElementById('welcome-screen');
    const formModal = document.getElementById('form-modal');
    const modalContent = document.getElementById('modal-content');

    const processConfig = {
        cosecha: { plural: 'fermentaciones', singular: 'fermentacion', outputWeightField: 'pesoGranosFrescos' },
        fermentacion: { plural: 'secados', singular: 'secado', outputWeightField: 'pesoFermentadoHumedo' },
        secado: { plural: 'tostados', singular: 'tostado', outputWeightField: 'pesoSeco' },
        tostado: { plural: 'moliendas', singular: 'molienda', outputWeightField: 'pesoTostado' },
        molienda: { displayName: 'Descascarillado & Molienda', plural: null, singular: null, outputWeightField: 'pesoProductoFinal' }
    };
    
    function generateId(prefix = 'LOTE') {
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const random = Math.random().toString(36).substring(2, 6);
        return `${prefix}-${timestamp}-${random}`;
    }

    async function init() {
        await loadBatches();
        crearCosechaBtn.addEventListener('click', () => openFormModal('create', 'cosecha', null));
        formModal.addEventListener('click', (e) => { if (e.target.id === 'form-modal') formModal.close(); });
    }

    async function loadBatches() {
        try {
            const batchesTree = await api('/api/batches/tree');
            state.batches = batchesTree;
            renderDashboard(state.batches);
        } catch (error) {
            console.error("Error al cargar lotes:", error);
            dashboardView.innerHTML = `<p class="text-red-500 text-center">No se pudieron cargar los datos del servidor.</p>`;
        }
    }

    function renderDashboard(cosechas) {
        dashboardView.innerHTML = '';
        welcomeScreen.classList.toggle('hidden', cosechas.length > 0);
        cosechas.forEach(cosecha => {
            dashboardView.appendChild(createBatchCard(cosecha, 'cosecha'));
        });
    }

    function buildPath(batch, type, parentPath = '') {
        const currentPath = `${type}:${batch.id}`;
        return parentPath ? `${parentPath}>${currentPath}` : currentPath;
    }
    
    function createBatchCard(batch, type, parentPath = '') {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-md mb-4 overflow-hidden';
        
        const path = buildPath(batch, type, parentPath);
        const config = processConfig[type];
        const childrenKey = config.plural;
        const hasChildren = batch[childrenKey] && batch[childrenKey].length > 0;
        const parentBatch = getParentBatchByPath(path);
        const parentType = parentBatch ? path.split('>').slice(-2, -1)[0].split(':')[0] : type;
        const displayName = config.displayName || type.charAt(0).toUpperCase() + type.slice(1);

        let inputWeight = 0;
        let outputWeight = parseFloat(batch[config.outputWeightField]) || 0;
        let yieldPercent = 0;
        
        if (type === 'cosecha') {
            inputWeight = parseFloat(batch.pesoMazorcas) || 0;
        } else if (parentType) {
            const inputField = processConfig[parentType].outputWeightField;
            inputWeight = parseFloat(batch[inputField]) || 0;
        }

        if (type === 'molienda') {
            const finalProductWeight = parseFloat(batch.pesoProductoFinal) || 0;
            if (inputWeight > 0) {
                 yieldPercent = (finalProductWeight / inputWeight) * 100;
            }
        } else {
            if (inputWeight > 0) {
                yieldPercent = (outputWeight / inputWeight) * 100;
            }
        }

        let titleDate = '';
        if (type === 'cosecha') titleDate = batch.fechaCosecha;
        if (type === 'fermentacion' || type === 'secado') titleDate = batch.fechaInicio;
        if (type === 'tostado') titleDate = batch.fechaTostado;
        if (type === 'molienda') titleDate = batch.fecha;

        let variablesHtml = `<dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">`;
        if (type === 'cosecha') {
            variablesHtml += `<div><dt class="text-stone-500">Finca:</dt><dd class="font-medium text-stone-800">${batch.finca}</dd></div>`;
        }
        if (type === 'fermentacion' || type === 'secado') {
            variablesHtml += `<div><dt class="text-stone-500">Lugar:</dt><dd class="font-medium text-stone-800">${batch.lugarProceso || 'N/A'}</dd></div>`;
            variablesHtml += `<div><dt class="text-stone-500">Método:</dt><dd class="font-medium text-stone-800">${batch.metodo}</dd></div>`;
            variablesHtml += `<div><dt class="text-stone-500">Duración:</dt><dd class="font-medium text-stone-800">${batch.duracion} días</dd></div>`;
        }
        if (type === 'tostado') {
            variablesHtml += `<div><dt class="text-stone-500">Procesadora:</dt><dd class="font-medium text-stone-800">${batch.procesadora || 'N/A'}</dd></div>`;
            variablesHtml += `<div><dt class="text-stone-500">Perfil:</dt><dd class="font-medium text-stone-800">${batch.tipoPerfil || 'N/A'}</dd></div>`;
            variablesHtml += `<div><dt class="text-stone-500">Temp. Máx:</dt><dd class="font-medium text-stone-800">${batch.tempMaxima}°C</dd></div>`;
            variablesHtml += `<div><dt class="text-stone-500">Tueste:</dt><dd class="font-medium text-stone-800">${batch.duracion} min</dd></div>`;
        }
        if (type === 'molienda') {
             variablesHtml += `<div><dt class="text-stone-500">Procesadora:</dt><dd class="font-medium text-stone-800">${batch.procesadora || 'N/A'}</dd></div>`;
        }
        variablesHtml += `</dl>`;

        let ioHtml = '';
        if (type === 'cosecha') {
            ioHtml = `<div class="flex gap-4"><div class="flex-1"><p class="text-sm text-stone-500">Entrada (Mazorcas)</p><p class="font-bold text-lg">${(parseFloat(batch.pesoMazorcas) || 0).toFixed(2)} kg</p></div><div class="flex-1"><p class="text-sm text-stone-500">Salida (Granos Frescos)</p><p class="font-bold text-lg text-green-700">${(parseFloat(batch.pesoGranosFrescos) || 0).toFixed(2)} kg</p></div></div>`;
        } else if (type === 'fermentacion') {
            ioHtml = `<div class="flex gap-4"><div class="flex-1"><p class="text-sm text-stone-500">Entrada (Granos Frescos)</p><p class="font-bold text-lg">${inputWeight.toFixed(2)} kg</p></div><div class="flex-1"><p class="text-sm text-stone-500">Salida (Fermentado Húmedo)</p><p class="font-bold text-lg text-green-700">${outputWeight.toFixed(2)} kg</p></div></div>`;
        } else if (type === 'secado') {
            ioHtml = `<div class="flex gap-4"><div class="flex-1"><p class="text-sm text-stone-500">Entrada (Fermentado Húmedo)</p><p class="font-bold text-lg">${inputWeight.toFixed(2)} kg</p></div><div class="flex-1"><p class="text-sm text-stone-500">Salida (Cacao Seco)</p><p class="font-bold text-lg text-green-700">${outputWeight.toFixed(2)} kg</p></div></div>`;
        } else if (type === 'tostado') {
            ioHtml = `<div class="flex gap-4"><div class="flex-1"><p class="text-sm text-stone-500">Entrada (Cacao Seco)</p><p class="font-bold text-lg">${inputWeight.toFixed(2)} kg</p></div><div class="flex-1"><p class="text-sm text-stone-500">Salida (Cacao Tostado)</p><p class="font-bold text-lg text-green-700">${outputWeight.toFixed(2)} kg</p></div></div>`;
        } else if (type === 'molienda') {
            ioHtml = `<div class="flex gap-4"><div class="flex-1"><p class="text-sm text-stone-500">Entrada (Cacao Tostado)</p><p class="font-bold text-lg">${inputWeight.toFixed(2)} kg</p></div><div class="flex-1"><p class="text-sm text-stone-500">Salida (${batch.productoFinal || 'Producto'})</p><p class="font-bold text-lg text-green-700">${(parseFloat(batch.pesoProductoFinal) || 0).toFixed(2)} kg</p><p class="text-sm text-stone-500 mt-1">Cascarilla</p><p class="font-bold text-lg text-red-600">${(parseFloat(batch.pesoCascarilla) || 0).toFixed(2)} kg</p></div></div>`;
        }

        const cardContent = document.createElement('div');
        cardContent.className = `p-4 border-l-4 border-amber-800 ${hasChildren ? 'cursor-pointer' : ''}`;
        
        cardContent.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                <div class="flex items-center gap-2 flex-grow" ${hasChildren ? `onclick="this.closest('.p-4').nextElementSibling.classList.toggle('hidden'); this.querySelector('.expand-icon').classList.toggle('rotate-90')"` : ''}>
                    ${hasChildren ? `<svg class="w-5 h-5 text-stone-400 transition-transform duration-300 flex-shrink-0 expand-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7-7"></path></svg>` : '<div class="w-5 flex-shrink-0"></div>' }
                    <h3 class="font-bold text-lg text-amber-900">${displayName} <span class="text-base font-normal text-stone-500">[${titleDate || 'Sin fecha'}]</span></h3>
                </div>
                <div class="flex flex-wrap gap-2 items-center justify-start sm:justify-end flex-shrink-0">
                    ${type === 'molienda' || type === 'secado' ? `<button class="qr-btn text-xs bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1.5 rounded-lg" data-id="${batch.id}">QR</button>` : ''}
                    <button class="edit-btn text-xs bg-stone-200 hover:bg-stone-300 px-3 py-1.5 rounded-lg" data-path="${path}" data-type="${type}">Editar</button>
                    <button class="delete-btn text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg" data-path="${path}">X</button>
                    ${config.plural ? `<button ${calculateAvailableWeight(batch, type) <= 0 ? 'disabled' : ''} class="add-sub-btn text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg disabled:bg-gray-400" data-path="${path}" data-type="${type}">+ Añadir</button>` : ''}
                </div>
            </div>
            <div class="pl-7 mt-4 space-y-4">
                <div class="pt-4 border-t">${variablesHtml}</div>
                <div class="pt-4 border-t">${ioHtml}</div>
                <div>
                    <div class="flex justify-between items-center mb-1"><span class="text-sm font-medium text-amber-800">Rendimiento</span><span class="text-sm font-bold text-amber-800">${yieldPercent.toFixed(1)}%</span></div>
                    <div class="w-full bg-stone-200 rounded-full h-2.5"><div class="bg-amber-700 h-2.5 rounded-full" style="width: ${yieldPercent}%"></div></div>
                </div>
            </div>
        `;
        
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'ml-4 sm:ml-6 mt-0 pl-4 border-l-2 border-stone-200 hidden children-container';

        if (hasChildren) {
            batch[childrenKey].forEach(childBatch => {
                childrenContainer.appendChild(createBatchCard(childBatch, config.singular, path));
            });
        }
        
        card.appendChild(cardContent);
        card.appendChild(childrenContainer);

        return card;
    }

    async function openFormModal(mode, type, path) {
        const isCreating = mode === 'create';
        const parentBatch = isCreating ? getBatchByPath(path) : getParentBatchByPath(path);
        const batchData = isCreating ? {} : getBatchByPath(path);
        
        if (!isCreating && !batchData) {
            console.error("Error: No se pudo encontrar el lote para editar en la ruta:", path);
            alert("Error: no se pudo encontrar el lote.");
            return;
        }

        const parentType = parentBatch ? path.split('>').pop().split(':')[0] : null;
        const availableWeight = parentBatch ? calculateAvailableWeight(parentBatch, parentType) : 0;
        
        modalContent.innerHTML = await generateFormHTML(mode, type, batchData || {}, availableWeight);
        formModal.showModal();
        
        const imageInput = modalContent.querySelector('.image-upload-input');
        if(imageInput) {
            imageInput.addEventListener('change', e => {
                const file = e.target.files[0];
                if(!file) return;
                const reader = new FileReader();
                reader.onloadend = () => {
                    document.getElementById('image-preview').src = reader.result;
                    document.getElementById('image-hidden-input').value = reader.result;
                };
                reader.readAsDataURL(file);
            });
        }

        const form = document.getElementById('batch-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const newData = Object.fromEntries(formData.entries());
            try {
                if (isCreating) {
                    newData.id = generateId(type.toUpperCase().substring(0, 3));
                    const parentId = parentBatch ? parentBatch.id : null;
                    await api('/api/batches', { method: 'POST', body: JSON.stringify({ tipo: type, parent_id: parentId, data: newData }) });
                } else {
                    // FIX: Re-add the ID to the data object before sending the update.
                    newData.id = batchData.id; 
                    await api(`/api/batches/${batchData.id}`, { method: 'PUT', body: JSON.stringify({ data: newData }) });
                }
                formModal.close();
                await loadBatches();
            } catch (error) {
                console.error('Error al guardar:', error);
                alert('No se pudo guardar el lote: ' + error.message);
            }
        });
        document.getElementById('cancel-btn').addEventListener('click', () => formModal.close());
    }

    async function generateFormHTML(mode, type, data = {}, availableWeight = 0) {
        let formFields = '';
        if (mode === 'edit') {
            formFields += createReadOnlyField('ID Lote', data.id);
        }
        if (type !== 'cosecha') {
            const parentType = Object.keys(processConfig).find(k => processConfig[k].singular === type);
            const inputWeightField = processConfig[parentType].outputWeightField;
            let limit = availableWeight + (mode === 'edit' ? parseFloat(data[inputWeightField]) || 0 : 0);
            formFields += createInput(inputWeightField, `Peso Entrada (kg)`, 'number', `Disponible: ${limit.toFixed(2)} kg`, data[inputWeightField] || '', false, true);
        }
        const displayName = processConfig[type].displayName || type.charAt(0).toUpperCase() + type.slice(1);
        const hasImageUpload = ['cosecha', 'fermentacion', 'secado', 'tostado'].includes(type);

        switch(type) {
            case 'cosecha':
                formFields += await createFincaSelectHTML(data.finca);
                formFields += createInput('fechaCosecha', 'Fecha Cosecha', 'date', '', data.fechaCosecha, false, true);
                formFields += createInput('pesoMazorcas', 'Peso Mazorcas (kg)', 'number', '', data.pesoMazorcas, false, true);
                formFields += createInput('pesoGranosFrescos', 'Peso de granos frescos (kg)', 'number', '', data.pesoGranosFrescos, false, true);
                break;
            case 'fermentacion':
            case 'secado':
                formFields += await createLugarProcesoSelectHTML(data.lugarProceso);
                formFields += createInput('fechaInicio', 'Fecha Inicio', 'date', '', data.fechaInicio, false, true);
                formFields += createSelect('metodo', 'Método', type === 'fermentacion' ? ['Bandejas Rohan', 'Cajones de madera', 'Otro'] : ['Natural al sol','Metodo Rohan','Marquesinas o Túneles de secado', 'Hornos', 'Otro'], data.metodo);
                formFields += createInput('duracion', 'Duración (días)', 'number', '', data.duracion, false, true);
                const outputField = processConfig[type].outputWeightField;
                const outputLabel = type === 'fermentacion' ? 'Peso Fermentado Húmedo (kg)' : 'Peso Cacao Seco (kg)';
                formFields += createInput(outputField, outputLabel, 'number', '', data[outputField], false, true);
                break;
            case 'tostado':
                formFields += await createProcesadoraSelectHTML(data.procesadora);
                formFields += await createPerfilSelectHTML(data.tipoPerfil);
                formFields += createInput('fechaTostado', 'Fecha Tostado', 'date', '', data.fechaTostado, false, true);
                formFields += createSelect('clasificacion', 'Tamaño Grano', ['Grandes', 'Medianos', 'Pequeños'], data.clasificacion);
                formFields += createInput('tempMinima', 'Temp. Mínima (°C)', 'number', '', data.tempMinima, false, true);
                formFields += createInput('tempMaxima', 'Temp. Máxima (°C)', 'number', '', data.tempMaxima, false, true);
                formFields += createInput('duracion', 'Tiempo de Tueste (min)', 'number', '', data.duracion, false, true);
                formFields += createTextArea('perfilAroma', 'Perfil de Aroma', 'Ej: notas a caramelo...', data.perfilAroma);
                formFields += createInput('pesoTostado', 'Peso Cacao Tostado (kg)', 'number', '', data.pesoTostado, false, true);
                break;
            case 'molienda':
                formFields += await createProcesadoraSelectHTML(data.procesadora);
                formFields += createInput('fecha', 'Fecha Procesamiento', 'date', '', data.fecha, false, true);
                formFields += createInput('pesoCascarilla', 'Peso Cascarilla (kg)', 'number', '', data.pesoCascarilla, false, true);
                formFields += createSelect('productoFinal', 'Producto Final', ['Pasta de Cacao', 'Nibs de Cacao', 'Otros'], data.productoFinal);
                formFields += createInput('pesoProductoFinal', 'Peso Producto Final (kg)', 'number', '', data.pesoProductoFinal, false, true);
                break;
        }
        if (hasImageUpload) formFields += createImageInputHTML('imageUrl', `Foto de ${type}`, data.imageUrl);
        
        return `<form id="batch-form"><h2 class="text-2xl font-display text-amber-900 border-b pb-2 mb-4">${mode === 'create' ? 'Crear' : 'Editar'} Lote de ${displayName}</h2><div class="space-y-4 max-h-[60vh] overflow-y-auto p-1">${formFields}</div><div class="flex justify-end gap-4 mt-6"><button type="button" id="cancel-btn" class="bg-stone-300 hover:bg-stone-400 font-bold py-2 px-6 rounded-xl">Cancelar</button><button type="submit" class="bg-amber-800 hover:bg-amber-900 text-white font-bold py-2 px-6 rounded-xl">${mode === 'create' ? 'Guardar' : 'Actualizar'}</button></div></form>`;
    }

    function createInput(id, l, t, p, v, r, req=false) { return `<div><label for="${id}" class="block text-sm font-medium text-stone-700 mb-1">${l}</label><input type="${t}" id="${id}" name="${id}" value="${v||''}" placeholder="${p}" class="w-full p-3 border border-stone-300 rounded-xl" ${r?'readonly':''} step="0.01" ${req?'required':''}></div>`; }
    function createReadOnlyField(label, value) { return `<div><label class="block text-sm font-medium text-stone-700 mb-1">${label}</label><p class="w-full p-3 bg-stone-100 text-stone-600 rounded-xl font-mono text-sm">${value}</p></div>`; }
    function createSelect(id, l, o, s) { const opts = o.map(opt => `<option value="${opt}" ${opt===s?'selected':''}>${opt}</option>`).join(''); return `<div><label for="${id}" class="block text-sm font-medium text-stone-700 mb-1">${l}</label><select id="${id}" name="${id}" class="w-full p-3 border border-stone-300 rounded-xl" required><option value="">Seleccionar...</option>${opts}</select></div>`; }
    function createTextArea(id, l, p, v) { return `<div><label for="${id}" class="block text-sm font-medium text-stone-700 mb-1">${l}</label><textarea id="${id}" name="${id}" placeholder="${p}" rows="3" class="w-full p-3 border border-stone-300 rounded-xl">${v||''}</textarea></div>`; }
    function createImageInputHTML(id, l, v) { return `<div class="pt-4 border-t"><label class="block text-sm font-medium text-stone-700 mb-1">${l}</label><div class="mt-1 flex items-center gap-4"><img id="image-preview" src="${v||'https://placehold.co/100x100/e7e5e4/a8a29e?text=Foto'}" alt="Previsualización" class="h-24 w-24 rounded-lg object-cover"><div class="w-full"><input type="file" class="image-upload-input block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100" accept="image/*"><input type="hidden" id="image-hidden-input" name="${id}" value="${v||''}"><p class="text-xs text-stone-500 mt-2">Sube una imagen.</p></div></div></div>`; }
    async function createFincaSelectHTML(selectedValue = '') {
        try {
            const fincas = await api('/api/fincas');
            if (fincas.length === 0) return `<div><label class="block text-sm font-medium text-stone-700 mb-1">Finca</label><div class="p-3 border rounded-xl bg-stone-50 text-stone-500">No hay fincas. <a href="/app/fincas" class="text-sky-600 hover:underline">Registra una</a>.</div><input type="hidden" name="finca" value=""></div>`;
            return createSelect('finca', 'Asociar Finca', fincas.map(f => f.nombre_finca), selectedValue);
        } catch (error) { return `<div class="text-red-500">Error al cargar fincas.</div>`; }
    }
    async function createPerfilSelectHTML(selectedValue = '') {
        try {
            const perfiles = await api('/api/perfiles');
            let optionsHTML = perfiles.map(p => `<option value="${p.nombre}" ${p.nombre === selectedValue ? 'selected' : ''}>${p.nombre}</option>`).join('');
            return `<div><label for="tipoPerfil" class="block text-sm font-medium text-stone-700 mb-1">Tipo de Perfil Sensorial</label><div class="flex items-center gap-2"><select id="tipoPerfil" name="tipoPerfil" class="w-full p-3 border border-stone-300 rounded-xl"><option value="">Seleccionar perfil...</option>${optionsHTML}</select><a href="/app/perfiles" target="_blank" class="flex-shrink-0 bg-sky-600 hover:bg-sky-700 text-white font-bold p-3 rounded-xl" title="Añadir Nuevo Perfil">+</a></div></div>`;
        } catch (error) { return `<div class="text-red-500">Error al cargar perfiles. <a href="/app/perfiles" class="text-sky-600 hover:underline">Ir a Perfiles</a>.</div>`; }
    }
    async function createProcesadoraSelectHTML(selectedValue = '') {
        try {
            const procesadoras = await api('/api/procesadoras');
            if (procesadoras.length === 0) return `<div><label class="block text-sm font-medium text-stone-700 mb-1">Procesadora</label><div class="p-3 border rounded-xl bg-stone-50 text-stone-500">No hay procesadoras. <a href="/app/procesadoras" class="text-sky-600 hover:underline">Registra una</a>.</div><input type="hidden" name="procesadora" value=""></div>`;
            return createSelect('procesadora', 'Asociar Procesadora', procesadoras.map(p => p.nombre_comercial || p.razon_social), selectedValue);
        } catch (error) { return `<div class="text-red-500">Error al cargar procesadoras.</div>`; }
    }
    async function createLugarProcesoSelectHTML(selectedValue = '') {
        try {
            const [fincas, procesadoras] = await Promise.all([api('/api/fincas'), api('/api/procesadoras')]);
            let optionsHTML = '<option value="">Seleccionar lugar...</option>';
            if(fincas.length > 0) {
                optionsHTML += `<optgroup label="Fincas">`;
                optionsHTML += fincas.map(f => `<option value="Finca: ${f.nombre_finca}" ${`Finca: ${f.nombre_finca}` === selectedValue ? 'selected' : ''}>${f.nombre_finca}</option>`).join('');
                optionsHTML += `</optgroup>`;
            }
            if(procesadoras.length > 0) {
                optionsHTML += `<optgroup label="Procesadoras">`;
                optionsHTML += procesadoras.map(p => `<option value="Procesadora: ${p.nombre_comercial || p.razon_social}" ${`Procesadora: ${p.nombre_comercial || p.razon_social}` === selectedValue ? 'selected' : ''}>${p.nombre_comercial || p.razon_social}</option>`).join('');
                optionsHTML += `</optgroup>`;
            }
            return `<div><label for="lugarProceso" class="block text-sm font-medium text-stone-700 mb-1">Lugar del Proceso</label><select id="lugarProceso" name="lugarProceso" class="w-full p-3 border border-stone-300 rounded-xl" required>${optionsHTML}</select></div>`;
        } catch (error) {
            return `<div class="text-red-500">Error al cargar lugares.</div>`;
        }
    }

    function getBatchByPath(path) { if (!path) return null; const ids = path.split('>'); let currentBatch = null; let currentList = state.batches; for (let i = 0; i < ids.length; i++) { const [type, key] = ids[i].split(':'); currentBatch = currentList.find(b => b.id === key); if (!currentBatch) return null; const nextKey = processConfig[type]?.plural; if (i < ids.length - 1) currentList = currentBatch[nextKey] || []; } return currentBatch; }
    function getParentBatchByPath(path) { if (!path || !path.includes('>')) return null; const parentPath = path.split('>').slice(0, -1).join('>'); return getBatchByPath(parentPath); }
    function calculateAvailableWeight(batch, type) { const config = processConfig[type]; if (!config.plural) return 0; const totalOutput = parseFloat(batch[config.outputWeightField]) || 0; const children = batch[config.plural] || []; const assignedWeight = children.reduce((sum, child) => sum + (parseFloat(child[processConfig[type].outputWeightField]) || 0), 0); return totalOutput - assignedWeight; }
    
    dashboardView.addEventListener('click', async e => {
        const button = e.target.closest('button');
        if (!button) return;
        const { path, type } = button.dataset;
        if (button.classList.contains('add-sub-btn')) { openFormModal('create', processConfig[type].singular, path); }
        if (button.classList.contains('edit-btn')) { openFormModal('edit', type, path); }
        if (button.classList.contains('delete-btn')) {
            const batchId = path.split('>').pop().split(':')[1];
            if (confirm('¿Seguro que quieres eliminar este lote?')) {
                try { await api(`/api/batches/${batchId}`, { method: 'DELETE' }); await loadBatches(); } catch (error) { alert('Error al eliminar: ' + error.message); }
            }
        }
        if (button.classList.contains('qr-btn')) { 
            const url = `${window.location.origin}/trazabilidad.html?lote=${button.dataset.id}`; const qr = qrcode(0, 'L'); qr.addData(url); qr.make();
            const link = document.createElement('a'); link.href = qr.createDataURL(10, 5); link.download = `QR_${button.dataset.id}.png`; link.click();
        }
    });

    init();
});

