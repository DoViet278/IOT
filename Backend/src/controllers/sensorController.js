const db = require('../config/db');

// [GET] /api/sensors?range=10days&search=&sensor=&limit=&page=
exports.getAllDataSensors = async (req, res) => {
    try {
        const { range, search, sensor, limit, page } = req.query;

        const parsedLimit = limit ? parseInt(limit) : null;
        const parsedPage = page ? parseInt(page) : null;
        const offset = parsedLimit && parsedPage ? (parsedPage - 1) * parsedLimit : 0;

        // ===== Build WHERE chung =====
        let conditions = [];
        let params = [];

        if (range === '10days') {
            conditions.push(`ds.CreatedAt >= DATE_SUB(NOW(), INTERVAL 10 DAY)`);
        }

        if (sensor) {
            conditions.push(`s.Name = ?`);
            params.push(sensor);
        }

        if (search) {
            conditions.push(`(
                ds.Value LIKE ?
                OR DATE_FORMAT(ds.CreatedAt, '%Y-%m-%d %H:%i:%s') LIKE ?
            )`);
            const pattern = `%${search}%`;
            params.push(pattern, pattern);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        // ===== Query data =====
        let dataSql = `
            SELECT ds.ID, s.Name AS SensorName, ds.Value, ds.CreatedAt
            FROM datasensors ds
            JOIN sensors s ON ds.ID_Ss = s.ID
            ${whereClause}
            ORDER BY ds.CreatedAt DESC, ds.ID DESC
        `;

        // Phân trang hoặc dashboard
        if (parsedLimit && parsedPage) {
            dataSql += ` LIMIT ? OFFSET ?`;
        } else {
            dataSql += ` LIMIT 30`;
        }

        const dataParams = (parsedLimit && parsedPage)
            ? [...params, parsedLimit, offset]
            : params;

        const [rows] = await db.query(dataSql, dataParams);

        // ===== COUNT (chỉ khi có phân trang) =====
        let total = rows.length;

        if (parsedLimit && parsedPage) {
            const countSql = `
                SELECT COUNT(*) as total
                FROM datasensors ds
                JOIN sensors s ON ds.ID_Ss = s.ID
                ${whereClause}
            `;

            const [totalRows] = await db.query(countSql, params);
            total = totalRows[0].total;
        }

        res.status(200).json({
            total,
            count: rows.length,
            totalPages: (parsedLimit && parsedPage)
                ? Math.ceil(total / parsedLimit)
                : 1,
            data: rows
        });

    } catch (error) {
        res.status(500).json({
            message: "Lỗi lấy dữ liệu lịch sử",
            error: error.message
        });
    }
};