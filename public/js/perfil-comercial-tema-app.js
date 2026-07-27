/**
 * Theme Builder - App Client-Side Logic
 * Maneja la previsualización en vivo, cambio de viewport, selección de presets,
 * personalización de la paleta de 5 colores y persistencia con la API.
 */

let presetsData = [];
let currentTheme = {
    preset_id: null,
    is_custom: false,
    custom_name: 'Mi Tema Personalizado',
    color_primary: '#78350f',
    color_secondary: '#451a03',
    color_accent: '#d97706',
    color_background: '#fdfaf6',
    color_text: '#1c1917'
};
let savedState = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initThemeBuilder();
});

async function initThemeBuilder() {
    try {
        await Promise.all([
            fetchPresets(),
            fetchMyCompanyTheme()
        ]);

        renderPresets();
        updateFormInputs();
        applyColorsToPreview();
        updateThemeModeUI();

        // Escuchar cambio en el input de nombre personalizado
        const nameInput = document.getElementById('input-custom-name');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                currentTheme.custom_name = e.target.value;
                updateThemeModeUI();
            });
        }
    } catch (error) {
        console.error('Error al inicializar Theme Builder:', error);
    }
}

// 1. Obtener Presets desde la API (solo lectura)
async function fetchPresets() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/themes/presets', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success && json.data) {
            presetsData = json.data;
        }
    } catch (e) {
        console.error('Error cargando presets:', e);
    }
}

// 2. Obtener Tema guardado de la Empresa
async function fetchMyCompanyTheme() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/themes/my-theme', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();

        if (json.success) {
            if (json.company_name) {
                const mockNameEl = document.getElementById('mock-company-name');
                if (mockNameEl) mockNameEl.textContent = json.company_name;
            }

            if (json.data) {
                currentTheme = {
                    preset_id: json.data.preset_id || null,
                    is_custom: Boolean(json.data.is_custom),
                    custom_name: json.data.custom_name || 'Mi Tema Personalizado',
                    color_primary: json.data.color_primary || '#78350f',
                    color_secondary: json.data.color_secondary || '#451a03',
                    color_accent: json.data.color_accent || '#d97706',
                    color_background: json.data.color_background || '#fdfaf6',
                    color_text: json.data.color_text || '#1c1917'
                };
            } else if (presetsData.length > 0) {
                // Fallback a primer preset si aún no tiene tema guardado
                const firstPreset = presetsData[0];
                currentTheme = {
                    preset_id: firstPreset.id,
                    is_custom: false,
                    custom_name: null,
                    color_primary: firstPreset.color_primary,
                    color_secondary: firstPreset.color_secondary,
                    color_accent: firstPreset.color_accent,
                    color_background: firstPreset.color_background,
                    color_text: firstPreset.color_text
                };
            }

            // Guardar copia del estado inicial cargado para el botón Restablecer
            savedState = JSON.parse(JSON.stringify(currentTheme));
        }
    } catch (e) {
        console.error('Error cargando tema de la empresa:', e);
    }
}

// 3. Renderizar las tarjetas de Temas Prediseñados
function renderPresets() {
    const container = document.getElementById('presets-container');
    if (!container) return;

    if (!presetsData || presetsData.length === 0) {
        container.innerHTML = `<p class="col-span-2 text-xs text-stone-400 text-center py-4">No hay presets disponibles.</p>`;
        return;
    }

    container.innerHTML = presetsData.map(p => {
        const isSelected = (!currentTheme.is_custom && currentTheme.preset_id === p.id);
        const borderClass = isSelected
            ? 'border-2 border-amber-800 bg-amber-50/50 shadow-md ring-2 ring-amber-500/30'
            : 'border border-stone-200 bg-white hover:border-stone-400 hover:shadow-sm';

        return `
            <div onclick="selectPreset('${p.id}')" class="p-3 rounded-2xl cursor-pointer transition flex flex-col justify-between ${borderClass}">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-stone-800 line-clamp-1">${p.name}</span>
                    ${isSelected ? '<i class="fas fa-check-circle text-amber-800 text-xs"></i>' : ''}
                </div>
                
                <!-- Swatch de Colores -->
                <div class="flex items-center gap-1.5 p-1.5 rounded-xl bg-stone-100/80 border border-stone-200/50">
                    <span class="w-4 h-4 rounded-full border border-black/10 shadow-xs" style="background-color: ${p.color_primary}" title="Primario: ${p.color_primary}"></span>
                    <span class="w-4 h-4 rounded-full border border-black/10 shadow-xs" style="background-color: ${p.color_secondary}" title="Secundario: ${p.color_secondary}"></span>
                    <span class="w-4 h-4 rounded-full border border-black/10 shadow-xs" style="background-color: ${p.color_accent}" title="Acento: ${p.color_accent}"></span>
                    <span class="w-4 h-4 rounded-full border border-black/10 shadow-xs" style="background-color: ${p.color_background}" title="Fondo: ${p.color_background}"></span>
                    <span class="w-4 h-4 rounded-full border border-black/10 shadow-xs" style="background-color: ${p.color_text}" title="Texto: ${p.color_text}"></span>
                </div>
            </div>
        `;
    }).join('');
}

// 4. Seleccionar un Tema Prediseñado
function selectPreset(presetId) {
    const preset = presetsData.find(p => p.id === presetId);
    if (!preset) return;

    currentTheme.preset_id = preset.id;
    currentTheme.is_custom = false;
    currentTheme.color_primary = preset.color_primary;
    currentTheme.color_secondary = preset.color_secondary;
    currentTheme.color_accent = preset.color_accent;
    currentTheme.color_background = preset.color_background;
    currentTheme.color_text = preset.color_text;

    renderPresets();
    updateFormInputs();
    applyColorsToPreview();
    updateThemeModeUI();
}

// 5. Cambio en Picker de Color
function onCustomColorChange(key, value) {
    currentTheme[`color_${key}`] = value;
    markAsCustom();

    const hexInput = document.getElementById(`hex-${key}`);
    if (hexInput) hexInput.value = value.toUpperCase();

    applyColorsToPreview();
}

// 6. Cambio en Hex Input
function onCustomHexChange(key, value) {
    let cleanHex = value.trim();
    if (!cleanHex.startsWith('#')) cleanHex = '#' + cleanHex;

    if (/^#([0-9A-F]{3}){1,2}$/i.test(cleanHex)) {
        currentTheme[`color_${key}`] = cleanHex;
        markAsCustom();

        const colorInput = document.getElementById(`color-${key}`);
        if (colorInput) colorInput.value = cleanHex;

        applyColorsToPreview();
    }
}

// 7. Marcar como modo Custom si se altera un color manualmente
function markAsCustom() {
    if (!currentTheme.is_custom) {
        currentTheme.is_custom = true;
        currentTheme.preset_id = null;
        if (!currentTheme.custom_name) {
            currentTheme.custom_name = 'Mi Tema Personalizado';
        }
        renderPresets();
        updateThemeModeUI();
    }
}

// 8. Actualizar inputs de color
function updateFormInputs() {
    ['primary', 'secondary', 'accent', 'background', 'text'].forEach(key => {
        const val = currentTheme[`color_${key}`];
        const colorEl = document.getElementById(`color-${key}`);
        const hexEl = document.getElementById(`hex-${key}`);

        if (colorEl) colorEl.value = val;
        if (hexEl) hexEl.value = val.toUpperCase();
    });

    const nameInput = document.getElementById('input-custom-name');
    if (nameInput && currentTheme.custom_name) {
        nameInput.value = currentTheme.custom_name;
    }
}

// 9. Aplicar colores al lienzo de previsualización en tiempo real (0ms delay)
function applyColorsToPreview() {
    const root = document.getElementById('mock-landing-root');
    if (!root) return;

    root.style.setProperty('--color-primary', currentTheme.color_primary);
    root.style.setProperty('--color-secondary', currentTheme.color_secondary);
    root.style.setProperty('--color-accent', currentTheme.color_accent);
    root.style.setProperty('--color-background', currentTheme.color_background);
    root.style.setProperty('--color-text', currentTheme.color_text);
}

// 10. Actualizar UI de indicadores de modo
function updateThemeModeUI() {
    const modeTextEl = document.getElementById('theme-mode-text');
    const modeBadgeEl = document.getElementById('theme-mode-badge');
    const customNameContainer = document.getElementById('custom-name-container');

    if (currentTheme.is_custom) {
        if (modeTextEl) modeTextEl.textContent = `${currentTheme.custom_name || 'Tema Personalizado'} (Custom)`;
        if (modeBadgeEl) {
            modeBadgeEl.textContent = 'Custom';
            modeBadgeEl.className = 'bg-purple-100 text-purple-800 text-[10px] font-bold px-2.5 py-1 rounded-full';
        }
        if (customNameContainer) customNameContainer.classList.remove('hidden');
    } else {
        const activePreset = presetsData.find(p => p.id === currentTheme.preset_id);
        const presetName = activePreset ? activePreset.name : 'Prediseñado';

        if (modeTextEl) modeTextEl.textContent = `${presetName} (Prediseñado)`;
        if (modeBadgeEl) {
            modeBadgeEl.textContent = 'Preset';
            modeBadgeEl.className = 'bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-full';
        }
        if (customNameContainer) customNameContainer.classList.add('hidden');
    }
}

// 11. Cambiar el Viewport del Lienzo (Desktop, Tablet, Mobile)
function setViewport(mode) {
    const wrapper = document.getElementById('preview-viewport-wrapper');
    const btnDesktop = document.getElementById('btn-vp-desktop');
    const btnTablet = document.getElementById('btn-vp-tablet');
    const btnMobile = document.getElementById('btn-vp-mobile');

    if (!wrapper) return;

    wrapper.classList.remove('viewport-desktop', 'viewport-tablet', 'viewport-mobile');

    const activeBtnClass = 'px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition bg-white text-stone-900 shadow';
    const inactiveBtnClass = 'px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition text-stone-600 hover:text-stone-900';

    btnDesktop.className = inactiveBtnClass;
    btnTablet.className = inactiveBtnClass;
    btnMobile.className = inactiveBtnClass;

    if (mode === 'tablet') {
        wrapper.classList.add('viewport-tablet');
        btnTablet.className = activeBtnClass;
    } else if (mode === 'mobile') {
        wrapper.classList.add('viewport-mobile');
        btnMobile.className = activeBtnClass;
    } else {
        wrapper.classList.add('viewport-desktop');
        btnDesktop.className = activeBtnClass;
    }
}

// 12. Restablecer tema al último estado guardado
function resetThemeToSaved() {
    if (!savedState) return;
    currentTheme = JSON.parse(JSON.stringify(savedState));
    renderPresets();
    updateFormInputs();
    applyColorsToPreview();
    updateThemeModeUI();
}

// 13. Guardar Tema en el Servidor (API)
async function saveTheme() {
    const saveBtn = document.getElementById('btn-save-theme');
    const originalText = saveBtn ? saveBtn.innerHTML : 'Guardar Tema';

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Guardando...`;
        }

        const token = localStorage.getItem('token');
        const res = await fetch('/api/themes/my-theme', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(currentTheme)
        });

        const json = await res.json();
        if (json.success) {
            savedState = JSON.parse(JSON.stringify(currentTheme));
            alert('¡Tema guardado exitosamente! Tu Landing Page ahora refleja tus colores en tiempo real.');
        } else {
            alert('Error al guardar el tema: ' + (json.error || 'Intente nuevamente'));
        }
    } catch (error) {
        console.error('Error guardando tema:', error);
        alert('Ocurrió un error al intentar guardar el tema.');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }
}
