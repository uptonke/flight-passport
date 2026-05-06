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
