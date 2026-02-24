const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Chuyển sang dạng Promise để dùng async/await cho mượt
const db = pool.promise();

console.log('MySQL Pool đã được khởi tạo');

module.exports = db;