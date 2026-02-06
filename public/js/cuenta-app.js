document.addEventListener('DOMContentLoaded', () => {
    // --- Selectores del DOM ---
    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');
    
    // Selectores de Información de Suscripción
    const currentPlanEl = document.getElementById('current-plan');
    const trialInfoEl = document.getElementById('trial-info');
    const trialDaysLeftEl = document.getElementById('trial-days-left');

    const companyLogoInput = document.getElementById('company-logo-input');
    const companyLogoPreview = document.getElementById('company-logo-preview');
    const companyLogoHiddenInput = document.getElementById('company_logo');
    
    // Selectores de Configuración
    const currencySelect = document.getElementById('default_currency');
    const unitSelect = document.getElementById('default_unit');

    // Selectores de Entidad Productiva
    const companyTypeSelect = document.getElementById('company_type');
    const companyIdSelect = document.getElementById('company_id');

    async function init() {
        await loadConfigOptions(); // Cargar combos primero
        await loadEntityOptions(); // Cargar fincas y procesadoras
        await loadProfile();       // Luego cargar datos del usuario y setear valores
        setupEventListeners();
    }

    async function loadConfigOptions() {
        try {
            // Cargar Monedas
            const currRes = await api('/api/config/currencies');
            if (currencySelect) {
                currencySelect.innerHTML = currRes.map(c => 
                    `<option value="${c.code}">${c.code} - ${c.name} (${c.symbol})</option>`
                ).join('');
                // Default fallback
                if(!currencySelect.value) currencySelect.value = 'USD';
            }

            // Cargar Unidades (Solo MASA por ahora para simplificar)
            const unitRes = await api('/api/config/units');
            if (unitSelect) {
                const massUnits = unitRes.filter(u => u.type === 'MASA');
                unitSelect.innerHTML = massUnits.map(u => 
                    `<option value="${u.code}">${u.code} - ${u.name}</option>`
                ).join('');
                // Default fallback
                if(!unitSelect.value) unitSelect.value = 'KG';
            }
        } catch (e) {
            console.error("Error cargando configuraciones:", e);
        }
    }

    // Cargar Fincas y Procesadoras para el combo
    let fincasCache = [];
    let procesadorasCache = [];

    async function loadEntityOptions() {
        try {
            // Cargar ambos en paralelo
            const [fincas, procesadoras] = await Promise.all([
                api('/api/fincas').catch(() => []),
                api('/api/procesadoras').catch(() => [])
            ]);
            fincasCache = fincas;
            procesadorasCache = procesadoras;
        } catch (e) { console.error("Error cargando entidades:", e); }
    }

    function updateCompanyIdSelect(type, selectedId = null) {
        if (!companyIdSelect) return;
        
        companyIdSelect.innerHTML = '<option value="">-- Seleccionar --</option>';
        
        if (type === 'finca') {
            companyIdSelect.disabled = false;
            companyIdSelect.innerHTML += fincasCache.map(f => `<option value="${f.id}" ${f.id === selectedId ? 'selected' : ''}>${f.nombre_finca}</option>`).join('');
        } else if (type === 'procesadora') {
            companyIdSelect.disabled = false;
            companyIdSelect.innerHTML += procesadorasCache.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.nombre_comercial || p.razon_social}</option>`).join('');
        } else {
            companyIdSelect.disabled = true;
            companyIdSelect.innerHTML = '<option value="">Selecciona un tipo primero</option>';
        }
    }

    async function loadProfile() {
        try {
            const user = await api('/api/user/profile');
            
            // Poblar formulario de perfil
            if (profileForm) {
                // Sección Personal
                profileForm.nombre.value = user.nombre || '';
                profileForm.apellido.value = user.apellido || '';
                profileForm.dni.value = user.dni || '';
                profileForm.ruc.value = user.ruc || '';
                profileForm.correo.value = user.correo || '';

                // Sección Pública / Landing
                profileForm.empresa.value = user.empresa || '';
                profileForm.celular.value = user.celular || '';
                profileForm.social_instagram.value = user.social_instagram || '';
                profileForm.social_facebook.value = user.social_facebook || '';

                // Poblar configuración
                if (user.default_currency) currencySelect.value = user.default_currency;
                if (user.default_unit) unitSelect.value = user.default_unit;

                // Poblar Entidad Productiva
                if (user.company_type) {
                    companyTypeSelect.value = user.company_type;
                    updateCompanyIdSelect(user.company_type, user.company_id);
                }

                if (user.company_logo) {
                    companyLogoPreview.src = user.company_logo;
                    companyLogoHiddenInput.value = user.company_logo;
                }
            }
            
            // Lógica de Suscripción
            if (currentPlanEl && user.subscription_tier) {
                currentPlanEl.textContent = user.subscription_tier;
            }

            if (trialInfoEl && user.trial_ends_at) {
                const trialEndDate = new Date(user.trial_ends_at);
                const now = new Date();
                const diffTime = trialEndDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays > 0) {
                    trialDaysLeftEl.textContent = diffDays;
                    trialInfoEl.classList.remove('hidden');
                } else {
                    trialInfoEl.classList.add('hidden');
                }
            } else if(trialInfoEl) {
                trialInfoEl.classList.add('hidden');
            }

        } catch (error) {
            console.error("Error al cargar perfil:", error);
        }
    }

    function setupEventListeners() {
        if (profileForm) {
            profileForm.addEventListener('submit', handleProfileUpdate);
        }
        if (passwordForm) {
            passwordForm.addEventListener('submit', handlePasswordChange);
        }
        if (companyLogoInput) {
            companyLogoInput.addEventListener('change', handleLogoUpload);
        }
        // Listener para cambio de tipo de entidad
        if (companyTypeSelect) {
            companyTypeSelect.addEventListener('change', (e) => {
                updateCompanyIdSelect(e.target.value);
            });
        }
    }

    function handleLogoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Validación de tamaño (Max 2MB para logos)
        if (file.size > 2 * 1024 * 1024) {
            alert("El logo es demasiado pesado (Máx 2MB)");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.src = reader.result;
            img.onload = () => {
                // Redimensionar logo (max 300x300 es suficiente)
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 300;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                } else {
                    if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const resizedData = canvas.toDataURL('image/png');
                companyLogoPreview.src = resizedData;
                companyLogoHiddenInput.value = resizedData;
            };
        };
        reader.readAsDataURL(file);
    }

    async function handleProfileUpdate(e) {
        e.preventDefault();
        const btn = profileForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true; btn.textContent = "Guardando...";

        const formData = new FormData(profileForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const result = await api('/api/user/profile', {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            alert('Perfil actualizado con éxito.');
        } catch (error) {
            console.error("Error al actualizar perfil:", error);
            alert(`Error: ${error.message}`);
        } finally {
            btn.disabled = false; btn.textContent = originalText;
        }
    }

    async function handlePasswordChange(e) {
        e.preventDefault();
        const formData = new FormData(passwordForm);
        const data = Object.fromEntries(formData.entries());

        if (data.newPassword !== data.confirmPassword) {
            alert('Las nuevas contraseñas no coinciden.');
            return;
        }

        try {
            const result = await api('/api/user/password', {
                method: 'PUT',
                body: JSON.stringify({
                    oldPassword: data.oldPassword,
                    newPassword: data.newPassword
                })
            });
            alert('Contraseña actualizada con éxito.');
            passwordForm.reset();
        } catch (error) {
            console.error("Error al cambiar contraseña:", error);
            alert(`Error: ${error.message}`);
        }
    }

    // Helper API
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

    init();
});