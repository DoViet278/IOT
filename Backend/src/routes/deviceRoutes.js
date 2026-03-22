const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

/**
 * @swagger
 * tags:
 *   name: Devices
 *   description: API điều khiển thiết bị IoT
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DeviceActionHistory:
 *       type: object
 *       properties:
 *         ID:
 *           type: integer
 *           example: 1
 *         DeviceName:
 *           type: string
 *           example: "Đèn phòng khách"
 *         Action:
 *           type: string
 *           enum: [ON, OFF]
 *           example: ON
 *         Status:
 *           type: string
 *           enum: [Processing, Success, Fail]
 *           example: Success
 *         CreatedAt:
 *           type: string
 *           format: date-time
 *           example: "2026-03-20 10:30:00"
 *
 *     DeviceStatus:
 *       type: object
 *       properties:
 *         "1":
 *           type: string
 *           example: ON
 *         "2":
 *           type: string
 *           example: OFF
 *         "3":
 *           type: string
 *           example: Processing
 *
 *     ControlRequest:
 *       type: object
 *       required:
 *         - DeviceID
 *         - Action
 *       properties:
 *         DeviceID:
 *           type: integer
 *           example: 1
 *         Action:
 *           type: string
 *           enum: [ON, OFF]
 *           example: ON
 *
 *     ControlResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Lệnh đã được gửi, đang chờ phản hồi..."
 *         historyId:
 *           type: integer
 *           example: 15
 *
 *     PaginationResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DeviceActionHistory'
 *         total:
 *           type: integer
 *           example: 100
 *         totalPages:
 *           type: integer
 *           example: 10
 *         currentPage:
 *           type: integer
 *           example: 1
 */

/**
 * @swagger
 * /api/devices/data:
 *   get:
 *     summary: Lấy danh sách lịch sử điều khiển thiết bị (có phân trang, filter)
 *     tags: [Devices]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm theo thời gian
 *         example: "2026-03-20"
 *
 *       - in: query
 *         name: deviceId
 *         schema:
 *           type: integer
 *         description: ID thiết bị
 *         example: 1
 *
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số bản ghi mỗi trang
 *
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang hiện tại
 *
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginationResponse'
 *
 *       500:
 *         description: Lỗi server
 */
router.get('/data', deviceController.getAllData);

/**
 * @swagger
 * /api/devices/status:
 *   get:
 *     summary: Lấy trạng thái mới nhất của các thiết bị
 *     tags: [Devices]
 *     responses:
 *       200:
 *         description: Trạng thái thiết bị
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceStatus'
 *
 *       500:
 *         description: Lỗi server
 */
router.get('/status', deviceController.getLatestStatus);

/**
 * @swagger
 * /api/devices/control:
 *   post:
 *     summary: Gửi lệnh điều khiển thiết bị (MQTT)
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ControlRequest'
 *
 *     responses:
 *       200:
 *         description: Gửi lệnh thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ControlResponse'
 *
 *       400:
 *         description: Thiếu dữ liệu đầu vào
 *         content:
 *           application/json:
 *             example:
 *               message: "Thiếu DeviceID hoặc Action"
 *
 *       500:
 *         description: Lỗi server
 */
router.post('/control', deviceController.controlDevice);

module.exports = router;