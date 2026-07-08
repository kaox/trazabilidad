const express = require('express');
const router = express.Router();
const lotesController = require('../controllers/lotesController');

// Todas las rutas aquí asumen que pasan por un middleware de auth (ej. en server.js: app.use('/api/lotes', authMiddleware, lotesRoutes))
router.get('/', lotesController.getAll);
router.get('/:id', lotesController.getById);
router.post('/', lotesController.create);
router.put('/:id', lotesController.update);
router.delete('/:id', lotesController.remove);
router.post('/:id/sellar', lotesController.sellarBlockchain); // Ruta para congelar el lote

module.exports = router;