// auth.js - Este script debe incluirse en la cabecera de todas las páginas protegidas.

// El chequeo principal lo hace el servidor. Este script es un helper para el cliente.

function logout() {
    // Limpia el token de respaldo del cliente
    localStorage.removeItem('token');
    
    // Llama al endpoint del backend para limpiar la cookie de sesión en el servidor.
    // Usamos credentials: 'include' para asegurar que la cookie de sesión se envíe y se pueda borrar.
    fetch('/api/logout', { method: 'POST', credentials: 'include' })
        .catch(error => console.error("Fallo al cerrar sesión en el servidor:", error))
        .finally(() => {
            // Redirige al login sin importar el resultado de la API.
            window.location.href = '/login.html';
        });
}

// Helper para hacer llamadas a la API
async function api(url, options = {}) {
    
    // 1. Configuración por defecto de Headers
    options.headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // 2. IMPORTANTE: Asegurar el envío de cookies (HttpOnly)
    // Esto es crucial para que req.cookies.token funcione en el backend
    options.credentials = 'include'; 
    
    // 3. Respaldo: Añade el token del localStorage si existe (para clientes que no soporten cookies o apps móviles)
    const token = localStorage.getItem('token');
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, options);

        // Si la API devuelve 401 (No autorizado) o 403 (Prohibido/Token inválido)
        if (response.status === 401) {
            logout(); // Token vencido o inexistente -> Login
            return Promise.reject(new Error("Sesión expirada o no autorizada."));
        }

        if (response.status === 403) {
            // Un 403 puede ser "Token inválido" o "Falta suscripción".
            // Leemos el error para saber si debemos desloguear o solo avisar.
            const data = await response.json().catch(() => ({}));
            if (data.error && data.error.includes('suscripción')) {
                // Si es por suscripción, NO deslogueamos, solo lanzamos el error para que la UI lo muestre.
                throw new Error(data.error); 
            } else {
                // Si es otro tipo de 403 (ej. token manipulado), deslogueamos por seguridad.
                logout();
                return Promise.reject(new Error("Acceso denegado."));
            }
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error HTTP: ${response.status}`);
        }
        
        // Retornar null si es 204 No Content, sino el JSON
        return response.status === 204 ? null : response.json();

    } catch (error) {
        console.error("Error en llamada API:", error);
        throw error; // Re-lanzar para que el componente que llamó maneje el error UI
    }
}