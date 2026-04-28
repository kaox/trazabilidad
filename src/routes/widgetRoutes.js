// src/routes/widgetRoutes.js
const express = require('express');
const router = express.Router();
const widgetController = require('../controllers/widgetController');

router.get('/radar/:public_token', widgetController.serveWidget);

module.exports = router;
