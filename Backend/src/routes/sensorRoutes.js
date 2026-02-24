const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

router.get('/', sensorController.getAllData);
module.exports = router;