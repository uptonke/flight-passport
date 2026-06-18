async function loadGlobalAirports() {
    const cachedDB = localStorage.getItem('airportDB_cache_v1');
    if (cachedDB) {
        try {
            airportDB = JSON.parse(cachedDB);
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
        const manualOverrides = { 'TPE': { city: '桃園 Taipei' }, 'TSA': { city: '松山 Taipei' }, 
            'HND': { city: '東京羽田 Tokyo' }, 'NRT': { city: '東京成田 Tokyo' }, 'KIX': { city: '大阪 Osaka' },
            'OKA': { city: '沖繩 Okinawa' }, 'CTS': { city: '札幌 Sapporo' }, 'KMJ': { city: '熊本 Kumamoto' }, 'FUK': { city: '福岡 Fukuoka' },
            'PEK': { city: '北京首都 Beijing' }, 'PVG': { city: '上海浦東 Shanghai' }, 'SHA': { city: '上海虹橋 Shanghai' },
            'HGH': { city: '杭州 Hangzhou' }, 'TFU': { city: '成都天府 Chengdu' }, 'XIY': { city: '西安 Xi an' },
            'SZX': { coords: [113.8115, 22.6393], city: '深圳 Shenzhen' }, 'LJG': { coords: [100.2464, 26.6714], city: '麗江 Lijiang' },
            'SIN': { city: '新加坡 Singapore' }, 'HKT': { city: '普吉島 Phuket' }, 'PEN': { city: '檳城 Penang' },
            'BKK': { city: '曼谷 Bangkok' }, 'DMK': { city: '曼谷廊曼 Bangkok' }, 'KUL': { city: '吉隆坡 Kuala Lumpur' },
            'CGK': { city: '雅加達 Jakarta' }, 'MNL': { city: '馬尼拉 Manila' }, 'HKG': { city: '香港 Hong Kong' },
            'MFM': { city: '澳門 Macau' }, 'ICN': { city: '首爾 Seoul' }, 'GMP': { city: '首爾 Seoul' },
            'LGW': { city: '倫敦 London' }, 'FCO': { city: '羅馬 Rome' }, 'BCN': { city: '巴塞羅那 Barcelona' },
            'IST': { city: '伊斯坦堡 Istanbul' }, 'CAI': { city: '開羅 Cairo' }, 'DXB': { city: '杜拜 Dubai' },
            'ABU': { city: '阿布達比 Abu Dhabi' }, 'DOH': { city: '杜哈 Doha' },
            'JFK': { city: '紐約 New York' }, 'LAX': { city: '洛杉磯 Los Angeles' }, 'LAS': { city: '拉斯維加斯 Las Vegas' },
            'IAD': { city: '華盛頓 Washington' }, 'SFO': { city: '舊金山 San Francisco' }, 'DEL': { city: '新德里 New Delhi' },
            'CMB': { city: '科倫坡 Colombo'}
        };
        data.forEach(a => { 
            if (a.code) {
                let code = a.code.toUpperCase();
                airportDB[code] = { coords: [parseFloat(a.lon), parseFloat(a.lat)], name: a.name, city: a.city, country: a.country, ...manualOverrides[code] };
            }
        });
        localStorage.setItem('airportDB_cache_v1', JSON.stringify(airportDB));
        renderAirportOptions();
    } catch (e) { console.error(e); }
}

function renderAirportOptions() {
    let options = '';
    for (let code in airportDB) options += `<option value="${code}">${airportDB[code].name} (${airportDB[code].city})</option>`;
    document.getElementById('iata-list').innerHTML = options;
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
