const db = require('../config/db');


// [GET] /api/sensors?range=30days&search=&sensor=&limit=&page=
exports.getAllData = async (req, res) => {
    try {
        const { range, search, sensor, limit, page } = req.query;

        let queryParams = [];

        let sql = `
            SELECT ds.ID, s.Name AS SensorName, ds.Value, ds.CreatedAt
            FROM datasensors ds
            JOIN sensors s ON ds.ID_Ss = s.ID
            WHERE 1=1
        `;

        // 1️⃣ Lọc theo khoảng thời gian
        if (range === '30days') {
            sql += ` AND ds.CreatedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) `;
        }

        // 2️⃣ Lọc theo tên Sensor
        if (sensor) {
            sql += ` AND s.Name = ? `;
            queryParams.push(sensor);
        }

        // 3️⃣ Search theo Value hoặc thời gian
        if (search) {
            sql += `
                AND (
                    ds.Value LIKE ?
                    OR DATE_FORMAT(ds.CreatedAt, '%Y-%m-%d %H:%i:%s') LIKE ?
                )
            `;
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern);
        }

        // 4️⃣ Sắp xếp mới nhất lên đầu
        sql += ` ORDER BY ds.CreatedAt DESC `;

        // 5️⃣ Phân trang
        if (limit && page) {

            const parsedLimit = parseInt(limit);
            const parsedPage = parseInt(page);
            const offset = (parsedPage - 1) * parsedLimit;

            sql += ` LIMIT ? OFFSET ? `;
            queryParams.push(parsedLimit, offset);

        } else {
            // Nếu gọi từ dashboard
            sql += ` LIMIT 90 `;
        }

        const [rows] = await db.query(sql, queryParams);

        // ==============================
        // COUNT tổng số bản ghi (có filter)
        // ==============================
        let total = rows.length;

        if (limit && page) {

            let countSql = `
                SELECT COUNT(*) as total
                FROM datasensors ds
                JOIN sensors s ON ds.ID_Ss = s.ID
                WHERE 1=1
            `;

            let countParams = [];

            if (range === '30days') {
                countSql += ` AND ds.CreatedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) `;
            }

            if (sensor) {
                countSql += ` AND s.Name = ? `;
                countParams.push(sensor);
            }

            if (search) {
                countSql += `
                    AND (
                        ds.Value LIKE ?
                        OR DATE_FORMAT(ds.CreatedAt, '%Y-%m-%d %H:%i:%s') LIKE ?
                    )
                `;
                const searchPattern = `%${search}%`;
                countParams.push(searchPattern, searchPattern);
            }

            const [totalRows] = await db.query(countSql, countParams);
            total = totalRows[0].total;
        }

        const totalPages = (limit && page)
            ? Math.ceil(total / parseInt(limit))
            : 1;

        res.status(200).json({
            total,
            count: rows.length,
            totalPages,
            data: rows
        });

    } catch (error) {
        res.status(500).json({
            message: "Lỗi lấy dữ liệu lịch sử",
            error: error.message
        });
    }
};