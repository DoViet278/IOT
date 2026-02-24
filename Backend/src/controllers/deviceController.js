const db = require('../config/db');
const mqttClient = require('../config/mqtt');
const { getIO } = require('../socket');

const timers = global.deviceTimers || {};
const io = getIO();


// [GET] /api/devices
exports.getAllData = async (req, res) => {
    try {
        const { search, deviceId, status, limit, page } = req.query;

        let queryParams = [];

        let sql = `
            SELECT ah.ID, d.Name as DeviceName, ah.Action, ah.Status, ah.CreatedAt
            FROM actionshistory ah
            JOIN device d ON ah.ID_Device = d.ID
            WHERE 1=1
        `;

        // Search theo thời gian
        if (search) {
            sql += ` AND DATE_FORMAT(ah.CreatedAt, '%Y-%m-%d %H:%i:%s') LIKE ? `;
            queryParams.push(`%${search}%`);
        }

        // Lọc theo Device
        if (deviceId) {
            sql += ` AND d.ID = ? `;
            queryParams.push(deviceId);
        }

        // Lọc theo Status
        if (status) {
            sql += ` AND ah.Status = ? `;
            queryParams.push(status);
        }

        sql += ` ORDER BY ah.CreatedAt DESC `;

        const parsedLimit = limit ? parseInt(limit) : 10;
        const parsedPage = page ? parseInt(page) : 1;

        if (limit && page) {
            const offset = (parsedPage - 1) * parsedLimit;
            sql += ` LIMIT ? OFFSET ? `;
            queryParams.push(parsedLimit, offset);
        }

        const [rows] = await db.query(sql, queryParams);

        // COUNT
        let countSql = `
            SELECT COUNT(*) as total
            FROM actionshistory ah
            JOIN device d ON ah.ID_Device = d.ID
            WHERE 1=1
        `;

        let countParams = [];

        if (search) {
            countSql += ` AND DATE_FORMAT(ah.CreatedAt, '%Y-%m-%d %H:%i:%s') LIKE ? `;
            countParams.push(`%${search}%`);
        }

        if (deviceId) {
            countSql += ` AND d.ID = ? `;
            countParams.push(deviceId);
        }

        if (status) {
            countSql += ` AND ah.Status = ? `;
            countParams.push(status);
        }

        const [totalRows] = await db.query(countSql, countParams);

        const total = totalRows[0].total;
        const totalPages = Math.ceil(total / parsedLimit);

        res.json({
            data: rows,
            total,
            totalPages,
            currentPage: parsedPage
        });

    } catch (error) {
        res.status(500).json({ message: "Lỗi Server", error: error.message });
    }
};


// [GET] /api/devices/status
exports.getLatestDeviceStatus = async (req, res) => {
    try {

        const sql = `
            SELECT t.ID_Device, t.Action, t.Status
            FROM actionshistory t
            INNER JOIN (
                SELECT ID_Device, MAX(ID) as MaxID
                FROM actionshistory
                GROUP BY ID_Device
            ) latest ON t.ID = latest.MaxID
            WHERE t.ID_Device IN (1,2,3)
        `;

        const [rows] = await db.query(sql);

        const statusMap = {
            1: "OFF",
            2: "OFF",
            3: "OFF"
        };

        rows.forEach(item => {

            if (item.Status === 'Processing') {
                statusMap[item.ID_Device] = "Processing";
            }

            else if (item.Status === 'Success') {
                statusMap[item.ID_Device] = item.Action;
            }

            else {
                statusMap[item.ID_Device] =
                    (item.Action === 'ON') ? 'OFF' : 'ON';
            }
        });

        res.status(200).json(statusMap);

    } catch (error) {
        res.status(500).json({ message: "Lỗi Server", error: error.message });
    }
};


// [POST] /api/devices/control
exports.controlDevice = async (req, res) => {

    const { DeviceID, Action } = req.body;

    if (!DeviceID || !Action) {
        return res.status(400).json({ message: "Thiếu DeviceID hoặc Action" });
    }

    try {
        const [result] = await db.query(
            `INSERT INTO actionshistory (ID_Device, Action, Status, CreatedAt)
             VALUES (?, ?, 'Processing', NOW())`,
            [DeviceID, Action]
        );

        const historyId = result.insertId;

        const topic = "device/control";
        const payload = JSON.stringify({ DeviceID, Action });

        mqttClient.publish(topic, payload, { qos: 1 });

        timers[historyId] = setTimeout(async () => {

            const [check] = await db.query(
                "SELECT Status FROM actionshistory WHERE ID = ?",
                [historyId]
            );

            if (check[0] && check[0].Status === 'Processing') {

                await db.query(
                    "UPDATE actionshistory SET Status = 'Fail' WHERE ID = ?",
                    [historyId]
                );

                io.emit('device_status_update', {
                    DeviceID,
                    Status: 'Fail',
                    Action,
                    Message: 'Timeout'
                });

                console.log(`[TIMEOUT] HistoryID ${historyId} -> Fail`);
            }

            delete timers[historyId];

        }, 120000);

        res.status(200).json({
            message: "Lệnh đã được gửi, đang chờ phản hồi...",
            historyId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi Server", error: error.message });
    }
};