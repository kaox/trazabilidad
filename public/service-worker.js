importScripts('/js/dexie.js');

const CACHE_NAME = 'agritraza-cache-v2'; // Versión de caché actualizada
// Lista de archivos esenciales para que la app funcione offline (App Shell)
const URLS_TO_CACHE = [
    '/app/trazabilidad',
    '/api/templates',
    '/api/batches/tree',
    '/api/fincas',
    '/api/procesadoras',
    '/js/trazabilidad-app.js',
    '/auth.js',
    '/js/nav-loader.js',
    '/js/tailwindcss3.4.17.js',
    '/js/dexie.js',
    '/js/analytics-loader.js',
    '/partials/nav.html',
    '/partials/analytics.html'
];

// Configurar la base de datos de IndexedDB con Dexie
const db = new Dexie('sync-queue');
db.version(1).stores({
    pendingRequests: '++id,url,method,body'
});

// Evento 'install': Cachear el App Shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Cache abierto, añadiendo App Shell');
                // addAll es atómico, si una falla, fallan todas.
                return cache.addAll(URLS_TO_CACHE);
            })
            .catch(error => {
                console.error('Fallo al cachear el App Shell:', error);
            })
    );
});

// Evento 'activate': Limpiar cachés antiguos para evitar conflictos de versiones
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Limpiando caché antiguo', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Evento 'fetch': Estrategia "Network falling back to cache" para peticiones de navegación
self.addEventListener('fetch', (event) => {
    // Para peticiones de navegación (páginas HTML)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Si la red falla, intenta servir desde el caché
                return caches.match(event.request).then(response => {
                    return response || caches.match('/app/trazabilidad'); // Fallback final
                });
            })
        );
        return;
    }

    // Para otros recursos (CSS, JS, imágenes), usar estrategia "Cache First"
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request);
            })
    );
});

// Evento 'sync': Se activa cuando hay conexión y hay una tarea de sincronización pendiente
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-new-batch') {
        console.log('Service Worker: Sincronización en segundo plano iniciada.');
        event.waitUntil(sendPendingRequests());
    }
});

/**
 * Procesa la cola de peticiones pendientes en IndexedDB.
 */
async function sendPendingRequests() {
    const allRequests = await db.pendingRequests.toArray();
    
    for (const request of allRequests) {
        console.log(`Enviando petición pendiente: ${request.id}`);
        try {
            const response = await fetch(request.url, {
                method: request.method,
                headers: { 'Content-Type': 'application/json' },
                body: request.body,
            });

            if (response.ok) {
                console.log(`Petición ${request.id} enviada con éxito. Eliminando de la cola.`);
                await db.pendingRequests.delete(request.id);
            } else {
                console.error(`Error del servidor para la petición ${request.id}:`, response.statusText);
            }
        } catch (error) {
            console.error(`Error de red al enviar la petición ${request.id}:`, error);
        }
    }
}

