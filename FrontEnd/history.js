const API_BASE = "http://localhost:5000/api/devices/data";

let currentPage = 1;
let currentSearch = "";
let currentDevice = "";
let currentAction = "";
let currentStatus = "";
const limit = 10;

const tableBody = document.getElementById("history-data");
const paginationContainer = document.getElementById("pagination");
const paginationInfo = document.getElementById("pagination-info");

const searchBtn = document.querySelector(".btn-search");
const dateInput = document.getElementById("date-input");
const timeInput = document.getElementById("time-input");
const deviceFilter = document.querySelector(".sensor-filter");
const actionFilter = document.querySelector(".action-filter");
const statusFilter = document.querySelector(".status-filter");

function isValidDateTime(value) {
    return /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}(\s([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?)?$/.test(value);
}
// FORMAT DATE dd/mm/yyyy HH:mm:ss
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
function convertDateTime(value) {
    const parts = value.split(" ");

    const [dd, mm, yyyy] = parts[0].split("/");

    // chỉ có ngày
    if (parts.length === 1) {
        return `${yyyy}-${mm}-${dd}`;
    }

    // có giờ phút hoặc giờ phút giây
    return `${yyyy}-${mm}-${dd} ${parts[1]}`;
}

// LOAD DATA
async function loadData() {

    const params = new URLSearchParams({
        limit,
        page: currentPage
    });

    if (currentSearch) params.append("search", currentSearch);
    if (currentDevice) params.append("deviceId", currentDevice);
    if (currentAction) params.append("action", currentAction);
    if (currentStatus) params.append("status", currentStatus);

    try {
        const res = await fetch(`${API_BASE}?${params}`);
        const result = await res.json();

        renderTable(result.data);
        renderPagination(result.totalPages);
        renderPaginationInfo(result.total, result.totalPages);
    } catch (error) {
        console.error("Lỗi load history:", error);
    }
}


// RENDER TABLE
function renderTable(data) {

    if (!data || data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center">Không có dữ liệu</td>
            </tr>
        `;
        return;
    }

    let html = "";

    data.forEach(item => {

        let statusClass = "";
        let statusText = "";

        if (item.Status === "Success") {
            statusClass = "success";
            statusText = "Thành công";
        }
        else if (item.Status === "Processing") {
            statusClass = "pending";
            statusText = "Đang xử lý";
        }
        else {
            statusClass = "fail";
            statusText = "Thất bại";
        }

        html += `
            <tr>
                <td>#${item.ID}</td>
                <td>${item.DeviceName}</td>
                <td>${item.Action}</td>
                <td><span class="status ${statusClass}">${statusText}</span></td>
                <td>${formatDate(item.CreatedAt)}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

function renderPaginationInfo(total, totalPages) {
    const start = (currentPage - 1) * limit + 1;
    const end = Math.min(currentPage * limit, total);

    paginationInfo.innerHTML = `
        Hiển thị ${start} - ${end} / ${total} bản ghi (Trang ${currentPage}/${totalPages})
    `;
}
// PAGINATION 
function renderPagination(totalPages) {

    paginationContainer.innerHTML = "";

    if (totalPages <= 1) return;

    // PREV
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

    paginationContainer.appendChild(prevBtn);

    let startPage = Math.max(1, currentPage - 1);
    let endPage = Math.min(totalPages, startPage + 2);

    if (endPage - startPage < 2) {
        startPage = Math.max(1, endPage - 2);
    }

    for (let i = startPage; i <= endPage; i++) {

        const btn = document.createElement("button");
        btn.className = "page-btn";
        btn.textContent = i;

        if (i === currentPage) btn.classList.add("active");

        btn.onclick = () => {
            currentPage = i;
            loadData();
        };

        paginationContainer.appendChild(btn);
    }

    // NEXT
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

    paginationContainer.appendChild(nextBtn);
}


// SEARCH
const datetimeInput = document.getElementById("datetime-input");

searchBtn.addEventListener("click", () => {

    const value = datetimeInput.value.trim();

    if (value && !isValidDateTime(value)) {
        alert("Phải nhập đúng định dạng dd/mm/yyyy HH:mm:ss");
        return;
    }

    if (value) {
        currentSearch = convertDateTime(value);
    } else {
        currentSearch = "";
    }

    currentPage = 1;
    loadData();
});


// FILTER DEVICE
deviceFilter.addEventListener("change", () => {

    const value = deviceFilter.value;

    if (value === "light") currentDevice = 1;
    else if (value === "fan") currentDevice = 2;
    else if (value === "air") currentDevice = 3;
    else currentDevice = "";

    currentPage = 1;
    loadData();
});

actionFilter.addEventListener("change", () => {
    currentAction = actionFilter.value;
    currentPage = 1;
    loadData();
});

statusFilter.addEventListener("change", () => {
    currentStatus = statusFilter.value;
    currentPage = 1;
    loadData();
});

loadData();