document.addEventListener('DOMContentLoaded', () => {
    const templatesList = document.getElementById('templates-list');
    const newTemplateNameInput = document.getElementById('new-template-name');
    const newTemplateDescInput = document.getElementById('new-template-desc');
    const addTemplateBtn = document.getElementById('add-template-btn');
    const stagesView = document.getElementById('stages-view');
    const editTemplateModal = document.getElementById('edit-template-modal');
    const editStageModal = document.getElementById('edit-stage-modal');
    let templates = [];
    let selectedTemplateId = null;

    async function loadTemplates() {
        try {
            templates = await api('/api/templates');
            renderTemplates();
            if (templates.length > 0 && !templates.find(t => t.id === selectedTemplateId)) {
                selectedTemplateId = templates[0].id;
            }
            if (selectedTemplateId) {
                await selectTemplate(selectedTemplateId);
            } else {
                 stagesView.innerHTML = `<p class="text-center text-stone-500">No hay plantillas. Crea una para empezar.</p>`;
            }
        } catch (error) {
            console.error("Error al cargar plantillas:", error);
        }
    }

    function renderTemplates() {
        templatesList.innerHTML = templates.map(t => `
            <div class="p-3 border rounded-xl cursor-pointer hover:bg-amber-50 ${t.id === selectedTemplateId ? 'bg-amber-100 border-amber-800' : ''}" data-id="${t.id}">
                <div class="flex justify-between items-center">
                    <span class="font-semibold flex-grow">${t.nombre_producto}</span>
                    <div class="flex items-center flex-shrink-0">
                        <button data-id="${t.id}" class="edit-template-btn text-sky-600 hover:text-sky-800 p-1 rounded-full"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd"></path></svg></button>
                        <button data-id="${t.id}" class="delete-template-btn text-red-500 hover:text-red-700 text-xl font-bold leading-none p-1">&times;</button>
                    </div>
                </div>
                <p class="text-sm text-stone-500 mt-1">${t.descripcion || ''}</p>
            </div>
        `).join('');
    }
    
    async function selectTemplate(templateId) {
        selectedTemplateId = templateId;
        renderTemplates();
        try {
            const stages = await api(`/api/templates/${templateId}/stages`);
            renderStages(stages);
        } catch (error) {
            console.error("Error al cargar etapas:", error);
        }
    }

    function renderStages(stages) {
        const template = templates.find(t => t.id === selectedTemplateId);
        if (!template) {
             stagesView.innerHTML = `<p class="text-center text-stone-500">Selecciona una plantilla para ver o editar sus etapas.</p>`;
             return;
        }
        stagesView.innerHTML = `
            <h2 class="text-2xl font-display text-amber-900 border-b pb-2 mb-6">Etapas para "${template.nombre_producto}"</h2>
            <div id="stages-list" class="space-y-4 mb-6">
                ${stages.map(s => createStageCard(s)).join('') || '<p class="text-stone-500">Aún no hay etapas para esta plantilla.</p>'}
            </div>
            <div class="pt-6 border-t">
                <h3 class="text-xl font-display text-amber-800 mb-4">Añadir Nueva Etapa</h3>
                <form id="stage-form" class="space-y-4">
                    <input type="text" name="nombre_etapa" placeholder="Nombre de la etapa (ej. Cosecha)" class="w-full p-3 border rounded-xl" required>
                    
                    ${createFieldBuilder('entradas', 'Entradas')}
                    ${createFieldBuilder('salidas', 'Salidas')}
                    ${createFieldBuilder('variables', 'Variables')}

                    <button type="submit" class="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-8 rounded-xl">Añadir Etapa</button>
                </form>
            </div>
        `;
    }

    function createFieldBuilder(type, title) {
        return `<div class="p-4 border rounded-lg"><h4 class="font-semibold mb-2">${title}</h4><div class="grid grid-cols-2 gap-2 text-xs text-stone-500 mb-2 px-2"><span>Etiqueta (Visible)</span><span>Tipo de Campo</span></div><div id="${type}-fields-container" class="space-y-2"></div><button type="button" class="add-field-btn mt-2 text-sm text-sky-600 hover:text-sky-800" data-type="${type}">+ Añadir Campo</button></div>`;
    }

    function addField(containerId, data = {label: '', type: 'text'}) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const fieldCount = container.children.length;
        const type = containerId.replace(/^edit-/, '').replace(/-fields-container$/, '');
        const fieldHtml = `<div class="grid grid-cols-2 gap-2 field-row"><input type="text" name="${type}_label_${fieldCount}" value="${data.label}" placeholder="ej. Peso Mazorcas (kg)" class="p-2 border rounded-md text-sm" required><select name="${type}_type_${fieldCount}" class="p-2 border rounded-md text-sm bg-white"><option value="text" ${data.type === 'text' ? 'selected' : ''}>Texto</option><option value="number" ${data.type === 'number' ? 'selected' : ''}>Número</option><option value="date" ${data.type === 'date' ? 'selected' : ''}>Fecha</option><option value="textarea" ${data.type === 'textarea' ? 'selected' : ''}>Área de Texto</option><option value="selectFinca" ${data.type === 'selectFinca' ? 'selected' : ''}>Selector de Finca</option><option value="selectProcesadora" ${data.type === 'selectProcesadora' ? 'selected' : ''}>Selector de Procesadora</option><option value="selectPerfil" ${data.type === 'selectPerfil' ? 'selected' : ''}>Selector de Perfil</option><option value="selectLugar" ${data.type === 'selectLugar' ? 'selected' : ''}>Selector de Lugar</option><option value="image" ${data.type === 'image' ? 'selected' : ''}>Imagen</option></select></div>`;
        container.insertAdjacentHTML('beforeend', fieldHtml);
    }
    
    function createStageCard(stage) {
        const campos = stage.campos_json || { entradas: [], salidas: [], variables: [] };
        return `<div class="p-4 border rounded-xl bg-stone-50"><div class="flex justify-between items-center"><h4 class="font-bold text-lg">${stage.orden}. ${stage.nombre_etapa}</h4><div class="flex items-center"><button data-id="${stage.id}" class="edit-stage-btn text-sky-600 hover:text-sky-800 p-1 rounded-full"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd"></path></svg></button><button data-id="${stage.id}" class="delete-stage-btn text-red-500 hover:text-red-700 text-2xl font-bold leading-none">&times;</button></div></div><div class="text-xs mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2"><div><strong class="text-stone-500">Entradas:</strong> ${campos.entradas.map(c => c.label).join(', ') || 'N/A'}</div><div><strong class="text-stone-500">Salidas:</strong> ${campos.salidas.map(c => c.label).join(', ') || 'N/A'}</div><div><strong class="text-stone-500">Variables:</strong> ${campos.variables.map(c => c.label).join(', ') || 'N/A'}</div></div></div>`;
    }
    
    function toCamelCase(str) {
        return str.replace(/\((.*?)\)/g, "").replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/).map((word, index) => index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
    }

    // --- Eventos ---
    addTemplateBtn.addEventListener('click', async () => {
        const name = newTemplateNameInput.value.trim();
        const desc = newTemplateDescInput.value.trim();
        if (!name) return;
        try {
            await api('/api/templates', { method: 'POST', body: JSON.stringify({ nombre_producto: name, descripcion: desc }) });
            newTemplateNameInput.value = '';
            newTemplateDescInput.value = '';
            await loadTemplates();
        } catch (error) {
            alert('Error al crear plantilla.');
        }
    });

    templatesList.addEventListener('click', e => {
        const templateCard = e.target.closest('[data-id]');
        if (templateCard) {
            const templateId = parseInt(templateCard.dataset.id, 10);
            if (e.target.closest('.delete-template-btn')) {
                e.stopPropagation();
                if (confirm('¿Seguro que quieres eliminar esta plantilla y todas sus etapas?')) {
                    api(`/api/templates/${templateId}`, { method: 'DELETE' }).then(() => {
                        selectedTemplateId = null;
                        loadTemplates();
                    });
                }
            } else if (e.target.closest('.edit-template-btn')) {
                e.stopPropagation();
                const template = templates.find(t => t.id === templateId);
                if(template) openEditTemplateModal(template);
            } else {
                selectTemplate(templateId);
            }
        }
    });
    
    stagesView.addEventListener('click', async e => {
        if (e.target.classList.contains('add-field-btn')) {
            addField(e.target.dataset.type + '-fields-container');
        }
        const deleteBtn = e.target.closest('.delete-stage-btn');
        if (deleteBtn) {
            const stageId = deleteBtn.dataset.id;
            if (confirm('¿Seguro que quieres eliminar esta etapa?')) {
                await api(`/api/templates/stages/${stageId}`, { method: 'DELETE' });
                await selectTemplate(selectedTemplateId);
            }
        }
        const editBtn = e.target.closest('.edit-stage-btn');
        if(editBtn) {
             const stageId = parseInt(editBtn.dataset.id, 10);
             const stages = await api(`/api/templates/${selectedTemplateId}/stages`);
             const stage = stages.find(s => s.id === stageId);
             if (stage) openEditStageModal(stage);
        }
    });

    stagesView.addEventListener('submit', async e => {
        e.preventDefault();
        if (e.target.id === 'stage-form') {
            const formData = new FormData(e.target);
            const data = {
                nombre_etapa: formData.get('nombre_etapa'),
                campos_json: { entradas: [], salidas: [], variables: [] }
            };
            ['entradas', 'salidas', 'variables'].forEach(type => {
                let i = 0;
                while (formData.has(`${type}_label_${i}`)) {
                    const label = formData.get(`${type}_label_${i}`);
                    data.campos_json[type].push({
                        label: label,
                        name: toCamelCase(label),
                        type: formData.get(`${type}_type_${i}`)
                    });
                    i++;
                }
            });
            try {
                await api(`/api/templates/${selectedTemplateId}/stages`, { method: 'POST', body: JSON.stringify(data) });
                await selectTemplate(selectedTemplateId);
            } catch (error) {
                alert('Error al añadir etapa.');
            }
        }
    });

    function openEditTemplateModal(template) {
        editTemplateModal.innerHTML = `<div class="p-6"><form id="edit-template-form"><h2 class="text-2xl font-display text-amber-900 border-b pb-2 mb-6">Editar Plantilla</h2><div class="space-y-4"><div><label for="edit-template-name" class="block text-sm font-medium text-stone-700 mb-1">Nombre del Producto</label><input type="text" id="edit-template-name" value="${template.nombre_producto}" class="w-full p-3 border border-stone-300 rounded-xl" required></div><div><label for="edit-template-desc" class="block text-sm font-medium text-stone-700 mb-1">Descripción</label><textarea id="edit-template-desc" class="w-full p-3 border border-stone-300 rounded-xl" rows="3">${template.descripcion || ''}</textarea></div></div><div class="flex justify-end gap-4 mt-6"><button type="button" class="cancel-edit-modal-btn bg-stone-300 hover:bg-stone-400 font-bold py-2 px-6 rounded-xl">Cancelar</button><button type="submit" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl">Guardar Cambios</button></div></form></div>`;
        editTemplateModal.showModal();
        editTemplateModal.querySelector('.cancel-edit-modal-btn').addEventListener('click', () => editTemplateModal.close());
        editTemplateModal.addEventListener('click', (e) => { if (e.target.id === 'edit-template-modal') editTemplateModal.close(); });
        editTemplateModal.querySelector('#edit-template-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const updatedData = {
                nombre_producto: document.getElementById('edit-template-name').value.trim(),
                descripcion: document.getElementById('edit-template-desc').value.trim()
            };
            if (!updatedData.nombre_producto) { alert("El nombre del producto no puede estar vacío."); return; }
            try {
                await api(`/api/templates/${template.id}`, { method: 'PUT', body: JSON.stringify(updatedData) });
                editTemplateModal.close();
                await loadTemplates();
            } catch (error) {
                alert(`Error al actualizar la plantilla: ${error.message}`);
            }
        });
    }

    function openEditStageModal(stage) {
        let fieldsHtml = '';
        ['entradas', 'salidas', 'variables'].forEach(type => {
            let fieldRows = '';
            if (stage.campos_json[type]) {
                stage.campos_json[type].forEach((field, index) => {
                    fieldRows += `<div class="grid grid-cols-2 gap-2 field-row"><input type="text" name="${type}_label_${index}" value="${field.label}" class="p-2 border rounded-md text-sm"><select name="${type}_type_${index}" class="p-2 border rounded-md text-sm bg-white"><option value="text" ${field.type === 'text' ? 'selected' : ''}>Texto</option><option value="number" ${field.type === 'number' ? 'selected' : ''}>Número</option><option value="date" ${field.type === 'date' ? 'selected' : ''}>Fecha</option><option value="textarea" ${field.type === 'textarea' ? 'selected' : ''}>Área de Texto</option><option value="selectFinca" ${field.type === 'selectFinca' ? 'selected' : ''}>Selector de Finca</option><option value="selectProcesadora" ${field.type === 'selectProcesadora' ? 'selected' : ''}>Selector de Procesadora</option><option value="selectPerfil" ${field.type === 'selectPerfil' ? 'selected' : ''}>Selector de Perfil</option><option value="selectLugar" ${field.type === 'selectLugar' ? 'selected' : ''}>Selector de Lugar</option><option value="image" ${field.type === 'image' ? 'selected' : ''}>Imagen</option></select></div>`;
                });
            }
            fieldsHtml += `<div class="p-4 border rounded-lg mt-4"><h4 class="font-semibold mb-2">${type.charAt(0).toUpperCase() + type.slice(1)}</h4><div id="edit-${type}-fields-container" class="space-y-2">${fieldRows}</div><button type="button" class="add-field-btn mt-2 text-sm text-sky-600" data-type="edit-${type}">+ Añadir Campo</button></div>`;
        });

        editStageModal.innerHTML = `
            <div class="p-6">
                <form id="edit-stage-form">
                    <h2 class="text-2xl font-display text-amber-900 border-b pb-2 mb-6">Editar Etapa: ${stage.nombre_etapa}</h2>
                    <div class="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                         <div><label for="edit-stage-name" class="block text-sm font-medium text-stone-700 mb-1">Nombre de la Etapa</label><input type="text" name="nombre_etapa" id="edit-stage-name" value="${stage.nombre_etapa}" class="w-full p-3 border border-stone-300 rounded-xl" required></div>
                        ${fieldsHtml}
                    </div>
                    <div class="flex justify-end gap-4 mt-6">
                        <button type="button" class="cancel-edit-modal-btn bg-stone-300 hover:bg-stone-400 font-bold py-2 px-6 rounded-xl">Cancelar</button>
                        <button type="submit" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        `;
        editStageModal.showModal();

        editStageModal.querySelector('.cancel-edit-modal-btn').addEventListener('click', () => editStageModal.close());
        editStageModal.addEventListener('click', (e) => { if (e.target.id === 'edit-stage-modal') editStageModal.close(); });
        
        editStageModal.querySelectorAll('.add-field-btn').forEach(btn => {
            btn.addEventListener('click', e => addField(e.target.dataset.type + '-fields-container'));
        });

        editStageModal.querySelector('#edit-stage-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const updatedData = {
                nombre_etapa: formData.get('nombre_etapa'),
                campos_json: { entradas: [], salidas: [], variables: [] }
            };
            ['entradas', 'salidas', 'variables'].forEach(type => {
                let i = 0;
                while (formData.has(`${type}_label_${i}`)) {
                    const label = formData.get(`${type}_label_${i}`);
                    updatedData.campos_json[type].push({ label: label, name: toCamelCase(label), type: formData.get(`${type}_type_${i}`) });
                    i++;
                }
            });

            try {
                await api(`/api/templates/stages/${stage.id}`, { method: 'PUT', body: JSON.stringify(updatedData) });
                editStageModal.close();
                await selectTemplate(selectedTemplateId);
            } catch (error) {
                alert(`Error al actualizar la etapa: ${error.message}`);
            }
        });
    }

    loadTemplates();
});

