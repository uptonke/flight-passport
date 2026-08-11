const manualAirportOverrides = { 'TPE': { city: '桃園 Taipei' }, 'TSA': { city: '松山 Taipei' }, 
    'HND': { city: '東京羽田 Tokyo' }, 'NRT': { city: '東京成田 Tokyo' }, 'KIX': { city: '大阪 Osaka' },
    'OKA': { city: '沖繩 Okinawa' }, 'CTS': { city: '札幌 Sapporo' }, 'KMJ': { city: '熊本 Kumamoto' }, 'FUK': { city: '福岡 Fukuoka' },
    'PEK': { city: '北京首都 Beijing' }, 'PVG': { city: '上海浦東 Shanghai' }, 'SHA': { city: '上海虹橋 Shanghai' },
    'HGH': { city: '杭州 Hangzhou' },
    'TFU': { coords: [104.441284, 30.31252], name: 'Chengdu Tianfu International Airport', city: '成都天府 Chengdu', country: 'China' },
    'CTU': { city: '成都雙流 Chengdu' }, 'XIY': { city: '西安 Xi an' },
    'SZX': { coords: [113.8115, 22.6393], city: '深圳 Shenzhen' }, 'LJG': { coords: [100.2464, 26.6714], city: '麗江 Lijiang' },
    'SIN': { city: '新加坡 Singapore' }, 'HKT': { city: '普吉島 Phuket' }, 'PEN': { city: '檳城 Penang' },
    'BKK': { city: '曼谷 Bangkok' }, 'DMK': { city: '曼谷廊曼 Bangkok' }, 'KUL': { city: '吉隆坡 Kuala Lumpur' },
    'CGK': { city: '雅加達 Jakarta' }, 'MNL': { city: '馬尼拉 Manila' }, 'HKG': { city: '香港 Hong Kong' },
    'MFM': { city: '澳門 Macau' }, 'ICN': { city: '首爾 Seoul' }, 'GMP': { city: '首爾 Seoul' },
    'LGW': { city: '倫敦 London' }, 'FCO': { city: '羅馬 Rome' }, 'BCN': { city: '巴塞羅那 Barcelona' },
    'IST': { city: '伊斯坦堡 Istanbul' }, 'CAI': { city: '開羅 Cairo' }, 'DXB': { city: '杜拜 Dubai' },
    'AUH': { city: '阿布達比 Abu Dhabi' }, 'ABU': { city: '阿布達比 Abu Dhabi' }, 'DOH': { city: '杜哈 Doha' },
    'JFK': { city: '紐約 New York' }, 'LAX': { city: '洛杉磯 Los Angeles' }, 'LAS': { city: '拉斯維加斯 Las Vegas' },
    'IAD': { city: '華盛頓 Washington' }, 'SFO': { city: '舊金山 San Francisco' }, 'DEL': { city: '新德里 New Delhi' },
    'CMB': { city: '科倫坡 Colombo'}
};

function applyManualAirportOverrides() {
    Object.keys(manualAirportOverrides).forEach(code => {
        airportDB[code] = { ...(airportDB[code] || {}), ...manualAirportOverrides[code] };
    });
}

async function loadGlobalAirports() {
    const cachedDB = localStorage.getItem('airportDB_cache_v1');
    if (cachedDB) {
        try {
            airportDB = JSON.parse(cachedDB);
            applyManualAirportOverrides();
            localStorage.setItem('airportDB_cache_v1', JSON.stringify(airportDB));
            renderAirportOptions(); 
            return;
        } catch (e) {
            console.warn('快取字典損毀，已清除並重新下載');
            localStorage.removeItem('airportDB_cache_v1');
        }
    }
    
    try {
        const res = await fetch('https://gist.githubusercontent.com/tdreyno/4278655/raw/7b0762c09b519f40397e4c3e100b097d861f5588/airports.json');
        const data = await res.json();
        data.forEach(a => { 
            if (a.code) {
                let code = a.code.toUpperCase();
                airportDB[code] = { coords: [parseFloat(a.lon), parseFloat(a.lat)], name: a.name, city: a.city, country: a.country };
            }
        });
        applyManualAirportOverrides();
        localStorage.setItem('airportDB_cache_v1', JSON.stringify(airportDB));
        renderAirportOptions();
    } catch (e) {
        console.error(e);
        applyManualAirportOverrides();
        renderAirportOptions();
    }
}

function getAirportSearchItems() {
    return Object.keys(airportDB)
        .sort()
        .map(code => ({ code, ...airportDB[code] }));
}

function renderAirportOptions() {
    const datalist = document.getElementById('iata-list');
    if (!datalist) return;

    let options = '';
    for (let code in airportDB) {
        const airport = airportDB[code];
        options += `<option value="${code}">${airport.name || ''} (${airport.city || ''})</option>`;
    }
    datalist.innerHTML = options;
    setupAirportMenus();
}

function filterAirportItems(query, limit = 30) {
    const q = (query || '').trim().toUpperCase();
    const items = getAirportSearchItems();

    if (!q) {
        const preferredCodes = ['TPE', 'TSA', 'HND', 'NRT', 'KIX', 'ICN', 'HKG', 'BKK', 'SIN', 'KUL', 'BCN', 'ORY', 'CDG', 'FCO', 'DXB', 'LAX', 'JFK'];
        const preferred = preferredCodes.filter(code => airportDB[code]).map(code => ({ code, ...airportDB[code] }));
        return preferred.slice(0, limit);
    }

    return items
        .filter(a => {
            const haystack = `${a.code} ${a.name || ''} ${a.city || ''} ${a.country || ''}`.toUpperCase();
            return haystack.includes(q);
        })
        .sort((a, b) => {
            const aCode = a.code.startsWith(q) ? 0 : 1;
            const bCode = b.code.startsWith(q) ? 0 : 1;
            if (aCode !== bCode) return aCode - bCode;
            return a.code.localeCompare(b.code);
        })
        .slice(0, limit);
}

function showAirportMenu(inputId, menuId) {
    const input = document.getElementById(inputId);
    const menu = document.getElementById(menuId);
    if (!input || !menu) return;

    const items = filterAirportItems(input.value);
    if (!items.length) {
        menu.innerHTML = '<div class="px-3 py-2 text-xs text-gray-500">找不到機場代碼</div>';
    } else {
        menu.innerHTML = items.map(a => `
            <button type="button" class="airport-menu-item w-full text-left px-3 py-2 hover:bg-sky-500/20 border-b border-white/5 last:border-b-0" data-code="${a.code}">
                <div class="text-sm font-black tracking-widest text-white">${a.code}</div>
                <div class="text-[11px] text-gray-400 truncate">${a.name || ''}${a.city ? ' · ' + a.city : ''}${a.country ? ' · ' + a.country : ''}</div>
            </button>
        `).join('');
    }

    document.querySelectorAll('.airport-menu').forEach(el => {
        if (el.id !== menuId) el.classList.add('hidden');
    });
    menu.classList.remove('hidden');
}

function hideAirportMenus() {
    document.querySelectorAll('.airport-menu').forEach(el => el.classList.add('hidden'));
}

function bindAirportMenu(inputId, menuId) {
    const input = document.getElementById(inputId);
    const menu = document.getElementById(menuId);
    if (!input || !menu || input.dataset.airportMenuBound === '1') return;

    input.dataset.airportMenuBound = '1';

    input.addEventListener('focus', () => showAirportMenu(inputId, menuId));
    input.addEventListener('input', () => {
        input.value = input.value.toUpperCase();
        showAirportMenu(inputId, menuId);
    });

    menu.addEventListener('pointerdown', (event) => {
        const item = event.target.closest('.airport-menu-item');
        if (!item) return;
        event.preventDefault();
        input.value = item.dataset.code;
        hideAirportMenus();
    });
}

function setupAirportMenus() {
    bindAirportMenu('inp-origin', 'origin-airport-menu');
    bindAirportMenu('inp-dest', 'dest-airport-menu');

    document.querySelectorAll('.airport-menu-toggle').forEach(btn => {
        if (btn.dataset.airportMenuToggleBound === '1') return;
        btn.dataset.airportMenuToggleBound = '1';
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            const inputId = btn.dataset.targetInput;
            const menuId = btn.dataset.targetMenu;
            const menu = document.getElementById(menuId);
            if (!menu) return;
            if (menu.classList.contains('hidden')) showAirportMenu(inputId, menuId);
            else hideAirportMenus();
            document.getElementById(inputId)?.focus();
        });
    });

    if (!document.body.dataset.airportMenuOutsideBound) {
        document.body.dataset.airportMenuOutsideBound = '1';
        document.addEventListener('pointerdown', (event) => {
            if (event.target.closest('.airport-menu') || event.target.closest('.airport-menu-toggle') || event.target.closest('#inp-origin') || event.target.closest('#inp-dest')) return;
            hideAirportMenus();
        });
    }
}

async function fetchFlights() {
    const { data, error } = await supabaseClient.from('flights').select('*').order('flight_date', { ascending: false });
    if (!error) setFlights(data);
}

function removeOptionalFlightTimingColumns(payload) {
    const cleanPayload = { ...payload };
    delete cleanPayload.origin_utc_offset;
    delete cleanPayload.dest_utc_offset;
    delete cleanPayload.arrival_date;
    return cleanPayload;
}

function isMissingOptionalFlightTimingColumnError(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('origin_utc_offset') ||
        message.includes('dest_utc_offset') ||
        message.includes('arrival_date') ||
        (message.includes('column') && message.includes('schema cache'));
}

async function upsertFlightPayload(payload, id = null) {
    if (id) return await supabaseClient.from('flights').update(payload).eq('id', id);
    return await supabaseClient.from('flights').insert([payload]);
}

async function saveFlight(payload, id = null) {
    try {
        let result = await upsertFlightPayload(payload, id);

        // Backward compatible fallback: if Supabase has not added the optional timing columns yet,
        // still save the corrected flight_hours and the rest of the flight record.
        if (result.error && isMissingOptionalFlightTimingColumnError(result.error)) {
            result = await upsertFlightPayload(removeOptionalFlightTimingColumns(payload), id);
        }

        if (result.error) throw result.error;
        return true;
    } catch (error) {
        console.error('儲存失敗:', error);
        alert('儲存失敗: ' + error.message);
        return false;
    }
}

async function deleteFlight(id) {
    if (!confirm('確定要刪除這筆航班紀錄嗎？此動作無法復原。')) return false;
    try {
        const { error } = await supabaseClient.from('flights').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('刪除失敗:', error);
        alert('刪除失敗: ' + error.message);
        return false;
    }
}