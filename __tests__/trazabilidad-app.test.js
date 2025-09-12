/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Cargar el script de la aplicación en el entorno de JSDOM
const script = fs.readFileSync(path.resolve(__dirname, './public/trazabilidad-app.js'), 'utf8');

describe('Pruebas para Trazabilidad App', () => {

    beforeEach(() => {
        // Limpiar mocks y DOM antes de cada prueba
        jest.clearAllMocks();
        // Cargar el HTML base antes de cada prueba
        document.body.innerHTML = fs.readFileSync(path.resolve(__dirname, './views/index.html'), 'utf8');
        
        // Simular una respuesta exitosa por defecto para las plantillas y lotes
        api.mockResolvedValue([]); 
    });

    test('debe inicializar y llamar a las funciones de carga de datos', async () => {
        // Ejecutar el script
        eval(script);
        document.dispatchEvent(new window.Event('DOMContentLoaded'));

        // Verificar que se llamó a la API para cargar plantillas y lotes
        expect(api).toHaveBeenCalledWith('/api/templates');
        expect(api).toHaveBeenCalledWith('/api/batches/tree');
    });

    test('debe renderizar el mensaje de bienvenida si no hay lotes', async () => {
        api.mockResolvedValueOnce([]); // Mock para loadTemplates
        api.mockResolvedValueOnce([]); // Mock para loadBatches

        eval(script);
        await new Promise(process.nextTick); // Esperar a que las promesas se resuelvan
        document.dispatchEvent(new window.Event('DOMContentLoaded'));
        await new Promise(process.nextTick);

        const welcomeScreen = document.getElementById('welcome-screen');
        expect(welcomeScreen.classList.contains('hidden')).toBe(false);
    });

    test('debe abrir el modal de selección de plantilla al hacer clic en "Iniciar Nuevo Proceso"', async () => {
        const mockTemplates = [{ id: 1, nombre_producto: 'Cacao Fino' }];
        api.mockResolvedValue(mockTemplates);
        
        eval(script);
        document.dispatchEvent(new window.Event('DOMContentLoaded'));
        await new Promise(process.nextTick);

        const modal = document.getElementById('form-modal');
        modal.showModal = jest.fn(); // Mock de la función showModal

        const crearProcesoBtn = document.getElementById('crear-proceso-btn');
        crearProcesoBtn.click();

        expect(modal.showModal).toHaveBeenCalled();
        expect(document.getElementById('template-selector').innerHTML).toContain('Cacao Fino');
    });
    
    test('debe generar un ID de lote con el formato correcto', () => {
        // Para probar funciones internas, las exponemos temporalmente en el objeto window
        let generateId;
        const tempScript = `
            ${script}
            window.testableGenerateId = generateId;
        `;
        eval(tempScript);
        generateId = window.testableGenerateId;

        const id = generateId('COS');
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        
        expect(id).toMatch(new RegExp(`^COS-${datePart}-\\w{4}$`));
    });

    test('debe construir y enviar correctamente los datos para un nuevo lote', async () => {
        // Configuración de mocks
        const mockTemplates = [{ id: 1, nombre_producto: 'Cacao Fino' }];
        const mockStages = [{ id: 1, nombre_etapa: 'Cosecha', orden: 1, campos_json: { entradas: [], salidas: [], variables: [{ label: 'Finca', name: 'finca', type: 'selectFinca' }] } }];
        api.mockResolvedValueOnce(mockTemplates) // Para loadTemplates
           .mockResolvedValueOnce(mockStages)      // Para stagesByTemplate
           .mockResolvedValueOnce([])             // Para loadBatches
           .mockResolvedValueOnce([])             // Para createFincaSelectHTML
           .mockResolvedValueOnce({});             // Para la llamada de creación del lote

        eval(script);
        document.dispatchEvent(new window.Event('DOMContentLoaded'));
        await new Promise(process.nextTick);

        // Simular la selección de plantilla y la creación del lote
        const modal = document.getElementById('form-modal');
        modal.showModal = jest.fn();
        modal.close = jest.fn();

        // 1. Abrir selector de plantillas
        document.getElementById('crear-proceso-btn').click();
        
        // 2. Simular clic en "Siguiente" para abrir el formulario de la primera etapa
        document.getElementById('start-process-btn').click();
        await new Promise(process.nextTick);

        // 3. Simular el envío del formulario
        const form = document.getElementById('batch-form');
        const fincaInput = document.createElement('input');
        fincaInput.name = 'finca';
        fincaInput.value = 'Finca La Esmeralda';
        form.appendChild(fincaInput);

        form.dispatchEvent(new window.Event('submit', { bubbles: true }));
        await new Promise(process.nextTick);

        // Verificar que la API fue llamada para crear el lote con los datos correctos
        expect(api).toHaveBeenCalledWith('/api/batches', expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"finca":"Finca La Esmeralda"')
        }));
    });

});
