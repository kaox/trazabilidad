// auth.js - Este script debe incluirse en la cabecera de todas las páginas protegidas.

// El chequeo principal lo hace el servidor. Este script es un helper para el cliente.

function logout() {
    // Limpia el token de respaldo del cliente
    localStorage.removeItem('token');
    
    // Llama al endpoint del backend para limpiar la cookie de sesión en el servidor.
    fetch('/api/logout', { method: 'POST' })
        .catch(error => console.error("Fallo al cerrar sesión en el servidor:", error))
        .finally(() => {
            // Redirige al login sin importar el resultado de la API.
            window.location.href = '/login.html';
        });
}

// Helper para hacer llamadas a la API
async function api(url, options = {}) {
    options.headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    // Añade el token de respaldo del localStorage si existe.
    // La cookie se envía automáticamente por el navegador.
    const token = localStorage.getItem('token');
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, options);

    // Si la API devuelve 401/403 (por un token inválido de localStorage o cookie expirada)
    if (response.status === 401 || response.status === 403) {
        logout(); // Forzamos el logout para limpiar la sesión inconsistente.
        return Promise.reject(new Error("Sesión no autorizada."));
    }

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error HTTP: ${response.status}`);
    }
    
    return response.status === 204 ? null : response.json();
}

