function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

document.addEventListener('DOMContentLoaded', () => {
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (navPlaceholder) {
        fetch('/partials/nav.html')
            .then(response => response.ok ? response.text() : Promise.reject('Error loading navigation'))
            .then(data => {
                navPlaceholder.innerHTML = data;
                
                // Helper para mostrar enlaces de admin
                const showAdminLinks = (role) => {
                    if (role === 'admin') {
                        const adminLinks = document.querySelectorAll('.admin-only');
                        adminLinks.forEach(link => link.classList.remove('hidden'));
                    }
                };

                // ESTRATEGIA HÍBRIDA DE ROLES:
                // 1. Intento Rápido: Leer del localStorage (si existe)
                const token = localStorage.getItem('token');
                if (token) {
                    try {
                        const payload = JSON.parse(atob(token.split('.')[1]));
                        showAdminLinks(payload.role);
                    } catch (e) {
                        console.error('Error al decodificar el token local:', e);
                    }
                } else {
                    // 2. Intento Robusto: Si localStorage es null, consultar a la API (usa la cookie)
                    // Esto arregla el problema cuando el usuario tiene sesión pero no token en storage
                    fetch('/api/user/profile', { headers: { 'Content-Type': 'application/json' } })
                        .then(res => {
                            if (res.ok) return res.json();
                            throw new Error('No sesión');
                        })
                        .then(user => {
                            if (user && user.role) {
                                showAdminLinks(user.role);
                            }
                        })
                        .catch(() => {
                            // Usuario no logueado o error, no hacemos nada (links siguen ocultos)
                        });
                }

                initializeNav();
            })
            .catch(error => console.error('Failed to load nav:', error));
    }
});

function initializeNav() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const labDropdownBtn = document.getElementById('lab-dropdown-btn');
    const labDropdown = document.getElementById('lab-dropdown-desktop');
    const operacionesDropdownBtn = document.getElementById('operaciones-dropdown-btn');
    const operacionesDropdown = document.getElementById('operaciones-dropdown-desktop');
    const configDropdownBtn = document.getElementById('config-dropdown-btn');
    const configDropdown = document.getElementById('config-dropdown-desktop');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    function setupDropdown(btn, dropdown) {
        if (!btn || !dropdown) return;

        const container = btn.parentElement;
        let hideTimer;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = dropdown.classList.contains('hidden');
            document.querySelectorAll('.absolute.z-50').forEach(d => d.classList.add('hidden'));
            if (isHidden) {
                dropdown.classList.remove('hidden');
            }
        });

        container.addEventListener('mouseenter', () => {
            clearTimeout(hideTimer);
            dropdown.classList.remove('hidden');
        });

        container.addEventListener('mouseleave', () => {
            hideTimer = setTimeout(() => {
                dropdown.classList.add('hidden');
            }, 500);
        });
    }

    setupDropdown(labDropdownBtn, labDropdown);
    setupDropdown(configDropdownBtn, configDropdown);
    setupDropdown(operacionesDropdownBtn, operacionesDropdown);
    
    document.addEventListener('click', () => {
        if(labDropdown) labDropdown.classList.add('hidden');
        if(configDropdown) configDropdown.classList.add('hidden');
        if(operacionesDropdown) operacionesDropdown.classList.add('hidden');
    });


    // Lógica para resaltar el enlace activo
    const currentPage = window.location.pathname;
    const navLinks = document.querySelectorAll('a.nav-link, a.nav-link-mobile');
    
    navLinks.forEach(link => {
        if (link.href) {
            const linkPath = new URL(link.href).pathname;
            
            // Lógica extendida para mantener activo el botón en sub-rutas
            if (
                currentPage === linkPath || 
                (currentPage.startsWith('/app/trazabilidad') && linkPath.startsWith('/app/trazabilidad')) ||
                // NUEVO: Mantener activo si estamos en el CMS del blog
                (currentPage.startsWith('/app/admin-blog') && linkPath.startsWith('/app/admin-blog'))
            ) {
                link.classList.add('bg-amber-800');
            }
        }
    });

    if (labDropdownBtn && (currentPage.startsWith('/app/maridaje') || currentPage.startsWith('/app/blends'))) {
        labDropdownBtn.classList.add('bg-amber-800');
    }
    if (configDropdownBtn && (currentPage.startsWith('/app/fincas') || currentPage.startsWith('/app/perfiles') || currentPage.startsWith('/app/procesadoras') || currentPage.startsWith('/app/plantillas') || currentPage.startsWith('/app/ruedas-sabores'))) {
        configDropdownBtn.classList.add('bg-amber-800');
    }
}

(async function() {
    try {
        // Obtenemos el perfil del usuario actual
        const response = await fetch('/api/user/profile');
        if (response.ok) {
            const user = await response.json();
            
            // Si es admin, quitamos la clase 'hidden' de los elementos .admin-only
            if (user && user.role === 'admin') {
                const adminElements = document.querySelectorAll('.admin-only');
                adminElements.forEach(el => {
                    el.classList.remove('hidden');
                });
            }
        }
    } catch (error) {
        console.error("Error al verificar permisos de admin:", error);
    }
})();