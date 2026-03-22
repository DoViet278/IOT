const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

/**
 * @swagger
 * tags:
 *   name: Sensors
 *   description: API dữ liệu cảm biến (IoT)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SensorData:
 *       type: object
 *       properties:
 *         ID:
 *           type: integer
 *           example: 1
 *         SensorName:
 *           type: string
 *           example: "Temperature"
 *         Value:
 *           type: number
 *           example: 28.5
 *         CreatedAt:
 *           type: string
 *           format: date-time
 *           example: "2026-03-20 10:30:00"
 *
 *     SensorResponse:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           example: 100
 *         count:
 *           type: integer
 *           example: 10
 *         totalPages:
 *           type: integer
 *           example: 10
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SensorData'
 */

/**
 * @swagger
 * /api/sensors/data:
 *   get:
 *     summary: Lấy dữ liệu cảm biến (dashboard hoặc phân trang)
 *
 *     tags: [Sensors]
 *
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [10days]
 *         description: Lọc dữ liệu trong 10 ngày gần nhất
 *
 *       - in: query
 *         name: sensor
 *         schema:
 *           type: string
 *         description: Tên cảm biến (ví dụ Temperature, Humidity)
 *         example: Temperature
 *
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo giá trị hoặc thời gian
 *         example: "2026-03-20"
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Số bản ghi mỗi trang (bắt buộc nếu dùng phân trang)
 *         example: 10
 *
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Trang hiện tại (bắt buộc nếu dùng phân trang)
 *         example: 1
 *
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SensorResponse'
 *
 *             examples:
 *               dashboardMode:
 *                 summary: Dashboard mode (không phân trang)
 *                 value:
 *                   total: 90
 *                   count: 90
 *                   totalPages: 1
 *                   data:
 *                     - ID: 1
 *                       SensorName: Temperature
 *                       Value: 28.5
 *                       CreatedAt: "2026-03-20 10:30:00"
 *
 *               paginationMode:
 *                 summary: Pagination mode
 *                 value:
 *                   total: 100
 *                   count: 10
 *                   totalPages: 10
 *                   data:
 *                     - ID: 1
 *                       SensorName: Humidity
 *                       Value: 65
 *                       CreatedAt: "2026-03-20 10:30:00"
 *
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             example:
 *               message: "Lỗi lấy dữ liệu lịch sử"
 */
router.get('/data', sensorController.getAllDataSensors);

module.exports = router;