const API_SENSORS = "http://localhost:5000/api/sensors/data";
const API_DEVICES = "http://localhost:5000/api/devices";
const socket = io("http://localhost:5000");

socket.on("connect", () => {
    console.log("Đã kết nối Socket:", socket.id);
});

const ctx = document.getElementById('iotChart').getContext('2d');

const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Nhiệt độ (°C)',
                data: [],
                borderColor: '#ff4d4d',
                backgroundColor: 'rgba(255,77,77,0.15)',
                fill: true,
                tension: 0.4
            },
            {
                label: 'Độ ẩm (%)',
                data: [],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52,152,219,0.15)',
                fill: true,
                tension: 0.4
            },
            {
                label: 'Ánh sáng (lx)',
                data: [],
                borderColor: '#f1c40f',
                backgroundColor: 'rgba(241,196,15,0.15)',
                fill: true,
                tension: 0.4
            }
        ]
    }
});

const MAX_POINTS = 10;

// ================= LOAD DATA BAN ĐẦU =================
async function loadInitialData() {
    try {
        const res = await fetch(API_SENSORS);
        const result = await res.json();
        const data = result.data;
        console.log(data);

        const tempData = data.filter(d => d.SensorName === "Nhiệt độ").slice(0,10).reverse();
        const humidData = data.filter(d => d.SensorName === "Độ ẩm").slice(0,10).reverse();
        const lightData = data.filter(d => d.SensorName === "Ánh sáng").slice(0,10).reverse();

        // if (tempData.length)
        //     document.getElementById("tempValue").innerText =
        //         tempData[tempData.length - 1].Value + " °C";

        // if (humidData.length)
        //     document.getElementById("humidValue").innerText =
        //         humidData[humidData.length - 1].Value + " %";

        // if (lightData.length)
        //     document.getElementById("lightValue").innerText =
        //         lightData[lightData.length - 1].Value + " lx";

        chart.data.labels = tempData.map(d => {
            const date = new Date(d.CreatedAt);
            return date.toLocaleTimeString(); // hiển thị giờ:phút:giây
        });
        chart.data.datasets[0].data = tempData.map(d => d.Value);
        chart.data.datasets[1].data = humidData.map(d => d.Value);
        chart.data.datasets[2].data = lightData.map(d => d.Value);

        chart.update();

    } catch (err) {
        console.error("Lỗi load dữ liệu:", err);
    }
}

// ================= REALTIME SOCKET =================
function pushData(index, value) {
    chart.data.datasets[index].data.push(value);
    if (chart.data.datasets[index].data.length > MAX_POINTS) {
        chart.data.datasets[index].data.shift();
    }
}

socket.on("sensorData", (data) => {

    if (chart.data.labels.length >= MAX_POINTS) {
        chart.data.labels.shift();

        // shift tất cả dataset cùng lúc
        chart.data.datasets.forEach(ds => ds.data.shift());
    }

    chart.data.labels.push(data.time);
    chart.data.datasets[0].data.push(data.temperature);
    chart.data.datasets[1].data.push(data.humidity);
    chart.data.datasets[2].data.push(data.light);
    // Cập nhật giá trị hiển thị
    document.getElementById("tempValue").innerText =
        data.temperature + " °C";

    document.getElementById("humidValue").innerText =
        data.humidity + " %";

    document.getElementById("lightValue").innerText =
        data.light + " lx";

    // Push vào chart
   
    chart.update();
});

loadInitialData();

// Map DeviceID
const DEVICE = {
    LIGHT: 1,
    FAN: 2,
    AIR: 3
};

const switches = {
    1: document.getElementById("lightSwitch"),
    2: document.getElementById("fanSwitch"),
    3: document.getElementById("airSwitch")
};


// ================= LOAD TRẠNG THÁI BAN ĐẦU =================
async function loadDeviceStatus() {
    try {
        const res = await fetch(`${API_DEVICES}/status`);
        const data = await res.json();

        Object.keys(data).forEach(id => {
            if (switches[id]) {
                switches[id].checked = (data[id] === "ON");
            }
        });

    } catch (err) {
        console.error("Lỗi load device status:", err);
    }
}



// ================= GỬI LỆNH BẬT/TẮT =================
async function sendControl(DeviceID, isOn) {

    const Action = isOn ? "ON" : "OFF";

    try {
        await fetch(`${API_DEVICES}/control`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ DeviceID, Action })
        });
        console.log("post api");
    } catch (err) {
        console.error("Lỗi gửi lệnh:", err);
    }
}

// ==========================
// HÀM BẬT/TẮT LOADING
// ==========================
function setLoading(deviceId, state) {

    const card = document.querySelector(`.control-card[data-id="${deviceId}"]`);
    if (!card) return;

    if (state) {
        card.classList.add("loading");
    } else {
        card.classList.remove("loading");
    }
}


// ================= SỰ KIỆN CLICK SWITCH =================
Object.keys(switches).forEach(id => {

    if (!switches[id]) return;

    switches[id].addEventListener("change", function () {

        const isOn = this.checked;

        // bật loading khi gửi lệnh
        setLoading(id, true);

        sendControl(parseInt(id), isOn);
    });
});



// ================= SOCKET REALTIME UPDATE =================
socket.on("update_status", (data) => {

    console.log("Realtime device:", data);

    const { DeviceID, Status, Action } = data;

    if (!switches[DeviceID]) return;

    // Nếu đang Processing thì không đổi gì
    if (Status === "Processing") {
        setLoading(DeviceID, true);
        return;
    }

    // Nếu Success → cập nhật trạng thái đúng
    if (Status === "Success") {
        switches[DeviceID].checked = (Action === "ON");
    }

    // Nếu Fail → revert lại trạng thái
    if (Status === "Fail") {
        switches[DeviceID].checked = !(Action === "ON");
        alert("Thiết bị không phản hồi (Timeout)");
    }

    // Tắt loading khi có kết quả
    setLoading(DeviceID, false);
});



// ================= INIT =================
loadDeviceStatus();