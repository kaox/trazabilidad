document.addEventListener('DOMContentLoaded', () => {
    // --- Selectores del DOM ---
    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');
    
    // Selectores de Información de Suscripción (Mantenidos por si los reactivas)
    const currentPlanEl = document.getElementById('current-plan');
    const trialInfoEl = document.getElementById('trial-info');
    const trialDaysLeftEl = document.getElementById('trial-days-left');
    
    // Selectores de Configuración
    const currencySelect = document.getElementById('default_currency');
    const unitSelect = document.getElementById('default_unit');

    async function init() {
        await loadConfigOptions(); // Cargar combos primero
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

    async function loadProfile() {
        try {
            const user = await api('/api/user/profile');
            
            // Poblar formulario de perfil
            if (profileForm) {
                // Sección Personal
                if (profileForm.nombre) profileForm.nombre.value = user.nombre || '';
                if (profileForm.apellido) profileForm.apellido.value = user.apellido || '';
                if (profileForm.dni) profileForm.dni.value = user.dni || '';
                if (profileForm.ruc) profileForm.ruc.value = user.ruc || '';
                if (profileForm.correo) profileForm.correo.value = user.correo || '';

                // Poblar configuración
                if (user.default_currency && currencySelect) currencySelect.value = user.default_currency;
                if (user.default_unit && unitSelect) unitSelect.value = user.default_unit;
            }
            
            // Lógica de Suscripción (Opcional, si reactivas la sección en HTML)
            if (currentPlanEl && user.subscription_tier) {
                currentPlanEl.textContent = user.subscription_tier;
            }

            if (trialInfoEl && user.trial_ends_at) {
                const trialEndDate = new Date(user.trial_ends_at);
                const now = new Date();
                const diffTime = trialEndDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays > 0) {
                    if(trialDaysLeftEl) trialDaysLeftEl.textContent = diffDays;
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