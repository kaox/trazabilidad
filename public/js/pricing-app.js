document.addEventListener('DOMContentLoaded', () => {
    // IMPORTANTE: Debes reemplazar 'TU_PUBLIC_KEY' con tu clave pública de Mercado Pago
    const mp = new MercadoPago('TEST-610fdd05-5a84-4fc8-a095-258ad5c9306c', {
        locale: 'es-PE' // Ajusta a tu país (ej: es-AR, es-CO, es-MX)
    });

    const upgradeBtn = document.getElementById('upgrade-btn');
    const btnText = document.getElementById('upgrade-btn-text');
    const btnLoader = document.getElementById('upgrade-loader');

    upgradeBtn.addEventListener('click', async () => {
        // Mostrar loader y deshabilitar botón
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        upgradeBtn.disabled = true;

        try {
            // 1. Llamar a nuestro backend para crear la preferencia de pago
            const response = await fetch('/api/payments/create-preference', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('No se pudo crear la preferencia de pago.');
            }

            const data = await response.json();
            
            // 2. Redirigir al checkout de Mercado Pago
            window.location.href = data.init_point;

        } catch (error) {
            console.error('Error al crear preferencia:', error);
            alert('Error al iniciar el pago. Por favor, inténtelo de nuevo.');
            // Ocultar loader y habilitar botón
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
            upgradeBtn.disabled = false;
        }
    });
});
