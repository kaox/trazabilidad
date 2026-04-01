document.addEventListener('DOMContentLoaded', () => {
    
    const form = document.getElementById('company-profile-form');
    const btnSave = document.getElementById('btn-save');
    const btnViewLanding = document.getElementById('btn-view-landing');
    
    // Inputs de Imágenes
    const logoInput = document.getElementById('logo_input');
    const coverInput = document.getElementById('cover_input');
    const logoPreview = document.getElementById('logo_preview');
    const coverPreview = document.getElementById('cover_preview');
    const logoHidden = document.getElementById('logo_url');
    const coverHidden = document.getElementById('cover_image_url');

    // Elementos Dinámicos Finca/Procesadora
    const typeSelect = document.getElementById('company_type');
    const entityContainer = document.getElementById('entity_container');
    const entitySelect = document.getElementById('company_id');
    const entityLabel = document.getElementById('entity_label');
    const entityHelpLabel = document.getElementById('entity_help_label');
    const entityCreateLink = document.getElementById('entity_create_link');

    let currentUserId = null;
    let savedCompanyId = null; // Guardar el ID que viene de la BD

    // Caché de datos para no hacer peticiones dobles
    let fincasList = [];
    let procesadorasList = [];

    async function init() {
        // Cargamos entidades y perfil en paralelo
        await Promise.all([
            loadEntities(),
            loadProfileData()
        ]);
        
        setupEventListeners();

        // Forzar actualización visual si ya hay un tipo guardado
        if (typeSelect.value) {
            updateEntitySelect(typeSelect.value, savedCompanyId);
        }
    }

    // Cargar listas de Fincas y Procesadoras
    async function loadEntities() {
        try {
            const [fincasRes, procRes] = await Promise.all([
                api('/api/fincas').catch(() => []),
                api('/api/procesadoras').catch(() => [])
            ]);
            fincasList = fincasRes;
            procesadorasList = procRes;
        } catch (e) {
            console.error("Error al cargar entidades:", e);
        }
    }

    // Helper para formatear Slugs (URLs amigables)
    function createSlug(text) { 
        if (!text) return '';
        return text.toString().toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-'); 
    }

    // Cargar datos actuales del backend
    async function loadProfileData() {
        try {
            const response = await api('/api/user/company-profile');
            
            currentUserId = response.user_id;

            if (response && response.name) {
                // Rellenar formulario
                document.getElementById('name').value = response.name || '';
                document.getElementById('history_text').value = response.history_text || '';
                document.getElementById('contact_email').value = response.contact_email || '';
                document.getElementById('contact_phone').value = response.contact_phone || '';
                document.getElementById('social_instagram').value = response.social_instagram || '';
                document.getElementById('social_facebook').value = response.social_facebook || '';
                document.getElementById('website_url').value = response.website_url || '';
                
                if (response.company_type) {
                    typeSelect.value = response.company_type;
                }
                
                if (response.subdomain) {
                    document.getElementById('subdomain').value = response.subdomain || '';
                }
                
                // Guardar ID en memoria para setearlo en el Select dinámico
                savedCompanyId = response.company_id || null;

                const isPublishedToggle = document.getElementById('is_published');
                if (isPublishedToggle) {
                    isPublishedToggle.checked = response.is_published === 1 || response.is_published === true;
                }

                // Cargar Imágenes
                if (response.logo_url) {
                    logoPreview.src = response.logo_url;
                    logoHidden.value = response.logo_url;
                }
                if (response.cover_image_url) {
                    coverPreview.src = response.cover_image_url;
                    coverHidden.value = response.cover_image_url;
                }

                // --- NUEVO: Marcar los checkboxes de categorías guardadas ---
                if (response.product_categories) {
                    let categories = [];
                    // Si el backend lo devuelve como String JSON, lo parseamos
                    if (typeof response.product_categories === 'string') {
                        try { categories = JSON.parse(response.product_categories); } catch(e){}
                    } else if (Array.isArray(response.product_categories)) {
                        categories = response.product_categories;
                    }
                    
                    const checkboxes = document.querySelectorAll('input[name="product_categories"]');
                    checkboxes.forEach(cb => {
                        if (categories.includes(cb.value)) {
                            cb.checked = true;
                        }
                    });
                }

                // Configurar botón "Ver mi Landing"
                if (currentUserId) {
                    const slug = response.subdomain || createSlug(response.name);
                    const baseUrl = response.subdomain ? `${response.subdomain}.rurulab.com` : `rurulab.com/origen-unico/${slug}-${currentUserId}`;
                    
                    btnViewLanding.href = response.subdomain ? `https://${response.subdomain}.rurulab.com` : `/origen-unico/${slug}-${currentUserId}`;
                    btnViewLanding.classList.remove('hidden');
                    btnViewLanding.classList.add('inline-flex');
                }
            }

        } catch (error) {
            console.error("No hay perfil previo o hubo un error:", error);
        }
    }

    // Cambiar dinámicamente las opciones del select según el tipo
    function updateEntitySelect(type, selectedId = null) {
        if (!type) {
            entityContainer.classList.add('hidden');
            entitySelect.removeAttribute('required');
            return;
        }

        entityContainer.classList.remove('hidden');
        entitySelect.setAttribute('required', 'required');
        entitySelect.innerHTML = '<option value="">-- Selecciona una opción --</option>';

        if (type === 'finca') {
            entityLabel.textContent = 'Finca';
            entityHelpLabel.textContent = 'finca';
            entityCreateLink.href = '/app/fincas';
            
            if (fincasList.length === 0) {
                entitySelect.innerHTML += `<option value="" disabled>No tienes fincas registradas</option>`;
            } else {
                fincasList.forEach(f => {
                    entitySelect.innerHTML += `<option value="${f.id}">${f.nombre_finca}</option>`;
                });
            }

        } else if (type === 'procesadora') {
            entityLabel.textContent = 'Procesadora';
            entityHelpLabel.textContent = 'procesadora';
            entityCreateLink.href = '/app/procesadoras';
            
            if (procesadorasList.length === 0) {
                entitySelect.innerHTML += `<option value="" disabled>No tienes procesadoras registradas</option>`;
            } else {
                procesadorasList.forEach(p => {
                    const nombre = p.nombre_comercial || p.razon_social || 'Procesadora sin nombre';
                    entitySelect.innerHTML += `<option value="${p.id}">${nombre}</option>`;
                });
            }
        }

        // Marcar la opción guardada si existe
        if (selectedId) {
            entitySelect.value = selectedId;
        }
    }

    function setupEventListeners() {
        form.addEventListener('submit', handleFormSubmit);
        
        logoInput.addEventListener('change', (e) => processImageUpload(e, 'logo'));
        coverInput.addEventListener('change', (e) => processImageUpload(e, 'cover'));

        // Escuchar cambios en el Tipo de Entidad
        typeSelect.addEventListener('change', (e) => {
            updateEntitySelect(e.target.value, null); // Pasamos null porque es un cambio manual, no BD
        });

        // Auto-limpiar subdominio mientras escribe
        const subdomainInput = document.getElementById('subdomain');
        subdomainInput.addEventListener('input', (e) => {
            e.target.value = createSlug(e.target.value);
        });
    }

    // Procesar imágenes en cliente (Redimensionar y a Base64)
    function processImageUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        // Validaciones de tamaño preliminar
        const maxMB = type === 'logo' ? 2 : 5;
        if (file.size > maxMB * 1024 * 1024) {
            alert(`La imagen es demasiado pesada (Máx ${maxMB}MB)`);
            event.target.value = ''; // Limpiar input
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.src = reader.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                
                // Tamaños máximos
                const MAX_WIDTH = type === 'logo' ? 400 : 1200;
                const MAX_HEIGHT = type === 'logo' ? 400 : 800;
                
                let width = img.width;
                let height = img.height;
                
                // Mantener proporción
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                const quality = mimeType === 'image/jpeg' ? 0.8 : undefined;
                const resizedBase64 = canvas.toDataURL(mimeType, quality);
                
                // Asignar al DOM
                if (type === 'logo') {
                    logoPreview.src = resizedBase64;
                    logoHidden.value = resizedBase64;
                } else {
                    coverPreview.src = resizedBase64;
                    coverHidden.value = resizedBase64;
                }
            };
        };
        reader.readAsDataURL(file);
    }

    // Enviar datos al Backend
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        // Validación extra: Debe haber seleccionado una entidad si es requerida
        if (entityContainer.classList.contains('hidden') === false && !entitySelect.value) {
            alert('Por favor, selecciona una entidad vinculada (Finca o Procesadora).');
            entitySelect.focus();
            return;
        }

        const originalBtnHtml = btnSave.innerHTML;
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Guardando...';

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data.product_categories = formData.getAll('product_categories');

        // Forzar checkbox booleano
        data.is_published = document.getElementById('is_published').checked;

        // Limpiar @ de instagram si el usuario lo puso por error
        if (data.social_instagram) {
            data.social_instagram = data.social_instagram.replace('@', '').trim();
        }
        
        // Limpiar subdominio
        if (data.subdomain) {
            data.subdomain = createSlug(data.subdomain);
        }

        try {
            const result = await api('/api/user/company-profile', {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            
            alert('Perfil Comercial guardado con éxito.');
            
            // Refrescar para asegurar enlace de landing correcto
            if (!currentUserId && result.user_id) {
                currentUserId = result.user_id;
            }
            if (currentUserId) {
                const slug = createSlug(data.name);
                btnViewLanding.href = `/origen-unico/${slug}-${currentUserId}`;
                btnViewLanding.classList.remove('hidden');
                btnViewLanding.classList.add('inline-flex');
            }

        } catch (error) {
            console.error("Error al guardar perfil comercial:", error);
            alert(`Error: ${error.message}`);
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = originalBtnHtml;
        }
    }

    // Helper API fetch
    async function api(url, options = {}) {
        options.credentials = 'include';
        options.headers = { ...options.headers, 'Content-Type': 'application/json' };

        const res = await fetch(url, options);
        if (!res.ok) {
            const errText = await res.text();
            let errMsg = `Error ${res.status}`;
            try {
                const errObj = JSON.parse(errText);
                errMsg = errObj.error || errMsg;
            } catch(e) {}
            throw new Error(errMsg);
        }
        
        if (res.status === 204) return {};
        return res.json();
    }

    // Inicializar
    init();
});