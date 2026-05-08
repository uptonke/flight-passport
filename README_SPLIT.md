# Flight Log split version

This version keeps the original behavior but splits the front-end into smaller files.

## CSS
- `assets/css/00-base.css`: tokens, map, base panels, scrollbars
- `assets/css/10-ui.css`: tools dropdown, passport nav, year chips, utility actions
- `assets/css/20-dashboard.css`: empty state and dashboard stat cards

## JS
- `assets/js/00-bootstrap-auth.js`: globals, auth, motion loader, airline dictionaries
- `assets/js/10-airports-data.js`: airport DB loading, fetch/save/delete flight data
- `assets/js/20-analytics-dashboard.js`: stats calculation, dashboard render, flight list render
- `assets/js/30-report-charts.js`: charts, passport/report lists, modal toggle helper
- `assets/js/40-map-ui.js`: dashboard UI toggles, Mapbox init, route rendering, animation loop
- `assets/js/50-app-flight-form.js`: app init, add/edit flight form, CSV export stub
- `assets/js/60-fleet-track.js`: fleet radar and route CSV track upload

## 2026-05 UX Velocity Pack

這版一次加入三波 UI/UX：

1. Onboarding / Empty State
   - 空資料狀態改成可操作入口：新增第一筆、匯入 CSV、載入示範資料。
   - Dashboard 加入 insight cards：年度熱度、航點覆蓋、最常搭航司。

2. Recording Velocity
   - Quick Input 支援 command-style：`2026-05-07 TPE-HND BR184 12A`。
   - 新增「複製上一筆」、「建立回程」、「複製指定航班」。
   - CSV 匯入功能已補上，支援常見欄位名稱。
   - 表單改為欄位內驗證，不再只用粗暴 alert。

3. Retrieval / Mobile UX
   - Flight list 新增搜尋與排序：航點、航司、航班號、機型、座位、日期。
   - 手機版 dashboard / 新增航班 modal 改成 bottom-sheet workflow。
   - 新增 toast 狀態提示，成功/失敗回饋更清楚。


## 2026-05-08 Apple-style analytics skin
- Added a new Signal Analytics section with 4 high-signal charts and 7D / 30D / 1Y / All range switching.
- Added insight subtitles for each signal chart.
- Unified motion timing across modals, dashboard drawer, toasts, and list insertion.
- Added prefers-reduced-motion support.
- Reduced glass usage to header chrome + main floating dashboard; other panels now use solid elevated surfaces.
