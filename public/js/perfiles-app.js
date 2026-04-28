// public/js/perfiles-app.js

let sensoryConfig = {};
let perfilesData = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const configRes = await fetch('/data/perfiles.json');
        sensoryConfig = await configRes.json();

        // Populate the select dropdown with types from JSON
        const typeSelect = document.getElementById('perfil-tipo');
        if (typeSelect) {
            typeSelect.innerHTML = Object.keys(sensoryConfig).map(type => `
                <option value="${type}">${type.charAt(0).toUpperCase() + type.slice(1)}</option>
            `).join('');

            typeSelect.addEventListener('change', () => renderAttributes());
        }

        await loadPerfiles();
        document.getElementById('perfilForm').addEventListener('submit', handleSavePerfil);
        document.getElementById('atributos-container').addEventListener('input', updateRadarPreview);

        // Initial render for empty form
        renderAttributes();

    } catch (err) {
        console.error("Error initializing app:", err);
    }
});

async function loadPerfiles() {
    const container = document.getElementById('perfiles-container');
    try {
        const res = await fetch('/api/perfiles');
        if (!res.ok) throw new Error("Error loading profiles");

        perfilesData = await res.json();

        if (perfilesData.length === 0) {
            container.innerHTML = `<div class="text-center text-gray-400 py-12 col-span-full">No hay perfiles creados.</div>`;
            return;
        }

        container.innerHTML = perfilesData.map(p => `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between hover:shadow-md transition w-80">
                <div>
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold text-gray-900">${p.nombre_perfil}</h3>
                        <span class="text-xs font-bold uppercase tracking-wide px-2 py-1 bg-gray-100 text-gray-500 rounded">${p.tipo}</span>
                    </div>
                    <div class="text-sm text-gray-500 mb-4">
                        Puntaje: <span class="font-bold text-amber-600">${p.puntaje_sca || 'N/A'}</span>
                    </div>
                    <div class="w-full h-64 flex items-center justify-center mb-4 bg-gray-50 rounded-lg">
                        <svg id="radar-${p.id}" class="w-full h-full"></svg>
                    </div>
                </div>
                <div class="flex justify-between border-t border-gray-100 pt-4 mt-2">
                    <button onclick="showSnippet('${p.public_token}')" class="text-xs text-blue-600 hover:text-blue-800 font-medium">
                        <i class="fas fa-code mr-1"></i> Iframe
                    </button>
                    <div class="flex gap-3 text-xs">
                        <button onclick="editPerfil('${p.id}')" class="text-gray-400 hover:text-amber-600 transition"><i class="fas fa-pen"></i></button>
                        <button onclick="deletePerfil('${p.id}')" class="text-gray-400 hover:text-red-600 transition"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `).join('');

        // Render D3 for all cards
        setTimeout(() => {
            perfilesData.forEach(p => {
                const config = formatDataForD3(p.tipo, p.perfil_data);
                if (config) renderRadarChart(`#radar-${p.id}`, config, { maxValue: 10 });
            });
        }, 100);

    } catch (e) {
        container.innerHTML = `<div class="text-center text-red-500 py-12 col-span-full">Error al cargar.</div>`;
    }
}

function formatDataForD3(tipo, data) {
    const list = sensoryConfig[tipo];
    if (!list) return null;

    const labels = [];
    const values = [];

    list.forEach(attr => {
        labels.push(attr.label);
        values.push(parseFloat(data[attr.id]) || 0);
    });

    const colors = {
        cafe: '#d97706',
        cacao: '#7c2d12',
        miel: '#fbbf24'
    };

    return {
        labels,
        datasets: [{
            data: values,
            color: colors[tipo] || '#3b82f6'
        }]
    };
}

function renderAttributes(existingData = {}) {
    const tipo = document.getElementById('perfil-tipo').value;
    const container = document.getElementById('atributos-container');
    const list = sensoryConfig[tipo];

    if (!list) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = list.map(attr => {
        const val = existingData[attr.id] || 0;
        return `
            <div class="flex items-center gap-4">
                <label class="w-1/3 text-xs font-medium text-gray-600">${attr.label}</label>
                <input type="range" name="attr_${attr.id}" min="0" max="10" step="0.25" value="${val}" class="flex-1">
                <span class="text-xs font-bold text-gray-800 w-8 text-right attr-value-display">${val}</span>
            </div>
        `;
    }).join('');

    container.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.nextElementSibling.textContent = e.target.value;
            updateRadarPreview();
        });
    });

    updateRadarPreview();
}

function updateRadarPreview() {
    const tipo = document.getElementById('perfil-tipo').value;
    const list = sensoryConfig[tipo];
    if (!list) return;

    const currentData = {};
    list.forEach(attr => {
        const input = document.querySelector(`input[name="attr_${attr.id}"]`);
        currentData[attr.id] = input ? parseFloat(input.value) : 0;
    });

    const config = formatDataForD3(tipo, currentData);
    if (config) renderRadarChart('#radarPreview', config, { maxValue: 10 });
}

function editPerfil(id) {
    const p = perfilesData.find(x => x.id === id);
    if (!p) return;

    document.getElementById('modal-title').textContent = 'Editar Perfil Sensorial';
    document.getElementById('perfil-id').value = p.id;
    document.getElementById('perfil-nombre').value = p.nombre_perfil;
    document.getElementById('perfil-tipo').value = p.tipo;
    document.getElementById('perfil-puntaje').value = p.puntaje_sca || '';

    renderAttributes(p.perfil_data);
    document.getElementById('perfilModal').classList.remove('hidden');
}

async function handleSavePerfil(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    const id = document.getElementById('perfil-id').value;
    const tipo = document.getElementById('perfil-tipo').value;
    const list = sensoryConfig[tipo];

    const perfil_data = {};
    list.forEach(attr => {
        const input = document.querySelector(`input[name="attr_${attr.id}"]`);
        perfil_data[attr.id] = input ? parseFloat(input.value) : 0;
    });

    const data = {
        nombre_perfil: document.getElementById('perfil-nombre').value,
        tipo,
        puntaje_sca: parseFloat(document.getElementById('perfil-puntaje').value) || null,
        perfil_data
    };

    try {
        const url = id ? `/api/perfiles/${id}` : '/api/perfiles';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            closeModal();
            loadPerfiles();
        } else {
            const err = await res.json();
            alert('Error: ' + err.error);
        }
    } catch (err) {
        alert('Error de red');
    } finally {
        btn.disabled = false;
    }
}

async function deletePerfil(id) {
    if (!confirm('¿Eliminar perfil de forma permanente?')) return;
    try {
        await fetch(`/api/perfiles/${id}`, { method: 'DELETE' });
        loadPerfiles();
    } catch (e) {
        alert('Error al eliminar');
    }
}

function showSnippet(token) {
    const protocol = window.location.protocol;
    const host = window.location.host;
    const url = `${protocol}//${host}/widget/radar/${token}`;

    const iframeCode = `<iframe src="${url}" width="100%" height="400" frameborder="0" loading="lazy" style="border:none; overflow:hidden;"></iframe>`;

    document.getElementById('snippet-code').value = iframeCode;
    document.getElementById('snippetModal').classList.remove('hidden');
}

function copySnippet() {
    const text = document.getElementById('snippet-code');
    text.select();
    navigator.clipboard.writeText(text.value).then(() => {
        alert('Código copiado al portapapeles');
    });
}

function closeModal() {
    document.getElementById('perfilModal').classList.add('hidden');
    document.getElementById('perfilForm').reset();
    document.getElementById('perfil-id').value = '';
    document.getElementById('modal-title').textContent = 'Nuevo Perfil Sensorial';
    renderAttributes();
}