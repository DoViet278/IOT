require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const socketStorage = require('./socket');
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
// Swagger endpoint
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// KHỞI TẠO SOCKET
socketStorage.init(server); 

const mqttClient = require('./config/mqtt');
const sensorRoutes = require('./routes/sensorRoutes');
const deviceRoutes = require('./routes/deviceRoutes');

app.use('/api/sensors', sensorRoutes);
app.use('/api/devices', deviceRoutes);

const PORT = process.env.PORT;
server.listen(PORT, () => {
    console.log(`BE đang chạy tại http://localhost:${PORT}`);
});