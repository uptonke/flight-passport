function renderChartsAndLists(stats) {
    renderLegacyLists(stats);
    renderLegacyCharts(stats);
    renderSignalAnalytics(stats);
}

function renderLegacyLists(stats) {
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
}

function renderLegacyCharts(stats) {
    const renderPolar = (ctxId, data, isTakeoff) => {
        destroyChart(ctxId);
        const ctx = document.getElementById(ctxId); if(!ctx) return;
        window[`chart_${ctxId}`] = new Chart(ctx.getContext('2d'), {
            type: 'polarArea',
            data: { labels: Array.from({length:24}, (_,i)=>`${i}:00`), datasets: [{ data: data, backgroundColor: data.map((_, i) => (i>=6 && i<=17) ? (isTakeoff?'rgba(250,204,21,0.6)':'rgba(34,197,94,0.6)') : (isTakeoff?'rgba(56,189,248,0.6)':'rgba(126,87,194,0.6)')), borderWidth: 0 }] },
            options: { plugins: { legend: { display: false } }, scales: { r: { ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.1)' }, angleLines: { color: 'rgba(255,255,255,0.1)' } } } }
        });
    };
    renderPolar('chart-takeoff', stats.takeoffStats, true);
    renderPolar('chart-landing', stats.landingStats, false);

    destroyChart('chart-yearly');
    const yearlyCtx = document.getElementById('chart-yearly');
    if(yearlyCtx) {
        const years = Object.keys(stats.yearlyDist).sort();
        window['chart_chart-yearly'] = new Chart(yearlyCtx.getContext('2d'), {
            type: 'bar',
            data: { labels: years, datasets: [{ label: 'km', data: years.map(y => Math.round(stats.yearlyDist[y])), backgroundColor: 'rgba(250,204,21,0.7)', borderRadius: 4 }] },
            options: baseChartOptions({ indexAxis: 'x', integerY: false, compact: true })
        });
    }

    destroyChart('chart-monthly');
    const monthlyCtx = document.getElementById('chart-monthly');
    if(monthlyCtx) {
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        window['chart_chart-monthly'] = new Chart(monthlyCtx.getContext('2d'), {
            type: 'bar',
            data: { labels: monthNames, datasets: [{ data: stats.monthlyCount, backgroundColor: stats.monthlyCount.map(v => `rgba(56,189,248,${Math.min(0.2 + v * 0.2, 1)})`), borderRadius: 4 }] },
            options: baseChartOptions({ indexAxis: 'x', integerY: true, compact: true })
        });
    }

    renderDonutBreakdown(stats);
}

function renderDonutBreakdown(stats) {
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
            `<div class="flex justify-between items-center py-1"><div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full inline-block" style="background:${classColors[k]||'#555'}"></span><span class="text-gray-300">${k}</span></div><span class="font-bold text-white">${v} <span class="text-gray-500">(${((v/classTotal)*100).toFixed(0)}%)</span></span></div>`
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
            `<div class="flex justify-between items-center py-1"><div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full inline-block" style="background:${seatColors[k]||'#555'}"></span><span class="text-gray-300">${k}</span></div><span class="font-bold text-white">${v} <span class="text-gray-500">(${((v/seatTotal)*100).toFixed(0)}%)</span></span></div>`
        ).join('');
        document.getElementById('stat-exit-row').innerText = stats.seatStats.exitRows;
    }
}

function destroyChart(id) {
    const key = `chart_${id}`;
    if (window[key]) {
        window[key].destroy();
        window[key] = null;
    }
}

function chartPalette(alpha = 1) {
    return {
        sky: `rgba(56,189,248,${alpha})`,
        skySoft: `rgba(56,189,248,${Math.min(alpha, 0.24)})`,
        yellow: `rgba(250,204,21,${alpha})`,
        purple: `rgba(139,92,246,${alpha})`,
        emerald: `rgba(52,211,153,${alpha})`,
        slate: `rgba(148,163,184,${alpha})`,
        whiteSoft: `rgba(255,255,255,${Math.min(alpha, 0.16)})`
    };
}

function baseChartOptions({ indexAxis = 'x', integerY = true, compact = false } = {}) {
    const reduced = window.appMotion && window.appMotion.prefersReducedMotion.matches;
    return {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis,
        animation: reduced ? false : { duration: Math.round((((window.appMotion && window.appMotion.tokens.base) || 0.24) * 1000)), easing: 'easeOutQuart' },
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                borderColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                titleColor: '#fff',
                bodyColor: 'rgba(255,255,255,0.82)',
                padding: 10,
                displayColors: false
            }
        },
        scales: {
            x: {
                grid: { display: false },
                border: { display: false },
                ticks: { color: 'rgba(255,255,255,0.44)', maxRotation: 0, autoSkip: true, font: { size: compact ? 10 : 11 } }
            },
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(255,255,255,0.06)' },
                border: { display: false },
                ticks: { color: 'rgba(255,255,255,0.44)', precision: integerY ? 0 : undefined, font: { size: compact ? 10 : 11 } }
            }
        }
    };
}

function getSignalRangeFlights(timeline, range) {
    if (!timeline || !timeline.length || range === 'ALL') return [...(timeline || [])];
    const daysMap = { '7D': 7, '30D': 30, '1Y': 365 };
    const days = daysMap[range] || 365;
    const toTs = (f) => new Date(`${f.flight_date || '1970-01-01'}T${f.takeoff_time || '00:00'}:00`).getTime();
    const sorted = [...timeline].sort((a,b) => toTs(a) - toTs(b));
    const endTs = toTs(sorted[sorted.length - 1]);
    const startTs = endTs - ((days - 1) * 24 * 60 * 60 * 1000);
    return sorted.filter(f => toTs(f) >= startTs && toTs(f) <= endTs);
}

function buildCadenceBuckets(flights, range) {
    const labelFmt = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
    const monthFmt = new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' });
    const yearFmt = new Intl.DateTimeFormat('en', { year: 'numeric' });
    const toDate = (f) => new Date(`${f.flight_date || '1970-01-01'}T${f.takeoff_time || '00:00'}:00`);
    const buckets = [];
    const map = new Map();
    if (!flights.length) return { labels: [], counts: [], distances: [] };

    const sorted = [...flights].sort((a,b) => toDate(a) - toDate(b));
    const lastDate = toDate(sorted[sorted.length - 1]);
    if (range === '7D' || range === '30D') {
        const span = range === '7D' ? 7 : 30;
        const start = new Date(lastDate);
        start.setHours(0,0,0,0);
        start.setDate(start.getDate() - (span - 1));
        for (let i = 0; i < span; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const key = d.toISOString().slice(0,10);
            map.set(key, { label: labelFmt.format(d), count: 0, dist: 0 });
        }
        sorted.forEach(f => {
            const key = (f.flight_date || '').slice(0,10);
            if (map.has(key)) {
                const entry = map.get(key);
                entry.count += 1;
                entry.dist += Math.round(f.distance || 0);
            }
        });
    } else if (range === '1Y') {
        const anchor = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);
        for (let i = 11; i >= 0; i--) {
            const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            map.set(key, { label: monthFmt.format(d), count: 0, dist: 0 });
        }
        sorted.forEach(f => {
            const key = `${(f.flight_date || '').slice(0,4)}-${(f.flight_date || '').slice(5,7)}`;
            if (map.has(key)) {
                const entry = map.get(key);
                entry.count += 1;
                entry.dist += Math.round(f.distance || 0);
            }
        });
    } else {
        const years = [...new Set(sorted.map(f => (f.flight_date || '').slice(0,4)).filter(Boolean))].sort();
        years.forEach(y => map.set(y, { label: yearFmt.format(new Date(Number(y), 0, 1)), count: 0, dist: 0 }));
        sorted.forEach(f => {
            const key = (f.flight_date || '').slice(0,4);
            if (map.has(key)) {
                const entry = map.get(key);
                entry.count += 1;
                entry.dist += Math.round(f.distance || 0);
            }
        });
    }
    for (const v of map.values()) buckets.push(v);
    return { labels: buckets.map(x => x.label), counts: buckets.map(x => x.count), distances: buckets.map(x => x.dist) };
}

function renderSignalAnalytics(stats) {
    syncSignalRangeButtons();
    const flights = getSignalRangeFlights(stats.timeline, currentSignalRange);
    const buckets = buildCadenceBuckets(flights, currentSignalRange);
    const totalKm = flights.reduce((sum, f) => sum + Math.round(f.distance || 0), 0);
    const totalFlights = flights.length;

    renderSignalCadenceChart(buckets, flights);
    renderSignalDistanceChart(buckets, flights, totalKm);
    renderSignalCarriersChart(flights);
    renderSignalHaulChart(flights);

    if (!totalFlights) {
        setInsight('signal-sub-distance', '選定區間沒有可畫的資料。');
        setInsight('signal-sub-carriers', '航司集中度會在有航班後出現。');
        setInsight('signal-sub-haul', '航程組合會在有航班後出現。');
    }
}

function syncSignalRangeButtons() {
    document.querySelectorAll('.signal-range-btn').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.range === currentSignalRange);
    });
}

function setInsight(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function renderSignalCadenceChart(buckets, flights) {
    destroyChart('chart-signal-cadence');
    const el = document.getElementById('chart-signal-cadence');
    if (!el) return;
    const maxCount = Math.max(...(buckets.counts.length ? buckets.counts : [0]));
    const peakIdx = buckets.counts.findIndex(v => v === maxCount);
    setInsight('signal-sub-cadence', flights.length ? `${flights.length} flights · peak ${buckets.labels[peakIdx] || '--'} with ${maxCount}` : '選定區間沒有航班。');
    window['chart_chart-signal-cadence'] = new Chart(el.getContext('2d'), {
        type: 'line',
        data: {
            labels: buckets.labels,
            datasets: [{
                data: buckets.counts,
                borderColor: chartPalette(0.95).sky,
                backgroundColor: chartPalette(0.18).sky,
                fill: true,
                pointRadius: 0,
                tension: 0.34,
                borderWidth: 2.4
            }]
        },
        options: baseChartOptions({ compact: false, integerY: true })
    });
}

function renderSignalDistanceChart(buckets, flights, totalKm) {
    destroyChart('chart-signal-distance');
    const el = document.getElementById('chart-signal-distance');
    if (!el) return;
    const avg = flights.length ? Math.round(totalKm / flights.length) : 0;
    setInsight('signal-sub-distance', flights.length ? `${totalKm.toLocaleString()} km total · avg ${avg.toLocaleString()} km / flight` : '選定區間沒有里程資料。');
    window['chart_chart-signal-distance'] = new Chart(el.getContext('2d'), {
        type: 'bar',
        data: {
            labels: buckets.labels,
            datasets: [{
                data: buckets.distances,
                backgroundColor: chartPalette(0.85).yellow,
                borderRadius: 10,
                maxBarThickness: 26
            }]
        },
        options: baseChartOptions({ compact: false, integerY: false })
    });
}

function renderSignalCarriersChart(flights) {
    destroyChart('chart-signal-carriers');
    const el = document.getElementById('chart-signal-carriers');
    if (!el) return;
    const counts = {};
    flights.forEach(f => {
        const key = (f.airline || 'N/A').toUpperCase();
        counts[key] = (counts[key] || 0) + 1;
    });
    const rows = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0,5);
    const leader = rows[0];
    const leaderPct = leader && flights.length ? Math.round((leader[1] / flights.length) * 100) : 0;
    setInsight('signal-sub-carriers', leader ? `${leader[0]} leads with ${leader[1]} flights · ${leaderPct}% share` : '選定區間沒有航司資料。');
    window['chart_chart-signal-carriers'] = new Chart(el.getContext('2d'), {
        type: 'bar',
        data: {
            labels: rows.map(([k]) => airlineDB[k] ? `${k}` : k),
            datasets: [{
                data: rows.map(([,v]) => v),
                backgroundColor: rows.map((_, i) => i === 0 ? chartPalette(0.92).sky : chartPalette(0.54).slate),
                borderRadius: 10,
                maxBarThickness: 20
            }]
        },
        options: baseChartOptions({ indexAxis: 'y', compact: false, integerY: true })
    });
}

function renderSignalHaulChart(flights) {
    destroyChart('chart-signal-haul');
    const el = document.getElementById('chart-signal-haul');
    if (!el) return;
    const mix = { 'Short <1500km': 0, 'Medium 1500–4000km': 0, 'Long >4000km': 0 };
    flights.forEach(f => {
        const dist = Number(f.distance || 0);
        if (dist > 4000) mix['Long >4000km'] += 1;
        else if (dist >= 1500) mix['Medium 1500–4000km'] += 1;
        else mix['Short <1500km'] += 1;
    });
    const dominant = Object.entries(mix).sort((a,b) => b[1]-a[1])[0];
    setInsight('signal-sub-haul', dominant && flights.length ? `${dominant[0]} dominates · ${dominant[1]} of ${flights.length} flights` : '選定區間沒有航程資料。');
    window['chart_chart-signal-haul'] = new Chart(el.getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(mix),
            datasets: [{
                data: Object.values(mix),
                backgroundColor: [chartPalette(0.9).emerald, chartPalette(0.84).purple, chartPalette(0.88).yellow],
                borderRadius: 10,
                maxBarThickness: 36
            }]
        },
        options: baseChartOptions({ compact: false, integerY: true })
    });
}
