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
    console.log('MQTT Connected');

    const topics = [
        process.env.TOPIC_DATA,        // DataSensors
        process.env.TOPIC_RESPONSE,    // DeviceResponse
        process.env.TOPIC_SYNC_REQUEST 
    ];

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

        if (topic === process.env.TOPIC_DATA) {
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

                console.log(`T:${temperature} H:${humidity} L:${light}`);
            }
        }

        else if (topic === process.env.TOPIC_RESPONSE) {

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

                io.emit('update_status', {
                    DeviceID,
                    Status: 'Success',
                    Action: data.Action || 'Unknown'
                });

                console.log(`Device ${DeviceID} Success`);
            }
        }
        else if (topic === process.env.TOPIC_SYNC_REQUEST) {

            console.log("Request received");

            const [rows] = await db.query(`
                SELECT t.ID_Device, t.Action, t.Status
                FROM actionshistory t
                INNER JOIN (
                    SELECT ID_Device, MAX(ID) as MaxID
                    FROM actionshistory
                    WHERE Status = 'Success'
                    GROUP BY ID_Device
                ) latest ON t.ID = latest.MaxID
            `);

            const devices = [];

            rows.forEach(item => {
                let action = "OFF";

                if (item.Status === "Success") {
                    action = item.Action;
                }

                devices.push({
                    DeviceID: item.ID_Device,
                    Action: action
                });
            });

            mqttClient.publish(process.env.TOPIC_SYNC, JSON.stringify({
                devices
            }));

            console.log("[SYNC] Sent to ESP");
        }

    } catch (err) {
        console.error(`[MQTT ERROR] Topic: ${topic} - ${err.message}`);
    }
});

module.exports = mqttClient;