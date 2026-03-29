const db = require('../config/db');
const mqttClient = require('../config/mqtt');
const { getIO } = require('../socket');

const timers = global.deviceTimers || {};
const io = getIO();


// [GET] /api/devices/data
exports.getAllData = async (req, res) => {
    try {
        const { search, deviceId, status, action, limit = 10, page = 1 } = req.query;

        const parsedLimit = parseInt(limit);
        const parsedPage = parseInt(page);
        const offset = (parsedPage - 1) * parsedLimit;
        
        let conditions = [];
        let params = [];

        if (search) {
            conditions.push(`DATE_FORMAT(ah.CreatedAt, '%Y-%m-%d %H:%i:%s') LIKE ?`);
            params.push(`%${search}%`);
        }

        if (deviceId) {
            conditions.push(`d.ID = ?`);
            params.push(deviceId);
        }

        if (status) {
            conditions.push(`ah.Status = ?`);
            params.push(status);
        }

        if (action) {
            conditions.push(`ah.Action = ?`);
            params.push(action);
        }
        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        // Query chính
        const dataSql = `
            SELECT ah.ID, d.Name as DeviceName, ah.Action, ah.Status, ah.CreatedAt
            FROM actionshistory ah
            JOIN device d ON ah.ID_Device = d.ID
            ${whereClause}
            ORDER BY ah.CreatedAt DESC, ah.ID DESC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await db.query(dataSql, [...params, parsedLimit, offset]);

        // Query count 
        const countSql = `
            SELECT COUNT(*) as total
            FROM actionshistory ah
            JOIN device d ON ah.ID_Device = d.ID
            ${whereClause}
        `;

        const [totalRows] = await db.query(countSql, params);

        const total = totalRows[0].total;

        res.json({
            data: rows,
            total,
            totalPages: Math.ceil(total / parsedLimit),
            currentPage: parsedPage
        });

    } catch (error) {
        res.status(500).json({ message: "Lỗi Server", error: error.message });
    }
};


// [GET] /api/devices/status
exports.getLatestStatus = async (req, res) => {
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
    try {
        const { DeviceID, Action } = req.body;

        // 1. Validate
        if (!DeviceID || !Action) {
            return res.status(400).json({
                message: "Thiếu DeviceID hoặc Action"
            });
        }

        // 2. Lưu lịch sử (Processing)
        const insertSql = `
            INSERT INTO actionshistory (ID_Device, Action, Status, CreatedAt)
            VALUES (?, ?, 'Processing', NOW())
        `;

        const [result] = await db.query(insertSql, [DeviceID, Action]);
        const historyId = result.insertId;

        // 3. Publish MQTT
        const topic = process.env.TOPIC_CONTROL;
        const payload = JSON.stringify({ DeviceID, Action });

        mqttClient.publish(topic, payload, { qos: 1 });

        // 4. Timeout xử lý Fail
        const handleTimeout = async () => {
            try {
                const [rows] = await db.query(
                    "SELECT Status FROM actionshistory WHERE ID = ?",
                    [historyId]
                );

                const currentStatus = rows[0]?.Status;

                if (currentStatus === "Processing") {
                    await db.query(
                        "UPDATE actionshistory SET Status = 'Fail' WHERE ID = ?",
                        [historyId]
                    );

                    io.emit("update_status", {
                        DeviceID,
                        Status: "Fail",
                        Action,
                        Message: "Timeout"
                    });

                    console.log(`[TIMEOUT] HistoryID ${historyId} -> Fail`);
                }
            } catch (err) {
                console.error("Timeout error:", err);
            } finally {
                delete timers[historyId];
            }
        };

        timers[historyId] = setTimeout(handleTimeout, 10000);

        // 5. Response
        return res.status(200).json({
            message: "Lệnh đã được gửi, đang chờ phản hồi...",
            historyId
        });

    } catch (error) {
        console.error("ControlDevice Error:", error);
        return res.status(500).json({
            message: "Lỗi Server",
            error: error.message
        });
    }
};