const mqtt = require('mqtt');
const db = require('./db');
const { getIO } = require('../socket');
require('dotenv').config();

const timers = global.deviceTimers || {};

const options = {
    username: process.env.USER_NAME,
    password: process.env.PASSWORD,
    clean: true,
    connectTimeout: 4000,
};

const mqttClient = mqtt.connect(process.env.MQTT_BROKER, options);

mqttClient.on('connect', () => {
    console.log('--- MQTT Connected ---');
    
    const topics = [process.env.MQTT_TOPIC, 'device/confirm', 'device/init'];
    
    mqttClient.subscribe(topics, (err) => {
        if (!err) {
            console.log(`Đã subscribe: ${topics.join(', ')}`);
        }
    });
});

mqttClient.on('message', async (topic, message) => {
    const io = getIO();
    const payload = message.toString();
    if (!payload) return;

    try {
        const data = JSON.parse(payload);
        if (topic === process.env.MQTT_TOPIC) {
            const { temperature, humidity, light } = data;

            if (temperature !== undefined && humidity !== undefined && light !== undefined) {

                await Promise.all([
                    db.query(
                        "INSERT INTO datasensors (ID_Ss, Value, CreatedAt) VALUES (1, ?, NOW())",
                        [temperature]
                    ),
                    db.query(
                        "INSERT INTO datasensors (ID_Ss, Value, CreatedAt) VALUES (2, ?, NOW())",
                        [humidity]
                    ),
                    db.query(
                        "INSERT INTO datasensors (ID_Ss, Value, CreatedAt) VALUES (3, ?, NOW())",
                        [light]
                    )
                ]);

                io.emit('sensorData', {
                    temperature,
                    humidity,
                    light,
                    time: new Date().toLocaleTimeString('vi-VN')
                });

                console.log(`[SENSOR] T:${temperature} H:${humidity} L:${light}`);
            }
        }
        else if (topic === 'device/confirm') {

            const { DeviceID } = data;

            const [rows] = await db.query(
                `SELECT ID FROM actionshistory 
                 WHERE ID_Device = ? 
                 AND Status = 'Processing' 
                 ORDER BY CreatedAt DESC 
                 LIMIT 1`,
                [DeviceID]
            );

            if (rows.length > 0) {

                const historyId = rows[0].ID;

                if (timers[historyId]) {
                    clearTimeout(timers[historyId]);
                    delete timers[historyId];
                }

                await db.query(
                    "UPDATE actionshistory SET Status = 'Success' WHERE ID = ?",
                    [historyId]
                );

                io.emit('device_status_update', {
                    DeviceID,
                    Status: 'Success',
                    Action: data.Action || 'Unknown'
                });

                console.log(`[CONFIRM] Device ${DeviceID} Success`);
            }
        }
        else if (topic === 'device/init') {

            const { DeviceID, Action, Status } = data;

            await db.query(
                `INSERT INTO actionshistory 
                (ID_Device, Action, Status, CreatedAt) 
                VALUES (?, ?, ?, NOW())`,
                [DeviceID, Action, Status]
            );

            io.emit('device_status_update', {
                DeviceID,
                Status,
                Action
            });

            console.log(`[INIT] Device ${DeviceID} ${Action}`);
        }

    } catch (err) {
        console.error(`[MQTT ERROR] Topic: ${topic} - ${err.message}`);
    }
});

module.exports = mqttClient;