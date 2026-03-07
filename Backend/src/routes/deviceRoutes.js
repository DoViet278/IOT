const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

router.get('/data', deviceController.getAllData);
router.post('/control', deviceController.controlDevice);
router.get('/status', deviceController.getLatestStatus);
module.exports = router;