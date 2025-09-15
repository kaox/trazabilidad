document.addEventListener('DOMContentLoaded', () => {
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (navPlaceholder) {
        fetch('/partials/nav.html')
            .then(response => response.ok ? response.text() : Promise.reject('Error loading navigation'))
            .then(data => {
                navPlaceholder.innerHTML = data;
                initializeNav();
            })
            .catch(error => console.error('Failed to load nav:', error));
    }
});

function initializeNav() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const gestionDropdownBtn = document.getElementById('gestion-dropdown-btn');
    const gestionDropdown = document.getElementById('gestion-dropdown-desktop');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    if (gestionDropdownBtn && gestionDropdown) {
        gestionDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            gestionDropdown.classList.toggle('hidden');
        });
        gestionDropdownBtn.parentElement.addEventListener('mouseleave', () => {
            gestionDropdown.classList.add('hidden');
        });
        document.addEventListener('click', () => {
            gestionDropdown.classList.add('hidden');
        });
    }

    // Lógica para resaltar el enlace activo
    const currentPage = window.location.pathname;
    const navLinks = document.querySelectorAll('a.nav-link, a.nav-link-mobile');
    
    navLinks.forEach(link => {
        // FIX: Asegurarse de que el link tiene un href antes de procesarlo
        if (link.href) {
            const linkPath = new URL(link.href).pathname;
            
            // Lógica para resaltar el link de la página actual
            if (currentPage === linkPath) {
                link.classList.add('bg-amber-800');
            }
            
            // Lógica para resaltar el botón de Gestión si estamos en una de sus sub-páginas
            if (gestionDropdownBtn && (currentPage.startsWith('/app/fincas') || currentPage.startsWith('/app/perfiles') || currentPage.startsWith('/app/procesadoras') || currentPage.startsWith('/app/plantillas') || currentPage.startsWith('/app/ruedas-sabores'))) {
                 gestionDropdownBtn.classList.add('bg-amber-800');
            }
        }
    });
}

