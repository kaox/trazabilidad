document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('admin-dashboard-body');

    try {
        const data = await api('/api/admin/dashboard-data');
        
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-stone-500">No hay usuarios registrados.</td></tr>';
            return;
        }

        tableBody.innerHTML = data.map(user => {
            const trialEndDate = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
            const now = new Date();
            const hasActiveTrial = trialEndDate && trialEndDate > now;
            const diffDays = trialEndDate ? Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24)) : 0;

            let subscriptionStatus = `<span class="capitalize px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">${user.subscription_tier}</span>`;
            if (hasActiveTrial) {
                subscriptionStatus += `<br><span class="text-xs text-green-600">Prueba termina en ${diffDays} días</span>`;
            }

            return `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-medium text-stone-900">${user.usuario}</div>
                        <div class="text-sm text-stone-500">${user.correo || ''}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-stone-500">${new Date(user.created_at).toLocaleDateString()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${subscriptionStatus}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">${user.process_count}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-stone-500">${user.process_types.join(', ') || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">${user.finca_count}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">${user.procesadora_count}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error al cargar datos del dashboard:', error);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-600">Error al cargar los datos. Es posible que no tengas permisos de administrador.</td></tr>`;
    }
});
