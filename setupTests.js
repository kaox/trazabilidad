const fs = require('fs');
const path = require('path');
const JSDOM = require('jsdom').JSDOM;

// Cargar el HTML de la página para simular el DOM
const html = fs.readFileSync(path.resolve(__dirname, './views/index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:3000/app/trazabilidad' });

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock de funciones globales que el script espera encontrar
global.api = jest.fn();
global.logout = jest.fn();
global.qrcode = jest.fn(() => ({
    addData: jest.fn(),
    make: jest.fn(),
    createDataURL: jest.fn(() => 'data:image/png;base64,...')
}));
