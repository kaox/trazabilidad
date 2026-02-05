const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

/**
 * Configuración centralizada de Mercado Pago
 */
const mpClient = new MercadoPagoConfig({
    access_token: process.env.MP_ACCESS_TOKEN,
    options: { timeout: 5000 }
});

module.exports = {
    mpClient,
    Preference,
    Payment
};