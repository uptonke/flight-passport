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

        // 抓取航司顏色，找不到就給預設的天空藍
        const airColor = (f.airline && airlineColors[f.airline]) ? airlineColors[f.airline] : '#38bdf8';
        
        // 繪製高精度 SVG 雙色機體
        el.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" style="filter: drop-shadow(0px 8px 5px rgba(0,0,0,0.6));">
                <path fill="#ffffff" d="M11.5,2 C12.33,2 13,2.67 13,3.5 V19 L11.5,22 L10,19 V3.5 C10,2.67 10.67,2 11.5,2 Z"/>
                <path fill="${airColor}" d="M21,16 v-2 l-8-5 v1.5 l8,5.5 Z M3,16 v-2 l8-5 v1.5 l-8,5.5 Z"/>
                <path fill="${airColor}" d="M13,19 v1 l2.5,1.5 v0.5 l-4,-1.5 l-4,1.5 v-0.5 l2.5,-1.5 v-1 Z"/>
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