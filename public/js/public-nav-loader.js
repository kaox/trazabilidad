document.addEventListener('DOMContentLoaded', () => {
    const placeholder = document.getElementById('public-nav-placeholder');
    
    // En subdominios de cliente (White Label) no mostramos el nav de RuruLab
    if (window.IS_SUBDOMAIN) {
        if (placeholder) placeholder.style.display = 'none';
        return;
    }
    
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
    // Filtramos para que al hacer click en el botón "Soluciones" no se cierre todo el menú de golpe
    const menuLinks = mobileMenu ? mobileMenu.querySelectorAll('nav > a, [data-mobile-dropdown-content] a') : [];

    function openMenu() {
        mobileMenu.classList.remove('-translate-x-full');
        if (closeMenuButton) closeMenuButton.classList.remove('hidden');
        if (menuButton) menuButton.classList.add('hidden');
        document.body.style.overflow = 'hidden'; 
    }

    function closeMenu() {
        mobileMenu.classList.add('-translate-x-full');
        if (closeMenuButton) closeMenuButton.classList.add('hidden');
        if (menuButton) menuButton.classList.remove('hidden');
        document.body.style.overflow = ''; 
        
        // Resetear el dropdown móvil al cerrar el menú por completo
        const mobileContent = document.querySelector('[data-mobile-dropdown-content]');
        const mobileIcon = document.querySelector('[data-mobile-dropdown-icon]');
        if (mobileContent) mobileContent.style.maxHeight = null;
        if (mobileIcon) mobileIcon.classList.remove('rotate-180');
    }

    if (menuButton) menuButton.addEventListener('click', openMenu);
    if (closeMenuButton) closeMenuButton.addEventListener('click', closeMenu);
    
    // Cerrar menú al hacer clic en un enlace real
    menuLinks.forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    // ==========================================
    // NUEVA LÓGICA: Dropdown Móvil
    // ==========================================
    const mobileDropdown = document.querySelector('[data-mobile-dropdown]');
    if (mobileDropdown) {
        const btn = mobileDropdown.querySelector('button');
        const content = mobileDropdown.querySelector('[data-mobile-dropdown-content]');
        const icon = mobileDropdown.querySelector('[data-mobile-dropdown-icon]');

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = content.style.maxHeight;

            if (!isOpen) {
                // Abre de forma dinámica calculando el alto de los hijos
                content.style.maxHeight = content.scrollHeight + "px";
                if (icon) icon.classList.add('rotate-180');
            } else {
                // Cierra
                content.style.maxHeight = null;
                if (icon) icon.classList.remove('rotate-180');
            }
        });
    }

    // ==========================================
    // Lógica para Dropdowns en escritorio (Tu código existente)
    // ==========================================
    const dropdowns = document.querySelectorAll('[data-menu]');
    dropdowns.forEach(group => {
        const btn = group.querySelector('button');
        const content = group.querySelector('[data-menu-content]');
        let hideTimeout;
        const icon = btn.querySelector('i.fa-chevron-down');

        const show = () => {
            clearTimeout(hideTimeout);
            content.classList.remove('hidden');
            if (icon) icon.classList.add('rotate-180');
        };

        const hide = () => {
            hideTimeout = setTimeout(() => {
                content.classList.add('hidden');
                if (icon) icon.classList.remove('rotate-180');
            }, 300);
        };

        group.addEventListener('mouseenter', show);
        group.addEventListener('mouseleave', hide);
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = content.classList.contains('hidden');
            if (isHidden) show();
            else content.classList.add('hidden');
        });

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