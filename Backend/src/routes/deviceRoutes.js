const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

/**
 * @swagger
 * tags:
 *   name: Devices
 *   description: API điều khiển thiết bị
 */

/**
 * @swagger
 * /api/devices/data:
 *   get:
 *     summary: Lấy toàn bộ dữ liệu thiết bị
 *     tags: [Devices]
 *     responses:
 *       200:
 *         description: Danh sách dữ liệu thiết bị
 */
router.get('/data', deviceController.getAllData);

/**
 * @swagger
 * /api/devices/control:
 *   post:
 *     summary: Điều khiển thiết bị
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: integer
 *               action:
 *                 type: string
 *                 example: ON
 *     responses:
 *       200:
 *         description: Điều khiển thành công
 */
router.post('/control', deviceController.controlDevice);

/**
 * @swagger
 * /api/devices/status:
 *   get:
 *     summary: Lấy trạng thái thiết bị mới nhất
 *     tags: [Devices]
 *     responses:
 *       200:
 *         description: Trạng thái thiết bị
 */
router.get('/status', deviceController.getLatestStatus);

module.exports = router;