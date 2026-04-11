// 🌍 Globals & Framer Motion Setup
const MAPBOX_TOKEN = 'pk.eyJ1IjoidXB0b25rZSIsImEiOiJjbW5sNnNwajAxNnY2MnJvZ3kzcDNqN2NlIn0.oriWVIXM8Oy80ZExDHSJUA';
mapboxgl.accessToken = MAPBOX_TOKEN; 
const SUPABASE_URL = 'https://yrccanqxzrcoknzabifz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lDfwRDxgMhzRwVk0-Qu3vg_9HTmTFZy';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let airportDB = {}; 
let editingFlightId = null;
let currentYearFilter = 'ALL';
let animationState = { startTime: 0, planes: [], isRunning: false };
let isAppInitialized = false;
let isGlobe = true;
let isNightMode = false;

// 🎥 新增：電影跟隨鏡頭狀態與「避震器」
let cinematicMode = false;
let followedPlaneObj = null;
let cinematicCamera = { lng: 0, lat: 0, bearing: 0, pitch: 0, zoom: 0 };

// Auth & Session
async function checkAuth() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (session) {
        hideLoginOverlay();
        initApp();
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errorDiv = document.getElementById('login-error');

    btn.innerText = 'AUTHENTICATING...';
    errorDiv.classList.add('hidden');

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: password });

    if (error) {
        errorDiv.innerText = 'Access Denied: ' + error.message;
        errorDiv.classList.remove('hidden');
        btn.innerText = 'LOGIN 登入';
    } else {
        hideLoginOverlay();
        initApp();
    }
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    window.location.reload();
}

function hideLoginOverlay() {
    const overlay = document.getElementById('login-overlay');
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 500);
}

document.addEventListener('DOMContentLoaded', checkAuth);

// Framer Motion
let animate, stagger, spring;
import("https://cdn.jsdelivr.net/npm/motion@11.11.13/+esm").then(module => {
    animate = module.animate; stagger = module.stagger; spring = module.spring;
}).catch(e => {
    console.warn("動畫引擎載入失敗，使用降級模式");
});

const airlineDB = {
    'BR': '長榮航空 EVA Air', 'CI': '中華航空 China Airlines', 'JX': '星宇航空 STARLUX', 
    'IT': '台灣虎航 Tigerair Taiwan', 'AE': '華信航空 Mandarin', 'B7': '立榮航空 UNI Air',
    'JL': '日航航空 Japan Airlines', 'NH': '全日空 ANA', 
    'MM': '樂桃航空 Peach', 'GK': '捷星日本 Jetstar Japan', 'BC': '天馬航空 Skymark', 'ZG': 'ZIPAIR',
    'KE': '大韓航空 Korean Air', 'OZ': '韓亞航空 Asiana', 
    '7C': '濟州航空 Jeju Air', 'TW': '德威航空 T\'way', 'LJ': '真航空 Jin Air', 'BX': '釜山航空 Air Busan',
    'CX': '國泰航空 Cathay Pacific', 'UO': '香港快運 HK Express', 'HX': '香港航空 Hong Kong Airlines', 
    'NX': '澳門航空 Air Macau', 'CA': '中國航空 Air China', 'MU': '東方航空 China Eastern', 
    'CZ': '南方航空 China Southern', 'MF': '廈門航空 XiamenAir', '9C': '春秋航空 Spring Airlines', 
    'ZH': '深圳航空 Shenzhen Airlines','HB': '大灣區航空 Greater bay Airlines',
    'SQ': '新加坡航空 Singapore Airlines', 'TR': '酷航 Scoot', '3K': '捷星亞洲 Jetstar Asia',
    'MH': '馬航 Malaysia Airlines', 'AK': '亞航 AirAsia', 'D7': '全亞航 AirAsia X',
    'TG': '泰國航空 Thai Airways', 'FD': '泰亞航 Thai AirAsia', 'VZ': '泰越捷 Thai Vietjet',
    'VN': '越南航空 Vietnam Airlines', 'VJ': '越捷 VietJet', 
    'PR': '菲律賓航空 Philippine Airlines', '5J': '宿霧太平洋 Cebu Pacific', 
    'GA': '印尼鷹航 Garuda Indonesia', 'JT': '獅航 Lion Air',
    'AA': '美國航空 American Airlines', 'DL': '達美航空 Delta', 'UA': '聯合航空 United Airlines', 
    'WN': '西南航空 Southwest Airlines', 'AS': '阿拉斯加航空 Alaska Airlines', 'B6': '捷藍 JetBlue',
    'NK': '精神航空 Spirit Airlines', 'F9': '邊疆航空 Frontier Airlines', 'AC': '加拿大航空 Air Canada',
    'BA': '英國航空 British Airways', 'LH': '德國航空 Lufthansa', 'AF': '法國航空 Air France', 
    'KL': '荷蘭航空 KLM', 'LX': '瑞航 SWISS', 'AY': '芬蘭航空 Finnair', 'TK': '土耳其航空 Turkish Airlines',
    'U2': '易捷 easyJet', 'FR': '瑞安航空 Ryanair', 'W6': '威茲航空 Wizz Air', 'VY': '伏林航空 Vueling', 'TP': '葡萄牙航空 TAP Air Portugal',
    'EK': '阿聯酋航空 Emirates', 'QR': '卡達航空 Qatar Airways', 'EY': '阿提哈德航空 Etihad Airways'
};

let flightsState = [];
const setFlights = (newData) => {
    flightsState = newData;
    triggerReactRender();
};

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

async function saveFlight(payload, id = null) {
    try {
        let result;
        if (id) {
            result = await supabaseClient.from('flights').update(payload).eq('id', id);
        } else {
            result = await supabaseClient.from('flights').insert([payload]);
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

function calculateStats(flights) {
    let stats = {
        totalKm: 0, totalHours: 0, completedFlights: 0, domCount: 0, intCount: 0, longCount: 0,
        shortest: { route: '', dist: Infinity }, longest: { route: '', dist: -Infinity },
        freq: { airports: {}, airlines: {}, airlinesDist: {}, routes: {}, directedRoutes: {}, aircrafts: {}, aircraftsDist: {} },
        undirectedRouteDistances: {}, observedDirectedRoutes: new Set(),
        seatStats: { class: { 'Economy': 0, 'Premium Economy': 0, 'Business': 0, 'First Class': 0 }, type: { 'Window': 0, 'Middle': 0, 'Aisle': 0 }, exitRows: 0, validClasses: 0, validTypes: 0 },
        yearlyDist: {}, monthlyCount: new Array(12).fill(0), takeoffStats: new Array(24).fill(0), landingStats: new Array(24).fill(0),
        timeline: [], tripsCount: 0, timezonesCrossed: 0,
        airportStats: {}, airportFlightsInfo: {} 
    };

    const validFlights = flights.filter(f => f.origin_code && f.dest_code && airportDB[f.origin_code] && airportDB[f.dest_code]);
    stats.timeline = [...validFlights].sort((a, b) => {
        const dateA = new Date(`${a.flight_date || '1970-01-01'}T${a.takeoff_time || '00:00'}:00`).getTime();
        const dateB = new Date(`${b.flight_date || '1970-01-01'}T${b.takeoff_time || '00:00'}:00`).getTime();
        return dateA - dateB; 
    });

    stats.tripsCount = new Set(stats.timeline.filter(f => f.flight_date).map(f => f.flight_date)).size;

    stats.timeline.forEach((f, i) => {
        const orig = airportDB[f.origin_code], dest = airportDB[f.dest_code];
        f.distance ||= turf.distance(orig.coords, dest.coords, {units: 'kilometers'});
        const dist = f.distance, routeName = `${f.origin_code} ✈️ ${f.dest_code}`;
        const routeKey = [f.origin_code, f.dest_code].sort().join('-'); 
        const directedRouteKey = `${f.origin_code}-${f.dest_code}`;     
        stats.undirectedRouteDistances[routeKey] = Math.round(dist);
        
        stats.totalKm += dist; stats.completedFlights++;
        if(f.flight_hours) stats.totalHours += parseFloat(f.flight_hours);
        if(orig.country === dest.country) stats.domCount++; else stats.intCount++;
        if(dist >= 4000) stats.longCount++;
        if(dist < stats.shortest.dist) stats.shortest = { route: routeName, dist: dist };
        if(dist > stats.longest.dist) stats.longest = { route: routeName, dist: dist };
        
        stats.freq.airports[f.origin_code] = (stats.freq.airports[f.origin_code]||0)+1; stats.freq.airports[f.dest_code] = (stats.freq.airports[f.dest_code]||0)+1;
        stats.freq.routes[routeKey] = (stats.freq.routes[routeKey]||0)+1; 
        stats.freq.directedRoutes[directedRouteKey] = (stats.freq.directedRoutes[directedRouteKey]||0)+1; 
        if(f.airline) stats.freq.airlines[f.airline] = (stats.freq.airlines[f.airline]||0)+1;
        if(f.airline) stats.freq.airlinesDist[f.airline] = (stats.freq.airlinesDist[f.airline]||0) + Math.round(dist);
        if(f.aircraft_type) {
             let cleanType = f.aircraft_type.trim().toUpperCase();
              stats.freq.aircrafts[cleanType] = (stats.freq.aircrafts[cleanType]||0)+1;
             stats.freq.aircraftsDist[cleanType] = (stats.freq.aircraftsDist[cleanType]||0) + Math.round(dist);
        }

        if(f.seat_class) { stats.seatStats.class[f.seat_class] = (stats.seatStats.class[f.seat_class] || 0) + 1; stats.seatStats.validClasses++; }
        if(f.seat_type) { stats.seatStats.type[f.seat_type] = (stats.seatStats.type[f.seat_type] || 0) + 1; stats.seatStats.validTypes++; }
        if(f.is_exit_row) stats.seatStats.exitRows++;
        
        if(f.flight_date) {
            const y = f.flight_date.substring(0,4), m = parseInt(f.flight_date.substring(5,7)) - 1;
            stats.yearlyDist[y] = (stats.yearlyDist[y] || 0) + dist; stats.monthlyCount[m]++;
        }
        if(f.takeoff_time) { let h = parseInt(f.takeoff_time.split(':')[0]); if(!isNaN(h)) stats.takeoffStats[h]++; }
        if(f.landing_time) { let h = parseInt(f.landing_time.split(':')[0]); if(!isNaN(h)) stats.landingStats[h]++; }

        if(!stats.airportStats[f.origin_code]) stats.airportStats[f.origin_code] = { dep: 0, arr: 0, routes: {}, total: 0 };
        if(!stats.airportStats[f.dest_code]) stats.airportStats[f.dest_code] = { dep: 0, arr: 0, routes: {}, total: 0 };
        stats.airportStats[f.origin_code].dep++; stats.airportStats[f.origin_code].total++; stats.airportStats[f.origin_code].routes[f.dest_code] = (stats.airportStats[f.origin_code].routes[f.dest_code] || 0) + 1;
        stats.airportStats[f.dest_code].arr++; stats.airportStats[f.dest_code].total++; stats.airportStats[f.dest_code].routes[f.origin_code] = (stats.airportStats[f.dest_code].routes[f.origin_code] || 0) + 1;

        if(!stats.airportFlightsInfo[f.origin_code]) stats.airportFlightsInfo[f.origin_code] = [];
        if(!stats.airportFlightsInfo[f.dest_code]) stats.airportFlightsInfo[f.dest_code] = [];
        const infoStr = `${f.flight_date||''} ${f.airline||''}${f.flight_number||''} ${f.origin_code}✈️${f.dest_code}`;
        stats.airportFlightsInfo[f.origin_code].push(infoStr); stats.airportFlightsInfo[f.dest_code].push(infoStr);

        stats.timezonesCrossed += Math.round(Math.abs(orig.coords[0] - dest.coords[0]) / 15);

        if (f.route_geojson && f.route_geojson.coordinates) {
            const cleanCoords = f.route_geojson.coordinates.filter(c => c && c[0] != null && c[1] != null && !isNaN(c[0]) && !isNaN(c[1]));
            
            if (cleanCoords.length > 1) {
                f.routeCoords = cleanCoords;
                f.route_geojson.coordinates = cleanCoords; 
                try {
                    f.distance = turf.length(f.route_geojson, {units: 'kilometers'});
                } catch (e) {
                    f.distance = turf.distance(orig.coords, dest.coords, {units: 'kilometers'});
                }
            } else {
                f.routeCoords = null; 
            }
        } else {
            f.routeCoords = null;
        }

        if (!f.routeCoords) {
            const route = turf.greatCircle(orig.coords, dest.coords); 
            const lineDistance = turf.length(route);
            const maxHeight = Math.min(lineDistance * 200, 2000000); 
            const arcCoords = [];
            for (let d = 0; d <= lineDistance; d += lineDistance / 250) {
                let pt = turf.along(route, d).geometry.coordinates; 
                let h = Math.sin((d / lineDistance) * Math.PI) * maxHeight;
                arcCoords.push([pt[0], pt[1], h]); 
            }
            arcCoords.push([dest.coords[0], dest.coords[1], 0]); 
            f.routeCoords = arcCoords;
        }
        f.routeColor = getRouteColor(stats.freq.routes[routeKey] || 1);
    });

    const uniqueDirectedRoutes = Object.keys(stats.freq.directedRoutes).length;
    stats.repeatedRoutePct = stats.completedFlights > 0 ? ((stats.completedFlights - uniqueDirectedRoutes) / stats.completedFlights * 100).toFixed(1) : 0;
    
    const flightYears = Object.keys(stats.yearlyDist).map(Number);
    if (flightYears.length > 0) {
        const span = Math.max(...flightYears) - Math.min(...flightYears) + 1;
        stats.avgFlightsPerYear = (stats.completedFlights / span).toFixed(1);
    } else {
        stats.avgFlightsPerYear = 0;
    }

    Object.entries(stats.airportStats).sort((a, b) => b[1].total - a[1].total).forEach((entry, idx) => { entry[1].rank = idx + 1; });
    return stats;
}

function getRouteColor(c) { return c===1?'#facc15':c===2?'#3b82f6':c===3?'#22c55e':c===4?'#ffffff':c===5?'#ef4444':c===6?'#f97316':'#ffffff'; }
function getAirlineLogoUrl(code) { return (!code || code.length !== 2) ? null : `https://images.kiwi.com/airlines/64/${code.toUpperCase()}.png`; }
function formatTimeString(hrs) { if(!hrs) return '0h 0m'; const h = Math.floor(hrs); return `${h}h ${Math.round((hrs - h) * 60)}m`; }

function triggerReactRender() {
    let filtered = flightsState.filter(f => (currentYearFilter === 'ALL' || (f.flight_date && f.flight_date.startsWith(currentYearFilter))));
    const stats = calculateStats(filtered);
    
    renderFilters();
    renderDashboard(stats);
    renderFlightList(stats.timeline);
    renderChartsAndLists(stats);
    renderMapFeatures(stats);
}

function renderFilters() {
    const years = new Set(); flightsState.forEach(f => { if (f.flight_date) years.add(f.flight_date.substring(0, 4)); });
    let html = `<button onclick="filterByYear('ALL')" class="${currentYearFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400'} px-3 py-1 rounded-full whitespace-nowrap">ALL</button>`;
    Array.from(years).sort().reverse().forEach(y => {
        html += `<button onclick="filterByYear('${y}')" class="${currentYearFilter === y ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400'} px-3 py-1 rounded-full whitespace-nowrap">${y}</button>`;
    });
    document.getElementById('year-filters').innerHTML = html;
}
window.filterByYear = (y) => { currentYearFilter = y; triggerReactRender(); }

function renderDashboard(stats) {
    const setTxt = (id, txt) => { const e = document.getElementById(id); if(e) e.innerText = txt; };
    setTxt('stat-dist', Math.round(stats.totalKm).toLocaleString()); setTxt('stat-flights', stats.completedFlights); setTxt('stat-trips', stats.tripsCount); 
    if(stats.completedFlights > 0) {
        setTxt('sb-long-route', `${stats.longest.route} (${Math.round(stats.longest.dist)}km)`);
        if (document.getElementById('sb-short-route')) setTxt('sb-short-route', `${stats.shortest.route} (${Math.round(stats.shortest.dist)}km)`);
        if (document.getElementById('pp-short-route')) setTxt('pp-short-route', stats.shortest.route);
        if (document.getElementById('pp-short-dist')) setTxt('pp-short-dist', `${Math.round(stats.shortest.dist).toLocaleString()} km`);
        if (document.getElementById('pp-long-route')) setTxt('pp-long-route', stats.longest.route); 
        if (document.getElementById('pp-long-dist')) setTxt('pp-long-dist', `${Math.round(stats.longest.dist).toLocaleString()} km`);
    }
    setTxt('pp-dist', Math.round(stats.totalKm).toLocaleString());
    setTxt('pp-earth', (stats.totalKm / 40075).toFixed(1)); setTxt('pp-moon', (stats.totalKm / 384400).toFixed(2));
    const eBar = document.getElementById('pp-earth-bar'); if(eBar) eBar.style.width = `${Math.min((stats.totalKm / 40075) * 100, 100)}%`;
    const mBar = document.getElementById('pp-moon-bar'); if(mBar) mBar.style.width = `${Math.min((stats.totalKm / 384400) * 100, 100)}%`;

    const avg = stats.completedFlights ? (stats.totalHours / stats.completedFlights) : 0;
    document.getElementById('pp-time-main').innerHTML = `${Math.floor(stats.totalHours)}<span class="text-2xl text-gray-500">h</span> ${Math.round((stats.totalHours - Math.floor(stats.totalHours)) * 60)}<span class="text-2xl text-gray-500">m</span>`;
    setTxt('pp-days', (stats.totalHours / 24).toFixed(1)); setTxt('pp-avg-time', formatTimeString(avg)); setTxt('pp-in-air', formatTimeString(stats.totalHours));
    setTxt('pp-total-flights-box', stats.completedFlights); setTxt('pp-dom', stats.domCount); setTxt('pp-int', stats.intCount); setTxt('pp-long', stats.longCount);

    setTxt('pp-rep-route', stats.repeatedRoutePct);
    setTxt('pp-avg-flights', stats.avgFlightsPerYear);
    setTxt('pp-timezones', stats.timezonesCrossed);
}

function renderFlightList(timeline) {
document.getElementById('flight-list').innerHTML = timeline.map((f, i) => {
    const logo = getAirlineLogoUrl(f.airline); 
    const display = f.airline ? (logo ? `<img src="${logo}" class="w-6 h-6 rounded-full object-contain bg-white/5 p-0.5 shrink-0">` : f.airline) : '';
    return `
        <div class="flight-card bg-white/5 p-3 rounded-xl mb-2 flex items-center gap-3 cursor-pointer opacity-0" onclick="window.focusFlightRoute('r-${i}', '${f.origin_code}', '${f.dest_code}')">
            ${display} 
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center mb-0.5">
                    <span class="font-bold truncate">${f.origin_code} ✈️ ${f.dest_code}</span>
                    <div class="flex items-center gap-1 shrink-0 ml-2">
                        <span class="text-[10px] px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-300 font-bold mr-1">ID: ${f.id}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full border border-white/20 text-gray-300 mr-1">${f.flight_date ? f.flight_date.substring(0,4) : ''}</span>
                        <button onclick="event.stopPropagation(); window.editFlight('${f.id}')" class="opacity-50 hover:opacity-100 text-xs ml-1">✏️</button>
                        <button onclick="event.stopPropagation(); window.deleteFlightHandler('${f.id}')" class="opacity-50 hover:opacity-100 text-xs ml-1">🗑️</button>
                    </div>
                </div>
                <div class="text-[10px] text-gray-400 truncate">${[f.airline, f.flight_number].filter(Boolean).join(' ')} · ${formatTimeString(f.flight_hours)} · ${Math.round(f.distance)}km</div>
            </div>
        </div>`;
}).join('');

    if (animate && stagger) {
        animate(".flight-card", { x: [-30, 0], opacity: [0, 1] }, { delay: stagger(0.05), duration: 0.4, easing: "ease-out" });
    }
}

function renderChartsAndLists(stats) {
    const renderList = (data, id, colorCls, isLogo=false) => {
        const sorted = Object.entries(data).sort((a,b) => b[1]-a[1]); const max = sorted.length ? sorted[0][1] : 1;
        const el = document.getElementById(id); if(!el) return 0;
        el.innerHTML = sorted.slice(0, 10).map(i => {
            let name = i[0]; if(isLogo && airlineDB[name]) name = `${name} ${airlineDB[name]}`; else if(!isLogo && airportDB[name]) name = `${name} ${airportDB[name].city}`;
            const lg = isLogo && getAirlineLogoUrl(i[0]) ? `<img src="${getAirlineLogoUrl(i[0])}" class="w-6 h-6 rounded-full bg-white/5 p-1 mr-3 shrink-0">` : '';
            return `<div class="flex items-center text-sm">${lg}<div class="w-32 sm:w-48 font-bold truncate pr-2">${name}</div><div class="flex-1 min-w-0"><div class="${colorCls} h-6 rounded-r-md flex items-center px-2 text-xs font-bold" style="width:${(i[1]/max)*100}%">${i[1]}</div></div></div>`;
        }).join('');
        return sorted.length;
    };
    const sTxt = (id, txt) => { const e = document.getElementById(id); if(e) e.innerText = txt; };
    sTxt('pp-total-aircraft', renderList(stats.freq.aircrafts, 'list-aircraft', 'bg-emerald-600'));
    sTxt('pp-total-aircraft-dist', renderList(stats.freq.aircraftsDist, 'list-aircraft-dist', 'bg-teal-500'));
    sTxt('pp-total-routes', renderList(stats.freq.routes, 'list-routes', 'bg-[#5e35b1]'));
    sTxt('pp-total-airports', renderList(stats.freq.airports, 'list-airports', 'bg-[#7e57c2]'));
    sTxt('pp-total-airlines', renderList(stats.freq.airlines, 'list-airlines', 'bg-sky-600', true));
    sTxt('pp-total-airlines-dist', renderList(stats.freq.airlinesDist, 'list-airlines-dist', 'bg-blue-500', true));
    sTxt('pp-total-routes-dist', renderList(stats.undirectedRouteDistances, 'list-routes-dist', 'bg-[#facc15]'));   

    const renderPolar = (ctxId, data, isTakeoff) => {
        if(window[`chart_${ctxId}`]) window[`chart_${ctxId}`].destroy();
        const ctx = document.getElementById(ctxId); if(!ctx) return;
        window[`chart_${ctxId}`] = new Chart(ctx.getContext('2d'), {
            type: 'polarArea', data: { labels: Array.from({length:24}, (_,i)=>`${i}:00`), datasets: [{ data: data, backgroundColor: data.map((_, i) => (i>=6 && i<=17) ? (isTakeoff?'rgba(250,204,21,0.6)':'rgba(34,197,94,0.6)') : (isTakeoff?'rgba(56,189,248,0.6)':'rgba(126,87,194,0.6)')), borderWidth: 0 }] },
            options: { plugins: { legend: { display: false } }, scales: { r: { ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.1)' }, angleLines: { color: 'rgba(255,255,255,0.1)' } } } }
        });
    };
    renderPolar('chart-takeoff', stats.takeoffStats, true); renderPolar('chart-landing', stats.landingStats, false);
    
if(window.chart_yearly) window.chart_yearly.destroy();
const yearlyCtx = document.getElementById('chart-yearly');
if(yearlyCtx) {
    const years = Object.keys(stats.yearlyDist).sort();
    window.chart_yearly = new Chart(yearlyCtx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{ label: 'km', data: years.map(y => Math.round(stats.yearlyDist[y])), backgroundColor: 'rgba(250,204,21,0.7)', borderRadius: 4 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } } }
    });
}

if(window.chart_monthly) window.chart_monthly.destroy();
const monthlyCtx = document.getElementById('chart-monthly');
if(monthlyCtx) {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    window.chart_monthly = new Chart(monthlyCtx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: monthNames,
            datasets: [{ data: stats.monthlyCount, backgroundColor: stats.monthlyCount.map(v => `rgba(56,189,248,${Math.min(0.2 + v * 0.2, 1)})`), borderRadius: 4 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8', font: { size: 9 } } }, y: { ticks: { color: '#94a3b8', stepSize: 1 } } } }
    });
}

const classColors = { 'Economy': '#3b82f6', 'Premium Economy': '#8b5cf6', 'Business': '#f59e0b', 'First Class': '#ef4444' };
const classEntries = Object.entries(stats.seatStats.class).filter(([,v]) => v > 0);
const classTotal = classEntries.reduce((a,[,v]) => a + v, 0);
if (classEntries.length > 0) {
    let deg = 0;
    const gradParts = classEntries.map(([k, v]) => {
        const pct = (v / classTotal) * 360;
        const part = `${classColors[k] || '#555'} ${deg}deg ${deg + pct}deg`;
        deg += pct;
        return part;
    });
    const topClass = classEntries.sort((a,b) => b[1]-a[1])[0];
    document.getElementById('chart-class').style.background = `conic-gradient(${gradParts.join(', ')})`;
    document.getElementById('top-class-name').innerText = topClass[0];
    document.getElementById('legend-class').innerHTML = classEntries.map(([k,v]) =>
        `<div class="flex justify-between items-center py-1">
            <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full inline-block" style="background:${classColors[k]||'#555'}"></span><span class="text-gray-300">${k}</span></div>
            <span class="font-bold text-white">${v} <span class="text-gray-500">(${((v/classTotal)*100).toFixed(0)}%)</span></span>
        </div>`
    ).join('');
}

const seatColors = { 'Window': '#22c55e', 'Middle': '#f97316', 'Aisle': '#06b6d4' };
const seatEntries = Object.entries(stats.seatStats.type).filter(([,v]) => v > 0);
const seatTotal = seatEntries.reduce((a,[,v]) => a + v, 0);
if (seatEntries.length > 0) {
    let deg = 0;
    const gradParts = seatEntries.map(([k, v]) => {
        const pct = (v / seatTotal) * 360;
        const part = `${seatColors[k] || '#555'} ${deg}deg ${deg + pct}deg`;
        deg += pct;
        return part;
    });
    const topSeat = seatEntries.sort((a,b) => b[1]-a[1])[0];
    document.getElementById('chart-seat').style.background = `conic-gradient(${gradParts.join(', ')})`;
    document.getElementById('top-seat-name').innerText = topSeat[0];
    document.getElementById('legend-seat').innerHTML = seatEntries.map(([k,v]) =>
        `<div class="flex justify-between items-center py-1">
            <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full inline-block" style="background:${seatColors[k]||'#555'}"></span><span class="text-gray-300">${k}</span></div>
            <span class="font-bold text-white">${v} <span class="text-gray-500">(${((v/seatTotal)*100).toFixed(0)}%)</span></span>
        </div>`
    ).join('');
    document.getElementById('stat-exit-row').innerText = stats.seatStats.exitRows;
}
    }
    
window.toggleModal = function(id) {
    const el = document.getElementById(id);
    const panel = el.querySelector('.modal-panel');
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        if(animate) {
            animate(el, { opacity: [0, 1] }, { duration: 0.2 });
            animate(panel, { scale: [0.9, 1], y: [30, 0], opacity: [0, 1] }, { type: "spring", bounce: 0.4, duration: 0.6 });
        }
    } else {
        if(animate) {
            animate(el, { opacity: 0 }, { duration: 0.3 });
            animate(panel, { scale: 0.9, y: 30, opacity: 0 }, { duration: 0.3 });
            setTimeout(() => el.classList.add('hidden'), 300);
        } else el.classList.add('hidden');
    }
};

window.toggleDashboard = function() {
    if (window.innerWidth >= 768) return; 
    const content = document.getElementById('dash-content');
    const icon = document.getElementById('dash-toggle-icon');
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden'); setTimeout(() => content.classList.remove('opacity-0', 'h-0', 'mt-0'), 10);
        icon.style.transform = 'rotate(0deg)';
    } else {
        content.classList.add('opacity-0', 'h-0', 'mt-0'); icon.style.transform = 'rotate(180deg)';
        setTimeout(() => content.classList.add('hidden'), 500); 
    }
};

window.toggleProjection = function() {
    isGlobe = !isGlobe;
    map.setProjection({ name: isGlobe ? 'globe' : 'equirectangular' });
    map.flyTo({ pitch: isGlobe ? 45 : 0, duration: 1200 });
    const btn = document.getElementById('btn-projection-toggle');
    if (btn) btn.innerText = isGlobe ? '切換平面 2D' : '切換地球 3D';
};

window.toggleNightMode = function() {
    isNightMode = !isNightMode;
    if (map.getLayer('nasa-black-marble-layer')) {
        map.setLayoutProperty('nasa-black-marble-layer', 'visibility', isNightMode ? 'visible' : 'none');
    }
    const btn = document.getElementById('btn-night-toggle');
    if (btn) btn.innerText = isNightMode ? '切換衛星地貌' : '切換夜景燈光';
};

const map = new mapboxgl.Map({ 
    container: 'map', 
    style: 'mapbox://styles/mapbox/satellite-streets-v12', 
    center: [111.0, 25.0], 
    zoom: 3.5, 
    pitch: 45, 
    projection: 'globe' 
});
map.on('dragstart', () => {
    if (cinematicMode) {
        cinematicMode = false;
        followedPlaneObj = null;
        document.getElementById('db-status').innerHTML = '系統上線 Online <span class="text-xs text-gray-500 ml-2">已手動接管鏡頭</span>';
    }
});
map.on('style.load', () => {
    map.setLight({
        anchor: 'viewport',
        color: '#ffffff',
        intensity: 0.35,
        position: [1.15, 210, 30] // 模擬特定角度的太陽光源
    });

    if (!map.getSource('nasa-black-marble')) {
        map.addSource('nasa-black-marble', {
            'type': 'raster',
            'tiles': ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg'],
            'tileSize': 256,
            'attribution': '© NASA GIBS'
        });
        map.addLayer({
            'id': 'nasa-black-marble-layer',
            'type': 'raster',
            'source': 'nasa-black-marble',
            'paint': { 'raster-opacity': 1.0, 'raster-contrast': 0.1 },
            'layout': { 'visibility': 'none' }
        });
    }
    
    const btnProj = document.getElementById('btn-projection-toggle');
    if (btnProj) btnProj.innerText = isGlobe ? '切換平面 2D' : '切換地球 3D';

    const btnNight = document.getElementById('btn-night-toggle');
    if (btnNight) btnNight.innerText = isNightMode ? '切換衛星地貌' : '切換夜景燈光';
    
    if (isAppInitialized) {
        triggerReactRender();
    }
});

function renderMapFeatures(stats) {
    let airFeats = [];
    for (let [code, count] of Object.entries(stats.freq.airports)) {
        if (airportDB[code]) airFeats.push({ type: 'Feature', properties: { code, count, name: airportDB[code].name, city: airportDB[code].city }, geometry: { type: 'Point', coordinates: airportDB[code].coords } });
    }
    if(map.getSource('airports')) { map.getSource('airports').setData({ type: 'FeatureCollection', features: airFeats }); } 
    else {
        map.addSource('airports', { type: 'geojson', data: { type: 'FeatureCollection', features: airFeats } });
        map.addLayer({ id: 'airports-glow', type: 'circle', source: 'airports', paint: { 'circle-radius': ['*', ['get', 'count'], 4], 'circle-color': '#facc15', 'circle-opacity': 0.4, 'circle-blur': 1 } });
        map.addLayer({ id: 'airports-core', type: 'circle', source: 'airports', paint: { 'circle-radius': 4, 'circle-color': '#ffffff', 'circle-stroke-width': 1, 'circle-stroke-color': '#000' } });
        
        map.on('click', 'airports-core', (e) => {
            const p = e.features[0].properties; const astats = stats.airportStats[p.code];
            let topRt = '--'; if(astats && Object.keys(astats.routes).length > 0) { const tr = Object.entries(astats.routes).sort((a,b)=>b[1]-a[1])[0]; topRt = `${p.code} ⇄ ${tr[0]} (${tr[1]}次)`; }
            const listHTML = (stats.airportFlightsInfo[p.code]||[]).map(f => `<div class="text-[10px] text-gray-300 border-b border-white/10 py-1">${f}</div>`).join('');
            new mapboxgl.Popup({ closeButton: false }).setLngLat(e.features[0].geometry.coordinates).setHTML(`
                <div class="min-w-[220px]">
                    <div class="flex justify-between items-start mb-2"><div><strong class="text-xl font-black">${p.code}</strong><div class="text-xs text-gray-400">${p.name}</div></div><div class="bg-sky-500/20 text-sky-400 px-2 py-1 rounded text-[10px] font-bold">TOP ${astats?astats.rank:'-'}</div></div>
                    <div class="grid grid-cols-2 gap-2 mb-3 bg-black/30 p-2 rounded-lg text-center"><div><div class="text-[9px] text-gray-500">出發 Dep</div><div class="font-bold text-base">${astats?astats.dep:0}</div></div><div class="border-l border-white/10"><div class="text-[9px] text-gray-500">抵達 Arr</div><div class="font-bold text-base">${astats?astats.arr:0}</div></div></div>
                    <div class="mb-3"><div class="text-[9px] text-gray-500">最常飛航線 Top Route</div><div class="text-xs font-bold text-[#facc15]">${topRt}</div></div>
                    <div class="text-[10px] font-bold text-gray-400 border-b border-white/20 pb-1 mb-1">歷史航班 History</div>
                    <div class="max-h-32 overflow-y-auto pr-1">${listHTML}</div>
                </div>`).addTo(map);
        });
    }

    if (map.getStyle()) { map.getStyle().layers.forEach(l => { if (l.id.startsWith('r-')) map.removeLayer(l.id); }); Object.keys(map.getStyle().sources).forEach(s => { if (s.startsWith('r-')) map.removeSource(s); }); }
    animationState.planes.forEach(p => p.marker.remove()); 
    
    animationState.planes = [];
    animationState.currentPlaneIndex = 0;

    stats.timeline.forEach((f, i) => {
        const routeId = `r-${i}`;
        map.addSource(routeId, { 'type': 'geojson', 'data': { 'type': 'FeatureCollection', 'features': [] } });
        map.addLayer({ 'id': `${routeId}-line`, 'type': 'line', 'source': routeId, 'layout': { 'line-join': 'round', 'line-cap': 'round' }, 'paint': { 'line-color': f.routeColor, 'line-width': 3, 'line-opacity': 0.85 } });
        
        const elContainer = document.createElement('div'); 
        const planeIcon = document.createElement('div');

        // 啟用 3D 透視視角
        planeIcon.style.transformStyle = 'preserve-3d';
        planeIcon.style.perspective = '150px'; 

        // 🚀 將顏色綁定 f.routeColor，並加入發光特效
        planeIcon.innerHTML = `
            <svg viewBox="0 0 24 24" width="28" height="28" style="filter: drop-shadow(0px 15px 10px rgba(0,0,0,0.6)) drop-shadow(0px 0px 8px ${f.routeColor});">
                <path fill="${f.routeColor}" d="M21,16v-2l-8-5V3.5C13,2.67,12.33,2,11.5,2S10,2.67,10,3.5V9l-8,5v2l8-2.5V19l-2,1.5V22l3.5-1l3.5,1v-1.5L13,19v-5.5L21,16z"/>
            </svg>
            `;
        elContainer.appendChild(planeIcon);
        
        const planeMarker = new mapboxgl.Marker({ 
            element: elContainer,
            pitchAlignment: 'map',    // 讓機身貼齊 3D 地平線，而不是貼齊使用者的螢幕
            rotationAlignment: 'map'  // 讓旋轉的 0 度永遠指向正北，而非螢幕正上方
        }).setLngLat(f.routeCoords[0]).addTo(map);
        planeMarker.getElement().style.opacity = 0;
        const actualHours = f.flight_hours || ((f.distance / 850) + 0.5);
        animationState.planes.push({ id: routeId, marker: planeMarker, icon: planeIcon, coords: f.routeCoords, flightHours: actualHours, startTime: null });
    });

    if(!animationState.isRunning && animationState.planes.length > 0) { 
        animationState.isRunning = true; 
        requestAnimationFrame(globalAnimationLoop); 
    }
}

const TIME_SCALE = 2000; 

// 🚀 新增：預處理函式，將原始座標陣列轉換成「航段快取表」
function buildTrajectoryCache(coords) {
    let cache = [];
    let accumulatedDist = 0;
    
    for (let i = 0; i < coords.length - 1; i++) {
        let p1 = coords[i];
        let p2 = coords[i + 1];
        
        // 繁重的 Turf 運算，只在初始化時做一次！
        let dist = turf.distance(p1, p2, { units: 'kilometers' });
        let bearing = turf.bearing(p1, p2);
        
        cache.push({
            startDist: accumulatedDist,
            endDist: accumulatedDist + dist,
            length: dist,
            p1: p1,
            p2: p2,
            bearing: bearing
        });
        accumulatedDist += dist;
    }
    
    // 防呆：如果軌跡異常，給個預設值避免崩潰
    if (cache.length === 0) {
        cache.push({ startDist: 0, endDist: 0.1, length: 0.1, p1: coords[0]||[0,0], p2: coords[0]||[0,0], bearing: 0 });
    }
    return { cache, totalDist: accumulatedDist };
}

// 🚀 完整替換：主畫面動畫引擎 (搭載效能節流與雙重避震)
function globalAnimationLoop(timestamp) {
    if (!animationState.isRunning || animationState.planes.length === 0) return;

    let currentIndex = animationState.currentPlaneIndex;
    let p = animationState.planes[currentIndex];

    if (!p.startTime) {
        p.startTime = timestamp;
        p.marker.getElement().style.opacity = 1;
        
        if (!p.segmentCache) {
            const trajectory = buildTrajectoryCache(p.coords);
            p.segmentCache = trajectory.cache;
            p.totalDist = trajectory.totalDist;
            p.currentSegmentIndex = 0;
            p.currentBearing = trajectory.cache[0].bearing; // 初始化飛機陀螺儀
            p.lastLineUpdate = 0; // 用來控制畫線頻率的計時器
        }
    }

    const totalDurationMs = p.flightHours * TIME_SCALE;
    let progress = (timestamp - p.startTime) / totalDurationMs;

    if (progress < 1) {
        const currentDist = progress * p.totalDist;
        
        // 1. 快速尋找目前所在的航段 (O(1) 效能尋址)
        let segIdx = p.currentSegmentIndex || 0;
        while (segIdx < p.segmentCache.length - 1 && currentDist > p.segmentCache[segIdx].endDist) {
            segIdx++;
        }
        p.currentSegmentIndex = segIdx;

        const activeSeg = p.segmentCache[segIdx];
        
        let segmentProgress = 0;
        if (activeSeg.length > 0) {
            segmentProgress = (currentDist - activeSeg.startDist) / activeSeg.length;
        }

        // 2. 輕量級 LERP：計算飛機當下的平滑座標 (60 FPS)
        const smoothLng = activeSeg.p1[0] + (activeSeg.p2[0] - activeSeg.p1[0]) * segmentProgress;
        const smoothLat = activeSeg.p1[1] + (activeSeg.p2[1] - activeSeg.p1[1]) * segmentProgress;
        
        // 3. ✈️ 飛機本體陀螺儀避震 (過濾 GPS 雜訊)
        let targetPlaneBearing = activeSeg.bearing;
        let planeBDiff = targetPlaneBearing - p.currentBearing;
        while (planeBDiff > 180) planeBDiff -= 360;
        while (planeBDiff < -180) planeBDiff += 360;
        // 讓飛機轉向平滑過渡 (0.1 的靈敏度)
        p.currentBearing += planeBDiff * 0.1; 
        
        p.marker.setLngLat([smoothLng, smoothLat]); 
        // 1. 計算預期側傾角 (目標轉向差 * 放大係數)
        // 轉彎越急，planeBDiff 越大，飛機傾斜就越深
        let targetRoll = planeBDiff * 12; 

        // 2. 限制最大側傾角，避免飛機翻肚 (限制在正負 55 度內)
        targetRoll = Math.max(-55, Math.min(55, targetRoll));

        // 3. 側傾角 LERP 平滑過渡 (讓壓車和回正的動作像真實物理一樣柔和)
        p.currentRoll = p.currentRoll || 0;
        p.currentRoll += (targetRoll - p.currentRoll) * 0.08;

        // 4. 套用雙軸 3D 旋轉 (Z軸管航向，Y軸管側傾)
        // 注意：SVG 機頭已經是正的，所以不需要再 -45 度了！
        p.icon.style.transform = `rotateZ(${p.currentBearing}deg) rotateY(${p.currentRoll}deg)`;
        // 如果在機隊模式(renderFleet)中，變數可能是 p.el.style.transform 

        // 🎥 4. 終極避震運鏡：虛擬攝影機物理學 (60 FPS)
        if (cinematicMode && followedPlaneObj === p) {
            const targetLng = smoothLng;
            const targetLat = smoothLat;
            // 攝影機追蹤飛機「平滑化後」的航向
            const targetCamBearing = p.currentBearing; 
            const targetPitch = 65;
            const targetZoom = 6.5;

            cinematicCamera.lng += (targetLng - cinematicCamera.lng) * 0.1;
            cinematicCamera.lat += (targetLat - cinematicCamera.lat) * 0.1;

            let camBDiff = targetCamBearing - cinematicCamera.bearing;
            while (camBDiff > 180) camBDiff -= 360;
            while (camBDiff < -180) camBDiff += 360;
            cinematicCamera.bearing += camBDiff * 0.03; // 更重的攝影機阻尼

            cinematicCamera.pitch += (targetPitch - cinematicCamera.pitch) * 0.05;
            cinematicCamera.zoom += (targetZoom - cinematicCamera.zoom) * 0.05;

            map.jumpTo({
                center: [cinematicCamera.lng, cinematicCamera.lat],
                bearing: cinematicCamera.bearing,
                pitch: cinematicCamera.pitch,
                zoom: cinematicCamera.zoom
            });
        }

        // 🟢 5. 軌跡線繪製「效能節流」 (Throttle) - 解決地震的絕對關鍵！
        // 限制每 100 毫秒 (約 10 FPS) 才向 GPU 更新一次線條
        if (timestamp - p.lastLineUpdate > 100) {
            p.lastLineUpdate = timestamp;
            if (map.getSource(p.id)) {
                const drawnCoords = p.coords.slice(0, segIdx + 1);
                drawnCoords.push([smoothLng, smoothLat]);
                
                map.getSource(p.id).setData({ 
                    'type': 'FeatureCollection', 
                    'features': [ { 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': drawnCoords } } ] 
                });
            }
        }
        
    } else {
        if (map.getSource(p.id)) {
            map.getSource(p.id).setData({ 
                'type': 'FeatureCollection', 
                'features': [ { 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': p.coords } } ] 
            });
        }
        p.marker.getElement().style.opacity = 0;
        
        animationState.currentPlaneIndex++;
        
        if (animationState.currentPlaneIndex >= animationState.planes.length) {
            animationState.currentPlaneIndex = 0;
            animationState.planes.forEach(plane => {
                plane.startTime = null;
                plane.segmentCache = null;
                plane.currentBearing = null;
                if (map.getSource(plane.id)) {
                    map.getSource(plane.id).setData({ 'type': 'FeatureCollection', 'features': [] });
                }
            });
        }
    }

    requestAnimationFrame(globalAnimationLoop);
}
window.focusFlightRoute = function(routeId, origin, dest) {
    try {
        const o = airportDB[origin];
        const d = airportDB[dest];
        if (!o || !d || !o.coords || !d.coords) return;

        const pIndex = parseInt(routeId.split('-')[1]);
        followedPlaneObj = animationState.planes[pIndex];

        if (map.getStyle()) map.getStyle().layers.forEach(l => { if (l.id.startsWith('r-') && l.id.endsWith('-line')) map.setPaintProperty(l.id, 'line-width', 3); });
        if (map.getLayer(`${routeId}-line`)) map.setPaintProperty(`${routeId}-line`, 'line-width', 8); 
        
        // 🎥 啟動電影模式，並將虛擬攝影機初始化為「地圖當下的狀態」
        cinematicMode = true;
        cinematicCamera.lng = map.getCenter().lng;
        cinematicCamera.lat = map.getCenter().lat;
        cinematicCamera.bearing = map.getBearing();
        cinematicCamera.pitch = map.getPitch();
        cinematicCamera.zoom = map.getZoom();
        
        document.getElementById('db-status').innerHTML = '🎥 電影運鏡 Cinematic <span class="text-xs text-sky-400 ml-2 animate-pulse">Tracking</span>';
    } catch (e) {
        console.warn('無法聚焦此航線', e);
    }
};

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
document.getElementById('flightForm').addEventListener('change', window.smartSplitFlight);

window.openAddModal = () => { editingFlightId = null; document.getElementById('flightForm').reset(); document.getElementById('submitBtn').innerText = '儲存 Save'; document.querySelector('#addFlightModal h2').innerText = '新增航班 Add Flight'; toggleModal('addFlightModal'); };

window.deleteFlightHandler = async (id) => { if(await deleteFlight(id)) fetchFlights(); };

window.editFlight = (id) => {
    const f = flightsState.find(f => String(f.id) === String(id)); 
    if(!f) return; 
    
    editingFlightId = f.id; 
    const sVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
    sVal('inp-date', f.flight_date); sVal('inp-takeoff', f.takeoff_time); sVal('inp-landing', f.landing_time);
    sVal('inp-origin', f.origin_code); sVal('inp-dest', f.dest_code); sVal('inp-airline', f.airline); sVal('inp-flight-number', f.flight_number); sVal('inp-type', f.aircraft_type);
    sVal('inp-seat-class', f.seat_class); sVal('inp-seat-type', f.seat_type); sVal('inp-seat', f.seat);
    const exitRowEl = document.getElementById('inp-exit-row'); if(exitRowEl) exitRowEl.checked = f.is_exit_row || false;
    
    document.getElementById('submitBtn').innerText = '更新 Update'; 
    document.querySelector('#addFlightModal h2').innerText = '編輯航班 Edit Flight';
    toggleModal('addFlightModal');
};

window.submitFlight = async (e) => {
    e.preventDefault();
    const originInput = document.getElementById('inp-origin').value.toUpperCase(), destInput = document.getElementById('inp-dest').value.toUpperCase();
    if (!airportDB[originInput] || !airportDB[destInput]) return alert('找不到機場代碼');
    const btn = document.getElementById('submitBtn'); btn.innerText = '處理中...'; btn.disabled = true;

    const takeoffTime = document.getElementById('inp-takeoff').value, landingTime = document.getElementById('inp-landing').value;
    let flightHours = null;
    if (takeoffTime && landingTime) {
        let [tH, tM] = takeoffTime.split(':').map(Number), [lH, lM] = landingTime.split(':').map(Number);
        let tMins = tH * 60 + tM, lMins = lH * 60 + lM;
        if (lMins <= tMins) lMins += 24 * 60; 
        flightHours = parseFloat(((lMins - tMins) / 60).toFixed(1));
    } else {
        flightHours = parseFloat(((turf.distance(airportDB[originInput].coords, airportDB[destInput].coords, {units: 'kilometers'}) / 850) + 0.5).toFixed(1));
    }

    const payload = { flight_date: document.getElementById('inp-date').value || null, takeoff_time: takeoffTime || null, landing_time: landingTime || null, origin_code: originInput, dest_code: destInput, airline: document.getElementById('inp-airline').value || null, flight_number: document.getElementById('inp-flight-number').value || null, seat: document.getElementById('inp-seat').value.toUpperCase() || null, seat_class: document.getElementById('inp-seat-class').value || null, seat_type: document.getElementById('inp-seat-type').value || null, is_exit_row: document.getElementById('inp-exit-row').checked, aircraft_type: document.getElementById('inp-type').value || null, flight_hours: flightHours };
    await saveFlight(payload, editingFlightId); btn.disabled = false; btn.innerText = '儲存 Save'; toggleModal('addFlightModal'); fetchFlights();
};

window.exportCSV = exportCSV; window.importCSV = importCSV;
function exportCSV() {
    if (!flightsState.length) return alert('尚無資料');
    const headers = ['flight_date','origin_code','dest_code','airline','flight_number','aircraft_type','takeoff_time','landing_time','seat_class','seat_type','seat','is_exit_row'];
    const rows = flightsState.map(f => headers.map(h => `"${f[h]??''}"`).join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'flights.csv'; a.click();
}

function importCSV(event) {
    const file = event.target.files[0]; if (!file) return;
    alert('匯入功能尚未實作');
}

let fleetAnimationId = null;
let isFleetRadarOn = false;
let fleetPlanes = [];

window.toggleFleetRadar = function() {
    isFleetRadarOn = !isFleetRadarOn;
    const btn = document.getElementById('btn-fleet-radar');

    if (isFleetRadarOn) {
        btn.innerHTML = '🟢 關閉機隊雷達';
        btn.classList.replace('text-gray-300', 'text-green-400');
        startFleetRadar();
    } else {
        btn.innerHTML = '🛸 啟動全機隊雷達';
        btn.classList.replace('text-green-400', 'text-gray-300');
        stopFleetRadar();
    }
};

function startFleetRadar() {
    stopFleetRadar();
    fleetPlanes = [];

    if (!map.getSource('fleet-routes')) {
        map.addSource('fleet-routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
            'id': 'fleet-routes-layer',
            'type': 'line',
            'source': 'fleet-routes',
            'paint': { 'line-color': '#38bdf8', 'line-width': 1, 'line-opacity': 0.2 }
        });
    }

    const validFlights = flightsState.filter(f => f.origin_code && f.dest_code && airportDB[f.origin_code] && airportDB[f.dest_code]);
    const routeFeatures = [];

    validFlights.forEach((f) => {
        const orig = airportDB[f.origin_code];
        const dest = airportDB[f.dest_code];
        
        const route = turf.greatCircle(orig.coords, dest.coords);
        const lineDistance = turf.length(route);
        const coords = [];
        for (let d = 0; d <= lineDistance; d += lineDistance / 250) {
            coords.push(turf.along(route, d).geometry.coordinates);
        }
        coords.push(dest.coords);
        routeFeatures.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } });

        const el = document.createElement('div');
        // 啟用 3D 透視視角
        el.style.transformStyle = 'preserve-3d';
        el.style.perspective = '150px'; 

        // 繪製高精度 SVG 機體
        el.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" style="filter: drop-shadow(0px 8px 5px rgba(0,0,0,0.6));">
                <path fill="#38bdf8" d="M21,16v-2l-8-5V3.5C13,2.67,12.33,2,11.5,2S10,2.67,10,3.5V9l-8,5v2l8-2.5V19l-2,1.5V22l3.5-1l3.5,1v-1.5L13,19v-5.5L21,16z"/>
            </svg>
            `;
        
        // 1. 只宣告這一次
        const marker = new mapboxgl.Marker({ element: el }).setLngLat(orig.coords).addTo(map);
        const duration = ((lineDistance / 850) + 0.5) * 2000;
        const planeLineString = turf.lineString(coords);
        
        // 2. 建立物件並 push 進陣列
        const planeObj = { marker: marker, el: el, lineString: planeLineString, totalDist: lineDistance, duration: duration, progress: Math.random() };
        fleetPlanes.push(planeObj);

        // 3. 綁定點擊事件與運鏡
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            new mapboxgl.Popup({ closeButton: false })
                .setLngLat(orig.coords)
                .setHTML(`
                    <div class="min-w-[150px]">
                        <div class="font-black text-lg text-sky-400">${f.airline || ''} ${f.flight_number || ''}</div>
                        <div class="text-[10px] text-gray-400 border-b border-white/10 pb-1 mb-2">${f.flight_date || 'Unknown Date'}</div>
                        <div class="grid grid-cols-2 gap-2 text-xs font-bold">
                            <div class="text-gray-500">Route</div><div class="text-right text-white">${f.origin_code} ✈️ ${f.dest_code}</div>
                            <div class="text-gray-500">Distance</div><div class="text-right text-white">${Math.round(lineDistance)} km</div>
                        </div>
                    </div>
                `).addTo(map);
                
            // 🎥 啟動電影模式，並將虛擬攝影機初始化
            cinematicMode = true;
            followedPlaneObj = planeObj;
            cinematicCamera.lng = map.getCenter().lng;
            cinematicCamera.lat = map.getCenter().lat;
            cinematicCamera.bearing = map.getBearing();
            cinematicCamera.pitch = map.getPitch();
            cinematicCamera.zoom = map.getZoom();
            
            document.getElementById('db-status').innerHTML = '🎥 電影運鏡 Cinematic <span class="text-xs text-green-400 ml-2 animate-pulse">Fleet Tracking</span>';
        });
    });

    map.getSource('fleet-routes').setData({ type: 'FeatureCollection', features: routeFeatures });

    let lastTime = performance.now();
    function renderFleet(time) {
        const delta = time - lastTime;
        lastTime = time;

        fleetPlanes.forEach(p => {
            p.progress += delta / p.duration;
            if (p.progress >= 1) p.progress = 0;

            // 🚀 全面改用真實地理距離進行動畫
            const currentDist = p.progress * p.totalDist;
            const currentPt = turf.along(p.lineString, currentDist).geometry.coordinates;
            
            // 找前方 5 公里處看方向 (稍微拉長一點讓大機隊轉向更平穩)
            const nextDist = Math.min(currentDist + 5, p.totalDist); 
            const nextPt = turf.along(p.lineString, nextDist).geometry.coordinates;
            const bearing = turf.bearing(currentPt, nextPt);

            p.marker.setLngLat(currentPt);
            p.el.style.transform = `rotateZ(${bearing}deg)`;
            // 🎥 終極避震運鏡：虛擬攝影機物理學
        if (cinematicMode && followedPlaneObj === p) {
            
            // 設定目標預期視角 (請確認這裡的變數名稱與你的迴圈相符)
            const targetLng = currentPt[0];
            const targetLat = currentPt[1];
            const targetBearing = bearing;
            const targetPitch = 65;
            const targetZoom = 6.5;

            // 1. 位置平滑跟隨 (係數 0.1 吸收小顛簸)
            cinematicCamera.lng += (targetLng - cinematicCamera.lng) * 0.1;
            cinematicCamera.lat += (targetLat - cinematicCamera.lat) * 0.1;

            // 2. 航向極致平滑 (解決地震的最主要關鍵，係數 0.02 讓轉向極度穩重)
            let bDiff = targetBearing - cinematicCamera.bearing;
            while (bDiff > 180) bDiff -= 360; // 處理 -180度 到 +180度的切換問題
            while (bDiff < -180) bDiff += 360;
            cinematicCamera.bearing += bDiff * 0.02; 

            // 3. 仰角與縮放平滑過渡 (取代會打架的 map.easeTo)
            cinematicCamera.pitch += (targetPitch - cinematicCamera.pitch) * 0.05;
            cinematicCamera.zoom += (targetZoom - cinematicCamera.zoom) * 0.05;

            // 統一由這裡向 Mapbox 寫入視角，絕不衝突
            map.jumpTo({
                center: [cinematicCamera.lng, cinematicCamera.lat],
                bearing: cinematicCamera.bearing,
                pitch: cinematicCamera.pitch,
                zoom: cinematicCamera.zoom
            });
        }
        });
        fleetAnimationId = requestAnimationFrame(renderFleet);
    }
    fleetAnimationId = requestAnimationFrame(renderFleet);
}

function stopFleetRadar() {
    if (fleetAnimationId) cancelAnimationFrame(fleetAnimationId);
    fleetPlanes.forEach(p => p.marker.remove());
    fleetPlanes = [];
    if (map.getSource('fleet-routes')) {
        map.getSource('fleet-routes').setData({ type: 'FeatureCollection', features: [] });
    }
}
    
window.processCSVTrack = function(event) {
    const fileInput = event.target;
    const flightId = document.getElementById('csv-flight-id').value.trim();
    
    if (!flightId) {
        alert('❌ 請先填寫左側的航班 ID！(可在「近期日誌」的紅色標籤找到)');
        fileInput.value = '';
        return;
    }

    const file = fileInput.files[0];
    if (!file) return;

    const btnTextEl = document.getElementById('csv-upload-btn-text');
    if (btnTextEl) btnTextEl.innerText = '⏳ 解析與寫入中...';

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const text = e.target.result;
            const lines = text.split('\n');
            const coords = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                let lat = null, lon = null, alt = 0;

                const parts = line.split('"');
                if (parts.length >= 3) {
                    const posParts = parts[1].split(',');
                    if (posParts.length >= 2) {
                        lat = parseFloat(posParts[0]);
                        lon = parseFloat(posParts[1]);
                    }
                    const restParts = parts[2].split(',');
                    if (restParts.length > 1) alt = parseFloat(restParts[1]) || 0;
                } 
                else {
                    const nums = line.match(/-?\d+\.\d+/g);
                    if (nums && nums.length >= 2) {
                        lat = parseFloat(nums[0]);
                        lon = parseFloat(nums[1]);
                    }
                }

                if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
                    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                        coords.push([lon, lat, alt]); 
                    }
                }
            }

            if (coords.length < 2) {
                throw new Error("解析失敗：找不到足夠的經緯度座標。請確保檔案是正確的 CSV！");
            }

            let geojson = { type: 'LineString', coordinates: coords };
            try {
                const rawLine = turf.lineString(coords);
                const smoothedLine = turf.bezierSpline(rawLine, { resolution: 10000, sharpness: 0.85 });
                const smoothedCoords = smoothedLine.geometry.coordinates;
                geojson = { type: 'LineString', coordinates: smoothedCoords };
            } catch (e) {
                console.warn("軌跡平滑化失敗，退回原始數據", e);
            }


            const { error, data } = await supabaseClient
                .from('flights')
                .update({ route_geojson: geojson })
                .eq('id', flightId)
                .select(); 

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error(`資料庫中找不到 ID 為 [ ${flightId} ] 的航班！請檢查數字是否打錯。`);
            }

            alert(`🎉 成功解析 ${coords.length} 個軌跡點並永久儲存！地圖即將重整`);
            fetchFlights(); 

        } catch(err) {
            console.error(err);
            alert('❌ 上傳失敗: ' + err.message);
        } finally {
            if (btnTextEl) btnTextEl.innerText = '📂 選擇 CSV 並上傳';
            fileInput.value = ''; 
        }
    };
    
    reader.readAsText(file);
};