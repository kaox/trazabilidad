// ESTADO LOCAL
let currentImages = [];
let currentAwards = [];
let currentAwardIcon = null;
let productsCache = [];
let nutritionalRecipes = [];
let perfilesCache = [];
let ruedasCache = [];
let awardsConfig = {}; 

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadAwardsConfig();
    loadNutritionalRecipes();
    loadPerfiles();
    loadRuedas();
});

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
        if(select) {
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

// --- FUNCIÓN DE COMPRESIÓN DE IMÁGENES ---
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

// --- EVENTOS ---
document.getElementById('tipo_producto').addEventListener('change', function(e) {
    const type = e.target.value;
    const section = document.getElementById('awards-section');
    const select = document.getElementById('award-select');
    
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
document.getElementById('file-upload').addEventListener('change', async function(e) {
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
            if (file.size > 5 * 1024 * 1024) { 
                alert(`La imagen ${file.name} pesa más de 5MB y será omitida.`);
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

document.getElementById('award-icon-input').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (file) {
            if (file.size > 2 * 1024 * 1024) { 
            alert("El icono debe pesar menos de 2MB");
            this.value = '';
            return;
        }
        try {
            const base64 = await compressImage(file);
            currentAwardIcon = base64;
            document.getElementById('award-icon-preview').src = base64;
        } catch(err) {
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
        currentAwards.push({ name, year, logo_url: logoUrl });
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
                ${a.name} (${a.year})
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

            return `
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-stone-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col group ${opacityClass} relative">
                ${statusBadge}
                <div class="flex gap-4 mb-4">
                    <div class="relative w-20 h-20 flex-shrink-0">
                        <img src="${mainImage}" class="w-full h-full object-cover rounded-xl border border-stone-100">
                        <span class="absolute -bottom-2 -right-2 bg-white text-amber-800 text-xs p-1.5 rounded-full shadow-sm border border-stone-100"><i class="fas ${tipoIcon}"></i></span>
                    </div>
                    <div class="flex-grow min-w-0">
                        <h3 class="font-bold text-lg text-amber-900 leading-tight truncate" title="${p.nombre}">${p.nombre}</h3>
                        <p class="text-xs text-stone-500 mt-1">${p.peso || 'Peso N/A'}</p>
                        <span class="text-[10px] font-mono bg-stone-100 px-2 py-1 rounded text-stone-500 mt-2 inline-block border border-stone-200"><i class="fas fa-barcode mr-1"></i> ${p.gtin || 'Pendiente'}</span>
                    </div>
                </div>
                <div class="flex-grow">
                    ${p.receta_nutricional_nombre ? `<div class="mb-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded border border-green-100 inline-block"><i class="fas fa-utensils mr-1"></i> Info. Nutricional</div>` : ''}
                    <p class="text-sm text-stone-600 line-clamp-2 mb-2">${p.descripcion || 'Sin descripción comercial.'}</p>
                </div>
                <div class="flex justify-between items-center pt-4 border-t border-stone-100 mt-2">
                    <button onclick="editProduct('${p.id}')" class="text-sky-700 hover:text-sky-900 text-sm font-bold flex items-center gap-1"><i class="fas fa-pen"></i> Editar</button>
                    <button onclick="deleteProduct('${p.id}')" class="text-stone-400 hover:text-red-500 transition-colors"><i class="fas fa-trash"></i></button>
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
    
    currentImages = [];
    currentAwards = [];
    currentAwardIcon = null;
    document.getElementById('award-icon-preview').src = 'https://placehold.co/100?text=+';
    document.getElementById('awards-section').classList.add('hidden');
    document.getElementById('is_published').checked = true;
    
    // Resetear wrappers sensoriales
    const pW = document.getElementById('perfil-wrapper');
    const rW = document.getElementById('rueda-wrapper');
    if(pW) pW.innerHTML = '<div class="p-3 bg-stone-50 text-stone-400 text-sm italic">Selecciona un tipo...</div>';
    if(rW) rW.innerHTML = '<div class="p-3 bg-stone-50 text-stone-400 text-sm italic">Selecciona un tipo...</div>';

    if (id) {
        const p = productsCache.find(x => x.id === id);
        if (p) {
            document.getElementById('prod-id').value = p.id;
            document.getElementById('nombre').value = p.nombre;
            document.getElementById('gtin').value = p.gtin;
            document.getElementById('is_formal').checked = !!p.is_formal_gtin;
            document.getElementById('descripcion').value = p.descripcion || '';
            document.getElementById('ingredientes').value = p.ingredientes || '';
            document.getElementById('peso').value = p.peso || '';
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
    if(!confirm("¿Eliminar este producto?")) return;
    try {
        await api(`/api/productos/${id}`, { method: 'DELETE' });
        loadProducts();
    } catch(e) { alert(e.message); }
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
        tipo_producto: document.getElementById('tipo_producto').value,
        receta_nutricional_id: document.getElementById('receta_nutricional').value,
        
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