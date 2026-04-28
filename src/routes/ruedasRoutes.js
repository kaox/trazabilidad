const express = require('express');
const router = express.Router();
const ruedasController = require('../controllers/ruedasController');

router.get('/', ruedasController.getAll);
router.get('/:id', ruedasController.getById);
router.post('/', ruedasController.create);
router.put('/:id', ruedasController.update);
router.delete('/:id', ruedasController.remove);
router.post('/:id/regenerate-token', ruedasController.regenerateToken);

module.exports = router;
