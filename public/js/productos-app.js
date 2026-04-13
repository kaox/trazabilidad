import { compressImage } from './file-utils.js';

// ESTADO LOCAL
let currentImages = [];
let currentAwards = [];
let currentAwardIcon = null;
let productsCache = [];
let nutritionalRecipes = [];
let perfilesCache = [];
let ruedasCache = [];
let flavorWheelsCache = null;
let awardsConfig = {};
let fincasCache = [];
let unitsCache = [];
let currenciesCache = [];

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadAwardsConfig();
    loadNutritionalRecipes();
    loadPerfiles();
    loadRuedas();
    loadRelations();
});

// --- CARGA DE RELACIONES ESTÁTICAS ---
async function loadRelations() {
    try {
        const [fincasRes, unitsRes, currenciesRes, flavorsRes] = await Promise.all([
            api('/api/fincas'),
            api('/api/config/units'),
            api('/api/config/currencies'),
            fetch('/data/flavor-wheels.json').then(r => r.ok ? r.json() : null).catch(() => null)
        ]);

        if (flavorsRes) flavorWheelsCache = flavorsRes;
        fincasCache = fincasRes;
        unitsCache = unitsRes;
        currenciesCache = currenciesRes;

        const fincaSelect = document.getElementById('finca_id');
        if (fincaSelect) {
            fincaSelect.innerHTML = '<option value="">-- Sin Finca Asociada --</option>' +
                fincasCache.map(f => `<option value="${f.id}">${f.nombre_finca}</option>`).join('');
        }

        const unitSelect = document.getElementById('unit_id');
        if (unitSelect) {
            unitSelect.innerHTML = '<option value="">...</option>' +
                unitsCache.map(u => `<option value="${u.id}">${u.code}</option>`).join('');
        }

        const currencySelect = document.getElementById('currency_id');
        if (currencySelect) {
            currencySelect.innerHTML = '<option value="">...</option>' +
                currenciesCache.map(c => `<option value="${c.id}">${c.code}</option>`).join('');
        }

    } catch (error) {
        console.warn("Error cargando relaciones secundarias:", error);
    }
}

// --- CARGA DE DATOS MAESTROS ---
async function loadPerfiles() {
    try {
        const perfiles = await api('/api/perfiles');
        perfilesCache = perfiles;
    } catch (e) { console.warn("Error cargando perfiles:", e); }
}

async function loadRuedas() {
    try {
        const ruedas = await api('/api/ruedas-sabores');
        ruedasCache = ruedas;
    } catch (e) { console.warn("Error cargando ruedas:", e); }
}

async function loadNutritionalRecipes() {
    try {
        const recipes = await api('/api/nutricion/recetas');
        nutritionalRecipes = recipes;
        const select = document.getElementById('receta_nutricional');
        if (select) {
            select.innerHTML = '<option value="">-- Sin información nutricional --</option>' +
                recipes.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
        }
    } catch (e) { console.warn("Error cargando recetas nutricionales:", e); }
}

async function loadAwardsConfig() {
    try {
        const response = await fetch('/data/premios.json');
        if (response.ok) {
            const data = await response.json();
            awardsConfig = data.premios;
        }
    } catch (error) { console.error("Error cargando premios:", error); }
}

// --- ACTUALIZACIÓN DE SELECTORES SENSORIALES ---
function updateSensorySelects(type, selectedPerfil = null, selectedRueda = null) {
    const perfilWrapper = document.getElementById('perfil-wrapper');
    const ruedaWrapper = document.getElementById('rueda-wrapper');

    // Normalizar tipo para filtrado (cafe/cacao)
    let filterType = type;
    if (type !== 'cafe' && type !== 'cacao') filterType = null;

    // 1. Manejo de Perfiles
    if (perfilWrapper) {
        const filteredPerfiles = filterType
            ? perfilesCache.filter(p => p.tipo === filterType)
            : perfilesCache;

        if (filteredPerfiles.length === 0 && filterType) {
            perfilWrapper.innerHTML = `
                <label class="block text-sm font-medium text-stone-700 mb-1">Perfil Sensorial (${type})</label>
                <div class="p-4 border-2 border-dashed border-blue-200 rounded-xl text-center bg-blue-50/50 hover:bg-blue-50 transition group">
                    <i class="fas fa-sliders-h text-blue-400 mb-1 text-lg group-hover:scale-110 transition-transform"></i>
                    <p class="text-xs text-stone-500 mb-2">No tienes perfiles de ${type}.</p>
                    <a href="/app/perfiles" target="_blank" class="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline">
                        Crear Perfil <i class="fas fa-external-link-alt ml-1"></i>
                    </a>
                </div>
                <input type="hidden" name="perfil_id" id="perfil_id" value="">
            `;
        } else {
            const options = filteredPerfiles.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
            perfilWrapper.innerHTML = `
                <label for="perfil_id" class="block text-sm font-medium text-stone-700 mb-1">Perfil Sensorial</label>
                <select id="perfil_id" name="perfil_id" class="w-full p-3 border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none">
                    <option value="">-- Seleccionar Perfil --</option>
                    ${options}
                </select>
            `;
            // Restaurar valor si estamos editando
            if (selectedPerfil && document.getElementById('perfil_id')) {
                document.getElementById('perfil_id').value = selectedPerfil;
            }
        }
    }

    // 2. Manejo de Ruedas
    if (ruedaWrapper) {
        const filteredRuedas = filterType
            ? ruedasCache.filter(r => r.tipo === filterType)
            : ruedasCache;

        if (filteredRuedas.length === 0 && filterType) {
            ruedaWrapper.innerHTML = `
                <label class="block text-sm font-medium text-stone-700 mb-1">Rueda de Sabor (${type})</label>
                <div class="p-4 border-2 border-dashed border-purple-200 rounded-xl text-center bg-purple-50/50 hover:bg-purple-50 transition group">
                    <i class="fas fa-chart-pie text-purple-400 mb-1 text-lg group-hover:scale-110 transition-transform"></i>
                    <p class="text-xs text-stone-500 mb-2">No tienes ruedas de ${type}.</p>
                    <a href="/app/ruedas-sabores" target="_blank" class="text-xs font-bold text-purple-700 hover:text-purple-900 hover:underline">
                        Crear Rueda <i class="fas fa-external-link-alt ml-1"></i>
                    </a>
                </div>
                <input type="hidden" name="rueda_id" id="rueda_id" value="">
             `;
        } else {
            const options = filteredRuedas.map(r => `<option value="${r.id}">${r.nombre_rueda}</option>`).join('');
            ruedaWrapper.innerHTML = `
                <label for="rueda_id" class="block text-sm font-medium text-stone-700 mb-1">Rueda de Sabor</label>
                <select id="rueda_id" name="rueda_id" class="w-full p-3 border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none">
                    <option value="">-- Seleccionar Rueda --</option>
                    ${options}
                </select>
             `;
            if (selectedRueda && document.getElementById('rueda_id')) {
                document.getElementById('rueda_id').value = selectedRueda;
            }
        }
    }
}

// --- EVENTOS ---
document.getElementById('tipo_producto').addEventListener('change', function (e) {
    const type = e.target.value;
    const section = document.getElementById('awards-section');
    const select = document.getElementById('award-select');

    // UI Dinámica para Café / Cacao
    const dynamicSection = document.getElementById('dynamic-fields-section');
    const cafeFields = document.getElementById('cafe-fields');
    const cacaoFields = document.getElementById('cacao-fields');

    if (type === 'cafe') {
        dynamicSection.classList.remove('hidden');
        cafeFields.classList.remove('hidden');
        cacaoFields.classList.add('hidden');
    } else if (type === 'cacao') {
        dynamicSection.classList.remove('hidden');
        cafeFields.classList.add('hidden');
        cacaoFields.classList.remove('hidden');
    } else {
        dynamicSection.classList.add('hidden');
        cafeFields.classList.add('hidden');
        cacaoFields.classList.add('hidden');
    }

    // 1. Actualizar Selectores Sensoriales
    updateSensorySelects(type);

    // 2. Lógica de Premios
    let jsonKey = type;
    if (type === 'cacao') jsonKey = 'chocolate';

    if (jsonKey && awardsConfig[jsonKey]) {
        section.classList.remove('hidden');
        const premiosDisponibles = awardsConfig[jsonKey].map(p => p.nombre);
        const options = [...premiosDisponibles, "Otro"];
        select.innerHTML = options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
    } else if (type === 'otro') {
        section.classList.remove('hidden');
        select.innerHTML = '<option value="Otro">Otro</option>';
    } else {
        section.classList.add('hidden');
    }
});

// Manejo de Imágenes
document.getElementById('file-upload').addEventListener('change', async function (e) {
    const files = Array.from(e.target.files);
    if (currentImages.length + files.length > 3) {
        alert("Máximo 3 imágenes por producto.");
        return;
    }

    const submitBtn = document.getElementById('save-product-btn');
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = "Procesando imágenes...";

    try {
        for (const file of files) {
            if (file.size > 8 * 1024 * 1024) {
                alert(`La imagen ${file.name} pesa más de 8MB y será omitida.`);
                continue;
            }
            const compressedBase64 = await compressImage(file);
            currentImages.push(compressedBase64);
        }
        renderImages();
    } catch (error) {
        console.error("Error al procesar imágenes:", error);
        alert("Hubo un error al procesar alguna imagen.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
        e.target.value = '';
    }
});

function renderImages() {
    const container = document.getElementById('image-upload-container');
    const uploadBtnHTML = currentImages.length < 3 ? `
        <div class="border-2 border-dashed border-stone-300 rounded-xl h-24 flex items-center justify-center cursor-pointer hover:bg-stone-50 transition" onclick="document.getElementById('file-upload').click()">
            <div class="text-center text-stone-400"><i class="fas fa-plus mb-1"></i><br><span class="text-xs">Subir</span></div>
        </div>` : '';

    const imagesHTML = currentImages.map((img, i) => `
        <div class="relative h-24 w-full group">
            <img src="${img}" class="w-full h-full object-cover rounded-xl border border-stone-200">
            <button type="button" onclick="removeImage(${i})" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition">&times;</button>
        </div>
    `).join('');

    container.innerHTML = imagesHTML + uploadBtnHTML;
}

window.removeImage = (index) => {
    currentImages.splice(index, 1);
    renderImages();
};

document.getElementById('award-icon-input').addEventListener('change', async function (e) {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert("El icono debe pesar menos de 5MB");
            this.value = '';
            return;
        }
        try {
            const base64 = await compressImage(file);
            currentAwardIcon = base64;
            document.getElementById('award-icon-preview').src = base64;
        } catch (err) {
            console.error(err);
            alert("Error procesando icono");
        }
    }
});

document.getElementById('add-award-btn').addEventListener('click', () => {
    const name = document.getElementById('award-select').value;
    const year = document.getElementById('award-year').value;

    if (name && year) {
        let logoUrl = null;
        if (currentAwardIcon) {
            logoUrl = currentAwardIcon;
        } else {
            const type = document.getElementById('tipo_producto').value;
            let jsonKey = type === 'cacao' ? 'chocolate' : type;
            if (awardsConfig[jsonKey]) {
                const awardData = awardsConfig[jsonKey].find(a => a.nombre === name);
                if (awardData) logoUrl = awardData.logo_url;
            }
        }
        currentAwards.push({ name, year, nombre: name, anio: year, logo_url: logoUrl });
        renderAwards();
        document.getElementById('award-year').value = '';
        document.getElementById('award-icon-input').value = '';
        document.getElementById('award-icon-preview').src = 'https://placehold.co/100?text=+';
        currentAwardIcon = null;
    } else {
        alert("Selecciona un premio y un año.");
    }
});

function renderAwards() {
    const list = document.getElementById('awards-list');
    list.innerHTML = currentAwards.map((a, i) => `
        <div class="flex justify-between items-center bg-stone-50 p-2 rounded-lg text-sm border border-stone-100">
            <span class="flex items-center gap-2">
                ${a.logo_url ? `<img src="${a.logo_url}" class="w-6 h-6 object-contain" alt="">` : '<i class="fas fa-trophy text-amber-500"></i>'} 
                ${a.nombre || a.name} (${a.anio || a.year})
            </span>
            <button type="button" onclick="removeAward(${i})" class="text-red-400 hover:text-red-600">&times;</button>
        </div>
    `).join('');
}

window.removeAward = (i) => {
    currentAwards.splice(i, 1);
    renderAwards();
};

// --- CRUD ---
async function loadProducts() {
    const grid = document.getElementById('products-grid');
    try {
        const products = await api('/api/productos');
        productsCache = products;

        if (products.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-16 bg-white rounded-2xl shadow-sm border border-stone-100">
                    <i class="fas fa-box-open text-4xl text-stone-200 mb-4"></i>
                    <p class="text-stone-500 font-medium">Aún no has creado productos.</p>
                </div>`;
            return;
        }

        grid.innerHTML = products.map(p => {
            const mainImage = (p.imagenes_json && p.imagenes_json.length > 0) ? p.imagenes_json[0] : 'https://placehold.co/100?text=Producto';
            const tipoIcon = p.tipo_producto === 'cafe' ? 'fa-mug-hot' : (p.tipo_producto === 'cacao' ? 'fa-cookie-bite' : 'fa-jar');
            const isPublished = (p.is_published !== 0 && p.is_published !== false);
            const opacityClass = isPublished ? '' : 'opacity-60 grayscale-[0.5] border-dashed';
            const statusBadge = isPublished ? '' : `<span class="absolute top-2 right-2 bg-stone-200 text-stone-600 text-[10px] font-bold px-2 py-1 rounded shadow-sm z-10">BORRADOR</span>`;
            const attr = p.atributos_dinamicos || {};
            const detailLabels = [];
            if (attr.proceso) detailLabels.push(`<span class="bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-100">${attr.proceso}</span>`);
            if (attr.nivel_tueste) detailLabels.push(`<span class="bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200">${attr.nivel_tueste}</span>`);
            if (attr.grupo_genetico) detailLabels.push(`<span class="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-100">${attr.grupo_genetico}</span>`);

            return `
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-stone-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col group ${opacityClass} relative">
                ${statusBadge}
                <div class="flex gap-4 mb-4">
                    <div class="relative w-24 h-24 flex-shrink-0">
                        <img src="${mainImage}" class="w-full h-full object-cover rounded-xl border border-stone-100 shadow-sm">
                        <span class="absolute -bottom-2 -right-2 bg-white text-amber-800 text-xs p-1.5 rounded-full shadow-md border border-stone-100"><i class="fas ${tipoIcon}"></i></span>
                    </div>
                    <div class="flex-grow min-w-0">
                        <h3 class="font-bold text-lg text-amber-900 leading-tight truncate" title="${p.nombre}">${p.nombre}</h3>
                        <div class="flex flex-wrap gap-1 mt-2 mb-2">
                           ${detailLabels.join('')}
                        </div>
                        <p class="text-sm font-bold text-stone-800">
                            ${p.peso ? `${p.peso} ${p.unit_code || ''}` : 'N/A'}
                            ${p.product_precio || p.precio ? ` | <span class="text-amber-800">${p.currency_symbol || ''}${p.product_precio || p.precio}</span>` : ''}
                        </p>
                        ${p.finca_nombre ? `<p class="text-[11px] text-green-700 mt-1 font-medium"><i class="fas fa-mountain"></i> ${p.finca_nombre}</p>` : ''}
                    </div>
                </div>
                
                <div class="flex-grow">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[10px] font-mono bg-stone-100 px-2 py-1 rounded text-stone-500 border border-stone-200"><i class="fas fa-barcode mr-1"></i> ${p.gtin || 'Pendiente'}</span>
                        ${p.receta_nutricional_nombre ? `<span class="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100" title="Receta: ${p.receta_nutricional_nombre}"><i class="fas fa-utensils"></i></span>` : ''}
                    </div>
                    
                    ${p.perfil_id ? `
                    <div class="flex items-center gap-2 mb-1 text-[11px] text-blue-700 font-medium">
                        <i class="fas fa-sliders-h w-4"></i> Profile: ${perfilesCache.find(x => x.id == p.perfil_id)?.nombre || 'Custom'}
                    </div>` : ''}
                    ${p.rueda_id ? `
                    <div class="flex items-center gap-2 mb-2 text-[11px] text-purple-700 font-medium">
                        <i class="fas fa-chart-pie w-4"></i> Flavor: ${ruedasCache.find(x => x.id == p.rueda_id)?.nombre_rueda || 'Custom'}
                    </div>` : ''}

                    <p class="text-sm text-stone-600 line-clamp-2 mb-2 italic">"${p.descripcion || 'Sin descripción comercial.'}"</p>
                </div>

                <div class="pt-4 border-t border-stone-100 mt-2 space-y-3">
                    <button onclick="downloadTechnicalSheet('${p.id}')" 
                        class="w-full bg-stone-100 hover:bg-amber-50 hover:text-amber-900 text-stone-600 font-bold py-2 rounded-xl transition text-sm flex items-center justify-center gap-2 group/pdf">
                        <i class="fas fa-file-pdf text-red-500 group-hover/pdf:scale-110 transition"></i> Ficha Técnica
                    </button>
                    <div class="flex justify-between items-center">
                        <button onclick="editProduct('${p.id}')" class="text-sky-700 hover:text-sky-900 text-sm font-bold flex items-center gap-1"><i class="fas fa-pen"></i> Editar</button>
                        <button onclick="deleteProduct('${p.id}')" class="text-stone-400 hover:text-red-500 transition-colors"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p class="text-red-500 text-center col-span-full">Error de conexión.</p>';
    }
}

window.openProductModal = (id = null) => {
    const form = document.getElementById('product-form');
    form.reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('modal-title').innerText = 'Nuevo Producto';
    document.getElementById('variedad').value = '';
    document.getElementById('proceso').value = '';
    document.getElementById('nivel_tueste').value = '';
    document.getElementById('puntaje_sca').value = '';
    document.getElementById('grupo_genetico').value = '';
    document.getElementById('porcentaje_cacao').value = '';
    document.getElementById('peso').value = '';
    document.getElementById('unit_id').value = '';
    document.getElementById('precio').value = '';
    document.getElementById('currency_id').value = '';
    document.getElementById('finca_id').value = '';

    currentImages = [];
    currentAwards = [];
    currentAwardIcon = null;
    document.getElementById('award-icon-preview').src = 'https://placehold.co/100?text=+';
    document.getElementById('awards-section').classList.add('hidden');
    document.getElementById('is_published').checked = true;

    // Resetear wrappers sensoriales
    const pW = document.getElementById('perfil-wrapper');
    const rW = document.getElementById('rueda-wrapper');
    if (pW) pW.innerHTML = '<div class="p-3 bg-stone-50 text-stone-400 text-sm italic">Selecciona un tipo...</div>';
    if (rW) rW.innerHTML = '<div class="p-3 bg-stone-50 text-stone-400 text-sm italic">Selecciona un tipo...</div>';

    if (id) {
        const p = productsCache.find(x => x.id === id);
        if (p) {
            document.getElementById('prod-id').value = p.id;
            document.getElementById('nombre').value = p.nombre;
            document.getElementById('gtin').value = p.gtin;
            document.getElementById('is_formal').checked = !!p.is_formal_gtin;
            document.getElementById('descripcion').value = p.descripcion || '';
            document.getElementById('ingredientes').value = p.ingredientes || '';
            document.getElementById('tipo_producto').value = p.tipo_producto || '';

            const attr = p.atributos_dinamicos || {};
            document.getElementById('variedad').value = attr.variedad || '';
            document.getElementById('proceso').value = attr.proceso || '';
            document.getElementById('nivel_tueste').value = attr.nivel_tueste || '';
            document.getElementById('puntaje_sca').value = attr.puntaje_sca || '';
            document.getElementById('grupo_genetico').value = attr.grupo_genetico || '';
            document.getElementById('porcentaje_cacao').value = attr.porcentaje_cacao || '';

            document.getElementById('peso').value = p.peso || '';
            document.getElementById('unit_id').value = p.unit_id || '';
            document.getElementById('precio').value = p.product_precio || p.precio || '';
            document.getElementById('currency_id').value = p.currency_id || '';
            document.getElementById('finca_id').value = p.finca_id || '';
            document.getElementById('is_published').checked = (p.is_published !== 0 && p.is_published !== false);

            // CORRECCIÓN: Orden de ejecución
            // 1. Setear el tipo
            const tipoSelect = document.getElementById('tipo_producto');
            tipoSelect.value = p.tipo_producto || '';

            // 2. Disparar el evento de cambio para que la UI se ajuste (premios, etc)
            // Esto llamará a updateSensorySelects(type) internamente y limpiará los selects
            tipoSelect.dispatchEvent(new Event('change'));

            // 3. Volver a llamar a updateSensorySelects explícitamente con los IDs guardados
            // para que se seleccionen las opciones correctas
            updateSensorySelects(p.tipo_producto || '', p.perfil_id, p.rueda_id);

            document.getElementById('receta_nutricional').value = p.receta_nutricional_id || '';

            currentImages = p.imagenes_json || [];
            currentAwards = p.premios_json || [];

            document.getElementById('modal-title').innerText = 'Editar Producto';
        }
    }

    renderImages();
    renderAwards();
    document.getElementById('product-modal').showModal();
};

window.editProduct = (id) => openProductModal(id);

window.deleteProduct = async (id) => {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
        await api(`/api/productos/${id}`, { method: 'DELETE' });
        loadProducts();
    } catch (e) { alert(e.message); }
};

// --- PDF GENERATION (FICHA TÉCNICA) ---
window.downloadTechnicalSheet = async (productId) => {
    const product = productsCache.find(p => p.id === productId);
    if (!product) return alert("Producto no encontrado.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. Cabecera y Estilo
    doc.setFillColor(120, 53, 15); // Amber 900
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("FICHA TÉCNICA DE PRODUCTO", 20, 25);

    doc.setFontSize(10);
    doc.text(" RURULAB", pageWidth - 70, 25);

    // 2. Información General
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(16);
    doc.text(product.nombre.toUpperCase(), 20, 55);

    doc.setDrawColor(200, 200, 200);
    doc.line(20, 60, pageWidth - 20, 60);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("TIPO:", 20, 70);
    doc.setFont("helvetica", "normal");
    doc.text(product.tipo_producto === 'cafe' ? 'Café' : (product.tipo_producto === 'cacao' ? 'Cacao / Chocolate' : 'Otro'), 45, 70);

    doc.setFont("helvetica", "bold");
    doc.text("PRESENTACIÓN:", 100, 70);
    doc.setFont("helvetica", "normal");
    doc.text(`${product.peso || 'N/A'} ${product.unit_code || ''}`, 135, 70);

    // 3. Origen (Finca)
    doc.setFillColor(252, 250, 246); // Fondo suave
    doc.rect(20, 80, pageWidth - 40, 35, 'F');
    doc.setDrawColor(217, 119, 6); // Amber 600
    doc.rect(20, 80, pageWidth - 40, 35, 'S');

    doc.setTextColor(120, 53, 15);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DE ORIGEN", 25, 88);

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.text(`Finca: ${product.finca_nombre || 'No asociada'}`, 25, 95);
    doc.text(`Ubicación: ${[product.finca_ciudad, product.finca_distrito, product.finca_provincia, product.finca_departamento, product.finca_pais].filter(Boolean).join(', ')}`, 25, 102);
    doc.text(`Altitud: ${product.finca_altura ? `${product.finca_altura} msnm` : 'N/A'}`, 25, 109);

    // 4. Especificaciones Técnicas
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ESPECIFICACIONES", 20, 130);

    const attr = product.atributos_dinamicos || {};
    let yPos = 140;

    const renderTableLine = (label, value) => {
        if (!value) return;
        doc.setFont("helvetica", "bold");
        doc.text(label, 25, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(String(value), 80, yPos);
        yPos += 8;
    };

    renderTableLine("Variedad Botánica:", attr.variedad);
    renderTableLine("Proceso / Beneficio:", attr.proceso);
    renderTableLine("Nivel de Tueste:", attr.nivel_tueste);
    renderTableLine("Puntaje SCA:", attr.puntaje_sca);
    renderTableLine("Grupo Genético:", attr.grupo_genetico);
    renderTableLine("% Cacao:", attr.porcentaje_cacao ? `${attr.porcentaje_cacao}%` : null);
    renderTableLine("GTIN / EAN:", product.gtin);

    // 5. Perfil Sensorial (Gráficos)
    // Asegurar que los plugins están registrados (datalabels para la rueda)
    if (window.ChartUtils && window.ChartUtils.registerPlugins) {
        window.ChartUtils.registerPlugins();
    }

    const parseJSON = (data) => {
        if (typeof data === 'string') {
            try { return JSON.parse(data); } catch (e) { return {}; }
        }
        return data || {};
    };

    const perfil = perfilesCache.find(x => x.id == product.perfil_id);
    const rueda = ruedasCache.find(x => x.id == product.rueda_id);

    if (perfil || rueda) {
        doc.setFont("helvetica", "bold");
        doc.text("PERFIL SENSORIAL", 20, yPos + 10);

        let chartX = 20;
        let chartY = yPos + 20;

        // Radar Chart
        if (perfil && window.ChartUtils) {
            const radarCanvas = document.getElementById('pdf-radar-canvas');
            const pData = parseJSON(perfil.perfil_data);

            // Inicializar gráfico temporal en el canvas oculto
            const tempChart = window.ChartUtils.initializePerfilChart(radarCanvas.id, pData, product.tipo_producto, {
                animation: false,
                responsive: false
            });

            // Esperar un momento a que se renderice
            await new Promise(r => setTimeout(r, 600));
            const radarImg = radarCanvas.toDataURL("image/png");
            if (radarImg.length > 200) { // Validar que no sea imagen vacía
                doc.addImage(radarImg, 'PNG', chartX, chartY, 70, 70);
                doc.setFontSize(8);
                doc.text("Gráfico de Atributos", chartX + 15, chartY + 75);
                chartX += 90;
            }
            if (tempChart) tempChart.destroy();
        }

        // Wheel Chart
        if (rueda && window.ChartUtils && flavorWheelsCache) {
            const wheelCanvas = document.getElementById('pdf-wheel-l1');
            const rData = {
                notas_json: parseJSON(rueda.notas_json),
                tipo: product.tipo_producto
            };

            // Pasar flavorWheelsCache como 3er argumento!
            const tempWheelChart = window.ChartUtils.initializeRuedaChart('pdf-wheel', rData, flavorWheelsCache, {
                responsive: false,
                animation: false,
                hideLegend: true
            });

            await new Promise(r => setTimeout(r, 600)); // Un poco más de tiempo para seguridad
            const wheelImg = wheelCanvas.toDataURL("image/png");
            if (wheelImg.length > 200) {
                doc.addImage(wheelImg, 'PNG', chartX, chartY, 70, 70);
                doc.setFontSize(8);
                doc.text("Rueda de Sabores", chartX + 15, chartY + 75);
            }
            if (tempWheelChart && tempWheelChart.l1) tempWheelChart.l1.destroy();
        }
    }

    // 6. Watermark Footer (Extremo a extremo)
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.08 }));
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(140);
    doc.setFont("helvetica", "bold");

    const pageHeight = doc.internal.pageSize.getHeight();

    // Marca de agua única cruzando toda la página
    doc.text("RURULAB.COM", 10, pageHeight - 10, { angle: 45 });
    doc.restoreGraphicsState();

    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    const dateStr = new Date().toLocaleDateString();
    doc.text(`Documento generado por RuruLab el ${dateStr} - La trazabilidad es confianza.`, 20, doc.internal.pageSize.height - 10);

    doc.save(`Ficha_Tecnica_${product.nombre.replace(/\s+/g, '_')}.pdf`);
};

async function api(url, options = {}) {
    options.credentials = 'include';
    options.headers = { ...options.headers, 'Content-Type': 'application/json' };
    const res = await fetch(url, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
    }
    return res.json();
}

document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const submitBtn = document.getElementById('save-product-btn');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    const pfInput = document.getElementById('perfil_id');
    const rsInput = document.getElementById('rueda_id');

    const data = {
        nombre: document.getElementById('nombre').value,
        gtin: document.getElementById('gtin').value,
        is_formal_gtin: document.getElementById('is_formal').checked,
        descripcion: document.getElementById('descripcion').value,
        ingredientes: document.getElementById('ingredientes').value,
        peso: document.getElementById('peso').value,
        variedad: document.getElementById('variedad').value,
        proceso: document.getElementById('proceso').value,
        nivel_tueste: document.getElementById('nivel_tueste').value,
        puntaje_sca: document.getElementById('puntaje_sca').value ? parseFloat(document.getElementById('puntaje_sca').value) : null,
        grupo_genetico: document.getElementById('grupo_genetico').value,
        porcentaje_cacao: document.getElementById('porcentaje_cacao').value ? parseFloat(document.getElementById('porcentaje_cacao').value) : null,
        tipo_producto: document.getElementById('tipo_producto').value,
        receta_nutricional_id: document.getElementById('receta_nutricional').value,

        unit_id: document.getElementById('unit_id').value,
        precio: document.getElementById('precio').value ? parseFloat(document.getElementById('precio').value) : null,
        currency_id: document.getElementById('currency_id').value,
        finca_id: document.getElementById('finca_id').value,

        perfil_id: pfInput ? pfInput.value : null,
        rueda_id: rsInput ? rsInput.value : null,

        imagenes_json: currentImages,
        premios_json: currentAwards,
        is_published: document.getElementById('is_published').checked
    };

    try {
        if (id) await api(`/api/productos/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        else await api('/api/productos', { method: 'POST', body: JSON.stringify(data) });

        document.getElementById('product-modal').close();
        loadProducts();
    } catch (err) { alert("Error: " + err.message); }
    finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Guardar Producto';
    }
});