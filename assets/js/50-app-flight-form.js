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
        if(window.appMotion && window.appMotion.enabled()) {
            animate("#ui-header", { y: [-20, 0], opacity: [0, 1] }, { duration: window.appMotion.tokens.slow, easing: "ease-out" });
            animate("#main-dashboard", { y: [20, 0], opacity: [0, 1] }, { delay: 0.08, ...window.appMotion.tokens.spring });
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
        window.parseFlightCommand(e.target.value);
    });
}

window.openAddModal = () => {
    editingFlightId = null;

    document.getElementById('flightForm').reset();
    clearFormStatus();
    clearFieldErrors();
    prefillFromRecentMemory();
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
window.deleteFlightHandler = async (id) => {
    const target = flightsState.find(f => String(f.id) === String(id));
    if(await deleteFlight(id)) {
        showToast(`已刪除 ${target ? `${target.origin_code} → ${target.dest_code}` : '航班'}。`);
        fetchFlights();
    }
};

window.editFlight = (id) => {
    const f = flightsState.find(f => String(f.id) === String(id)); 
    if(!f) return; 
    
    editingFlightId = f.id; 
    const sVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
    sVal('inp-date', f.flight_date); sVal('inp-takeoff', f.takeoff_time); sVal('inp-landing', f.landing_time);
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
    clearFormStatus();
    clearFieldErrors();

    const originInput = normalizeCode('inp-origin');
    const destInput = normalizeCode('inp-dest');
    const validation = validateFlightForm(originInput, destInput);
    if (!validation.ok) {
        showFormStatus(validation.message, 'error');
        const firstBad = document.querySelector('.field-invalid');
        if (firstBad) firstBad.focus();
        return;
    }

    const btn = document.getElementById('submitBtn');
    btn.innerText = '處理中...';
    btn.disabled = true;

    try {
        const takeoffTime = document.getElementById('inp-takeoff').value;
        const landingTime = document.getElementById('inp-landing').value;
        let flightHours = estimateFlightHours(originInput, destInput, takeoffTime, landingTime);

        const payload = {
            flight_date: document.getElementById('inp-date').value || null,
            takeoff_time: takeoffTime || null,
            landing_time: landingTime || null,
            origin_code: originInput,
            dest_code: destInput,
            airline: normalizeUpperValue('inp-airline') || null,
            flight_number: normalizeUpperValue('inp-flight-number') || null,
            seat: normalizeUpperValue('inp-seat') || null,
            seat_class: document.getElementById('inp-seat-class').value || null,
            seat_type: document.getElementById('inp-seat-type').value || null,
            is_exit_row: document.getElementById('inp-exit-row').checked,
            aircraft_type: document.getElementById('inp-type').value.trim() || null,
            flight_hours: flightHours
        };

        const ok = await saveFlight(payload, editingFlightId);
        if (!ok) throw new Error('save failed');
        rememberRecentDefaults(payload);
        showToast(`${editingFlightId ? '已更新' : '已新增'} ${payload.airline || ''}${payload.flight_number || ''} · ${payload.origin_code} → ${payload.dest_code}`);
        toggleModal('addFlightModal');
        await fetchFlights();
    } catch (err) {
        console.error(err);
        showFormStatus('儲存失敗，資料已保留。請檢查欄位或連線。', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = editingFlightId ? '更新 Update' : '儲存 Save';
    }
};

window.exportCSV = exportCSV; window.importCSV = importCSV;
function exportCSV() {
    if (!flightsState.length) return alert('尚無資料');
    const headers = ['flight_date','origin_code','dest_code','airline','flight_number','aircraft_type','takeoff_time','landing_time','seat_class','seat_type','seat','is_exit_row'];
    const rows = flightsState.map(f => headers.map(h => `"${f[h]??''}"`).join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'flights.csv'; a.click();
}

async function importCSV(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) return showToast('CSV 沒有可匯入資料');
    const payloads = rows.map(normalizeImportedFlight).filter(Boolean);
    if (!payloads.length) return showToast('CSV 欄位無法辨識');
    const { error } = await supabaseClient.from('flights').insert(payloads);
    if (error) return showToast('匯入失敗：' + error.message);
    showToast(`已匯入 ${payloads.length} 筆航班`);
    event.target.value = '';
    fetchFlights();
}


function normalizeUpperValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim().toUpperCase() : '';
}
function normalizeCode(id) {
    const val = normalizeUpperValue(id);
    const el = document.getElementById(id);
    if (el) el.value = val;
    return val;
}
function setFieldError(fieldId, errId, msg) {
    const field = document.getElementById(fieldId);
    const err = document.getElementById(errId);
    if (field) field.classList.toggle('field-invalid', Boolean(msg));
    if (err) err.innerText = msg || '';
}
function clearFieldErrors() {
    setFieldError('inp-origin','err-origin','');
    setFieldError('inp-dest','err-dest','');
}
function validateFlightForm(origin, dest) {
    let ok = true;
    if (!airportDB[origin]) { setFieldError('inp-origin','err-origin','找不到出發機場代碼'); ok = false; }
    if (!airportDB[dest]) { setFieldError('inp-dest','err-dest','找不到目的地機場代碼'); ok = false; }
    if (origin && dest && origin === dest) { setFieldError('inp-dest','err-dest','出發與目的地不能相同'); ok = false; }
    return { ok, message: ok ? '' : '欄位有問題。不是你，是表單在阻止垃圾資料進資料庫。' };
}
function estimateFlightHours(origin, dest, takeoffTime, landingTime) {
    if (takeoffTime && landingTime) {
        let [tH, tM] = takeoffTime.split(':').map(Number), [lH, lM] = landingTime.split(':').map(Number);
        let tMins = tH * 60 + tM, lMins = lH * 60 + lM;
        if (lMins <= tMins) lMins += 24 * 60;
        return parseFloat(((lMins - tMins) / 60).toFixed(1));
    }
    return parseFloat(((turf.distance(airportDB[origin].coords, airportDB[dest].coords, {units: 'kilometers'}) / 850) + 0.5).toFixed(1));
}
function showFormStatus(msg, type='error') {
    const el = document.getElementById('form-status');
    if (!el) return;
    el.className = `form-status show ${type}`;
    el.innerText = msg;
}
function clearFormStatus() {
    const el = document.getElementById('form-status');
    if (el) { el.className = 'form-status'; el.innerText = ''; }
}
function showToast(msg) {
    let stack = document.getElementById('toast-stack');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'toast-stack';
        stack.className = 'toast-stack';
        document.body.appendChild(stack);
    }
    const item = document.createElement('div');
    const motionOn = window.appMotion && window.appMotion.enabled();
    const baseMs = Math.round((((window.appMotion && window.appMotion.tokens.base) || 0.24) * 1000));
    item.className = 'app-toast is-entering';
    item.innerText = msg;
    stack.appendChild(item);

    requestAnimationFrame(() => {
        item.classList.remove('is-entering');
        item.classList.add('is-visible');
        if (motionOn && animate) {
            animate(item, { y: [10, 0], opacity: [0, 1] }, { duration: (window.appMotion.tokens.fast || 0.16), easing: 'ease-out' });
        }
    });

    setTimeout(() => {
        item.classList.remove('is-visible');
        item.classList.add('is-leaving');
        if (motionOn && animate) {
            animate(item, { y: [0, 8], opacity: [1, 0] }, { duration: (window.appMotion.tokens.fast || 0.16), easing: 'ease-out' });
            setTimeout(() => item.remove(), baseMs);
        } else {
            item.remove();
        }
    }, 2800);
}

window.parseFlightCommand = function(raw) {
    if (!raw) return;
    const value = String(raw).toUpperCase().trim();
    const date = value.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2})\b/);
    if (date) document.getElementById('inp-date').value = date[1].replace(/\//g,'-').replace(/-(\d)\b/g,'-0$1');
    const route = value.match(/\b([A-Z]{3})\s*[-→>／/]\s*([A-Z]{3})\b/);
    if (route) { document.getElementById('inp-origin').value = route[1]; document.getElementById('inp-dest').value = route[2]; }
    const seat = value.match(/\b(\d{1,2}[A-K])\b/);
    if (seat) document.getElementById('inp-seat').value = seat[1];
    const flight = value.match(/\b([A-Z0-9]{2,3})\s*-?\s*(\d{1,4}[A-Z]?)\b/);
    if (flight && !['TPE','HND','NRT','KIX','BKK','SIN','HKG','ICN','LAX','JFK','DXB','DOH','KUL','MNL'].includes(flight[1])) {
        document.getElementById('inp-airline').value = flight[1];
        document.getElementById('inp-flight-number').value = flight[2];
    } else {
        window.smartSplitFlight(value);
    }
};

function rememberRecentDefaults(payload) {
    localStorage.setItem('flight_log_recent_defaults', JSON.stringify({
        airline: payload.airline || '', seat_class: payload.seat_class || '', seat_type: payload.seat_type || '', aircraft_type: payload.aircraft_type || ''
    }));
}
function prefillFromRecentMemory() {
    try {
        const r = JSON.parse(localStorage.getItem('flight_log_recent_defaults') || '{}');
        if (r.airline) document.getElementById('inp-airline').value = r.airline;
        if (r.seat_class) document.getElementById('inp-seat-class').value = r.seat_class;
        if (r.seat_type) document.getElementById('inp-seat-type').value = r.seat_type;
    } catch(e) {}
}
function fillFormFromFlight(f, reverse=false) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('inp-date', f.flight_date || new Date().toISOString().slice(0,10));
    set('inp-origin', reverse ? f.dest_code : f.origin_code);
    set('inp-dest', reverse ? f.origin_code : f.dest_code);
    set('inp-airline', f.airline); set('inp-flight-number', f.flight_number);
    set('inp-type', f.aircraft_type); set('inp-seat-class', f.seat_class); set('inp-seat-type', f.seat_type); set('inp-seat', f.seat);
    const exit = document.getElementById('inp-exit-row'); if (exit) exit.checked = !!f.is_exit_row;
}
window.duplicateFlight = function(id) {
    const f = flightsState.find(x => String(x.id) === String(id));
    if (!f) return;
    openAddModal();
    fillFormFromFlight(f, false);
    showFormStatus('已複製該航班，確認日期/航班號後儲存。', 'success');
};
window.duplicateLastFlight = function() {
    const sorted = [...flightsState].sort((a,b)=>String(b.flight_date||'').localeCompare(String(a.flight_date||'')));
    if (!sorted[0]) return showFormStatus('目前沒有上一筆可複製。', 'error');
    fillFormFromFlight(sorted[0], false);
    showFormStatus('已複製上一筆。', 'success');
};
window.createReturnFlight = function() {
    const origin = normalizeUpperValue('inp-origin'), dest = normalizeUpperValue('inp-dest');
    if (origin && dest) { document.getElementById('inp-origin').value = dest; document.getElementById('inp-dest').value = origin; showFormStatus('已交換出發/目的地，回程骨架完成。', 'success'); return; }
    const sorted = [...flightsState].sort((a,b)=>String(b.flight_date||'').localeCompare(String(a.flight_date||'')));
    if (!sorted[0]) return showFormStatus('先輸入去程，或至少要有一筆歷史資料。', 'error');
    fillFormFromFlight(sorted[0], true);
    showFormStatus('已用上一筆建立回程。', 'success');
};
window.loadDemoFlights = function() {
    const demo = [
        { id:'demo-1', flight_date:'2026-05-07', origin_code:'TPE', dest_code:'HND', airline:'BR', flight_number:'184', aircraft_type:'B789', flight_hours:3.1 },
        { id:'demo-2', flight_date:'2026-05-10', origin_code:'HND', dest_code:'TPE', airline:'BR', flight_number:'183', aircraft_type:'B789', flight_hours:3.4 },
        { id:'demo-3', flight_date:'2026-07-29', origin_code:'TPE', dest_code:'DXB', airline:'EK', flight_number:'367', aircraft_type:'A388', flight_hours:8.7 }
    ];
    setFlights(demo);
    showToast('已載入示範資料；重新整理後會回到你的正式資料。');
};
function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i], next = text[i + 1];
        if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue; }
        if (ch === '"') { quoted = !quoted; continue; }
        if (ch === ',' && !quoted) { row.push(cell.trim()); cell = ''; continue; }
        if ((ch === '\n' || ch === '\r') && !quoted) {
            if (ch === '\r' && next === '\n') i++;
            row.push(cell.trim());
            if (row.some(Boolean)) rows.push(row);
            row = []; cell = '';
            continue;
        }
        cell += ch;
    }
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] || ''])));
}
function normalizeImportedFlight(row) {
    const get = (...keys) => keys.map(k => row[k]).find(Boolean) || '';
    const origin = get('origin_code','origin','Origin').toUpperCase();
    const dest = get('dest_code','dest','destination','Dest').toUpperCase();
    if (!origin || !dest || !airportDB[origin] || !airportDB[dest]) return null;
    return {
        flight_date: get('flight_date','date','Date') || null,
        origin_code: origin,
        dest_code: dest,
        airline: get('airline','carrier','Airline').toUpperCase() || null,
        flight_number: get('flight_number','flight_no','number','Flight No.').toUpperCase() || null,
        aircraft_type: get('aircraft_type','aircraft','type') || null,
        takeoff_time: get('takeoff_time','takeoff') || null,
        landing_time: get('landing_time','landing') || null,
        seat_class: get('seat_class','class') || null,
        seat_type: get('seat_type','seat_type') || null,
        seat: get('seat','Seat').toUpperCase() || null,
        is_exit_row: ['true','1','yes','y'].includes(String(get('is_exit_row','exit_row')).toLowerCase())
    };
}

['inp-origin','inp-dest'].forEach(id => document.addEventListener('input', (e) => {
    if (e.target && e.target.id === id) {
        e.target.value = e.target.value.toUpperCase();
        if (e.target.value.length === 3) {
            const errId = id === 'inp-origin' ? 'err-origin' : 'err-dest';
            setFieldError(id, errId, airportDB[e.target.value] ? '' : '找不到機場代碼');
        }
    }
}));
