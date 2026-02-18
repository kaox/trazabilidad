document.addEventListener('DOMContentLoaded', () => {
    const placeholder = document.getElementById('public-nav-placeholder');
    
    if (placeholder) {
        fetch('/partials/public-nav.html')
            .then(response => {
                if (!response.ok) throw new Error('No se pudo cargar el menú');
                return response.text();
            })
            .then(html => {
                placeholder.innerHTML = html;
                initPublicNavigation();
                
                // Marcar link activo según URL
                highlightActiveLink();
            })
            .catch(err => console.error('Error cargando nav:', err));
    }
});

function initPublicNavigation() {
    const menuButton = document.getElementById('menu-button');
    const closeMenuButton = document.getElementById('close-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuLinks = mobileMenu ? mobileMenu.querySelectorAll('a') : [];

    function openMenu() {
        mobileMenu.classList.remove('-translate-x-full');
        closeMenuButton.classList.remove('hidden');
        menuButton.classList.add('hidden');
        document.body.style.overflow = 'hidden'; // Evitar scroll
    }

    function closeMenu() {
        mobileMenu.classList.add('-translate-x-full');
        closeMenuButton.classList.add('hidden');
        menuButton.classList.remove('hidden');
        document.body.style.overflow = ''; // Restaurar scroll
    }

    if (menuButton) menuButton.addEventListener('click', openMenu);
    if (closeMenuButton) closeMenuButton.addEventListener('click', closeMenu);
    
    // Cerrar menú al hacer clic en un enlace
    menuLinks.forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    // Lógica para Dropdowns en escritorio (Hover/Click híbrido)
    const dropdowns = document.querySelectorAll('[data-menu]');
    
    dropdowns.forEach(group => {
        const btn = group.querySelector('button');
        const content = group.querySelector('[data-menu-content]');
        
        // Soporte táctil
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            content.classList.toggle('hidden');
        });

        // Cerrar al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!group.contains(e.target)) {
                content.classList.add('hidden');
            }
        });
    });
}

function highlightActiveLink() {
    const currentPath = window.location.pathname;
    const links = document.querySelectorAll('nav a');
    
    links.forEach(link => {
        // Evitar marcar el logo o enlaces vacíos
        if (link.getAttribute('href') !== '/' && link.getAttribute('href') !== '#') {
            if (currentPath.includes(link.getAttribute('href'))) {
                link.classList.add('text-amber-800', 'font-bold');
                link.classList.remove('text-stone-500'); // Si tuviera esta clase por defecto
            }
        }
    });
}