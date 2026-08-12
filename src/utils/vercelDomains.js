/**
 * src/utils/vercelDomains.js
 * Utilidad para gestionar dominios personalizados via Vercel API.
 *
 * Docs: https://vercel.com/docs/rest-api/endpoints/projects#add-a-domain-to-a-project
 *
 * Variables de entorno requeridas:
 *   VERCEL_TOKEN      — Personal Access Token de Vercel (Account Settings → Tokens)
 *   VERCEL_PROJECT_ID — ID del proyecto (Settings → General → Project ID)
 *   VERCEL_TEAM_ID    — (Opcional) Team ID si el proyecto está en un equipo
 */

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID; // opcional

/**
 * Registra un dominio personalizado en el proyecto de Vercel.
 * Vercel gestionará el SSL automáticamente vía Let's Encrypt.
 *
 * @param {string} domain — ej. "burgos.com" o "www.burgos.com"
 * @returns {Promise<{ok: boolean, status: string, data: object}>}
 */
async function addDomainToVercel(domain) {
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
        console.warn('⚠️  VERCEL_TOKEN o VERCEL_PROJECT_ID no configurados. Saltando registro de dominio en Vercel.');
        return { ok: false, status: 'skipped', data: {} };
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase().trim();

    const teamQuery = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
    const url = `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains${teamQuery}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VERCEL_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: cleanDomain }),
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`✅ Dominio '${cleanDomain}' registrado en Vercel exitosamente.`);
            return { ok: true, status: 'registered', data };
        }

        // Vercel devuelve 409 si el dominio ya estaba registrado — no es un error real
        if (response.status === 409 || data.error?.code === 'domain_already_in_use') {
            console.log(`ℹ️  Dominio '${cleanDomain}' ya estaba registrado en Vercel.`);
            return { ok: true, status: 'already_exists', data };
        }

        console.error(`❌ Error al registrar dominio en Vercel: ${data.error?.message || JSON.stringify(data)}`);
        return { ok: false, status: 'error', data };

    } catch (err) {
        console.error('❌ Error de red al llamar a Vercel API:', err.message);
        return { ok: false, status: 'network_error', data: { message: err.message } };
    }
}

/**
 * Elimina un dominio personalizado del proyecto de Vercel.
 * Útil si el cliente desactiva o cambia su dominio.
 *
 * @param {string} domain
 * @returns {Promise<{ok: boolean, status: string}>}
 */
async function removeDomainFromVercel(domain) {
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
        return { ok: false, status: 'skipped' };
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase().trim();
    const teamQuery = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
    const url = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${cleanDomain}${teamQuery}`;

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` },
        });

        if (response.ok || response.status === 404) {
            console.log(`🗑️  Dominio '${cleanDomain}' eliminado de Vercel.`);
            return { ok: true, status: 'removed' };
        }

        return { ok: false, status: 'error' };
    } catch (err) {
        console.error('Error eliminando dominio de Vercel:', err.message);
        return { ok: false, status: 'network_error' };
    }
}

module.exports = { addDomainToVercel, removeDomainFromVercel };
