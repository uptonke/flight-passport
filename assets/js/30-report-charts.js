function renderChartsAndLists(stats) {
    const renderList = (data, id, colorCls, isLogo=false) => {
        const sorted = Object.entries(data).sort((a,b) => b[1]-a[1]); const max = sorted.length ? sorted[0][1] : 1;
        const el = document.getElementById(id); if(!el) return 0;
        el.innerHTML = sorted.map(i => {
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

// Route visibility enhancer for bright satellite/night imagery.
window.addEventListener('DOMContentLoaded', () => {
    const installRouteVisibilityEnhancer = () => {
        if (typeof map === 'undefined' || !map || typeof map.addLayer !== 'function') {
            setTimeout(installRouteVisibilityEnhancer, 50);
            return;
        }
        if (map.__routeVisibilityEnhanced) return;
        map.__routeVisibilityEnhanced = true;

        const originalAddLayer = map.addLayer.bind(map);
        const routeMainPattern = /^r-\d+-line$/;

        const normalStyle = () => {
            const night = typeof isNightMode !== 'undefined' && isNightMode;
            return night
                ? { main: 4.2, shadow: 10, halo: 7.2, shadowOpacity: 0.55, haloOpacity: 0.30, emissive: 1.8 }
                : { main: 3.4, shadow: 7, halo: 5.4, shadowOpacity: 0.28, haloOpacity: 0.16, emissive: 0.8 };
        };

        const makeUnderlay = (layer, suffix, paint) => ({
            id: `${layer.id}-${suffix}`,
            type: 'line',
            source: layer.source,
            ...(layer['source-layer'] ? { 'source-layer': layer['source-layer'] } : {}),
            ...(layer.minzoom !== undefined ? { minzoom: layer.minzoom } : {}),
            ...(layer.maxzoom !== undefined ? { maxzoom: layer.maxzoom } : {}),
            layout: { ...(layer.layout || {}), 'line-join': 'round', 'line-cap': 'round' },
            paint
        });

        const addUnderlaysForLayer = (layer, beforeId = null) => {
            if (!layer || !routeMainPattern.test(layer.id)) return;
            const style = normalStyle();

            const shadowId = `${layer.id}-shadow`;
            if (!map.getLayer(shadowId)) {
                originalAddLayer(makeUnderlay(layer, 'shadow', {
                    'line-color': '#000000',
                    'line-width': style.shadow,
                    'line-opacity': style.shadowOpacity,
                    'line-blur': 0.7,
                    'line-emissive-strength': 0
                }), beforeId || undefined);
            }

            const haloId = `${layer.id}-halo`;
            if (!map.getLayer(haloId)) {
                originalAddLayer(makeUnderlay(layer, 'halo', {
                    'line-color': '#ffffff',
                    'line-width': style.halo,
                    'line-opacity': style.haloOpacity,
                    'line-blur': 1.0,
                    'line-emissive-strength': 1.0
                }), beforeId || undefined);
            }
        };

        const applyRouteVisibility = (focusedRouteId = null) => {
            const style = map.getStyle();
            if (!style || !style.layers) return;
            const base = normalStyle();

            style.layers.forEach(layer => {
                if (!routeMainPattern.test(layer.id)) return;
                const isFocused = focusedRouteId && layer.id === `${focusedRouteId}-line`;
                const mainWidth = isFocused ? Math.max(base.main + 3.8, 8) : base.main;
                const shadowWidth = isFocused ? base.shadow + 6 : base.shadow;
                const haloWidth = isFocused ? base.halo + 5 : base.halo;

                if (map.getLayer(layer.id)) {
                    map.setPaintProperty(layer.id, 'line-width', mainWidth);
                    map.setPaintProperty(layer.id, 'line-opacity', 0.98);
                    map.setPaintProperty(layer.id, 'line-emissive-strength', isFocused ? base.emissive + 0.8 : base.emissive);
                }
                if (map.getLayer(`${layer.id}-shadow`)) {
                    map.setPaintProperty(`${layer.id}-shadow`, 'line-width', shadowWidth);
                    map.setPaintProperty(`${layer.id}-shadow`, 'line-opacity', isFocused ? Math.min(base.shadowOpacity + 0.12, 0.75) : base.shadowOpacity);
                }
                if (map.getLayer(`${layer.id}-halo`)) {
                    map.setPaintProperty(`${layer.id}-halo`, 'line-width', haloWidth);
                    map.setPaintProperty(`${layer.id}-halo`, 'line-opacity', isFocused ? Math.min(base.haloOpacity + 0.18, 0.55) : base.haloOpacity);
                }
            });
        };

        map.addLayer = function(layer, beforeId) {
            if (layer && routeMainPattern.test(layer.id)) {
                addUnderlaysForLayer(layer, beforeId || null);
                const style = normalStyle();
                layer = {
                    ...layer,
                    paint: {
                        ...(layer.paint || {}),
                        'line-width': style.main,
                        'line-opacity': 0.98,
                        'line-emissive-strength': style.emissive
                    }
                };
            }
            return originalAddLayer(layer, beforeId);
        };

        const enhanceExistingRoutes = () => {
            const style = map.getStyle();
            if (!style || !style.layers) return;
            const mains = style.layers.filter(layer => routeMainPattern.test(layer.id));
            mains.forEach(layer => addUnderlaysForLayer(layer, layer.id));
            applyRouteVisibility();
        };

        const originalToggleNightMode = window.toggleNightMode;
        if (typeof originalToggleNightMode === 'function') {
            window.toggleNightMode = function(...args) {
                const result = originalToggleNightMode.apply(this, args);
                requestAnimationFrame(() => applyRouteVisibility());
                return result;
            };
        }

        const originalFocusFlightRoute = window.focusFlightRoute;
        if (typeof originalFocusFlightRoute === 'function') {
            window.focusFlightRoute = function(routeId, origin, dest) {
                const result = originalFocusFlightRoute(routeId, origin, dest);
                requestAnimationFrame(() => applyRouteVisibility(routeId));
                return result;
            };
        }

        enhanceExistingRoutes();
    };

    installRouteVisibilityEnhancer();
});
