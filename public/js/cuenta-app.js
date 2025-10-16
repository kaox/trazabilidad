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

    async function init() {
        await loadProfile();
        setupEventListeners();
    }

    async function loadProfile() {
        try {
            const user = await api('/api/user/profile');
            
            // Poblar formulario de perfil
            if (profileForm) {
                profileForm.nombre.value = user.nombre || '';
                profileForm.apellido.value = user.apellido || '';
                profileForm.dni.value = user.dni || '';
                profileForm.ruc.value = user.ruc || '';
                profileForm.empresa.value = user.empresa || '';
                profileForm.celular.value = user.celular || '';
                profileForm.correo.value = user.correo || '';

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
            alert("No se pudo cargar la información de tu perfil. Por favor, intenta recargar la página.");
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
    }

    function handleLogoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            companyLogoPreview.src = reader.result;
            companyLogoHiddenInput.value = reader.result;
        };
        reader.readAsDataURL(file);
    }

    async function handleProfileUpdate(e) {
        e.preventDefault();
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

    init();
});

