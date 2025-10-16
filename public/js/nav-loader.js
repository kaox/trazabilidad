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
                
                document.getElementById('nav-placeholder').innerHTML = data;

        // Lógica para mostrar/ocultar el enlace de admin
        const adminLink = document.getElementById('admin-dashboard-link');
        const token = localStorage.getItem('token');

        if (adminLink && token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload.role === 'admin') {
                    adminLink.classList.remove('hidden');
                }
            } catch (e) {
                console.error('Error al decodificar el token:', e);
            }
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
    const configDropdownBtn = document.getElementById('config-dropdown-btn');
    const configDropdown = document.getElementById('config-dropdown-desktop');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    function setupDropdown(btn, dropdown) {
        if (!btn || !dropdown) return;

        const container = btn.parentElement; // El <div class="relative">
        let hideTimer;

        // Abrir/cerrar con clic en el botón (ideal para touch)
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = dropdown.classList.contains('hidden');
            // Ocultar todos los dropdowns primero
            document.querySelectorAll('.absolute.z-50').forEach(d => d.classList.add('hidden'));
            // Mostrar/ocultar el actual
            if (isHidden) {
                dropdown.classList.remove('hidden');
            }
        });

        // Mantener abierto mientras el mouse esté sobre el botón o el menú
        container.addEventListener('mouseenter', () => {
            clearTimeout(hideTimer); // Cancela cualquier temporizador de cierre pendiente
            dropdown.classList.remove('hidden');
        });

        // Iniciar un temporizador para cerrar cuando el mouse salga del área
        container.addEventListener('mouseleave', () => {
            hideTimer = setTimeout(() => {
                dropdown.classList.add('hidden');
            }, 500); // Medio segundo de retraso
        });
    }

    setupDropdown(labDropdownBtn, labDropdown);
    setupDropdown(configDropdownBtn, configDropdown);
    
    // Cerrar todos los dropdowns si se hace clic en cualquier otro lugar
    document.addEventListener('click', () => {
        if(labDropdown) labDropdown.classList.add('hidden');
        if(configDropdown) configDropdown.classList.add('hidden');
    });


    // Lógica para resaltar el enlace activo
    const currentPage = window.location.pathname;
    const navLinks = document.querySelectorAll('a.nav-link, a.nav-link-mobile');
    
    navLinks.forEach(link => {
        if (link.href) {
            const linkPath = new URL(link.href).pathname;
            
            if (currentPage === linkPath || (currentPage.startsWith('/app/trazabilidad') && linkPath.startsWith('/app/trazabilidad'))) {
                link.classList.add('bg-amber-800');
            }
        }
    });

    // Lógica para resaltar el botón del dropdown activo
    if (labDropdownBtn && (currentPage.startsWith('/app/maridaje') || currentPage.startsWith('/app/blends'))) {
        labDropdownBtn.classList.add('bg-amber-800');
    }
    if (configDropdownBtn && (currentPage.startsWith('/app/fincas') || currentPage.startsWith('/app/perfiles') || currentPage.startsWith('/app/procesadoras') || currentPage.startsWith('/app/plantillas') || currentPage.startsWith('/app/ruedas-sabores'))) {
        configDropdownBtn.classList.add('bg-amber-800');
    }
}

