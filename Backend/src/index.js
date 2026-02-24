require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const socketStorage = require('./socket'); // Import file vừa tạo

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// KHỞI TẠO SOCKET TẠI ĐÂY
socketStorage.init(server); 

// Sau khi init xong mới import MQTT và Routes
const mqttClient = require('./config/mqtt');
const sensorRoutes = require('./routes/sensorRoutes');
const deviceRoutes = require('./routes/deviceRoutes');

app.use('/api/sensors', sensorRoutes);
app.use('/api/devices', deviceRoutes);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`BE đang chạy tại http://localhost:${PORT}`);
});