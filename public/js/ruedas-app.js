/**
 * Flavor Wheels Admin Application Logic
 */

let currentRuedaData = {
    tipo: 'cafe',
    notas_json: []
};
let allFlavorWheels = {};
let userRuedas = [];

async function init() {
    await loadFlavorWheelData();
    await loadUserRuedas();
}

async function loadFlavorWheelData() {
    try {
        const response = await fetch('/data/flavor-wheels.json');
        allFlavorWheels = await response.json();
    } catch (e) {
        console.error("Error loading flavor wheel data:", e);
    }
}

async function loadUserRuedas() {
    try {
        const response = await fetch('/api/ruedas', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        userRuedas = await response.json();
        renderRuedasGrid();
    } catch (e) {
        console.error("Error loading user ruedas:", e);
    }
}

function renderRuedasGrid() {
    const container = document.getElementById('ruedas-container');
    if (userRuedas.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-24 bg-white rounded-[2rem] border-2 border-dashed border-gray-100">
                <div class="w-20 h-20 bg-gray-50 text-gray-300 rounded-3xl flex items-center justify-center mx-auto mb-6 text-3xl">
                    <i class="fas fa-bullseye"></i>
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-2">No hay ruedas configuradas</h3>
                <p class="text-gray-400 max-w-xs mx-auto">Comienza creando una nueva rueda para tus productos.</p>
                <button onclick="openRuedaModal()" class="mt-8 bg-amber-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-amber-100 hover:scale-105 transition">
                    Crear mi primera rueda
                </button>
            </div>`;
        return;
    }

    container.innerHTML = userRuedas.map(rueda => `
        <div class="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500 group">
            <div class="flex justify-between items-start mb-6">
                <div class="w-14 h-14 rounded-2xl ${rueda.tipo === 'cafe' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'} flex items-center justify-center text-2xl transition-transform group-hover:scale-110">
                    <i class="fas ${rueda.tipo === 'cafe' ? 'fa-mug-hot' : 'fa-seedling'}"></i>
                </div>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="showSnippet('${rueda.public_token}')" title="Widget" class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors">
                        <i class="fas fa-code text-sm"></i>
                    </button>
                    <button onclick="downloadSvg('${rueda.id}')" title="Descargar SVG" class="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-600 hover:text-white transition-colors">
                        <i class="fas fa-download text-sm"></i>
                    </button>
                    <button onclick="editRueda('${rueda.id}')" title="Editar" class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-600 hover:text-white transition-colors">
                        <i class="fas fa-edit text-sm"></i>
                    </button>
                    <button onclick="deleteRueda('${rueda.id}')" title="Eliminar" class="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors">
                        <i class="fas fa-trash text-sm"></i>
                    </button>
                </div>
            </div>
            <h3 class="font-black text-xl text-gray-900 mb-1 group-hover:text-amber-600 transition-colors">${rueda.nombre_rueda}</h3>
            <div class="flex items-center gap-2 mb-6">
                <span class="text-[10px] font-black uppercase tracking-widest text-gray-400">Perfil:</span>
                <span class="text-[10px] font-black uppercase tracking-widest text-gray-600">${rueda.tipo}</span>
            </div>
            <div class="flex flex-wrap gap-2">
                ${(rueda.notas_json || []).slice(0, 4).map(note => `
                    <span class="text-[10px] px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-gray-500 font-bold tracking-tight">
                        ${typeof note === 'string' ? note : (note.subnote || note.name || 'Nota')}
                    </span>
                `).join('')}
                ${rueda.notas_json.length > 4 ? `
                    <span class="text-[10px] px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg font-bold">
                        +${rueda.notas_json.length - 4}
                    </span>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function openRuedaModal() {
    document.getElementById('rueda-id').value = '';
    document.getElementById('rueda-nombre').value = '';
    currentRuedaData = { tipo: 'cafe', notas_json: [] };
    document.getElementById('modal-title').innerText = 'Nuevo Perfil';
    
    // Reset radio buttons
    document.querySelector('input[name="rueda-tipo"][value="cafe"]').checked = true;
    
    switchTipo('cafe');
    document.getElementById('ruedaModal').classList.remove('hidden');
}

function switchTipo(tipo) {
    currentRuedaData.tipo = tipo;
    currentRuedaData.notas_json = [];
    renderSelectedNotes();
    renderChart();
}

function renderChart() {
    const data = allFlavorWheels[currentRuedaData.tipo];
    if (!data) return;

    SunburstChart.render('#sunburst-container', data, {
        selection: currentRuedaData.notas_json,
        onClick: (node) => {
            // Only toggle leaf nodes or nodes without children in the data
            if (!node.children || node.children.length === 0) {
                toggleNote(node);
            }
        }
    });
}

function toggleNote(nodeOrName) {
    let noteName, category;
    
    if (typeof nodeOrName === 'object' && nodeOrName.data) {
        // Viene del click en D3
        noteName = nodeOrName.data.name;
        let curr = nodeOrName;
        while (curr && curr.depth > 1) curr = curr.parent;
        category = (curr && curr.depth === 1) ? curr.data.name : noteName;
    } else {
        // Viene del click en la X del chip (solo string)
        noteName = nodeOrName;
    }

    const index = currentRuedaData.notas_json.findIndex(n => {
        if (typeof n === 'string') return n === noteName;
        return n.subnote === noteName;
    });

    if (index > -1) {
        currentRuedaData.notas_json.splice(index, 1);
    } else {
        currentRuedaData.notas_json.push({
            category: category || noteName,
            subnote: noteName
        });
    }
    renderSelectedNotes();
    renderChart();
}

function renderSelectedNotes() {
    const container = document.getElementById('selected-notes');
    if (currentRuedaData.notas_json.length === 0) {
        container.innerHTML = `
            <div class="w-full flex flex-col items-center justify-center text-center py-6 opacity-40">
                <i class="fas fa-plus-circle text-2xl mb-2"></i>
                <p class="text-[11px] font-bold uppercase tracking-tight">Haz clic en el gráfico para añadir descriptores</p>
            </div>`;
        return;
    }

    container.innerHTML = currentRuedaData.notas_json.map(note => {
        const name = typeof note === 'string' ? note : note.subnote;
        return `
            <div class="note-chip px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-black flex items-center gap-3 border border-amber-100 shadow-sm shadow-amber-500/5">
                ${name}
                <i class="fas fa-times cursor-pointer hover:text-red-500 transition-colors" onclick="toggleNote('${name}')"></i>
            </div>
        `;
    }).join('');
}

async function handleSave(e) {
    e.preventDefault();
    const id = document.getElementById('rueda-id').value;
    const nombre = document.getElementById('rueda-nombre').value;
    
    const payload = {
        nombre_rueda: nombre,
        tipo: currentRuedaData.tipo,
        notas_json: currentRuedaData.notas_json
    };

    const url = id ? `/api/ruedas/${id}` : '/api/ruedas';
    const method = id ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            closeRuedaModal();
            loadUserRuedas();
        } else {
            const err = await response.json();
            alert('Error: ' + (err.error || 'No se pudo guardar la rueda'));
        }
    } catch (e) {
        console.error("Error saving rueda:", e);
    }
}

function editRueda(id) {
    const rueda = userRuedas.find(r => r.id === id);
    if (!rueda) return;

    document.getElementById('rueda-id').value = rueda.id;
    document.getElementById('rueda-nombre').value = rueda.nombre_rueda;
    currentRuedaData = {
        tipo: rueda.tipo,
        notas_json: [...rueda.notas_json]
    };
    
    document.getElementById('modal-title').innerText = 'Editar Perfil';
    
    // Update radio buttons
    const radio = document.querySelector(`input[name="rueda-tipo"][value="${rueda.tipo}"]`);
    if (radio) radio.checked = true;

    renderSelectedNotes();
    renderChart();
    document.getElementById('ruedaModal').classList.remove('hidden');
}

async function deleteRueda(id) {
    if (!confirm('¿Estás seguro de eliminar esta rueda de sabor? Esta acción no se puede deshacer.')) return;

    try {
        const response = await fetch(`/api/ruedas/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            loadUserRuedas();
        }
    } catch (e) {
        console.error("Error deleting rueda:", e);
    }
}

function showSnippet(token) {
    const baseUrl = window.location.origin;
    const snippet = `<iframe src="${baseUrl}/widget/rueda/${token}" width="600" height="600" frameborder="0"></iframe>`;
    document.getElementById('snippet-code').value = snippet;
    document.getElementById('snippetModal').classList.remove('hidden');
}

function copySnippet() {
    const textarea = document.getElementById('snippet-code');
    textarea.select();
    document.execCommand('copy');
    
    // UI Feedback
    const btn = event.currentTarget;
    const icon = btn.querySelector('i');
    icon.classList.replace('fa-copy', 'fa-check');
    setTimeout(() => icon.classList.replace('fa-check', 'fa-copy'), 2000);
}

function closeRuedaModal() {
    document.getElementById('ruedaModal').classList.add('hidden');
}

function downloadSvg(id) {
    const rueda = userRuedas.find(r => r.id === id);
    if (!rueda) return;

    const data = allFlavorWheels[rueda.tipo];
    if (!data) return;

    // Usar el contenedor temporal para renderizar el SVG completo
    const tempContainer = document.getElementById('temp-svg-container');
    tempContainer.style.display = 'block'; // d3 a veces necesita que esté visible para calcular tamaños, aunque viewBox salva esto.
    
    // Opciones para SVG descargable
    const options = {
        selection: rueda.notas_json,
        isWidget: true, // Para el branding central
        width: 800,
        height: 800
    };

    // Renderizar
    SunburstChart.render('#temp-svg-container', data, options);

    // Pequeño delay por si d3 hace transiciones (aunque con animation=false no debería)
    setTimeout(() => {
        const svgEl = tempContainer.querySelector('svg');
        if (!svgEl) {
            tempContainer.style.display = 'none';
            return;
        }

        // Asegurar namespaces XML para SVG puro y compatible con Canva/Illustrator
        if (!svgEl.getAttribute('xmlns')) {
            svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }
        if (!svgEl.getAttribute('xmlns:xlink')) {
            svgEl.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        }

        // Canva a veces necesita width y height explícitos
        svgEl.setAttribute('width', options.width);
        svgEl.setAttribute('height', options.height);

        let svgData = new XMLSerializer().serializeToString(svgEl);
        
        // Fix para algunos navegadores que reemplazan xmlns:xlink
        svgData = svgData.replace(/NS\\d+:href/gi, 'xlink:href');

        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `rueda_sabor_${rueda.nombre_rueda.replace(/\s+/g, '_')}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
        tempContainer.innerHTML = '';
        tempContainer.style.display = 'none';
    }, 50);
}

// Global Event Listeners
document.getElementById('ruedaForm').addEventListener('submit', handleSave);

// Global access for onclick in HTML strings
window.toggleNote = toggleNote;
window.editRueda = editRueda;
window.deleteRueda = deleteRueda;
window.showSnippet = showSnippet;
window.downloadSvg = downloadSvg;

init();
