// --- Manejador para el login tradicional ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (response.ok) {
            window.location.href = '/app/dashboard';
        } else {
            const error = await response.json();
            alert(`Error: ${error.error}`);
        }
    } catch (error) {
        alert('Error de conexión. Inténtalo de nuevo.');
    }
});

// --- Manejador para la respuesta de Google ---
async function handleCredentialResponse(response) {
    try {
        const res = await fetch('/api/login/google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: response.credential }),
        });

        if (res.ok) {
            window.location.href = '/app/dashboard';
        } else {
            const error = await res.json();
            alert(`Error en el inicio de sesión con Google: ${error.error}`);
        }
    } catch (error) {
        alert('Error de conexión al intentar iniciar sesión con Google.');
    }
}
