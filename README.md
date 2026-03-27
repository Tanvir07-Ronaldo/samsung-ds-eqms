<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg" width="300"/>
</p>

<h1 align="center">지진 데이터 통합 과제</h1>
<h3 align="center">Earthquake Data Integration Project</h3>
<p align="center">Developed by Mohammad Tanvir</p>
<p align="center">Samsung DS — EQMS Earthquake Monitoring System</p>

---

## 📌 Overview

This project implements a **directional distance arrow visualization** inside the Samsung DS **EQMS (Earthquake Monitoring System)** interactive map. The arrow visually connects detected seismic epicenter coordinates to Samsung DS monitoring station locations, showing direction and distance in kilometers.

Built with **Leaflet.js** on an **ASP.NET Core MVC** backend.

---

## ⚙️ Key Features

- Directional Arrow Rendering — Red polyline + triangle arrowhead
- Dynamic Arrow Scaling — prevents oversized arrowheads at long distances
- Midpoint Distance Label — shows km distance at the line midpoint
- Artifact-Free Geometry — no internal line segments inside arrowhead
- Multi-zoom Stable — tested from 5km to 2,000km range

---

## 🗺️ Core Arrow Logic
```javascript
const latlngs = polyline.getLatLngs();
const p1 = map.latLngToLayerPoint(latlngs[0]);
const p2 = map.latLngToLayerPoint(latlngs[1]);
const dx = p2.x - p1.x;
const dy = p2.y - p1.y;
const len = Math.sqrt(dx * dx + dy * dy);
const ux = dx / len;
const uy = dy / len;

const arrowLength = Math.min(len * 0.15, 40);
const arrowWidth  = arrowLength * 0.5;

L.polygon([tip, left, right], {
  color: 'transparent',
  fillColor: '#D01B1B',
  fillOpacity: 1
}).addTo(map);
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Map Library | Leaflet.js |
| Language | JavaScript ES6+ |
| Backend | ASP.NET Core MVC |
| PDF Export | html2canvas + jsPDF |

---

## 📄 Daily Development Report

📥 [View Full Report — 2026-03-09](./일일업무보고서_20260309_EQMS_화살표시각화.pdf)

---

## 👤 Developer

**Mohammad Tanvir** —Software Engineering Team, Samsung DS EQMS Project  
Mentor: 심근영 대리님 — Samsung DS