/**
 * nav-loader.js — Carga dinámica del sidebar lateral de Ruru Lab
 * Responsabilidades:
 *  1. Inyectar nav.html en #nav-placeholder
 *  2. Agregar clases de layout al body y envolver el contenido en #app-main-content
 *  3. Inicializar grupos colapsables, móvil, active state y datos del usuario
 *  4. Mostrar secciones admin si el usuario tiene rol admin
 */

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

document.addEventListener('DOMContentLoaded', () => {
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (!navPlaceholder) return;

    fetch('/partials/nav.html')
        .then(response => response.ok ? response.text() : Promise.reject('Error loading navigation'))
        .then(data => {
            // 1. Inyectar el sidebar
            navPlaceholder.outerHTML = data;

            // 2. Configurar el layout del body
            setupBodyLayout();

            // 3. Inicializar el sidebar
            initializeSidebar();

            // 4. Cargar rol de usuario (admin links + datos de perfil)
            loadUserRole();
        })
        .catch(error => console.error('Failed to load nav:', error));
});

/**
 * Configura el body para el layout de sidebar:
 * Añade clase app-layout y envuelve el contenido en #app-main-content
 */
function setupBodyLayout() {
    document.body.classList.add('app-layout');

    // Crear wrapper del contenido principal si no existe
    if (!document.getElementById('app-main-content')) {
        const wrapper = document.createElement('div');
        wrapper.id = 'app-main-content';

        // Mover todos los hijos del body (excepto el sidebar y sus elementos) al wrapper
        const children = Array.from(document.body.childNodes);
        children.forEach(child => {
            const skipIds = ['app-sidebar', 'sidebar-overlay', 'sidebar-mobile-toggle'];
            const skipCheck = child.nodeType === 1 && (
                skipIds.includes(child.id) ||
                child.tagName === 'SCRIPT'
            );
            if (!skipCheck) {
                wrapper.appendChild(child);
            }
        });

        document.body.appendChild(wrapper);
    }
}

/**
 * Inicializa toda la lógica del sidebar:
 * grupos colapsables, toggle móvil, active state
 */
function initializeSidebar() {
    // --- Grupos colapsables ---
    const groupTriggers = document.querySelectorAll('.sidebar-group-trigger');
    groupTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const groupId = trigger.id.replace('-trigger', '-group');
            const group = document.getElementById(groupId);
            if (!group) return;

            const isOpen = group.classList.contains('open');

            // Cerrar todos los grupos abiertos
            document.querySelectorAll('.sidebar-group-content.open').forEach(g => {
                g.classList.remove('open');
            });
            document.querySelectorAll('.sidebar-group-trigger.group-open').forEach(t => {
                t.classList.remove('group-open');
                t.setAttribute('aria-expanded', 'false');
            });

            // Abrir el seleccionado si estaba cerrado
            if (!isOpen) {
                group.classList.add('open');
                trigger.classList.add('group-open');
                trigger.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // --- Toggle móvil ---
    const mobileToggle = document.getElementById('sidebar-mobile-toggle');
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function openSidebar() {
        sidebar.classList.add('mobile-open');
        overlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('visible');
        document.body.style.overflow = '';
    }

    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            const isOpen = sidebar.classList.contains('mobile-open');
            isOpen ? closeSidebar() : openSidebar();
        });
    }

    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }

    // Cerrar al hacer clic en enlace del sidebar en móvil
    document.querySelectorAll('#app-sidebar a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) closeSidebar();
        });
    });

    // --- Active state por ruta actual ---
    setActiveNavItem();

    // --- Auto-abrir grupo si la ruta actual pertenece a él ---
    autoExpandActiveGroup();

    // --- Botón de acceso rápido a la página pública ---
    loadLandingLink();
}

/**
 * Carga el perfil comercial y muestra el botón de landing page en el footer
 */
function loadLandingLink() {
    fetch('/api/user/company-profile')
        .then(res => res.ok ? res.json() : null)
        .then(profile => {
            if (!profile) return;

            const linkEl = document.getElementById('sidebar-landing-link');
            const labelEl = document.getElementById('sidebar-landing-label');
            if (!linkEl || !labelEl) return;

            let url = null;
            let label = '🌐 Ver mi Página Pública';

            if (profile.subdomain) {
                url = `https://${profile.subdomain}.rurulab.com`;
                label = `🌐 ${profile.subdomain}.rurulab.com`;
            } else if (profile.slug && profile.user_id) {
                url = `/origen-unico/${profile.slug}-${profile.user_id}`;
                label = '🌐 Ver mi Página Pública';
            } else if (profile.name) {
                // Fallback: construir slug desde el nombre
                const slug = profile.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                url = `/origen-unico/${slug}`;
                label = '🌐 Ver mi Página Pública';
            }

            if (url) {
                linkEl.href = url;
                labelEl.textContent = label;
                linkEl.style.display = 'flex';
            }
        })
        .catch(() => {
            // No hay perfil comercial — silencioso
        });
}

/**
 * Marca el ítem de nav correspondiente a la ruta actual como activo
 */
function setActiveNavItem() {
    const currentPath = window.location.pathname;

    // Mapa de rutas a IDs de ítems del sidebar
    const routeMap = [
        { paths: ['/app/dashboard'], id: 'nav-dashboard' },
        { paths: ['/app/fincas'], id: 'nav-fincas' },
        { paths: ['/app/procesadoras'], id: 'nav-procesadoras' },
        { paths: ['/app/perfil-comercial-tema'], id: 'nav-perfil-tema' },
        { paths: ['/app/perfil-comercial'], id: 'nav-perfil-comercial' },
        { paths: ['/app/productos'], id: 'nav-productos' },
        { paths: ['/app/trazabilidad'], id: 'nav-trazabilidad' },
        { paths: ['/app/perfiles'], id: 'nav-perfiles' },
        { paths: ['/app/ruedas-sabores'], id: 'nav-ruedas' },
        { paths: ['/app/nutricion'], id: 'nav-nutricion' },
        { paths: ['/app/estimacion-cosecha'], id: 'nav-estimacion' },
        { paths: ['/app/cuenta'], id: 'nav-cuenta' },
        { paths: ['/app/admin-dashboard'], id: 'nav-admin-dashboard' },
        { paths: ['/app/admin-suggestions'], id: 'nav-admin-suggestions' },
        { paths: ['/app/admin-blog'], id: 'nav-admin-blog' },
        { paths: ['/app/admin-payments'], id: 'nav-admin-payments' },
    ];

    routeMap.forEach(({ paths, id }) => {
        const el = document.getElementById(id);
        if (!el) return;
        const matches = paths.some(p => currentPath === p || currentPath.startsWith(p + '/'));
        if (matches) {
            el.classList.add('active');
        }
    });
}

/**
 * Abre automáticamente el grupo del ítem activo
 */
function autoExpandActiveGroup() {
    const currentPath = window.location.pathname;

    const groupMap = [
        {
            paths: ['/app/perfil-comercial'],
            triggerId: 'nav-marca-trigger',
            groupId: 'nav-marca-group'
        },
        {
            paths: ['/app/fincas', '/app/procesadoras'],
            triggerId: 'nav-origen-trigger',
            groupId: 'nav-origen-group'
        },
        {
            paths: ['/app/productos', '/app/trazabilidad', '/app/acopio', '/app/procesamiento', '/app/existencias'],
            triggerId: 'nav-produccion-trigger',
            groupId: 'nav-produccion-group'
        },
        {
            paths: ['/app/perfiles', '/app/ruedas-sabores', '/app/nutricion', '/app/estimacion-cosecha', '/app/blends', '/app/maridaje'],
            triggerId: 'nav-calidad-trigger',
            groupId: 'nav-calidad-group'
        },
        {
            paths: ['/app/admin'],
            triggerId: 'nav-admin-trigger',
            groupId: 'nav-admin-group'
        },
    ];

    groupMap.forEach(({ paths, triggerId, groupId }) => {
        const matches = paths.some(p => currentPath === p || currentPath.startsWith(p));
        if (matches) {
            const trigger = document.getElementById(triggerId);
            const group = document.getElementById(groupId);
            if (trigger && group) {
                group.classList.add('open');
                trigger.classList.add('group-open');
                trigger.setAttribute('aria-expanded', 'true');
            }
        }
    });
}

/**
 * Carga el rol del usuario y muestra secciones admin si corresponde.
 * También carga el nombre del usuario en el footer del sidebar.
 * Estrategia híbrida: primero localStorage, luego API.
 */
function loadUserRole() {
    const token = localStorage.getItem('token');

    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.role === 'admin') showAdminSection();
            updateSidebarUser(payload);
        } catch (e) {
            console.error('Error al decodificar el token local:', e);
            fetchUserProfile();
        }
    } else {
        fetchUserProfile();
    }
}

function fetchUserProfile() {
    fetch('/api/user/profile', { headers: { 'Content-Type': 'application/json' } })
        .then(res => {
            if (res.ok) return res.json();
            throw new Error('No sesión');
        })
        .then(user => {
            if (user && user.role === 'admin') showAdminSection();
            if (user) updateSidebarUser(user);
        })
        .catch(() => {
            // Usuario no logueado o error — no hacer nada
        });
}

/**
 * Muestra la sección de administración en el sidebar
 */
function showAdminSection() {
    // La sección admin del sidebar
    const adminSection = document.getElementById('nav-admin-section');
    if (adminSection) adminSection.classList.add('visible');

    // Compatibilidad con otros elementos .admin-only en la página
    document.querySelectorAll('.admin-only').forEach(el => {
        el.classList.remove('hidden');
        el.classList.add('visible');
    });
}

/**
 * Actualiza el footer del sidebar con los datos del usuario
 */
function updateSidebarUser(user) {
    const displayName = document.getElementById('sidebar-user-display-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-avatar-initials');
    const avatarContainer = document.getElementById('sidebar-avatar');

    const nombre = user.nombre || user.name || user.email || 'Usuario';
    const role = user.role === 'admin' ? 'Administrador' : 'Productor';

    if (displayName) displayName.textContent = nombre;
    if (roleEl) roleEl.textContent = role;

    // Avatar: iniciales del nombre
    if (avatarEl && avatarContainer) {
        const initials = nombre
            .split(' ')
            .slice(0, 2)
            .map(w => w[0])
            .join('')
            .toUpperCase();

        if (initials) {
            avatarEl.className = ''; // remover ícono
            avatarContainer.textContent = initials;
        }
    }
}

// Fallback global de permisos admin (por si nav-loader falla parcialmente)
(async function () {
    try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
            const user = await response.json();
            if (user && user.role === 'admin') {
                document.querySelectorAll('.admin-only').forEach(el => {
                    el.classList.remove('hidden');
                    el.classList.add('visible');
                });
            }
        }
    } catch (error) {
        // Silencioso
    }
})();