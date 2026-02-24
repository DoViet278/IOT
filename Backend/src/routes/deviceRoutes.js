const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

router.get('/', deviceController.getAllData);
router.post('/control', deviceController.controlDevice);
router.get('/status', deviceController.getLatestDeviceStatus);
module.exports = router;