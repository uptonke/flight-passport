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
    const q = (currentFlightSearch || '').trim().toUpperCase();
    if (q) {
        filtered = filtered.filter(f => [f.origin_code, f.dest_code, f.airline, f.flight_number, f.aircraft_type, f.seat, f.flight_date]
            .filter(Boolean).join(' ').toUpperCase().includes(q));
    }
    const stats = calculateStats(filtered);
    stats.timeline = sortFlightTimeline(stats.timeline);
    
    renderFilters();
    renderDashboard(stats);
    renderFlightList(stats.timeline);
    renderChartsAndLists(stats);
    renderMapFeatures(stats);
}

function renderFilters() {
    const years = new Set();
    flightsState.forEach(f => {
        if (f.flight_date) years.add(f.flight_date.substring(0, 4));
    });

    let html = `
        <button onclick="filterByYear('ALL')" class="year-chip ${currentYearFilter === 'ALL' ? 'year-chip--active' : ''}">
            ALL
        </button>
    `;

    Array.from(years).sort().reverse().forEach(y => {
        html += `
            <button onclick="filterByYear('${y}')" class="year-chip ${currentYearFilter === y ? 'year-chip--active' : ''}">
                ${y}
            </button>
        `;
    });

    document.getElementById('year-filters').innerHTML = html;
}
window.filterByYear = (y) => { currentYearFilter = y; triggerReactRender(); }

function sortFlightTimeline(timeline) {
    const list = [...timeline];
    const dateScore = f => new Date(`${f.flight_date || '1970-01-01'}T${f.takeoff_time || '00:00'}:00`).getTime();
    if (currentFlightSort === 'date_asc') return list.sort((a,b) => dateScore(a) - dateScore(b));
    if (currentFlightSort === 'distance_desc') return list.sort((a,b) => (b.distance || 0) - (a.distance || 0));
    if (currentFlightSort === 'airline_asc') return list.sort((a,b) => `${a.airline || ''}${a.flight_number || ''}`.localeCompare(`${b.airline || ''}${b.flight_number || ''}`));
    return list.sort((a,b) => dateScore(b) - dateScore(a));
}

function renderDashboard(stats) {
    const setTxt = (id, txt) => {
        const e = document.getElementById(id);
        if (e) e.innerText = txt;
    };

    setTxt('stat-dist', Math.round(stats.totalKm).toLocaleString());
    setTxt('stat-flights', stats.completedFlights);
    setTxt('stat-trips', stats.tripsCount);

    setTxt('sb-long-route', '--');
    renderDashboardInsights(stats);
    setTxt('pp-short-route', '--');
    setTxt('pp-short-dist', '--');
    setTxt('pp-long-route', '--');
    setTxt('pp-long-dist', '--');

    if (stats.completedFlights > 0) {
        setTxt('sb-long-route', `${stats.longest.route} (${Math.round(stats.longest.dist)}km)`);
        if (document.getElementById('pp-short-route')) setTxt('pp-short-route', stats.shortest.route);
        if (document.getElementById('pp-short-dist')) setTxt('pp-short-dist', `${Math.round(stats.shortest.dist).toLocaleString()} km`);
        if (document.getElementById('pp-long-route')) setTxt('pp-long-route', stats.longest.route);
        if (document.getElementById('pp-long-dist')) setTxt('pp-long-dist', `${Math.round(stats.longest.dist).toLocaleString()} km`);
    }

    setTxt('pp-dist', Math.round(stats.totalKm).toLocaleString());
    setTxt('pp-earth', (stats.totalKm / 40075).toFixed(1));
    setTxt('pp-moon', (stats.totalKm / 384400).toFixed(2));

    const eBar = document.getElementById('pp-earth-bar');
    if (eBar) eBar.style.width = `${Math.min((stats.totalKm / 40075) * 100, 100)}%`;

    const mBar = document.getElementById('pp-moon-bar');
    if (mBar) mBar.style.width = `${Math.min((stats.totalKm / 384400) * 100, 100)}%`;

    const avg = stats.completedFlights ? (stats.totalHours / stats.completedFlights) : 0;

    const timeMain = document.getElementById('pp-time-main');
    if (timeMain) {
        timeMain.innerHTML = `${Math.floor(stats.totalHours)}<span class="text-2xl text-gray-500">h</span> ${Math.round((stats.totalHours - Math.floor(stats.totalHours)) * 60)}<span class="text-2xl text-gray-500">m</span>`;
    }

    setTxt('pp-days', (stats.totalHours / 24).toFixed(1));
    setTxt('pp-avg-time', formatTimeString(avg));
    setTxt('pp-in-air', formatTimeString(stats.totalHours));
    setTxt('pp-total-flights-box', stats.completedFlights);
    setTxt('pp-dom', stats.domCount);
    setTxt('pp-int', stats.intCount);
    setTxt('pp-long', stats.longCount);

    setTxt('pp-rep-route', stats.repeatedRoutePct);
    setTxt('pp-avg-flights', stats.avgFlightsPerYear);
    setTxt('pp-timezones', stats.timezonesCrossed);
}
function renderDashboardInsights(stats) {
    const box = document.getElementById('dashboard-insights');
    if (!box) return;
    if (!stats.completedFlights) {
        box.innerHTML = '';
        return;
    }
    const years = Object.keys(stats.yearlyDist).sort();
    const latestYear = years[years.length - 1];
    const latestYearFlights = latestYear ? stats.timeline.filter(f => f.flight_date && f.flight_date.startsWith(latestYear)).length : 0;
    const topAirline = Object.entries(stats.freq.airlines).sort((a,b)=>b[1]-a[1])[0];
    const uniqueAirports = Object.keys(stats.airportStats).length;
    box.innerHTML = `
        <div class="insight-card"><div class="insight-label">Current Year</div><div class="insight-value">${latestYear || '--'} · ${latestYearFlights} flights</div><div class="insight-sub">年度飛行熱度</div></div>
        <div class="insight-card"><div class="insight-label">Network</div><div class="insight-value">${uniqueAirports} airports unlocked</div><div class="insight-sub">航點覆蓋數</div></div>
        <div class="insight-card"><div class="insight-label">Top Carrier</div><div class="insight-value">${topAirline ? `${topAirline[0]} · ${topAirline[1]}x` : '--'}</div><div class="insight-sub">最常搭航司</div></div>`;
}

function renderEmptyFlightState() {
    return `<div class="empty-state-card">
        <div class="text-[11px] uppercase tracking-[0.2em] text-sky-400 font-black">Start fast</div>
        <div class="text-lg font-black mt-1">還沒有符合條件的航班</div>
        <div class="text-xs text-gray-400 mt-2 leading-relaxed">先新增第一筆，或匯入 CSV。資料進來後，地圖、統計、排行會自動生成。</div>
        <div class="empty-state-actions">
            <button class="empty-state-btn" onclick="openAddModal()">＋ 新增第一筆航班</button>
            <label class="empty-state-btn cursor-pointer">⬆ 匯入 CSV <input type="file" accept=".csv" class="hidden" onchange="importCSV(event)"></label>
            <button class="empty-state-btn" onclick="loadDemoFlights()">▣ 載入示範資料</button>
        </div>
    </div>`;
}

function renderFlightList(timeline) {
    const countEl = document.getElementById('recent-log-count');
    if (countEl) {
        countEl.innerText = `${timeline.length} logs`;
    }

    const listEl = document.getElementById('flight-list');
    if (!timeline.length) { listEl.innerHTML = renderEmptyFlightState(); return; }

    listEl.innerHTML = timeline.map((f, i) => {
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
                            <button onclick="event.stopPropagation(); window.duplicateFlight('${f.id}')" class="opacity-50 hover:opacity-100 text-xs ml-1" title="複製">⧉</button>
                            <button onclick="event.stopPropagation(); window.deleteFlightHandler('${f.id}')" class="opacity-50 hover:opacity-100 text-xs ml-1">🗑️</button>
                        </div>
                    </div>
                    <div class="text-[10px] text-gray-400 truncate">${[f.airline, f.flight_number].filter(Boolean).join(' ')} · ${formatTimeString(f.flight_hours)} · ${Math.round(f.distance)}km</div>
                </div>
            </div>`;
    }).join('');

    if (window.appMotion && window.appMotion.enabled() && animate && stagger) {
        animate(".flight-card", { x: [-18, 0], opacity: [0, 1] }, { delay: stagger(0.04), duration: window.appMotion.tokens.base, easing: "ease-out" });
    }
}



document.addEventListener('DOMContentLoaded', () => {
    const search = document.getElementById('flight-search');
    const sort = document.getElementById('flight-sort');
    const signalSwitch = document.getElementById('signal-range-switch');
    if (search) search.addEventListener('input', (e) => { currentFlightSearch = e.target.value || ''; if (isAppInitialized) triggerReactRender(); });
    if (sort) sort.addEventListener('change', (e) => { currentFlightSort = e.target.value || 'date_desc'; if (isAppInitialized) triggerReactRender(); });
    if (signalSwitch) {
        signalSwitch.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-range]');
            if (!btn) return;
            currentSignalRange = btn.dataset.range || '1Y';
            if (isAppInitialized) triggerReactRender();
        });
    }
});
