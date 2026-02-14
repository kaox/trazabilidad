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
                            // Usuario no logueado o error, no hacemos nada
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

    // 1. MI ORIGEN
    const origenBtn = document.getElementById('origen-dropdown-btn');
    const origenDropdown = document.getElementById('origen-dropdown-desktop');
    
    // 2. PRODUCCIÓN
    const prodBtn = document.getElementById('produccion-dropdown-btn');
    const prodDropdown = document.getElementById('produccion-dropdown-desktop');
    
    // 3. CALIDAD Y LAB
    const calidadBtn = document.getElementById('calidad-dropdown-btn');
    const calidadDropdown = document.getElementById('calidad-dropdown-desktop');

    // Mobile Menu Toggle
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Dropdown Logic
    function setupDropdown(btn, dropdown) {
        if (!btn || !dropdown) return;

        const container = btn.parentElement;
        let hideTimer;

        // Click Event (Tablets/Mobile in Desktop View)
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = dropdown.classList.contains('hidden');
            
            // Close all others first
            [origenDropdown, prodDropdown, calidadDropdown].forEach(d => {
                if(d) d.classList.add('hidden');
            });

            if (isHidden) {
                dropdown.classList.remove('hidden');
            }
        });

        // Hover Events
        container.addEventListener('mouseenter', () => {
            clearTimeout(hideTimer);
            // Optional: Close others on hover entry to avoid overlap
            [origenDropdown, prodDropdown, calidadDropdown].forEach(d => {
                if(d && d !== dropdown) d.classList.add('hidden');
            });
            dropdown.classList.remove('hidden');
        });

        container.addEventListener('mouseleave', () => {
            hideTimer = setTimeout(() => {
                dropdown.classList.add('hidden');
            }, 300);
        });
    }

    setupDropdown(origenBtn, origenDropdown);
    setupDropdown(prodBtn, prodDropdown);
    setupDropdown(calidadBtn, calidadDropdown);
    
    // Click Outside to Close
    document.addEventListener('click', () => {
        if(origenDropdown) origenDropdown.classList.add('hidden');
        if(prodDropdown) prodDropdown.classList.add('hidden');
        if(calidadDropdown) calidadDropdown.classList.add('hidden');
    });

    // --- Lógica de Resaltado (Active State) ---
    const currentPage = window.location.pathname;
    const navLinks = document.querySelectorAll('a.nav-link, a.nav-link-mobile');
    
    // Resaltar enlaces directos
    navLinks.forEach(link => {
        if (link.href) {
            const linkPath = new URL(link.href).pathname;
            // Coincidencia exacta o subrutas (ej: /app/admin-blog/editor)
            if (currentPage === linkPath || (currentPage.startsWith(linkPath) && linkPath !== '/')) {
                link.classList.add('bg-amber-800');
            }
        }
    });

    // Resaltar Menús Padres (Dropdowns) según la sección actual

    // 1. MI ORIGEN (Fincas, Procesadoras, Admin)
    if (origenBtn && (
        currentPage.startsWith('/app/fincas') || 
        currentPage.startsWith('/app/procesadoras') || 
        currentPage.startsWith('/app/admin')
    )) {
        origenBtn.classList.add('bg-amber-800');
    }

    // 2. PRODUCCIÓN (Productos, Acopio, Proceso, Stock, Trazabilidad)
    if (prodBtn && (
        currentPage.startsWith('/app/productos') || 
        currentPage.startsWith('/app/acopio') || 
        currentPage.startsWith('/app/procesamiento') || 
        currentPage.startsWith('/app/existencias') || 
        currentPage.startsWith('/app/trazabilidad-inmutable')
    )) {
        prodBtn.classList.add('bg-amber-800');
    }

    // 3. CALIDAD Y LAB (Perfiles, Ruedas, Maridaje, Nutricion, Blends, Recetas, Estimacion)
    if (calidadBtn && (
        currentPage.startsWith('/app/perfiles') || 
        currentPage.startsWith('/app/ruedas-sabores') || 
        currentPage.startsWith('/app/maridaje') || 
        currentPage.startsWith('/app/blends') || 
        currentPage.startsWith('/app/recetas-chocolate') || 
        currentPage.startsWith('/app/nutricion') ||
        currentPage.startsWith('/app/estimacion-cosecha')
    )) {
        calidadBtn.classList.add('bg-amber-800');
    }
}

// Inicialización de permisos de administrador global (Fallback)
(async function() {
    try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
            const user = await response.json();
            if (user && user.role === 'admin') {
                const adminElements = document.querySelectorAll('.admin-only');
                adminElements.forEach(el => el.classList.remove('hidden'));
            }
        }
    } catch (error) {
        // Silencioso: si falla la llamada (ej. login page), no importa aquí
    }
})();