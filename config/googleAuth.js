const { OAuth2Client } = require('google-auth-library');

/**
 * Cliente de Google para autenticación OAuth2
 */
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

module.exports = {
    googleClient,
    GOOGLE_CLIENT_ID
};