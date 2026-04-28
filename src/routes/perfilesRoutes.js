// src/routes/perfilesRoutes.js
const express = require('express');
const router = express.Router();
const perfilesController = require('../controllers/perfilesController');

// All routes here should be protected by API authentication in server.js
router.get('/', perfilesController.getAll);
router.get('/:id', perfilesController.getById);
router.post('/', perfilesController.create);
router.put('/:id', perfilesController.update);
router.delete('/:id', perfilesController.remove);

module.exports = router;
