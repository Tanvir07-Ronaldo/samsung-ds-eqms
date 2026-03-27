<div align="center">

<!-- Samsung Logo - stored locally in repo -->
<img src="docs/samsung-logo.png" width="280" alt="Samsung Electronics" />

<br/>
<br/>

# 삼성 DS EQMS 지진 모니터링 시스템

### Samsung DS — EQMS Earthquake Monitoring System

**Developed by Mohammad Tanvir**
Samsung DS · EQMS Project · [주식회사 두잇](https://www.k-doit.com)

<br/>

![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet.js-Map_Library-199900?style=for-the-badge&logo=leaflet&logoColor=white)
![ASP.NET](https://img.shields.io/badge/ASP.NET_Core-MVC-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)
![License](https://img.shields.io/badge/License-Proprietary-D01B1B?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active-00C853?style=for-the-badge)

</div>

---

## 📌 Overview

This project implements a **directional distance arrow visualization** feature inside the **Samsung DS EQMS** (Earthquake Quality Monitoring System) interactive map interface.

The visualization renders a precise **directional red arrow** from the detected earthquake epicenter to the Samsung DS seismic monitoring station cluster, with a **kilometer-accurate distance label** at the midpoint — giving operations staff an instant, intuitive spatial reference during live seismic events.

> **Mentor:** 심근영 대리님 · **Status:** ✅ Approved · **Date:** 2026-03-09

---

## 🗺️ Output Visualization

<div align="center">
  <img src="docs/output.png" width="640" alt="EQMS Directional Arrow Visualization" />
  <br/>
  <sub>
    Directional red arrow from epicenter <strong>(경북 영양군 남쪽 12km, M2.6)</strong> to Samsung DS monitoring stations — distance label <strong>195km</strong> at midpoint
  </sub>
</div>

---

## 📁 Project Structure

```
samsung-ds-eqms/
│
├── EventAnalysis_ReportForm.js       # Leaflet map controller — arrow & distance visualization
├── EventAnalysis_ReportForm.cshtml   # ASP.NET Core Razor view — EQMS frontend integration
├── README.md
│
└── docs/
    ├── samsung-logo.png              # Samsung Electronics logo
    ├── output.png                    # Final approved visualization screenshot
    └── 일일업무보고서_20260309_EQMS_화살표시각화.pdf   # Daily development report
```

---

## ⚙️ Core Implementation

The arrow visualization is built entirely with **pixel-space vector mathematics** projected back into geographic coordinates via Leaflet's layer point API.

```javascript
// Direction vector calculation
const p1 = map.latLngToLayerPoint(latlngs[0]); // Station
const p2 = map.latLngToLayerPoint(latlngs[1]); // Epicenter
const dx = p2.x - p1.x;
const dy = p2.y - p1.y;
const len = Math.sqrt(dx * dx + dy * dy);
const ux = dx / len; // Unit vector X
const uy = dy / len; // Unit vector Y

// Dynamic arrowhead scaling
const arrowLength = Math.min(len * 0.15, 40);
const arrowWidth  = arrowLength * 0.5;

// Triangle polygon vertices
const tip   = map.layerPointToLatLng(L.point(p2.x, p2.y));
const left  = map.layerPointToLatLng(L.point(p2.x - ux*arrowLength - uy*arrowWidth, p2.y - uy*arrowLength + ux*arrowWidth));
const right = map.layerPointToLatLng(L.point(p2.x - ux*arrowLength + uy*arrowWidth, p2.y - uy*arrowLength - ux*arrowWidth));

L.polygon([tip, left, right], {
  color: 'transparent',
  fillColor: '#D01B1B',
  fillOpacity: 1
}).addTo(map);
```

---

## 🛠️ Tech Stack

| Component | Detail |
|---|---|
| **Language** | JavaScript (ES6+) |
| **Map Library** | Leaflet.js — open-source geospatial rendering |
| **Rendering** | HTML5 Canvas + SVG via Leaflet layer system |
| **PDF Export** | html2canvas + jsPDF |
| **Backend** | ASP.NET Core MVC — Razor view integration |
| **Dev Tools** | Visual Studio + Chrome DevTools |
| **Deploy Target** | Samsung DS EQMS Operations Server |

---

## 🔧 Problems Solved

| # | Problem | Root Cause | Solution |
|---|---|---|---|
| 01 | Arrowhead too large | Fixed ratio of full geographic distance | Applied `Math.min()` pixel cap on `arrowLength` |
| 02 | Arrow overlapping station marker | Polygon tip placed exactly on station coords | Offset tip position backward along unit vector |
| 03 | Extra polyline inside triangle | Polyline endpoint coinciding with polygon vertex | Separated polyline and polygon layers |
| 04 | Line disappearing on edit | Improper mutation of `getLatLngs()` result | Used immutable coordinate copies |
| 05 | Visual imbalance across zoom levels | Arrow, marker, label competing for space | Tuned `arrowWidth` ratio and `divIcon` offsets |

---

## 📅 Development Log

| Date | Milestone | Status |
|---|---|---|
| 2026-03-09 | Baseline analysis — existing EQMS map state | ✅ Done |
| 2026-03-09 | S1 — Initial polyline connection | ✅ Done |
| 2026-03-09 | S2 — Arrowhead + distance label added | ✅ Done |
| 2026-03-09 | S3 — Scaling & artifact fixes, final approval | ✅ **Approved** |
| 2026-03-10 | Code cleanup & production deployment | 🔜 Planned |

---

## 🚀 Deployment Plan

| Phase | Task | Target Date |
|---|---|---|
| P1 | Remove debug code, clean `console.log` statements | 2026-03-10 |
| P2 | Final code review by 심근영 대리님 | 2026-03-10 |
| P3 | Merge feature branch into main EQMS codebase | 2026-03-10 |
| P4 | Deploy to Samsung DS EQMS production server | 2026-03-10 |
| P5 | Validate with live seismic event data | 2026-03-11 |

---

<div align="center">

**Mohammad Tanvir** · Engineering Team · Samsung DS EQMS Project

*Samsung DS — EQMS Development Report · 대외비 (Confidential)*

</div>