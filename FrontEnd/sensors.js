const API_BASE = "http://localhost:5000/api/sensors/data";

let currentPage = 1;
let currentSearch = "";
let currentSensor = "";
const limit = 10;

const tableBody = document.getElementById("sensor-data");
const paginationContainer = document.querySelector(".pagination");
const searchBtn = document.querySelector(".btn-search");
const dateInput = document.getElementById("date-input");
const timeInput = document.getElementById("time-input");
const sensorFilter = document.querySelector(".sensor-filter");

function isValidTime(time) {
    return /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.test(time);
}

function isValidDate(date) {
    return /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(date);
}

function convertDate(date) {
    const [dd, mm, yyyy] = date.split("/");
    return `${yyyy}-${mm}-${dd}`;
}

// FORMAT dd/mm/yyyy hh:mm:ss
function formatDate(dateStr) {
    const date = new Date(dateStr);

    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear());

    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");

    return `${dd}/${mm}/${yy} ${hh}:${min}:${ss}`;
}


// LOAD DATA
async function loadData() {

    const params = new URLSearchParams({
        limit,
        page: currentPage
    });

    if (currentSearch) {
        params.append("search", currentSearch);
    }

    if (currentSensor && currentSensor !== "all") {
        params.append("sensor", currentSensor);
    }

    try {
        const res = await fetch(`${API_BASE}?${params}`);
        const result = await res.json();

        renderTable(result.data);
        renderPagination(result.totalPages);

    } catch (error) {
        console.error("Lỗi load data:", error);
    }
}


// RENDER TABLE
function renderTable(data) {

    if (!data || data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center">Không có dữ liệu</td>
            </tr>
        `;
        return;
    }

    let html = "";

    data.forEach((item, index)=> {
        html += `
            <tr>
                <td>#${item.ID}</td>
                <td>${item.SensorName}</td>
                <td class="sensor-val">
                    ${item.Value}${getUnit(item.SensorName)}
                </td>
                <td>${formatDate(item.CreatedAt)}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

function getUnit(sensorName) {
    if (sensorName === "Nhiệt độ") return "°C";
    if (sensorName === "Độ ẩm") return "%";
    if (sensorName === "Ánh sáng") return " lx";
    return "";
}
// RENDER PAGINATION
function renderPagination(totalPages) {

    const container = document.getElementById("pagination");
    container.innerHTML = "";

    if (totalPages <= 1) return;

    const prevBtn = document.createElement("button");
    prevBtn.className = "page-btn";
    prevBtn.innerHTML = `<i class="fa-solid fa-chevron-left"></i>`;
    prevBtn.disabled = currentPage === 1;

    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            loadData();
        }
    };

    container.appendChild(prevBtn);

    let startPage = Math.max(1, currentPage - 1);
    let endPage = Math.min(totalPages, startPage + 2);

    if (endPage - startPage < 2) {
        startPage = Math.max(1, endPage - 2);
    }

    for (let i = startPage; i <= endPage; i++) {

        const btn = document.createElement("button");
        btn.className = "page-btn";
        btn.textContent = i;

        if (i === currentPage) {
            btn.classList.add("active");
        }

        btn.onclick = () => {
            currentPage = i;
            loadData();
        };

        container.appendChild(btn);
    }

    const nextBtn = document.createElement("button");
    nextBtn.className = "page-btn";
    nextBtn.innerHTML = `<i class="fa-solid fa-chevron-right"></i>`;
    nextBtn.disabled = currentPage === totalPages;

    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadData();
        }
    };

    container.appendChild(nextBtn);
}


// SEARCH
searchBtn.addEventListener("click", () => {

    const date = dateInput.value;
    const time = timeInput.value;

    if (time && !isValidTime(time)) {
        alert("Giờ phải đúng định dạng HH:mm:ss");
        return;
    }

    if (date) {

        const sqlDate = convertDate(date);

        currentSearch = time ? `${sqlDate} ${time}` : sqlDate;

    } else {
        currentSearch = "";
    }

    currentPage = 1;
    loadData();
});


// FILTER SENSOR
sensorFilter.addEventListener("change", () => {

    const value = sensorFilter.value;

    if (value === "temp") currentSensor = "Nhiệt độ";
    else if (value === "humid") currentSensor = "Độ ẩm";
    else if (value === "light") currentSensor = "Ánh sáng";
    else currentSensor = "";

    currentPage = 1;
    loadData();
});


// INIT
loadData();