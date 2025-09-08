document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');

    async function loadProfile() {
        try {
            const profile = await api('/api/user/profile');
            // Poblar el formulario con los datos del usuario
            for (const key in profile) {
                if (profileForm.elements[key]) {
                    profileForm.elements[key].value = profile[key] || '';
                }
            }
        } catch (error) {
            console.error("Error al cargar el perfil:", error);
            alert("No se pudo cargar la información de tu perfil.");
        }
    }

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(profileForm);
        const data = Object.fromEntries(formData.entries());

        try {
            await api('/api/user/profile', {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            alert("¡Tus datos han sido actualizados exitosamente!");
        } catch (error) {
            console.error("Error al actualizar perfil:", error);
            alert(`Error: ${error.message}`);
        }
    });

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(passwordForm);
        const data = Object.fromEntries(formData.entries());

        if (data.newPassword !== data.confirmPassword) {
            alert("La nueva contraseña y la confirmación no coinciden.");
            return;
        }

        try {
            const payload = {
                oldPassword: data.oldPassword,
                newPassword: data.newPassword
            };
            await api('/api/user/password', {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            alert("¡Contraseña actualizada exitosamente!");
            passwordForm.reset();
        } catch (error) {
            console.error("Error al cambiar contraseña:", error);
            alert(`Error: ${error.message}`);
        }
    });

    loadProfile();
});

