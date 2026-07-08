const express = require('express');
const router = express.Router();
const etapasController = require('../controllers/etapasController');

// Obtener la hoja de ruta completa (todas las etapas) de un lote específico
router.get('/lote/:loteId', etapasController.getByLote);

// Crear, actualizar y eliminar etapas
router.post('/', etapasController.create);
router.put('/:id', etapasController.update);
router.delete('/:id', etapasController.remove);

module.exports = router;