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

const ROUTE_ANIMATION_MODE_DRAW = 'draw';
const ROUTE_ANIMATION_MODE_ALL = 'all';
let routeAnimationMode = ROUTE_ANIMATION_MODE_DRAW;

function ensureRouteAnimationModeButton() {
    if (document.getElementById('btn-route-animation-mode')) return;

    const toolsGrid = document.querySelector('.tools-dropdown .grid');
    if (!toolsGrid) return;

    const btn = document.createElement('button');
    btn.id = 'btn-route-animation-mode';
    btn.type = 'button';
    btn.onclick = () => window.toggleRouteAnimationMode();
    btn.className = 'text-xs font-bold transition-colors text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10';

    const fleetBtn = document.getElementById('btn-fleet-radar');
    if (fleetBtn && fleetBtn.parentElement === toolsGrid && fleetBtn.nextSibling) {
        toolsGrid.insertBefore(btn, fleetBtn.nextSibling);
    } else {
        toolsGrid.prepend(btn);
    }

    updateRouteAnimationModeButton();
}

function updateRouteAnimationModeButton() {
    const btn = document.getElementById('btn-route-animation-mode');
    if (!btn) return;

    const isAllRoutesMode = routeAnimationMode === ROUTE_ANIMATION_MODE_ALL;
    btn.innerText = isAllRoutesMode ? '🟢 航線動畫：全線常駐' : '✏️ 航線動畫：邊飛邊畫';
    btn.title = isAllRoutesMode
        ? '所有軌跡線條同時呈現，所有飛機同時在線上循環飛行'
        : '一次一架飛機沿軌跡飛行，飛過去的同時逐步畫線';
    btn.classList.toggle('text-green-400', isAllRoutesMode);
    btn.classList.toggle('text-purple-300', !isAllRoutesMode);
}

window.toggleRouteAnimationMode = function() {
    routeAnimationMode = routeAnimationMode === ROUTE_ANIMATION_MODE_DRAW
        ? ROUTE_ANIMATION_MODE_ALL
        : ROUTE_ANIMATION_MODE_DRAW;

    updateRouteAnimationModeButton();
    resetRouteAnimationMode();
};

function makeRouteFeature(coords) {
    return { 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': coords } };
}

function setRouteSourceData(routeId, coords, drawFullLine) {
    if (!map.getSource(routeId)) return;

    map.getSource(routeId).setData({
        'type': 'FeatureCollection',
        'features': drawFullLine ? [makeRouteFeature(coords)] : []
    });
}

function resetRouteAnimationMode() {
    if (!animationState || !animationState.planes) return;

    animationState.currentPlaneIndex = 0;
    animationState.allRoutesStartTime = null;
    cinematicMode = false;
    followedPlaneObj = null;

    const planeCount = Math.max(animationState.planes.length, 1);
    animationState.planes.forEach((plane, index) => {
        plane.startTime = null;
        plane.segmentCache = null;
        plane.totalDist = null;
        plane.currentSegmentIndex = 0;
        plane.currentBearing = null;
        plane.currentRoll = 0;
        plane.lastLineUpdate = 0;
        plane.fullLineDrawn = routeAnimationMode === ROUTE_ANIMATION_MODE_ALL;
        plane.allRoutesOffsetRatio = index / planeCount;
        plane.marker.getElement().style.opacity = routeAnimationMode === ROUTE_ANIMATION_MODE_ALL ? 1 : 0;
        plane.marker.setLngLat(plane.coords[0]);
        setRouteSourceData(plane.id, plane.coords, routeAnimationMode === ROUTE_ANIMATION_MODE_ALL);
    });

    const status = document.getElementById('db-status');
    if (status) {
        status.innerHTML = routeAnimationMode === ROUTE_ANIMATION_MODE_ALL
            ? '系統上線 Online <span class="text-xs text-green-400 ml-2">全線常駐模式</span>'
            : '系統上線 Online <span class="text-xs text-purple-300 ml-2">邊飛邊畫模式</span>';
    }

    if (!animationState.isRunning && animationState.planes.length > 0) {
        animationState.isRunning = true;
        requestAnimationFrame(globalAnimationLoop);
    }
}

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

    ensureRouteAnimationModeButton();
    updateRouteAnimationModeButton();
    
    if (isAppInitialized) {
        triggerReactRender();
    }
});

function renderMapFeatures(stats) {
    ensureRouteAnimationModeButton();

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
    animationState.allRoutesStartTime = null;

    const planeCount = Math.max(stats.timeline.length, 1);
    stats.timeline.forEach((f, i) => {
        const routeId = `r-${i}`;
        const shouldDrawFullLine = routeAnimationMode === ROUTE_ANIMATION_MODE_ALL;
        map.addSource(routeId, { 'type': 'geojson', 'data': { 'type': 'FeatureCollection', 'features': shouldDrawFullLine ? [makeRouteFeature(f.routeCoords)] : [] } });
        map.addLayer({ 'id': `${routeId}-line`, 'type': 'line', 'source': routeId, 'layout': { 'line-join': 'round', 'line-cap': 'round' }, 'paint': { 'line-color': f.routeColor, 'line-width': 3, 'line-opacity': 0.85 } });
        
        const elContainer = document.createElement('div'); 
        const planeIcon = document.createElement('div');

        // 啟用 3D 透視視角
        planeIcon.style.transformStyle = 'preserve-3d';
        planeIcon.style.perspective = '150px'; 

        // 抓取航司顏色，找不到就退回航線預設顏色
        const airColor = (f.airline && airlineColors[f.airline]) ? airlineColors[f.airline] : f.routeColor;

        // 🚀 雙色塗裝：白底機身 + 航司專屬色點綴 (機翼、尾翼)
        planeIcon.innerHTML = `
            <svg viewBox="0 0 24 24" width="28" height="28" style="filter: drop-shadow(0px 15px 10px rgba(0,0,0,0.6)) drop-shadow(0px 0px 8px ${airColor});">
                <path fill="#ffffff" d="M11.5,2 C12.33,2 13,2.67 13,3.5 V19 L11.5,22 L10,19 V3.5 C10,2.67 10.67,2 11.5,2 Z"/>
                <path fill="${airColor}" d="M21,16 v-2 l-8-5 v1.5 l8,5.5 Z M3,16 v-2 l8-5 v1.5 l-8,5.5 Z"/>
                <path fill="${airColor}" d="M13,19 v1 l2.5,1.5 v0.5 l-4,-1.5 l-4,1.5 v-0.5 l2.5,-1.5 v-1 Z"/>
            </svg>
        `;
        elContainer.appendChild(planeIcon);
        const planeMarker = new mapboxgl.Marker({ 
            element: elContainer,
            pitchAlignment: 'map',    // 讓機身貼齊 3D 地平線，而不是貼齊使用者的螢幕
            rotationAlignment: 'map'  // 讓旋轉的 0 度永遠指向正北，而非螢幕正上方
        }).setLngLat(f.routeCoords[0]).addTo(map);
        planeMarker.getElement().style.opacity = shouldDrawFullLine ? 1 : 0;
        const actualHours = f.flight_hours || ((f.distance / 850) + 0.5);
        animationState.planes.push({
            id: routeId,
            marker: planeMarker,
            icon: planeIcon,
            coords: f.routeCoords,
            flightHours: actualHours,
            startTime: null,
            allRoutesOffsetRatio: i / planeCount,
            fullLineDrawn: shouldDrawFullLine
        });
    });

    updateRouteAnimationModeButton();

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
        accumulatedDist = 0.1;
    }
    return { cache, totalDist: accumulatedDist || 0.1 };
}

function ensurePlaneTrajectory(p) {
    if (p.segmentCache) return;

    const trajectory = buildTrajectoryCache(p.coords);
    p.segmentCache = trajectory.cache;
    p.totalDist = trajectory.totalDist;
    p.currentSegmentIndex = 0;
    p.currentBearing = trajectory.cache[0].bearing;
    p.lastLineUpdate = 0;
    p.currentRoll = p.currentRoll || 0;
}

function updatePlaneMotion(p, progress, timestamp, shouldDrawProgressLine) {
    ensurePlaneTrajectory(p);

    const currentDist = Math.max(0, Math.min(1, progress)) * p.totalDist;
    let segIdx = p.currentSegmentIndex || 0;

    if (currentDist < p.segmentCache[segIdx].startDist) segIdx = 0;
    while (segIdx < p.segmentCache.length - 1 && currentDist > p.segmentCache[segIdx].endDist) {
        segIdx++;
    }
    p.currentSegmentIndex = segIdx;

    const activeSeg = p.segmentCache[segIdx];
    let segmentProgress = 0;
    if (activeSeg.length > 0) {
        segmentProgress = (currentDist - activeSeg.startDist) / activeSeg.length;
    }
    segmentProgress = Math.max(0, Math.min(1, segmentProgress));

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
    if (shouldDrawProgressLine && timestamp - p.lastLineUpdate > 100) {
        p.lastLineUpdate = timestamp;
        if (map.getSource(p.id)) {
            const drawnCoords = p.coords.slice(0, segIdx + 1);
            drawnCoords.push([smoothLng, smoothLat]);
            
            map.getSource(p.id).setData({ 
                'type': 'FeatureCollection', 
                'features': [makeRouteFeature(drawnCoords)] 
            });
        }
    }
}

function runAllRoutesAnimation(timestamp) {
    if (!animationState.allRoutesStartTime) {
        animationState.allRoutesStartTime = timestamp;
    }

    const planeCount = Math.max(animationState.planes.length, 1);
    animationState.planes.forEach((p, index) => {
        ensurePlaneTrajectory(p);

        if (!p.fullLineDrawn) {
            setRouteSourceData(p.id, p.coords, true);
            p.fullLineDrawn = true;
        }

        p.marker.getElement().style.opacity = 1;
        const totalDurationMs = Math.max((p.flightHours || 1) * TIME_SCALE, 1);
        const offsetRatio = p.allRoutesOffsetRatio ?? (index / planeCount);
        const elapsed = (timestamp - animationState.allRoutesStartTime) + (totalDurationMs * offsetRatio);
        const progress = (elapsed % totalDurationMs) / totalDurationMs;
        updatePlaneMotion(p, progress, timestamp, false);
    });
}

// 🚀 完整替換：主畫面動畫引擎 (搭載效能節流與雙重避震)
function globalAnimationLoop(timestamp) {
    if (!animationState.isRunning || animationState.planes.length === 0) return;

    if (routeAnimationMode === ROUTE_ANIMATION_MODE_ALL) {
        runAllRoutesAnimation(timestamp);
        requestAnimationFrame(globalAnimationLoop);
        return;
    }

    let currentIndex = animationState.currentPlaneIndex;
    let p = animationState.planes[currentIndex];

    if (!p.startTime) {
        p.startTime = timestamp;
        p.marker.getElement().style.opacity = 1;
        ensurePlaneTrajectory(p);
    }

    const totalDurationMs = Math.max((p.flightHours || 1) * TIME_SCALE, 1);
    let progress = (timestamp - p.startTime) / totalDurationMs;

    if (progress < 1) {
        updatePlaneMotion(p, progress, timestamp, true);
    } else {
        // 飛機已抵達目的地
        if (map.getSource(p.id)) {
            map.getSource(p.id).setData({ 
                'type': 'FeatureCollection', 
                'features': [makeRouteFeature(p.coords)] 
            });
        }
        p.marker.getElement().style.opacity = 0;
        
        // 🎥 記下我們剛剛是不是正在看這架飛機
        let wasFollowing = (cinematicMode && followedPlaneObj === p);
        
        // 切換到時間軸的下一架飛機
        animationState.currentPlaneIndex++;
        
        if (animationState.currentPlaneIndex >= animationState.planes.length) {
            // 所有航班都飛完了，重置循環
            animationState.currentPlaneIndex = 0;
            animationState.planes.forEach(plane => {
                plane.startTime = null;
                plane.segmentCache = null;
                plane.currentBearing = null;
                plane.currentRoll = 0;
                if (map.getSource(plane.id)) {
                    map.getSource(plane.id).setData({ 'type': 'FeatureCollection', 'features': [] });
                }
            });
            // 結束電影跟隨模式
            if (wasFollowing) {
                cinematicMode = false;
                followedPlaneObj = null;
                document.getElementById('db-status').innerHTML = '系統上線 Online <span class="text-xs text-gray-500 ml-2">所有航程結束</span>';
            }
        } else {
            // 🚀 核心升級：自動切換鏡頭到下一架飛機 (無縫接軌)
            if (wasFollowing) {
                followedPlaneObj = animationState.planes[animationState.currentPlaneIndex];
                document.getElementById('db-status').innerHTML = '🎥 電影運鏡 Cinematic <span class="text-xs text-sky-400 ml-2 animate-pulse">Auto Tracking Next...</span>';
                // 這裡我們不硬性重置攝影機，讓原本的避震器 LERP 演算法，自動從上一架的目的地「滑順地飛越地球」到下一架的出發地！
            }
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
        
        const trackingLabel = routeAnimationMode === ROUTE_ANIMATION_MODE_ALL ? 'All Routes Tracking' : 'Tracking';
        document.getElementById('db-status').innerHTML = `🎥 電影運鏡 Cinematic <span class="text-xs text-sky-400 ml-2 animate-pulse">${trackingLabel}</span>`;
    } catch (e) {
        console.warn('無法聚焦此航線', e);
    }
};
