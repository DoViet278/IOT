const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

router.get('/data', sensorController.getAllDataSensors);
module.exports = router;