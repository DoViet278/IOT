const db = require('../config/db');
const mqttClient = require('../config/mqtt');
const { getIO } = require('../socket');

const timers = global.deviceTimers || {};
const io = getIO();

const DEVICE_NAMES = {
    1: "Đèn",
    2: "Quạt",
    3: "Điều hòa",
    4: "Tivi",
    5: "Máy bơm"
};

function parseDays(value) {
    const parsed = parseInt(value, 10);

    if (Number.isNaN(parsed) || parsed < 1) {
        return 14;
    }

    return Math.min(parsed, 90);
}

function parseSelectedDate(value) {
    if (!value || typeof value !== "string") {
        return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return formatDateKey(date) === value ? value : null;
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function buildDateLabels(days) {
    const labels = [];
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    for (let index = 0; index < days; index += 1) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + index);
        labels.push(formatDateKey(currentDate));
    }

    return labels;
}


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
            WHERE t.ID_Device IN (1,2,3,4,5)
        `;

        const [rows] = await db.query(sql);

        const statusMap = {
            1: "OFF",
            2: "OFF",
            3: "OFF",
            4: "OFF",
            5: "OFF"
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


// [GET] /api/devices/usage/daily
exports.getDailyUsageStats = async (req, res) => {
    try {
        const selectedDate = parseSelectedDate(req.query.date);
        const days = selectedDate ? 1 : parseDays(req.query.days);
        const labels = selectedDate ? [selectedDate] : buildDateLabels(days);
        const startDate = labels[0];
        const endDate = labels[labels.length - 1];

        const aggregateSql = `
            SELECT
                DATE(ah.CreatedAt) AS actionDate,
                ah.ID_Device AS DeviceID,
                d.Name AS DeviceName,
                COUNT(*) AS actionCount,
                SUM(CASE WHEN UPPER(TRIM(ah.Action)) = 'ON' THEN 1 ELSE 0 END) AS onCount,
                SUM(CASE WHEN UPPER(TRIM(ah.Action)) = 'OFF' THEN 1 ELSE 0 END) AS offCount
            FROM actionshistory ah
            JOIN device d ON ah.ID_Device = d.ID
            WHERE ah.ID_Device IN (1, 2, 3, 4, 5)
            AND ah.Status = 'Success'
            AND DATE(ah.CreatedAt) BETWEEN ? AND ?
            GROUP BY DATE(ah.CreatedAt), ah.ID_Device, d.Name
            ORDER BY actionDate ASC, ah.ID_Device ASC
        `;

        const [rows] = await db.query(aggregateSql, [startDate, endDate]);

        const devices = [1, 2, 3, 4, 5].map((deviceId) => ({
            DeviceID: deviceId,
            DeviceName: DEVICE_NAMES[deviceId],
            data: labels.map(() => 0),
            onData: labels.map(() => 0),
            offData: labels.map(() => 0),
            total: 0,
            onCount: 0,
            offCount: 0
        }));

        const deviceIndexMap = new Map(devices.map((device, index) => [device.DeviceID, index]));
        const labelIndexMap = new Map(labels.map((label, index) => [label, index]));

        rows.forEach((row) => {
            const deviceIndex = deviceIndexMap.get(row.DeviceID);
            const labelIndex = labelIndexMap.get(formatDateKey(new Date(row.actionDate)));

            if (deviceIndex === undefined || labelIndex === undefined) {
                return;
            }

            const count = Number(row.actionCount) || 0;
            const onCount = Number(row.onCount) || 0;
            const offCount = Number(row.offCount) || 0;

            devices[deviceIndex].data[labelIndex] += count;
            devices[deviceIndex].onData[labelIndex] += onCount;
            devices[deviceIndex].offData[labelIndex] += offCount;
            devices[deviceIndex].total += count;
            devices[deviceIndex].onCount += onCount;
            devices[deviceIndex].offCount += offCount;
            devices[deviceIndex].DeviceName = row.DeviceName || devices[deviceIndex].DeviceName;
        });

        res.status(200).json({
            days,
            selectedDate,
            startDate,
            endDate,
            labels,
            devices,
            summary: devices.map((device) => ({
                DeviceID: device.DeviceID,
                DeviceName: device.DeviceName,
                total: device.total,
                onCount: device.onCount,
                offCount: device.offCount
            }))
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi Server", error: error.message });
    }
};


// [POST] /api/devices/control
exports.controlDevice = async (req, res) => {
    try {
        const { DeviceID, Action } = req.body;

        if (!DeviceID || !Action) {
            return res.status(400).json({
                message: "Thiếu DeviceID hoặc Action"
            });
        }

        const insertSql = `
            INSERT INTO actionshistory (ID_Device, Action, Status, CreatedAt)
            VALUES (?, ?, 'Processing', NOW())
        `;

        const [result] = await db.query(insertSql, [DeviceID, Action]);
        const historyId = result.insertId;

        const topic = process.env.TOPIC_CONTROL;
        const payload = JSON.stringify({ DeviceID, Action });

        mqttClient.publish(topic, payload, { qos: 1 });

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