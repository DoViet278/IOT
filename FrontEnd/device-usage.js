const API_BASE = "http://localhost:5000/api/devices/usage/daily";

const dateInput = document.getElementById("date-input");
const daysSelect = document.getElementById("days-select");
const clearDateBtn = document.getElementById("clear-date-btn");
const refreshBtn = document.getElementById("refresh-btn");
const summaryGrid = document.getElementById("summary-grid");
const periodInfo = document.getElementById("period-info");
const chartCanvas = document.getElementById("usageChart");

const DEVICE_META = {
    1: { name: "Đèn", icon: "fa-lightbulb", color: "#31d27c" },
    2: { name: "Quạt", icon: "fa-fan", color: "#35c7ff" },
    3: { name: "Điều hòa", icon: "fa-snowflake", color: "#ffb347" },
    4: { name: "Tivi", icon: "fa-tv", color: "#ff7b7b" },
    5: { name: "Máy bơm", icon: "fa-water", color: "#96a6ff" }
};

const DISPLAY_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
});

function parseDateLabel(label) {
    if (!label) return "";
    const date = new Date(`${label}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
        return label;
    }
    return DISPLAY_FORMATTER.format(date);
}

function parsePeriodLabel(startDate, endDate) {
    if (startDate && endDate && startDate === endDate) {
        return parseDateLabel(startDate);
    }

    const start = parseDateLabel(startDate);
    const end = parseDateLabel(endDate);
    return `${start} - ${end}`;
}

function getTodayLabel() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function syncFilterMode() {
    const hasDate = Boolean(dateInput?.value);
    daysSelect.disabled = hasDate;
    daysSelect.style.opacity = hasDate ? "0.55" : "1";
}

function resolveTargetDate(payload) {
    return payload.selectedDate || dateInput?.value || payload.endDate;
}

function resolveDateIndex(payload, targetDate) {
    const index = payload.labels.findIndex((label) => label === targetDate);
    if (index >= 0) {
        return index;
    }

    return payload.labels.length > 0 ? payload.labels.length - 1 : 0;
}

function buildChartForDate(payload, dateIndex) {
    const devices = payload.devices || [];

    return {
        labels: devices.map((device) => device.DeviceName || DEVICE_META[device.DeviceID]?.name || `Thiết bị ${device.DeviceID}`),
        datasets: [
            {
                label: "Số lần bật (ON)",
                data: devices.map((device) => Number(device.onData?.[dateIndex]) || 0),
                backgroundColor: "rgba(49, 210, 124, 0.78)",
                borderColor: "rgba(49, 210, 124, 1)",
                borderWidth: 1.2,
                borderRadius: 6,
                maxBarThickness: 34
            },
            {
                label: "Số lần tắt (OFF)",
                data: devices.map((device) => Number(device.offData?.[dateIndex]) || 0),
                backgroundColor: "rgba(255, 123, 123, 0.78)",
                borderColor: "rgba(255, 123, 123, 1)",
                borderWidth: 1.2,
                borderRadius: 6,
                maxBarThickness: 34
            }
        ]
    };
}

function buildSummaryForDate(payload, dateIndex) {
    return (payload.devices || []).map((device) => {
        const onCount = Number(device.onData?.[dateIndex]) || 0;
        const offCount = Number(device.offData?.[dateIndex]) || 0;

        return {
            DeviceID: device.DeviceID,
            DeviceName: device.DeviceName,
            onCount,
            offCount,
            total: onCount + offCount
        };
    });
}

function buildChartForSummary(summary) {
    return {
        labels: summary.map((device) => device.DeviceName || DEVICE_META[device.DeviceID]?.name || `Thiết bị ${device.DeviceID}`),
        datasets: [
            {
                label: "Số lần bật (ON)",
                data: summary.map((device) => Number(device.onCount) || 0),
                backgroundColor: "rgba(49, 210, 124, 0.78)",
                borderColor: "rgba(49, 210, 124, 1)",
                borderWidth: 1.2,
                borderRadius: 6,
                maxBarThickness: 34
            },
            {
                label: "Số lần tắt (OFF)",
                data: summary.map((device) => Number(device.offCount) || 0),
                backgroundColor: "rgba(255, 123, 123, 0.78)",
                borderColor: "rgba(255, 123, 123, 1)",
                borderWidth: 1.2,
                borderRadius: 6,
                maxBarThickness: 34
            }
        ]
    };
}

function createChart() {
    return new Chart(chartCanvas, {
        type: "bar",
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#dce6f2",
                        usePointStyle: true,
                        pointStyle: "circle",
                        boxWidth: 12,
                        padding: 18,
                        font: {
                            family: "Trebuchet MS, Segoe UI, sans-serif",
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: "rgba(8, 16, 24, 0.96)",
                    titleColor: "#ffffff",
                    bodyColor: "#dce6f2",
                    borderColor: "rgba(49, 210, 124, 0.24)",
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#9fb0c4",
                        maxRotation: 0,
                        autoSkip: true
                    },
                    grid: {
                        color: "rgba(255,255,255,0.06)"
                    }
                },
                y: {
                    beginAtZero: true,
                    precision: 0,
                    ticks: {
                        color: "#9fb0c4",
                        stepSize: 1
                    },
                    grid: {
                        color: "rgba(255,255,255,0.06)"
                    }
                }
            }
        }
    });
}

const chart = createChart();

function renderSummary(summary) {
    summaryGrid.innerHTML = summary.map((device) => {
        const meta = DEVICE_META[device.DeviceID] || {};
        const onCount = Number(device.onCount) || 0;
        const offCount = Number(device.offCount) || 0;
        const total = Number(device.total) || (onCount + offCount);

        return `
            <article class="stat-card" style="--stat-color: ${meta.color || "#31d27c"}">
                <div class="label">
                    <i class="fa-solid ${meta.icon || "fa-circle"}"></i>
                    <span>${device.DeviceName}</span>
                </div>
                <p class="value">${total}</p>
                <div class="split-counts">
                    <span class="pill on">ON: <strong>${onCount}</strong></span>
                    <span class="pill off">OFF: <strong>${offCount}</strong></span>
                </div>
            </article>
        `;
    }).join("");
}

function renderChart(payload) {
    const isDateMode = Boolean(payload.selectedDate);
    let chartData;
    let summaryData;

    if (isDateMode) {
        const targetDate = resolveTargetDate(payload);
        const dateIndex = resolveDateIndex(payload, targetDate);

        chartData = buildChartForDate(payload, dateIndex);
        summaryData = buildSummaryForDate(payload, dateIndex);
        periodInfo.textContent = `Ngày hiển thị: ${parseDateLabel(payload.labels[dateIndex] || targetDate)}`;
    } else {
        summaryData = payload.summary || [];
        chartData = buildChartForSummary(summaryData);
        periodInfo.textContent = `Khoảng thời gian: ${parsePeriodLabel(payload.startDate, payload.endDate)}`;
    }

    chart.data.labels = chartData.labels;
    chart.data.datasets = chartData.datasets;
    chart.update();

    renderSummary(summaryData);
}

async function loadUsageData() {
    const selectedDate = dateInput?.value || "";
    const days = daysSelect.value;
    const query = new URLSearchParams();

    if (selectedDate) {
        query.set("date", selectedDate);
    } else {
        query.set("days", days);
    }

    periodInfo.textContent = "Đang tải dữ liệu...";

    try {
        const response = await fetch(`${API_BASE}?${query.toString()}`);
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.message || "Không thể tải dữ liệu");
        }

        renderChart(payload);
    } catch (error) {
        console.error("Lỗi load usage stats:", error);
        summaryGrid.innerHTML = `
            <article class="stat-card" style="grid-column: 1 / -1;">
                <div class="label">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <span>Không tải được dữ liệu</span>
                </div>
                <p class="caption">${error.message}</p>
            </article>
        `;
        periodInfo.textContent = "Không có dữ liệu";
        chart.data.labels = [];
        chart.data.datasets = [];
        chart.update();
    }
}

if (dateInput) {
    dateInput.value = getTodayLabel();
    dateInput.addEventListener("change", () => {
        syncFilterMode();
        loadUsageData();
    });
}

daysSelect.addEventListener("change", () => {
    if (!dateInput?.value) {
        loadUsageData();
    }
});

if (clearDateBtn) {
    clearDateBtn.addEventListener("click", () => {
        if (!dateInput) {
            return;
        }

        dateInput.value = "";
        syncFilterMode();
        loadUsageData();
    });
}

refreshBtn.addEventListener("click", loadUsageData);

syncFilterMode();
loadUsageData();
