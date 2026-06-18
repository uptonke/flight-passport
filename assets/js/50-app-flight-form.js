async function initApp() {
    document.getElementById('db-status').innerText = '載入字典...';
    await loadGlobalAirports();
    try {
        document.getElementById('db-status').innerText = '拉取航班...';
        await fetchFlights();
        isAppInitialized = true;
        document.getElementById('db-status').innerText = '系統上線 Online';
        document.getElementById('db-status').className = 'text-sm md:text-xl font-black text-green-400 flex items-center gap-2';
        
        // 這裡就是讓 UI 浮現的關鍵動畫
        if(animate) {
            animate("#ui-header", { y: [-50, 0], opacity: [0, 1] }, { duration: 0.8, easing: "ease-out" });
            animate("#main-dashboard", { y: [50, 0], opacity: [0, 1] }, { delay: 0.3, type: "spring", stiffness: 200, damping: 20 });
        } else {
            const header = document.getElementById('ui-header');
            const dash = document.getElementById('main-dashboard');
            if (header) header.classList.remove('opacity-0');
            if (dash) dash.classList.remove('opacity-0', 'translate-y-10');
        }

        if (window.innerWidth < 768) {
            const content = document.getElementById('dash-content');
            const icon = document.getElementById('dash-toggle-icon');
            content.classList.add('hidden', 'opacity-0', 'h-0', 'mt-0'); 
            icon.style.transform = 'rotate(180deg)';
        }
    } catch(e) { 
        document.getElementById('db-status').innerHTML = '<span class="text-red-500">連線失敗 Failed</span>'; 
    }
}

window.smartSplitFlight = function(e) {
    if(!e.target || !e.target.value) return;
    let val = e.target.value.toUpperCase().replace(/\s/g, '');
    if (/^[0-9]{1,4}[A-Z]?$/.test(val)) return;
    let match = val.match(/^([A-Z0-9]{2,3})([0-9]{1,4}[A-Z]?)$/);
    if (match) {
        const airlineInput = document.getElementById('inp-airline');
        const flightNumInput = document.getElementById('inp-flight-number');
        if(airlineInput) airlineInput.value = match[1];
        if(flightNumInput) flightNumInput.value = match[2];
    }
};
window.smartSplitFlight = function(rawValue) {
    if (!rawValue) return;

    let val = String(rawValue).toUpperCase().replace(/[\s-]/g, '');

    // 純數字不要拆
    if (/^[0-9]{1,4}[A-Z]?$/.test(val)) return;

    const airlineInput = document.getElementById('inp-airline');
    const flightNumInput = document.getElementById('inp-flight-number');

    // 先優先判斷 2 碼 IATA 航司代碼
    const firstTwo = val.slice(0, 2);
    const restAfterTwo = val.slice(2);

    if (airlineDB[firstTwo] && /^[0-9]{1,4}[A-Z]?$/.test(restAfterTwo)) {
        if (airlineInput) airlineInput.value = firstTwo;
        if (flightNumInput) flightNumInput.value = restAfterTwo;
        return;
    }

    // 再退回 3 碼代碼邏輯（例如少數你自己想手動輸入的情境）
    const firstThree = val.slice(0, 3);
    const restAfterThree = val.slice(3);

    if (/^[A-Z0-9]{3}$/.test(firstThree) && /^[0-9]{1,4}[A-Z]?$/.test(restAfterThree)) {
        if (airlineInput) airlineInput.value = firstThree;
        if (flightNumInput) flightNumInput.value = restAfterThree;
        return;
    }
};

const quickFlightInput = document.getElementById('inp-flight-quick');
if (quickFlightInput) {
    quickFlightInput.addEventListener('input', (e) => {
        window.smartSplitFlight(e.target.value);
    });
}


const DEFAULT_UTC_OFFSET = 8;

function normalizeUtcOffset(value, fallback = DEFAULT_UTC_OFFSET) {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(-12, Math.min(14, n));
}

function setDefaultTimezoneFields() {
    const originTz = document.getElementById('inp-origin-utc-offset');
    const destTz = document.getElementById('inp-dest-utc-offset');
    if (originTz) originTz.value = DEFAULT_UTC_OFFSET;
    if (destTz) destTz.value = DEFAULT_UTC_OFFSET;
}

function parseDateParts(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
    return { y: parts[0], m: parts[1], d: parts[2] };
}

function parseTimeParts(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.split(':').map(Number);
    if (parts.length < 2 || parts.some(n => !Number.isFinite(n))) return null;
    return { h: parts[0], min: parts[1] };
}

function localDateTimeToUtcMs(dateStr, timeStr, utcOffset, dayShift = 0) {
    const date = parseDateParts(dateStr);
    const time = parseTimeParts(timeStr);
    if (!date || !time) return null;
    const offset = normalizeUtcOffset(utcOffset);
    return Date.UTC(date.y, date.m - 1, date.d + dayShift, time.h, time.min) - offset * 60 * 60 * 1000;
}

function estimateFlightHoursByDistance(originCode, destCode) {
    if (!airportDB[originCode] || !airportDB[destCode]) return null;
    return (turf.distance(airportDB[originCode].coords, airportDB[destCode].coords, { units: 'kilometers' }) / 850) + 0.5;
}

function calculateFlightHoursWithUtcOffsets({ dateStr, takeoffTime, landingTime, originUtcOffset, destUtcOffset, originCode, destCode }) {
    if (!dateStr || !takeoffTime || !landingTime) return null;

    const depUtc = localDateTimeToUtcMs(dateStr, takeoffTime, originUtcOffset, 0);
    if (depUtc === null) return null;

    const distanceEstimate = estimateFlightHoursByDistance(originCode, destCode);
    const candidates = [-1, 0, 1, 2].map(dayShift => {
        const arrUtc = localDateTimeToUtcMs(dateStr, landingTime, destUtcOffset, dayShift);
        if (arrUtc === null) return null;
        const hours = (arrUtc - depUtc) / 36e5;
        if (hours <= 0 || hours > 36) return null;
        const score = distanceEstimate ? Math.abs(hours - distanceEstimate) : hours;
        return { hours, score };
    }).filter(Boolean).sort((a, b) => a.score - b.score);

    if (!candidates.length) return null;
    return parseFloat(candidates[0].hours.toFixed(1));
}

window.openAddModal = () => {
    editingFlightId = null;

    document.getElementById('flightForm').reset();
    setDefaultTimezoneFields();
    document.getElementById('submitBtn').innerText = '儲存 Save';
    document.querySelector('#addFlightModal h2').innerText = '新增航班 Add Flight';

    const engineeringPanel = document.getElementById('track-engineering-panel');
    if (engineeringPanel) engineeringPanel.open = false;

    const csvFlightId = document.getElementById('csv-flight-id');
    if (csvFlightId) csvFlightId.value = '';

    const advancedFlightFields = document.getElementById('flight-advanced-fields');
    if (advancedFlightFields) advancedFlightFields.open = false;

    toggleModal('addFlightModal');
};
window.deleteFlightHandler = async (id) => { if(await deleteFlight(id)) fetchFlights(); };

window.editFlight = (id) => {
    const f = flightsState.find(f => String(f.id) === String(id)); 
    if(!f) return; 
    
    editingFlightId = f.id; 
    const sVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val ?? ''; };
    sVal('inp-date', f.flight_date); sVal('inp-takeoff', f.takeoff_time); sVal('inp-landing', f.landing_time);
    sVal('inp-origin-utc-offset', f.origin_utc_offset ?? DEFAULT_UTC_OFFSET); sVal('inp-dest-utc-offset', f.dest_utc_offset ?? DEFAULT_UTC_OFFSET);
    sVal('inp-origin', f.origin_code); sVal('inp-dest', f.dest_code); sVal('inp-airline', f.airline); sVal('inp-flight-number', f.flight_number); sVal('inp-type', f.aircraft_type);
        const quickInput = document.getElementById('inp-flight-quick');
if (quickInput) {
    quickInput.value = `${f.airline || ''}${f.flight_number || ''}`;
}

const advancedFlightFields = document.getElementById('flight-advanced-fields');
if (advancedFlightFields) advancedFlightFields.open = false;

    sVal('inp-seat-class', f.seat_class); sVal('inp-seat-type', f.seat_type); sVal('inp-seat', f.seat);
    const exitRowEl = document.getElementById('inp-exit-row'); if(exitRowEl) exitRowEl.checked = f.is_exit_row || false;
    const csvFlightId = document.getElementById('csv-flight-id');
    if (csvFlightId) csvFlightId.value = f.id || '';

    const engineeringPanel = document.getElementById('track-engineering-panel');
    if (engineeringPanel) engineeringPanel.open = false;   
    
    document.getElementById('submitBtn').innerText = '更新 Update'; 
    document.querySelector('#addFlightModal h2').innerText = '編輯航班 Edit Flight';
    toggleModal('addFlightModal');
};

window.submitFlight = async (e) => {
    e.preventDefault();
    const originInput = document.getElementById('inp-origin').value.toUpperCase(), destInput = document.getElementById('inp-dest').value.toUpperCase();
    if (!airportDB[originInput] || !airportDB[destInput]) return alert('找不到機場代碼');
    const btn = document.getElementById('submitBtn'); btn.innerText = '處理中...'; btn.disabled = true;

    const dateStr = document.getElementById('inp-date').value;
    const takeoffTime = document.getElementById('inp-takeoff').value, landingTime = document.getElementById('inp-landing').value;
    const originUtcOffset = normalizeUtcOffset(document.getElementById('inp-origin-utc-offset')?.value);
    const destUtcOffset = normalizeUtcOffset(document.getElementById('inp-dest-utc-offset')?.value);

    let flightHours = null;
    if (takeoffTime && landingTime && dateStr) {
        flightHours = calculateFlightHoursWithUtcOffsets({
            dateStr, takeoffTime, landingTime,
            originUtcOffset, destUtcOffset,
            originCode: originInput, destCode: destInput
        });
    }

    if (flightHours === null) {
        flightHours = parseFloat((estimateFlightHoursByDistance(originInput, destInput)).toFixed(1));
    }

    const payload = { flight_date: dateStr || null, takeoff_time: takeoffTime || null, landing_time: landingTime || null, origin_code: originInput, dest_code: destInput, origin_utc_offset: originUtcOffset, dest_utc_offset: destUtcOffset, airline: document.getElementById('inp-airline').value || null, flight_number: document.getElementById('inp-flight-number').value || null, seat: document.getElementById('inp-seat').value.toUpperCase() || null, seat_class: document.getElementById('inp-seat-class').value || null, seat_type: document.getElementById('inp-seat-type').value || null, is_exit_row: document.getElementById('inp-exit-row').checked, aircraft_type: document.getElementById('inp-type').value || null, flight_hours: flightHours };
    await saveFlight(payload, editingFlightId); btn.disabled = false; btn.innerText = '儲存 Save'; toggleModal('addFlightModal'); fetchFlights();
};

window.exportCSV = exportCSV; window.importCSV = importCSV;
function exportCSV() {
    if (!flightsState.length) return alert('尚無資料');
    const headers = ['flight_date','origin_code','dest_code','origin_utc_offset','dest_utc_offset','airline','flight_number','aircraft_type','takeoff_time','landing_time','flight_hours','seat_class','seat_type','seat','is_exit_row'];
    const rows = flightsState.map(f => headers.map(h => `"${f[h]??''}"`).join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'flights.csv'; a.click();
}

function importCSV(event) {
    const file = event.target.files[0]; if (!file) return;
    alert('匯入功能尚未實作');
}
