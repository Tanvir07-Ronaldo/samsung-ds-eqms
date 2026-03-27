
window.onload = async function () {
  InitTotalDataLoad();
}

let usgsMap;
let usgsTiles;

var GlobalFromLon = 0;
var GlobalFromLat = 0;
var GlobalToLat = 0;
var SCSLat = 34.10901;
var SCSLon = 108.80528;

// USGS 베이스맵 레이어 모음
let usgsBaseLayers;

// 베이스맵 순환 순서 (키 목록)
// topo, imageryTopo, imageryOnly, shadedRelief, hydro 만 사용
// usaTopo 는 상용 라이센스 이슈가 있어 주석 처리
const usgsBaseOrder = [
  'topo',
  'imageryTopo',
  'imageryOnly',
  'shadedRelief',
  'hydro',
  /*'usaTopo' 상용 라이센스 문제 있음 */
];

// 현재 선택된 베이스맵 인덱스와 키
let currentBaseIndex = 0;        // 기본값: imageryTopo가 0번
let currentBaseKey = usgsBaseOrder[currentBaseIndex];


// 화면에 표시할 지도 이름 (베이스맵 키 -> 사용자용 문자열)
const usgsBaseNames = {
  topo: '1. USGS Topo',
  imageryTopo: '2. USGS Imagery + Topo',
  imageryOnly: '3. USGS Imagery Only',
  shadedRelief: '4. USGS Shaded Relief',
  hydro: '5. USGS Hydro',
  usaTopo: '6. Esri USA Topo'
};




// 관측소 마커 배열 (leaftlet 마커 객체들 저장)
let stationMarkers = [];
// 지진 관련 레이어 그룹(진앙지 마커, 거리 라인, 배지, 파동 애니메이션 등)
let eqLayerGroup = null;

// 진앙지 파동 애니메이션(리플) 관리용 자료구조
// - key: "MarkerGroup"
// - value: { el: DOM 요소, lon: 경도, lat: 위도 }
let usgsRipples = new Map();

// 리플 위치 업데이트 루프가 이미 바인딩 되었는지 여부
let usgsRippleLoopBound = false;
let Tabulator_PGA, Tabulator_Wave, Tabulator_Spec, Tabulator_SpecLog,
  Tabulator_Amp, Tabulator_Response = null;
var TotalData1, AnalysisData = null;
var tartgetAnalysisData = [];
var hiddenNetCode = null;

async function InitTotalDataLoad() {
  try {
    await initMapSetting(); 
    await initDataLoad();
  } catch (error) {
    console.error('데이터 로드 중 오류 발생:', error);
  }
}


function initMapSetting() {
  return new Promise((resolve, reject) => {
    try {
      // 이미 만들어져 있으면 재사용
      if (usgsMap) {
        resolve();
        return;
      }

      // Leaflet 맵 생성 (초기값은 대충 한반도 근처)
      usgsMap = L.map('GISImage', {
        attributionControl: false,
        center: [36.5, 127.5],   // [위도, 경도]
        zoom: 8,        // 초기 줌 레벨
        minZoom: 1,   // 줌 아웃 제한(축소)
        maxZoom: 8,  // 줌 인 제한(확대)
        zoomControl: false,   // 줌 컨트롤 미표시
        dragging: true,  // 드레그 허용(지도이동)
        //scrollWheelZoom: false,   // 마우스 휠 줌 막기
        doubleClickZoom: false    // 더블클릭 줌 막기

        //// 드래그 허용 + 범위 제한
        //maxBounds: [
        //  [33.0, 124.0],  // 남서쪽 모서리 (lat, lon)
        //  [39.5, 132.0]   // 북동쪽 모서리
        //],
        //maxBoundsViscosity: 0.3  // 0~1 : 1이면 벽처럼 딱 막힘
      });

      // 1 ~ 5 : USGS
      // 6 : Esri
      // USGS 베이스맵 정의
      usgsBaseLayers = {
        // 1. 기본 Topo 
        topo: L.tileLayer(
          '/BN_ANA/basemaps/topo/{z}/{x}/{y}.png',
          //'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 19, attribution: 'Map data: USGS The National Map' }
        ),
        // 2. 이미지 + 레이블
        imageryTopo: L.tileLayer(
          //'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}',
          '/BN_ANA/basemaps/imageryTopo/{z}/{x}/{y}.png',
          { maxZoom: 19, attribution: 'Map data: USGS The National Map' }
        ),
        // 3. 이미지만
        imageryOnly: L.tileLayer(
          'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
          '/BN_ANA/basemaps/imageryOnly/{z}/{x}/{y}.png',
          { maxZoom: 19, attribution: 'Map data: USGS The National Map' }
        ),
        // 4. 음영 기복(지형)
        shadedRelief: L.tileLayer(
          //'https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}',
          '/BN_ANA/basemaps/shadedRelief/{z}/{x}/{y}.png',
          { maxZoom: 19, attribution: 'Map data: USGS The National Map' }
        ),
        // 5. 하천/수계
        hydro: L.tileLayer(
          //'https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile/{z}/{y}/{x}',
          '/BN_ANA/basemaps/hydro/{z}/{x}/{y}.png',
          { maxZoom: 19, attribution: 'Map data: USGS The National Map' }
        ),
      };


      // 마지막으로 저장된 지도의 인덱스 불러오기
      let mapIdx = LoadBaseMapFromStorageIndex();

      if (mapIdx == null || mapIdx < 0 || mapIdx == 0) {
        mapIdx = usgsBaseOrder.indexOf('imageryOnly');
      }

      // 현재 맵 인덱스 전역 변수에 설정하여 동기화 함.
      currentBaseIndex = mapIdx;

      // 불러온 지도 인덱스 번호의 베이스맵 키 반환
      currentBaseKey = usgsBaseOrder[mapIdx];

      // 베이스맵 설정
      usgsTiles = usgsBaseLayers[currentBaseKey];
      usgsTiles.addTo(usgsMap);

      // 지진 관련 오버레이용 그룹
      eqLayerGroup = L.layerGroup().addTo(usgsMap);

      // Leaflet 줌 레벨 표시 메서드 호출
      InitZoomIndicator();

      // 지도 페이지에 베이스맵 바꾸는 버튼 추가
      //AddBaseMapButton();


      resolve();
    } catch (e) {
      console.error('initMapSetting 오류:', e);
      reject(e);
    }
  });
}

// 드래그 제한 설정
// 진앙과 모든 관측소를 포함하는 영역을 계산해서
// 그 영역 안에서만 드래그 가능하도록 maxBounds 설정
function ApplyEQMaxBounds(ev) {
  if (!usgsMap || !TotalData1 || !TotalData1.stationPoint?.length) return;

  const pts = [];

  // 진앙 좌표 추가
  const evLat = parseFloat(ev.lat);
  const evLon = parseFloat(ev.lon);
  if (Number.isFinite(evLat) && Number.isFinite(evLon)) {
    pts.push([evLat, evLon]);
  }

  // 관측소 좌표들을 배열에 추가
  TotalData1.stationPoint.forEach(sp => {
    const sLat = parseFloat(sp.lat);
    const sLon = parseFloat(sp.lon);
    if (Number.isFinite(sLat) && Number.isFinite(sLon)) {
      pts.push([sLat, sLon]);
    }
  });

  if (!pts.length) return;

  // 진앙 + 관측소 모두 포함하는 경계 계산
  let bounds = L.latLngBounds(pts);

  // 거리 많이 떨어지면 여유 크게: size의 50% 만큼 추가 패딩
  bounds = bounds.pad(0.5);   // 숫자 키우면 더 느슨해짐

  usgsMap.setMaxBounds(bounds);

  // 0 ~ 1 (1에 가까울수록 경계에서 더 강하게 튕김)
  usgsMap.options.maxBoundsViscosity = 0.5;  // 1.0보다 느슨하게
}

// 줌 레벨 표시 컨트롤 객체
let zoomIndicator = null;
// 우측 상단에 "Zoom: n" 형태로 현재 줌 레벨을 보여주는 컨트롤
function InitZoomIndicator() {
  if (!usgsMap) return;
  if (zoomIndicator) return;     // 이미 만들어졌으면 또 만들지 않음

  zoomIndicator = L.control({ position: 'topright' });

  zoomIndicator.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'zoom-indicator');
    div.innerHTML = 'Zoom: ' + map.getZoom();
    this._div = div;
    return div;
  };

  zoomIndicator.update = function () {
    if (!this._div || !usgsMap) return;
    this._div.innerHTML = 'Zoom: ' + usgsMap.getZoom();
  };

  zoomIndicator.addTo(usgsMap);
  zoomIndicator.update();        // 초기 1회 표시

  usgsMap.on('zoomend', function () {
    zoomIndicator.update();
  });
}



function initDataLoad() {
  var txtEventNo = document.getElementById("ViewBagEventID").dataset.eventid;
  if (txtEventNo != "" && txtEventNo != null) {
    $.ajax({
      type: "GET",
      url: 'DataLoad',
      data: { EventID: txtEventNo },
      contentType: "application/json; charset=utf-8",
      dataType: 'json',
      success: function (data) {
        if (data[0] == "Error_01") {
          alert("데이터 로드 중 오류가 발생하였습니다.(Error_01)");
          return;
        }
        else if (data[0] == "Error_02") {
          alert("데이터 로드 중 오류가 발생하였습니다.(Error_02)");
          return;
        }
        else if (data[0] == "Error_0.") {
          alert("데이터 로드 중 오류가 발생하였습니다.(Error_03)");
          return;
        }
        else if (data[0] == "Error_04") {
          alert("데이터 로드 중 오류가 발생하였습니다.(Error_04)");
          return;
        }
        else if (data[0] == "Error_05") {
          alert("데이터 로드 중 오류가 발생하였습니다.(Error_05)");
          return;
        }
        else if (data[0] == "Error_06") {
          alert("데이터 로드 중 오류가 발생하였습니다.(Error_06)");
          return;
        }
        else if (data[0] == "Error") {
          alert("데이터 로드 중 오류가 발생하였습니다.(Error)");
          return;
        }
        else if (data[0] == "NoData") {
          return;
        }
        else {
          if (data) {
            TotalData1 = data;

            initStationPanel();

            if (data.eventMaster) {
              EQMarkerLoad(data.eventMaster);
            }
          }
        }
      },
      error: function () {
        alert("세션 연결이 종료되었습니다.\n다시 로그인을 시도해주세요.");
        return;
      }
    });
  }
}

function initStationPanel() {

  if (!TotalData1 || !TotalData1.stationPoint || TotalData1.stationPoint.length === 0) {
    return;
  }

  // stationPoint를 stationCode 기준으로 찾아서 카드 생성
  TotalData1.stationPoint.forEach((sp, idx) => {

    const id = `station-${idx}`;
    //const imgPath = GetPinSVG();

    const maxPga = getStationMaxPGA(sp.stationCode);
    const mmiInfo = getMMIColorByPGA(maxPga);

    addStationDivMarker({
      id,
      lon: sp.lon,
      lat: sp.lat,
      color: mmiInfo.color,
      stationCode: sp.stationCode
    });

  });
}
function addStationDivMarker({ id, lon, lat, color, stationCode }) {
  if (!usgsMap) return null;

  const size = 22; // 아이콘 전체 크기

  const html = `
    <div class="station-circle" data-station-id="${id}" style="--mmi-color:${color}">
      <div class="station-circle-core"></div>
      <div class="station-circle-ring"></div>
    </div>
  `;

  const icon = L.divIcon({
    className: 'station-div-icon', // 기본 배경 없게
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });

  const marker = L.marker([lat, lon], { icon }).addTo(usgsMap);

  marker.stationCode = stationCode;
  //stationMarkers1.push(marker);
  return marker;
}

function getStationMaxPGA(stationCode) {
  if (!TotalData1 || !TotalData1.seiswaveStationList) return 0;

  let list = null;

  switch (stationCode) {
    case 'HS':
      list = TotalData1.seiswaveStationList.hS_List;
      break;
    case 'PT':
      list = TotalData1.seiswaveStationList.pT_List;
      break;
    case 'CA':
      list = TotalData1.seiswaveStationList.cA_List;
      break;
    case 'OY':
      list = TotalData1.seiswaveStationList.oY_List;
      break;
    default:
      return 0;
  }

  if (!list || list.length === 0) return 0;

  let max = 0;
  for (let i = 0; i < list.length; i++) {
    const v = parseFloat(list[i].pgA_Vector ?? 0);
    if (!isNaN(v) && v > max) max = v;
  }
  return max;
}

function getMMIColorByPGA(gal) {
  const v = gal ?? 0;

  if (v < 0.69) return { level: 'I', color: '#8f9ea7' };      // 미소
  if (v < 2.3) return { level: 'II', color: '#7ea8ab' };
  if (v < 7.5) return { level: 'III', color: '#46b0b7' };
  if (v < 25.1) return { level: 'IV', color: '#23b3a1' };
  if (v < 67.3) return { level: 'V', color: '#18af63' };
  if (v < 144.5) return { level: 'VI', color: '#a4b51f' };
  if (v < 310.6) return { level: 'VII', color: '#b5a314' };
  if (v < 667.2) return { level: 'VIII', color: '#cd691f' };
  if (v < 1443) return { level: 'IX', color: '#cd4a1f' };
  if (v < 3080) return { level: 'X', color: '#cb1414' };
  // 그 이상은 XI~XII 통합
  return { level: 'XI', color: '#960b16' };
}


function formatEventTime(dtStr) {
  if (!dtStr) return "";

  // "2026-01-12 09:50:00" → Date 객체로 변환
  const d = new Date(dtStr.replace(" ", "T"));

  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];

  return `${mm}/${dd}(${week}) ${hh}:${mi}경`;
}

function formatEventTimeKorean(dtStr) {
  if (!dtStr) return "";

  // "2026-01-12 09:50:00" → Date 객체
  const d = new Date(dtStr.replace(" ", "T"));

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];

  return `${yyyy}년 ${mm}월 ${dd}일(${week}) ${hh}시 ${mi}분`;
}

// ✅ 진도 포맷 (필요하면 반올림/정수화 등 여기서)
function formatInt(v) {
  if (v === null || v === undefined) return null;

  // 숫자면 그대로 반환
  if (typeof v === "number") return v;

  // 문자열로 변환
  const str = String(v);

  // (숫자) 패턴 찾기
  const match = str.match(/\((\d+)\)/);

  if (match) {
    return Number(match[1]);
  }

  // 괄호 없으면 그냥 숫자로 변환 시도
  const num = Number(str);
  return isNaN(num) ? null : num;
}

// ✅ gal(PGA) 포맷 (원하는 자릿수로 조절)
function formatPga(v) {
  if (v === null || v === undefined || v === "") return "-";
  const num = Number(v);
  if (Number.isNaN(num)) return String(v);
  return num.toFixed(3); // 예: 0.30 형태
}

// ✅ 1,431 같은 천단위 콤마 + km(원하면) 처리
function formatKm(v) {
  if (v === null || v === undefined || v === "") return "-";
  const num = Number(v);
  if (Number.isNaN(num)) return String(v); // 이미 "1,431" 문자열로 오면 그대로
  return num.toLocaleString("en-US"); // 1431 -> "1,431"
  // km까지 붙이고 싶으면:
  // return num.toLocaleString("en-US") + "km";
}

function formatPosition(c, v) {
  if (v == null) return "-";

  v = String(v).trim();

  if (v === "") return "-";

  // - 앞에 공백이 있어도 제거
  v = v.replace(/\s*\d+F$/i, "").trim();

  const isOutdoor =
    v.includes("옥외") &&
    (v.includes("지표형") || v.includes("시추형"));

  //const isOutdoor =
  //  v === "옥외(시추형)" || v === "옥외(지표형)";

  if (isOutdoor) {
    if (c === "HS") return "동학산";
    if (c === "PT") return "1방재센터";
    if (c === "CA") return "복지동";
    return "챌린지동";
  }

  return v;
}

// 전체 교체
// 진앙지 이벤트 로드 (마커, 거리, 규모 배지, 파동 등)

// 지진 이벤트 정보 로드 시 호출
// 진앙지 마커, 사업장까지의 거리, 규모 배지, 파동 애니메이션 등을 설정
function EQMarkerLoad(data) {

  if (!data || data.length === 0) return;

  const ev = data[0];

  //윗부분 타이틀, 요약
  var titleText = ev.loc ?? "";
  var titleEl = document.querySelector("#ReportLoc");
  if (titleEl) titleEl.textContent = titleText;

  var magText = `규모 ${ev.mt ?? "-"} 지진 발생`;
  var magEl = document.querySelector("#ReportMag");
  if (magEl) magEl.textContent = magText;

  var RS_TimeText = formatEventTime(ev.eventTime);
  var timeEl = document.querySelector("#ReportSummary_Time");
  if (timeEl) timeEl.textContent = RS_TimeText;

  var locEl = document.querySelector("#ReportSummary_Loc");
  if (locEl) locEl.textContent = titleText;

  var magText2 = `규모 ${ev.mt ?? "-"}의 지진이 발생`;
  var magEl = document.querySelector("#ReportSummary_Mag");
  if (magEl) magEl.textContent = magText2;

  const raw = ev.selF_INT;  
  const fixedINT = formatInt(raw);

  //const fixedINT = raw.replace(/\s*\(/, "(");
  var selfINTText = ` DS 사업장에서의 흔들림 정도는 진도 ${fixedINT} 수준`;
  var selfINTEl = document.querySelector("#ReportSummary_SELFINT");
  if (selfINTEl) selfINTEl.textContent = selfINTText;

  //지진 상황 (발생지)
  var Content_TimeText = formatEventTimeKorean(ev.eventTime);
  var contentTimeEL = document.querySelector("#Content_EventTime");
  if (contentTimeEL) contentTimeEL.textContent = Content_TimeText;

  var Content_MagText = `규모 ${ev.mt ?? "-"}`;
  var contentMagEl = document.querySelector("#Content_Mag");
  if (contentMagEl) contentMagEl.textContent = Content_MagText;

  var Content_LocText = `${ev.loc ?? "-"}`;
  var contentLocEl = document.querySelector("#Content_Loc");
  var len = ev.loc.length;

  if (contentLocEl) contentLocEl.textContent = Content_LocText;

  if (TotalData1.campusEvent) {
    for (var i = 0; i < TotalData1.campusEvent.length; i++) {
      if (TotalData1.campusEvent[i].stationCode === 'HS') {
        var evtDistance = TotalData1.campusEvent[i].distance;

        var distanceText =
          evtDistance == null
            ? "-"
            : Number(evtDistance).toLocaleString(); // 1000 → 1,000

        var Content_DistanceText = `(당사 거리: ${distanceText}km / * 화성사업장 기준)`;
        var contentDistanceEl = document.querySelector("#Content_Distance");
        if (contentDistanceEl) contentDistanceEl.textContent = Content_DistanceText;
      }
    }
  }
  else {
    var Content_DistanceText = `(당사 거리:  -km / * 화성사업장 기준)`;
    var contentDistanceEl = document.querySelector("#Content_Distance");
    if (contentDistanceEl) contentDistanceEl.textContent = Content_DistanceText;
  }

  var contentLocEl = document.querySelector("#Content_Loc");
  var contentDistanceEl = document.querySelector("#Content_Distance");
  var contentWrapEl = document.querySelector("#Content_Loc_Wrap");

  if (contentLocEl && contentWrapEl) {
    var locText = ev.loc ?? "-";
    contentLocEl.textContent = locText;

    // ✅ 글자 수 기준
    var len = locText.trim().length;

    if (len > 24) {
      contentWrapEl.classList.add("loc-break");
    } else {
      contentWrapEl.classList.remove("loc-break");
    }
  }

  //당사 지진 도달 수준
  const list = TotalData1?.campusEvent;
  if (!Array.isArray(list) || list.length === 0) return;

  list.forEach(item => {
    const campusKey = (item.stationCode ?? "").toString().trim();
    if (!campusKey) return;

    // 진도 / PGA 최대값
    const intMax = item.inT_Max;
    const pgaMax = item.pgA_Max;
    const distance = item.distance;
    const position = item.position;

    // 같은 campusKey를 가진 셀이 여러개 있을 수 있으니 전부 채움
    const cells = document.querySelectorAll(`.editable-dash[data-campus="${campusKey}"]`);
    if (!cells || cells.length === 0) return;

    cells.forEach(cell => {
      const intEl = cell.querySelector('[data-part="int"]');
      const pgaEl = cell.querySelector('[data-part="pga"]');
      const distEl = cell.querySelector('[data-part="distance"]');
      const positionEl = cell.querySelector('[data-part="position"]');

      if (intEl) intEl.textContent = formatInt(intMax);
      if (pgaEl) pgaEl.textContent = formatPga(pgaMax);
      if (distEl) distEl.textContent = formatKm(distance);
      if (positionEl) positionEl.textContent = formatPosition(campusKey, position);
    });
  });

  //SCS 발생지로부터 거리
  var SCS_Km = GetDistanceKm(TotalData1.eventMaster[0].lon, TotalData1.eventMaster[0].lat, SCSLon, SCSLat);
  var replaceSCS = SCS_Km.toFixed(0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  var SCSCell = document.querySelectorAll(`.editable-dash[data-campus="SCS"]`);
  SCSCell.forEach(cell => {
    const distEl = cell.querySelector('[data-part="distance"]');
    if (distEl) distEl.textContent = replaceSCS;
  });

  // 규모 값에 따른 색상 설정
  const mag = parseFloat(ev.mt);
  const magColor = colorByMag(mag);

  if (!usgsMap) return;

  // 이전 지진 관련 레이어 제거
  if (eqLayerGroup) {
    eqLayerGroup.clearLayers();
  }

  // 기존 파동 리플 DOM 제거 후 초기화
  usgsRipples.forEach(({ el }) => el.remove());
  usgsRipples.clear();

  var stationSite = TotalData1.stationPoint[0];

  // 규모 색으로 원점 아이콘 생성
  const imgPath = createEpicenterDot(magColor);

  // 진앙 마커 추가
  AddEQMarker({
    lon: ev.lon,
    lat: ev.lat,
    baseLon: stationSite.lon,
    imgPath: imgPath,
    width: 18,      // 아이콘 크기 약간 키움(원하는 값으로 조정 가능)
    height: 18,
    scale: 1.0
  });


  // 진앙지 리플(파동) 애니메이션 추가
  AddEQAnimation({
    name: "MarkerGroup",
    lon: ev.lon,
    lat: ev.lat,
    baseLon: stationSite.lon,
    color: magColor, // 파동 애니메이션 색상
    maxPx: 120,
    durationMs: 2400,
    ringCount: 2
  });

  //  // 관측소가 하나 이상 있을 경우, 첫 관측소를 기준으로 라인/배지/카메라 설정
  if (TotalData1 && TotalData1.stationPoint && TotalData1.stationPoint.length > 0) {
    const site = TotalData1.stationPoint[0];

    // 규모값에 따른 색상
    const mag = parseFloat(ev.mt);
    const magColor = colorByMag(mag);


    // 진앙지 => 관측소까지의 거리 라인 및 텍스트
    AddDistanceArrow({
      fromLon: ev.lon, fromLat: ev.lat,
      toLon: site.lon, toLat: site.lat,
      color: magColor, // 규모값에 따른 거리 라인 색상 설정
      width: 5.5
    });

    GlobalFromLon = ev.lon;
    GlobalFromLat = ev.lat;
    GlobalToLon = site.lon;
    GlobalToLat = site.lat;


    // 진앙지 규모 배지 + 위치 텍스트
    AddMagText({
      lon: ev.lon,
      lat: ev.lat,
      baseLon: stationSite.lon,
      mag: ev.mt,
      location: ev.loc,
      width: 70,
      height: 36
    });


    // 진앙지와 관측소가 한 화면에 보이도록 카메라 이동
    MoveCameraEvent(
      { lon: ev.lon, lat: ev.lat },
      { lon: site.lon, lat: site.lat }
    );



  } else {
    // 관측소 정보가 없으면 진앙 위치만 중앙에
    usgsMap.setView([ev.lat, ev.lon], 8);


  }

  // 드래그 제한 범위 재설정
  //ApplyEQMaxBounds(ev);
}


// 진앙지 점(원) 아이콘 생성
// 진원지 점을 그리는 헬퍼 메서드
function createEpicenterDot(color) {
  const size = 18;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 7;   // 그림자/외곽
  const rInner = 5;   // 실제 원

  g.clearRect(0, 0, size, size);

  // 바깥 은은한 그림자
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 4;
  g.beginPath();
  g.arc(cx, cy, rOuter, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.restore();

  // 가운데 원 + 흰 테두리
  g.beginPath();
  g.arc(cx, cy, rInner, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();

  g.lineWidth = 2;
  g.strokeStyle = '#ffffff';
  g.stroke();

  return c.toDataURL();
}

// 전체 교체
// 진앙지 마커 추가
// 진앙지 마커 추가 (eqLayerGroup 에 추가)
function AddEQMarker({ lon, lat, baseLon, imgPath, width, height, scale }) {
  if (!usgsMap) return null;

  if (!eqLayerGroup) {
    eqLayerGroup = L.layerGroup().addTo(usgsMap);
  }

  // ✅ 핵심: baseLon 기준으로 진앙 lon을 같은 월드로 맞춰서 찍기
  const drawLon = (baseLon !== undefined && baseLon !== null)
    ? alignLngTo(baseLon, lon)
    : lon;

  const icon = L.icon({
    iconUrl: imgPath,
    iconSize: [width * scale, height * scale],
    iconAnchor: [(width * scale) / 2, (height * scale) / 2]
  });

  const marker = L.marker([lat, drawLon], { icon }).addTo(eqLayerGroup);
  return marker;
}


// 전체 교체
// 진앙지 파동 애니메이션 추가
// 진앙 주변 파동 애니메이션 등록
function AddEQAnimation({ name, lon, lat, baseLon, color, maxPx, durationMs, ringCount }) {
  const el = createRippleDOM({ id: name, color, maxPx, durationMs, ringCount });

  const drawLon = (baseLon !== undefined && baseLon !== null)
    ? alignLngTo(baseLon, lon)
    : lon;

  usgsRipples.set(name, { el, lon: drawLon, lat });
  RippleLoop();
}
// 전체 교체
// 파동(원형 리플) DOM 요소 생성
function createRippleDOM({ id, color, maxPx, durationMs, ringCount }) {

  const el = document.createElement('div');
  el.className = 'ripple';
  el.dataset.rippleId = id;
  el.style.setProperty('--r', maxPx + 'px');
  el.style.setProperty('--dur', durationMs + 'ms');

  // ringCount 수만큼 원형 링 생성
  for (let k = 0; k < ringCount; k++) {
    const ring = document.createElement('div');
    ring.className = 'ring';
    ring.style.borderColor = color;
    el.appendChild(ring);
  }

  // Leaflet overlayPane 위에 리플 DOM 추가
  const parent = usgsMap
    ? usgsMap.getPanes().overlayPane   // Leaflet 오버레이 pane 위에 얹기
    : document.getElementById('GISImage');

  parent.appendChild(el);

  return el;
}

// 전체 교체
// RippleLoop
// 파동 위치 업데이트 루프 등록
function RippleLoop() {
  if (usgsRippleLoopBound || !usgsMap) return;
  usgsRippleLoopBound = true;

  const updateAll = () => {
    usgsRipples.forEach(({ el, lon, lat }) => updateRipplePosition(el, lon, lat));
  };

  // 지도 이동 및 줌 변경 시마다 리플 위치 재계산
  usgsMap.on('move zoom', updateAll);
  updateAll();
}

// 전체 교체
// 물결 애니메이션 위치 업데이트 메서드
// 리플(파동) DOM 요소를 실제 지도 좌표에 맞게 위치 이동
function updateRipplePosition(el, lon, lat) {

  if (!usgsMap) return;

  //const p = usgsMap.latLngToContainerPoint([lat, lon]);

  // overlayPane 에 붙었으니 layerPoint 기준으로
  const p = usgsMap.latLngToLayerPoint([lat, lon]);

  el.style.left = p.x + 'px';
  el.style.top = p.y + 'px';

}

// 전체 교체
// 진앙지 => 사업장 거리 표시 (화살표 라인 + 거리 텍스트)
// 파일 상단 쪽 전역
let distanceArrowLayer = null;
let distanceLabelLayer = null;

//진앙지 => 사업장까지의 화살표라인 및 거리 텍스트 표시
function AddDistanceArrow({ fromLon, fromLat, toLon, toLat, color, width }) {
  if (!usgsMap) return null;

  if (!eqLayerGroup) eqLayerGroup = L.layerGroup().addTo(usgsMap);

  // 이전 제거...
  if (distanceArrowLayer) eqLayerGroup.removeLayer(distanceArrowLayer);
  if (distanceLabelLayer) eqLayerGroup.removeLayer(distanceLabelLayer);
  distanceArrowLayer = null;
  distanceLabelLayer = null;

  // ✅ 기준: 사업장(to) 기준으로 진앙(from)을 같은 월드로 맞춤
  const fromDrawLon = alignLngTo(toLon, fromLon);
  const toDrawLon = Number(toLon);

  // ✅ 라인/방향/중간점은 draw 좌표로 통일
  const fromDraw = [Number(fromLat), fromDrawLon];
  const toDraw = [Number(toLat), toDrawLon];

  // main line
 
  distanceArrowLayer = L.polyline([fromDraw, toDraw], {
    color: color || '#c90000',
    weight: width || 4
  }).addTo(eqLayerGroup);

  // ----- draw arrow head -----
  // ----- draw scalable arrow head -----
  const latlngs = distanceArrowLayer.getLatLngs();
  const start = latlngs[0];
  const end = latlngs[1];

  // direction vector
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;

  // line length
  const lineLength = Math.sqrt(dx * dx + dy * dy);

  // normalize direction
  const ux = dx / lineLength;
  const uy = dy / lineLength;

  const arrowLength = 0.14;   // small constant size
  const arrowWidth = 0.08;    // half width of triangle

  // base of arrow
  const baseLng = end.lng - ux * (arrowLength * 1.3);
  const baseLat = end.lat - uy * (arrowLength * 1.2);
  // perpendicular vector
  const px = -uy;
  const py = ux;

  // triangle points
  const arrowPoint1 = [
    baseLat + py * arrowWidth,
    baseLng + px * arrowWidth
  ];

  const arrowPoint2 = [
    baseLat - py * arrowWidth,
    baseLng - px * arrowWidth
  ];

  // small gap so arrow does not touch white dot
  const gap = arrowLength * 0.35;

  const tipLat = end.lat - uy * gap;
  const tipLng = end.lng - ux * gap;

  // draw triangle arrow
  const arrowPolygon = L.polygon([[tipLat, tipLng], arrowPoint1, arrowPoint2], {
    color: color || '#c90000',
    fillColor: color || '#c90000',
    fillOpacity: 1,
    weight: 1,
    pane: 'overlayPane'
  });

  arrowPolygon.addTo(eqLayerGroup);

  /*
const arrowDecorator = L.polylineDecorator(distanceArrowLayer, {
    patterns: [
        {
            offset: '100%',
            repeat: 0,
            symbol: L.Symbol.arrowHead({
                pixelSize: 15,
                polygon: true,
                pathOptions: {
                    fillOpacity: 1,
                    weight: 0,
                    color: color || '#c90000',
                    fillColor: color || '#c90000'
                }
            })
        }
    ]
});
arrowDecorator.addTo(eqLayerGroup);
*/
  // 거리 계산은 raw로 OK
  const km = GetDistanceKm(fromLon, fromLat, toLon, toLat);

  // ✅ 라벨 위치도 draw 기준으로 계산하고, marker 찍을 때만 wrap
  const midLat = (Number(fromLat) + Number(toLat)) / 2;
  const midLonDraw = (fromDrawLon + toDrawLon) / 2;
  //const midLon = wrapLng(midLonDraw);
  const midLon = midLonDraw; 

  distanceLabelLayer = L.marker([midLat, midLon], {
    icon: L.divIcon({
      className: 'distance-label-icon',
      html: `
        <span class="distance-label-text"
              style="font-size:1.2rem; background:linear-gradient(to bottom,#db5656 0%,#cb0808 35%,#cb0808 100%); border:1px solid ${color || '#000'};">
          ${km.toFixed(0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} km
        </span>`,
      iconSize: [0, 0]
    })
  }).addTo(eqLayerGroup);

  return distanceArrowLayer;
}
// 전체 교체
// 두 좌표 사이 거리 계산 (Haversine 공식을 사용)
function GetDistanceKm(lon1, lat1, lon2, lat2) {
  const R = 6371; // 지구 반지름 (km)
  const toRad = deg => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}



// 전체 교체
// 진앙지 규모 텍스트 오버레이 표시 (Cesium 빌보드)
// 진앙지 규모 배지 + 그 위에 위치 문자열
function AddMagText({ lon, lat, baseLon, mag, location, width, height }) {
  if (!usgsMap) return null;
  if (!eqLayerGroup) {
    eqLayerGroup = L.layerGroup().addTo(usgsMap);
  }

  var canvas;
  var magColor;
  // 규모 배지용 아이콘 (캔버스 => 이미지)
  if (mag === '-') {
    magColor = colorByMag(mag);
    canvas = MagCanvas(
      mag,
      { w: width, h: height, color: magColor }
    );
  }
  else {
    mag = parseFloat(mag);
    magColor = colorByMag(mag);   // 규모색 하나로 재사용

    canvas = MagCanvas(
      mag.toFixed(1),
      { w: width, h: height, color: magColor }
    );
  }

  const drawLon = (baseLon !== undefined && baseLon !== null)
    ? alignLngTo(baseLon, lon)
    : lon;


  const dataUrl = canvas.toDataURL();

  const magIcon = L.icon({
    iconUrl: dataUrl,
    iconSize: [width, height],
    iconAnchor: [width / 2, height + 10]
  });

  const marker = L.marker([lat, drawLon], {
    icon: magIcon,
    zIndexOffset: 1000
  }).addTo(eqLayerGroup);

  // 위치 텍스트는 Tooltip으로, 배지 위쪽에 고정
  if (location) {
    marker.bindTooltip(
      `<span class="eq-loc" style="color:#fff">${location}</span>`,
      //`<span style="font-size: .9rem; color:${magColor}">${location}</span>`,  //색을 규모색으로
      {
        permanent: true,
        direction: 'top',
        offset: [0, -(height + 10)],
        className: 'eq-location-tooltip'
      }
    );
  }

  return marker;
}

// 전체 교체
// 규모 배지 캔버스 그리기
// 진앙지 규모 표시 메서드
// 진앙지 규모 배지 (둥근 직사각형 + 아래 삼각형 꼬리)
function MagCanvas(text, { w, h, color } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');

  const pointerH = 10;
  const bodyH = h - pointerH;
  const r = 6;

  g.clearRect(0, 0, w, h);

  // ===== 본체 (사각 박스) =====
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = 0;
  g.shadowOffsetY = 1;

  g.beginPath();
  // 둥근 사각형
  g.moveTo(r, 0);
  g.lineTo(w - r, 0);
  g.quadraticCurveTo(w, 0, w, r);
  g.lineTo(w, bodyH - r);
  g.quadraticCurveTo(w, bodyH, w - r, bodyH);
  g.lineTo(r, bodyH);
  g.quadraticCurveTo(0, bodyH, 0, bodyH - r);
  g.lineTo(0, r);
  g.quadraticCurveTo(0, 0, r, 0);
  g.closePath();

  g.fillStyle = color;
  g.fill();
  g.restore();

  // ===== 상단 글로스(사각 박스에도 동일 적용) =====
  g.save();
  const glossGrad = g.createLinearGradient(0, 0, 0, bodyH);
  glossGrad.addColorStop(0.0, 'rgba(255,255,255,0.35)');
  glossGrad.addColorStop(0.35, 'rgba(255,255,255,0.12)');
  glossGrad.addColorStop(1.0, 'rgba(255,255,255,0.0)');

  g.fillStyle = glossGrad;

  // 본체만 클리핑
  g.beginPath();
  g.moveTo(r, 0);
  g.lineTo(w - r, 0);
  g.quadraticCurveTo(w, 0, w, r);
  g.lineTo(w, bodyH - r);
  g.quadraticCurveTo(w, bodyH, w - r, bodyH);
  g.lineTo(r, bodyH);
  g.quadraticCurveTo(0, bodyH, 0, bodyH - r);
  g.lineTo(0, r);
  g.quadraticCurveTo(0, 0, r, 0);
  g.closePath();
  g.clip();

  g.fillRect(0, 0, w, bodyH);
  g.restore();

  // ===== 텍스트 =====
  g.font = 'bold 18px Pretendard';
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, bodyH / 2);

  return c;
}

// 규모→색상
function colorByMag(m) {
  if (m >= 7) return '#c90000';
  if (m >= 6) return '#c90000';
  if (m >= 5) return '#c90000';
  if (m >= 4) return '#c90000';
  return '#c90000';
}


//// 전체 교체
//// 카메라 이동 (진앙지와 사업장이 한 화면에 들어오도록)
//// 진앙지와 단일 사업장을 한 화면에 들어오게 카메라 이동
//async function moveBoundsSafe(bounds) {
//  usgsMap.invalidateSize(false);
//  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
//  usgsMap.invalidateSize(false);

//  usgsMap.fitBounds(bounds, {
//    padding: [0, 0],
//    maxZoom: 8,
//    animate: false
//  });
//}

//async function MoveCameraEvent(epi, site) {
//  if (!usgsMap) return;

//  const fromLon = Number(epi.lon), fromLat = Number(epi.lat);
//  const toLon = Number(site.lon), toLat = Number(site.lat);
//  if (![fromLon, fromLat, toLon, toLat].every(Number.isFinite)) return;

//  let bounds = L.latLngBounds([fromLat, fromLon], [toLat, toLon]).pad?.(0)
//    ?? L.latLngBounds([fromLat, fromLon], [toLat, toLon]);

//  await moveBoundsSafe(bounds);

//  lockUserZoom(usgsMap);
//}

function lockUserZoom(map) {
  // 줌 잠금
  map.scrollWheelZoom.disable();
  map.doubleClickZoom.disable();
  map.touchZoom.disable();
  map.boxZoom.disable();
  map.keyboard.disable();
  if (map.tap) map.tap.disable();

  // 이동 잠금
  map.dragging.disable();
}

function MoveCameraEvent(epi, site) {
  if (!usgsMap) return;

  const epiLon = +epi.lon;
  const epiLat = +epi.lat;
  const siteLon = +site.lon;
  const siteLat = +site.lat;

  if (![epiLon, epiLat, siteLon, siteLat].every(Number.isFinite)) {
    console.warn('MoveCameraEvent: 좌표가 올바르지 않습니다.', { epi, site });
    return;
  }

  // ✅ 기준(base): 사업장(site) 기준으로 진앙(epi) 경도를 같은 월드로 맞춤
  const epiDrawLon = alignLngTo(siteLon, epiLon);
  const siteDrawLon = siteLon;

  // ⏱️ 렌더링 안정화를 위해 약간 지연
  setTimeout(() => {

    // 두 점이 완전 같은 위치이면 그냥 setView
    if (epiLat === siteLat && epiDrawLon === siteDrawLon) {
      usgsMap.setView([epiLat, wrapLng(epiDrawLon)], 5);
      return;
    }

    // ✅ bounds는 "둘 다 draw 좌표"로 잡아야 함
    const bounds = L.latLngBounds(
      [epiLat, epiDrawLon],
      [siteLat, siteDrawLon]
    );

    usgsMap.flyToBounds(bounds, {
      padding: [60, 60],
      maxZoom: 8,
      duration: 0.8
    });

  }, 300);
}

//function MoveCameraEvent(epi, site) {
//  if (!usgsMap) return;

//  const fromLon = +epi.lon;
//  const fromLat = +epi.lat;
//  const toLon = +site.lon;
//  const toLat = +site.lat;

//  if (![fromLon, fromLat, toLon, toLat].every(Number.isFinite)) {
//    console.warn('MoveCameraEvent: 좌표가 올바르지 않습니다.', { epi, site });
//    return;
//  }

//  // 두 점이 완전 같은 위치이면 그냥 setView
//  if (fromLon === toLon && fromLat === toLat) {
//    // 너무 확대되지 않게 여기서도 5로 맞춤
//    usgsMap.setView([fromLat, fromLon], 5);
//    return;
//  }

//  const bounds = L.latLngBounds(
//    [fromLat, fromLon],
//    [toLat, toLon]
//  );

//  usgsMap.flyToBounds(bounds, {
//    padding: [60, 60],
//    // 여기 추가: 너무 확대되지 않도록 최대 줌 제한
//    maxZoom: 8,
//    duration: 0.8
//  });

//  lockUserZoom(usgsMap);
//}

//async function MoveCameraEvent(epi, site) {
//  if (!usgsMap) return;

//  const fromLon = Number(epi.lon);
//  const fromLat = Number(epi.lat);
//  const toLon = Number(site.lon);
//  const toLat = Number(site.lat);

//  if (![fromLon, fromLat, toLon, toLat].every(Number.isFinite)) {
//    console.warn("MoveCameraEvent: 좌표가 올바르지 않습니다.", { epi, site });
//    return;
//  }

//  // ✅ 1) 지도 컨테이너 크기 재계산 (가장 중요)
//  //    애니메이션/레이아웃 변경 직후에는 1번으로 부족한 경우가 있어 2프레임 대기
//  usgsMap.invalidateSize(true);
//  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
//  //usgsMap.invalidateSize(true);
//  setTimeout(() => {
//    usgsMap.invalidateSize(true);
//    usgsMap.fitBounds(bounds, {
//      padding: [80, 80],
//      maxZoom: 8
//    });
//  }, 200);


//  // 두 점이 같으면 setView
//  if (fromLon === toLon && fromLat === toLat) {
//    usgsMap.setView([fromLat, fromLon], 5, { animate: true });
//    return;
//  }

//  // ✅ 2) bounds에 여유를 줌 (pad는 버전에 따라 없을 수 있어 안전 처리)
//  let bounds = L.latLngBounds([fromLat, fromLon], [toLat, toLon]);

//  if (typeof bounds.pad === "function") {
//    bounds = bounds.pad(0.3); // 30% 여유
//  } else {
//    // Leaflet 구버전 대비: 수동으로 확장
//    const sw = bounds.getSouthWest();
//    const ne = bounds.getNorthEast();
//    const latPad = (ne.lat - sw.lat) * 0.3;
//    const lngPad = (ne.lng - sw.lng) * 0.3;
//    bounds = L.latLngBounds(
//      [sw.lat - latPad, sw.lng - lngPad],
//      [ne.lat + latPad, ne.lng + lngPad]
//    );
//  }

//  // ✅ 3) "무조건 다 들어오게" 줌을 직접 계산해서 한 단계 더 여유 주기
//  const z = usgsMap.getBoundsZoom(bounds, false);
//  const targetZoom = Math.max(1, Math.min(z - 1, 7)); // 한 단계 여유 + 과확대 방지

//  // ✅ 4) flyToBounds 대신 flyTo(center, zoom) 방식이 더 안정적
//  usgsMap.flyTo(bounds.getCenter(), targetZoom, {
//    animate: true,
//    duration: 0
//  });
//}

//function MoveCameraEvent(epi, site) {
//  if (!usgsMap) return;

//  const fromLon = +epi.lon;
//  const fromLat = +epi.lat;
//  const toLon = +site.lon;
//  const toLat = +site.lat;

//  if (![fromLon, fromLat, toLon, toLat].every(Number.isFinite)) {
//    console.warn('MoveCameraEvent: 좌표가 올바르지 않습니다.', { epi, site });
//    return;
//  }

//  // 두 점이 완전 같은 위치이면 그냥 setView
//  if (fromLon === toLon && fromLat === toLat) {
//    // 너무 확대되지 않게 여기서도 5로 맞춤
//    usgsMap.setView([fromLat, fromLon], 5);
//    return;
//  }

//  const bounds = L.latLngBounds(
//    [fromLat, fromLon],
//    [toLat, toLon]
//  ).pad(0.3);

//  usgsMap.flyToBounds(bounds, {
//    padding: [80, 80],
//    maxZoom: 7
//  });
//  //const bounds = L.latLngBounds(
//  //  [fromLat, fromLon],
//  //  [toLat, toLon]
//  //);

//  //usgsMap.flyToBounds(bounds, {
//  //  padding: [60, 60],
//  //  // 여기 추가: 너무 확대되지 않도록 최대 줌 제한
//  //  maxZoom: 8
//  //});
//}



// ============================ 베이스맵 (USGS 베이스맵) 토글 기능 단축키 ============================ //

// 키보드 단축키로 베이스맵을 순환
document.addEventListener('keydown', function (e) {
  // Ctrl + Alt + M
  if (e.ctrlKey && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
    e.preventDefault();
    ChangingBaseMap();
  }
});




// =========================== 지도 우측 상단에 베이스맵 변경 버튼 추가 ================================ //
// 지도 우측 상단에 베이스맵 토글 버튼 컨트롤 추가 메서드
function AddBaseMapButton() {
  if (!usgsMap) return;

  const BaseMapControl = L.Control.extend({
    position: 'topright',   // 우측 상단

    onAdd: function (map) {
      const container = L.DomUtil.create('div', 'leaflet-control basemap-toggle-wrap');

      const btn = L.DomUtil.create('div', 'basemap-toggle-btn', container);

      // Leaflet의 css 이미지 사용
      const img = L.DomUtil.create('img', 'basemap-toggle-img', btn);
      img.src = '/Admin/CSS_Lib/images/layers-2x.png';   // 지도 레이어 이미지 경로
      img.alt = '베이스맵 변경';

      // 지도 드래그와 충돌하지 않도록 이벤트 전파 중지
      L.DomEvent.on(btn, 'click', function (e) {
        L.DomEvent.stop(e);
        ChangingBaseMap();
      });

      return container;
    }
  });

  // 컨트롤을 지도에 추가
  usgsMap.addControl(new BaseMapControl());
}






// ============================ 베이스맵 바꾸는 메서드 (단축키 / 버튼 공용)============================ //
// 베이스맵을 순서대로 변경하는 메서드
function ChangingBaseMap() {
  if (!usgsMap || !usgsBaseLayers) return;

  // 다음 인덱스로 순환
  currentBaseIndex = (currentBaseIndex + 1) % usgsBaseOrder.length;
  currentBaseKey = usgsBaseOrder[currentBaseIndex];

  // 기존 베이스맵 제거
  if (usgsTiles) {
    usgsMap.removeLayer(usgsTiles);
  }

  // 새 베이스맵 적용
  usgsTiles = usgsBaseLayers[currentBaseKey];
  usgsTiles.addTo(usgsMap);

  // 변경한 지도의 문자열 키값을 [로컬 스토리지]에 저장
  SaveBaseMapToStorage();

  // 변경된 베이스 지도 화면에 3초간 표시 메서드 호출
  ShowChangeBaseMap(currentBaseKey);

}



// ===================== 베이스 지도 변경시 3초 표시 메서드 ======================== //
function ShowChangeBaseMap(baseKey) {
  const label = usgsBaseNames[baseKey] || baseKey;

  let el = document.getElementById('basemap-toast');
  if (!el) {

    // 지도 컨테이너에  표시 요소 붙이기
    const container = usgsMap
      ? usgsMap.getContainer()
      : document.getElementById('GISImage');

    el = document.createElement('div');
    el.id = 'basemap-toast';
    el.className = 'basemap-toast';
    container.appendChild(el);
  }

  el.textContent = label;

  // CSS 애니메이션이 다시 적용되도록 클래스 재등록
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');

  // 3초 뒤 자동 숨김
  clearTimeout(ShowChangeBaseMap._timer);
  ShowChangeBaseMap._timer = setTimeout(() => {
    el.classList.remove('show');
  }, 3000);
}





// ================================= localStorage 를 사용한 마지막 베이스맵 기억하기 ========================================= //
// 로컬 스토리지에 사용할 키 이름
const BASEMAP_STORAGE_KEY = 'EA_LastBaseMapKey';

// 마지막 선택 베이스맵 저장
function SaveBaseMapToStorage() {
  try {
    localStorage.setItem(BASEMAP_STORAGE_KEY, currentBaseKey);
  } catch (e) {
    console.warn('SaveBaseMapToStorage error:', e);
  }
}



// [로컬 스토리지]에 저장된 마지막 선택 베이스맵 인덱스 번호를 반환하는 메서드
function LoadBaseMapFromStorageIndex() {
  try {
    const savedKey = localStorage.getItem(BASEMAP_STORAGE_KEY);
    if (!savedKey) return 0; // 저장된 값이 없으면 0 반환

    const idx = usgsBaseOrder.indexOf(savedKey);
    if (idx === -1)
      return 0; // 배열에 없는 값이면 0 반환

    return idx;

  } catch (e) {
    console.warn('LoadBaseMapFromStorage error:', e);

    // 오류 발생 시 기본값 반환
    return 0;
  }
}

async function PDFDownload_Button() {
  const jsPDF = getJsPdf();
  if (!jsPDF) return;

  const target = document.getElementById('event-report-container');
  if (!target) return alert('보고서 영역(event-report-container)을 찾을 수 없습니다.');

  const page1 = document.getElementById('ReportPage1');
  const page2 = document.getElementById('ReportPage2');
  const page3 = document.getElementById('ReportPage3');
  if (!page1 || !page2 || !page3) {
    return alert('ReportPage1/2/3 래퍼를 찾을 수 없습니다. HTML에 div로 감싸주세요.');
  }

  const gisEl = document.getElementById('GISImage');
  if (!gisEl) return alert('GISImage를 찾을 수 없습니다.');

  // ✅ 공통: 캡처 모드 + 스크롤 위치 백업
  target.classList.add('capture-mode');
  const prevScrollY = window.scrollY;

  // ✅ 지도 캡처용 임시 이미지
  let snapshotImg = null;

  // ✅ PDF 생성
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // 캔버스를 "한 페이지"로 꽉 채워 넣는 헬퍼
  function addCanvasAsOnePdfPage(canvas, isFirstPage) {
    //const imgData = canvas.toDataURL('image/png');
    const imgData = canvas.toDataURL('image/jpeg', 0.85); // 품질 0.75

    // A4 폭에 맞추고, 높이는 비율 유지
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // ✅ 한 페이지에 넣되, 남으면 위/아래 여백으로 센터링(선택)
    //const y = imgHeight < pageHeight ? (pageHeight - imgHeight) / 2 : 0;

    if (!isFirstPage) pdf.addPage();
    //pdf.addImage(imgData, 'PNG', 0, 8, imgWidth, imgHeight);

    pdf.addImage(imgData, 'JPEG', 0, 8, imgWidth, imgHeight);
  }

  try {
    window.scrollTo(0, 0);

    // =========================
    // ✅ 1) 지도 먼저 스냅샷으로 고정 (기존 로직 유지)
    // =========================
    usgsMap?.invalidateSize?.(true);
    usgsMap?.panBy?.([0, 0], { animate: false });

    AddDistanceArrow({
      fromLon: GlobalFromLon, fromLat: GlobalFromLat,
      toLon: GlobalToLon, toLat: GlobalToLat,
      color: '#c90000',
      width: 5.5
    });

    freezeLeafletTransform(usgsMap);

    // force leaflet to redraw layers (important for arrow)
    usgsMap.invalidateSize(true);

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const mapCanvas = await html2canvas(gisEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#fff",
      scrollX: 0,
      scrollY: 0
    });
    const mapImgData = mapCanvas.toDataURL("image/png");

    const leafletPane = gisEl.querySelector('.leaflet-container');
    if (leafletPane) leafletPane.style.display = "none";

    snapshotImg = document.createElement("img");
    snapshotImg.src = mapImgData;
    snapshotImg.style.width = "100%";
    snapshotImg.style.height = "100%";
    snapshotImg.style.objectFit = "cover";
    snapshotImg.setAttribute("data-map-snapshot", "1");
    gisEl.appendChild(snapshotImg);

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // =========================
    // ✅ 2) 페이지별로 각각 캡처해서 PDF에 넣기
    // =========================
    const c1 = await html2canvas(page1, {
      scale: 2, useCORS: true, backgroundColor: "#fff",
      scrollX: 0, scrollY: 0
    });

    const c2 = await html2canvas(page2, {
      scale: 2, useCORS: true, backgroundColor: "#fff",
      scrollX: 0, scrollY: 0
    });

    const c3 = await html2canvas(page3, {
      scale: 2, useCORS: true, backgroundColor: "#fff",
      scrollX: 0, scrollY: 0
    });

    restoreLeafletTransform(usgsMap);

    // ✅ PDF에 1페이지/2페이지/3페이지로 추가
    addCanvasAsOnePdfPage(c1, true);   // 1페이지
    addCanvasAsOnePdfPage(c2, false);  // 2페이지
    addCanvasAsOnePdfPage(c3, false);  // 3페이지

    var yymmdd = TotalData1?.eventMaster?.[0]?.eventTime?.slice(2, 10).replaceAll("-", "");
    var eventTitle = "(" + yymmdd + ")" + document.getElementById("ReportLoc").textContent + " " + document.getElementById("ReportMag").textContent;
    //const eventNo = TotalData1?.eventMaster?.[0]?.eventNo ?? "report";
    pdf.save(eventTitle + '.pdf');

  } finally {
    // ✅ 지도 원복
    if (snapshotImg) snapshotImg.remove();
    const leafletPane2 = gisEl?.querySelector('.leaflet-container');
    if (leafletPane2) leafletPane2.style.display = "";

    window.scrollTo(0, prevScrollY);
    target.classList.remove('capture-mode');
  }
}

//// PDF 다운로드 (2번부터 무조건 2페이지)
//async function PDFDownload_Button() {
//  const JsPDF = getJsPdf();
//  if (!JsPDF) return;

//  // ✅ 캡처모드: 버튼 숨김까지 포함시키려면 더 상위(root)에 클래스 적용
//  const root = document.getElementById('ReportContainer');   // 버튼 영역은 보통 root 밖이지만, 안전하게 상위로
//  const page1 = document.getElementById('ReportPage1');
//  const page2 = document.getElementById('ReportPage2');

//  if (!root || !page1 || !page2) {
//    alert('ReportContainer / ReportPage1 / ReportPage2를 찾을 수 없습니다.');
//    return;
//  }

//  // ✅ 캡처모드 ON (점선 제거 등)
//  root.classList.add('capture-mode');

//  const prevScrollY = window.scrollY;

//  const captureOptions = {
//    scale: 2,
//    useCORS: true,
//    scrollX: 0,
//    scrollY: 0,
//    backgroundColor: "#fff"
//  };

//  try {
//    window.scrollTo(0, 0);
//    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

//    const pdf = new JsPDF('p', 'mm', 'a4');
//    const pageWidth = pdf.internal.pageSize.getWidth();
//    const pageHeight = pdf.internal.pageSize.getHeight();

//    const marginLeft = 0, marginTop = 0, marginRight = 0, marginBottom = 0;
//    const contentWidth = pageWidth - marginLeft - marginRight;
//    const usablePageHeight = pageHeight - marginTop - marginBottom;

//    async function addElementToPdf(element, isFirst) {
//      const canvas = await html2canvas(element, captureOptions);
//      const imgData = canvas.toDataURL('image/png');

//      const imgWidth = contentWidth;
//      const imgHeight = (canvas.height * imgWidth) / canvas.width;

//      let heightLeft = imgHeight;
//      let position = marginTop;

//      if (!isFirst) pdf.addPage();
//      pdf.addImage(imgData, 'PNG', marginLeft, position, imgWidth, imgHeight);
//      heightLeft -= usablePageHeight;

//      while (heightLeft > 0) {
//        pdf.addPage();
//        position = marginTop - (imgHeight - heightLeft);
//        pdf.addImage(imgData, 'PNG', marginLeft, position, imgWidth, imgHeight);
//        heightLeft -= usablePageHeight;
//      }
//    }

//    // ✅ 1페이지
//    await addElementToPdf(page1, true);

//    // ✅ 2페이지부터 (길면 3~ 자동)
//    await addElementToPdf(page2, false);

//    const eventNo = TotalData1?.eventMaster?.[0]?.eventNo ?? "report";
//    pdf.save(eventNo + '.pdf');

//  } finally {
//    window.scrollTo(0, prevScrollY);
//    root.classList.remove('capture-mode');
//  }
//}


//async function PDFDownload_Button() {
//  const jsPDF = getJsPdf();
//  if (!jsPDF) return;

//  const target = document.getElementById('event-report-container');
//  if (!target) return alert('보고서 영역을 찾을 수 없습니다.');

//  const gisEl = document.getElementById('GISImage');
//  if (!gisEl) return alert('GISImage를 찾을 수 없습니다.');

//  target.classList.add('capture-mode');
//  const prevScrollY = window.scrollY;

//  // ✅ 지도 캡처용 임시 이미지
//  let snapshotImg = null;
//  const prevGisHtml = gisEl.innerHTML; // 원복용 (leaflet dom이 많으면 innerHTML 원복은 비추, 아래 방식 권장)

//  try {
//    window.scrollTo(0, 0);

//    // ✅ Leaflet 안정화(최소)
//    usgsMap?.invalidateSize?.(true);
//    usgsMap?.panBy?.([0, 0], { animate: false }); // move 이벤트 강제
//    AddDistanceArrow({
//      fromLon: GlobalFromLon, fromLat: GlobalFromLat,
//      toLon: GlobalToLon, toLat: GlobalToLat,
//      color: '#c90000',
//      width: 5.5
//    });

//    freezeLeafletTransform(usgsMap);

//    // ✅ 타일/레이어 렌더 한 템포 대기
//    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

//    // ✅ 1) 지도만 먼저 캡처
//    const mapCanvas = await html2canvas(gisEl, {
//      scale: 2,
//      useCORS: true,
//      backgroundColor: "#fff"
//    });
//    const mapImgData = mapCanvas.toDataURL("image/png");

//    // ✅ 2) GISImage 안에 Leaflet 대신 “스냅샷 이미지”를 덮어씌움
//    //    (leaflet dom은 숨기고 img만 보이게)
//    const leafletPane = gisEl.querySelector('.leaflet-container');
//    if (leafletPane) leafletPane.style.display = "none";

//    snapshotImg = document.createElement("img");
//    snapshotImg.src = mapImgData;
//    snapshotImg.style.width = "100%";
//    snapshotImg.style.height = "100%";
//    snapshotImg.style.objectFit = "cover";
//    snapshotImg.setAttribute("data-map-snapshot", "1");
//    gisEl.appendChild(snapshotImg);

//    // ✅ 스냅샷 DOM 반영 대기
//    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));


//    // ✅ 3) 이제 전체 보고서 캡처
//    const canvas = await html2canvas(target, {
//      scale: 2,
//      useCORS: true,
//      scrollX: 0,
//      scrollY: 0,
//      backgroundColor: "#fff"
//    });

//    restoreLeafletTransform(usgsMap);

//    const imgData = canvas.toDataURL('image/png');
//    const pdf = new jsPDF('p', 'mm', 'a4');

//    const pageWidth = pdf.internal.pageSize.getWidth();
//    const pageHeight = pdf.internal.pageSize.getHeight();
//    const imgWidth = pageWidth;
//    const imgHeight = (canvas.height * imgWidth) / canvas.width;

//    let heightLeft = imgHeight;
//    let position = 0;

//    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
//    heightLeft -= pageHeight;

//    while (heightLeft > 0) {
//      pdf.addPage();
//      position = 0 - (imgHeight - heightLeft);
//      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
//      heightLeft -= pageHeight;
//    }

//    const eventNo = TotalData1?.eventMaster?.[0]?.eventNo ?? "report";
//    pdf.save(eventNo + '.pdf');

//  } finally {
//    // ✅ 지도 원복
//    if (snapshotImg) snapshotImg.remove();
//    const gisEl2 = document.getElementById('GISImage');
//    const leafletPane2 = gisEl2?.querySelector('.leaflet-container');
//    if (leafletPane2) leafletPane2.style.display = "";

//    window.scrollTo(0, prevScrollY);
//    target.classList.remove('capture-mode');
//  }
//}

function getJsPdf() {
  if (window.jspdf && window.jspdf.jsPDF) {
    return window.jspdf.jsPDF;
  }

  alert('jsPDF 라이브러리가 로드되지 않았습니다.');
  return null;
}

async function Copy_Button() {
  const el = document.querySelector("#ReportContainer");
  if (!el) return alert("ReportContainer를 찾지 못했습니다.");

  // ✅ 1) 캡처모드 ON
  el.classList.add("capture-mode");

  // ✅ 2) 스크롤바 폭(보통 15~17px)만큼 "가짜 오른쪽 여백"을 추가해서
  //     브라우저에서 보이는 레이아웃 폭과 캡처 레이아웃 폭을 동일하게 맞춤
  const sbw = window.innerWidth - document.documentElement.clientWidth;

  // 기존 padding-right 보존
  const prevPaddingRight = el.style.paddingRight;
  const computedPR = parseFloat(getComputedStyle(el).paddingRight) || 0;

  // 캡처 동안만 padding-right 추가
  el.style.paddingRight = `${computedPR + sbw}px`;

  try {
    // ✅ 레이아웃 반영 대기 (네가 하던 2프레임 유지)
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // ✅ "화면에서 보이는 그대로" 크기를 고정하기 위해 bounding rect 사용
    const rect = el.getBoundingClientRect();

    const canvas = await html2canvas(el, {
      scale: 1,
      useCORS: true,
      backgroundColor: "#fff",
      scrollX: 0,
      scrollY: 0,

      // ✅ 여기서가 핵심: el.scrollWidth/scrollHeight 쓰면
      //    '캡처용으로 다시 계산된 전체 폭'을 따라가서 이미지1과 달라질 수 있음
      //    화면에 보이는 폭/높이를 고정
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),

      // ✅ 캔버스가 참조하는 viewport도 현재 화면 기준으로 고정
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
    });

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);

    alert("클립보드 복사 완료!");
  } finally {
    // ✅ 원복
    el.style.paddingRight = prevPaddingRight;
    el.classList.remove("capture-mode");
  }
}

async function CopyTitle_Button() {
  var AddReportTitle = document.getElementById("ReportLoc").textContent + " " + document.getElementById("ReportMag").textContent + "(인프라, 환경안전 특이사항 없음)";
  if (AddReportTitle != null && AddReportTitle != "") {
    try {
      await navigator.clipboard.writeText(AddReportTitle);
      alert("제목이 클립보드에 복사되었습니다.");
    } catch (err) {
      alert("클립보드 복사에 실패했습니다.");
      console.error(err);
    }
  }
  else {
    alert("제목 복사할 수 있는 내용이 존재하지 않습니다.");
    return;
  }
}


//async function Copy_Button() {
//  const el = document.querySelector("#ReportContainer");
//  if (!el) return alert("ReportContainer를 찾지 못했습니다.");

//  // ✅ 점선 숨김 ON
//  el.classList.add("capture-mode");

//  try {
//    // ✅ 스타일 반영 대기
//    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

//    const canvas = await html2canvas(el, {
//      scale: 2,
//      useCORS: true,
//      backgroundColor: "#fff",
//      scrollX: 0,
//      scrollY: 0
//    });

//    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
//    await navigator.clipboard.write([
//      new ClipboardItem({ "image/png": blob })
//    ]);

//    alert("보고서 이미지를 클립보드에 복사했습니다.");
//  } finally {
//    // ✅ 원복
//    el.classList.remove("capture-mode");
//  }
//}

async function CopyReportForWord_RTF() {
  const reportEl = document.querySelector("#ReportContainer");
  if (!reportEl) return alert("ReportContainer를 찾지 못했습니다.");

  reportEl.classList.add("capture-mode");

  try {
    // 스타일 반영 대기
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(reportEl, {
      scale: 3,
      useCORS: true,
      backgroundColor: "#fff",
      scrollX: 0,
      scrollY: 0
    });

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // PNG 바이너리 -> hex 문자열 (RTF pict는 hex 필요)
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, "0");
    }

    // ✅ Word 폭 맞춤 (A4 일반 여백 기준 대충 170mm 추천)
    // twips: 1 inch = 1440 twips, 1mm = 56.6929 twips
    const widthMm = 170;
    const picwgoal = Math.round(widthMm * 56.6929);

    // 비율 유지해서 높이 계산
    const ratio = canvas.height / canvas.width;
    const pichgoal = Math.round(picwgoal * ratio);

    // picw/pich는 픽셀 수(캔버스 px)
    const picw = canvas.width;
    const pich = canvas.height;

    // RTF 생성 (이미지 하나)
    const rtf =
      `{\\rtf1\\ansi` +
      `{\\pict\\pngblip\\picw${picw}\\pich${pich}\\picwgoal${picwgoal}\\pichgoal${pichgoal}\n` +
      `${hex}}` +
      `}`;

    await navigator.clipboard.write([
      new ClipboardItem({
        // ✅ Word가 가장 잘 먹는 포맷
        "text/rtf": new Blob([rtf], { type: "text/rtf" }),
        // ✅ 혹시 RTF가 막히면 최소한 이미지라도 붙게(환경 따라 다름)
        "image/png": blob,
        "text/plain": new Blob(["(보고서 이미지)"], { type: "text/plain" })
      })
    ]);

    alert("워드용(RTF) 복사 완료! Word에 Ctrl+V 해보세요.");
  } catch (e) {
    console.error(e);
    alert("워드용 복사 실패: 브라우저/권한 정책 확인 필요");
  } finally {
    reportEl.classList.remove("capture-mode");
  }
}

async function CopyReportForWord() {
  const reportEl = document.querySelector("#ReportContainer");
  if (!reportEl) return alert("ReportContainer를 찾지 못했습니다.");

  reportEl.classList.add("capture-mode");

  try {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(reportEl, {
      scale: 3,
      useCORS: true,
      backgroundColor: "#fff",
      scrollX: 0,
      scrollY: 0
    });

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));

    // blob -> base64 dataURL (HTML용)
    const dataUrl = await new Promise(resolve => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });

    // ✅ Word가 HTML을 채택하면 width:100%로 들어감
    const html = `
      <html>
        <body>
          <img src="${dataUrl}" style="width:100%; height:auto; display:block;" />
        </body>
      </html>
    `;

    // ✅ 핵심: HTML + PNG 둘 다 제공
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "image/png": blob,
        "text/plain": new Blob(["(보고서 이미지)"], { type: "text/plain" })
      })
    ]);

    alert("워드용 복사 완료! (Word에서는 붙여넣기 옵션에서 '원본 서식 유지' 권장)");
  } catch (err) {
    console.error(err);
    alert("클립보드 복사가 차단되었습니다. (HTTP/권한/브라우저 정책 가능)");
  } finally {
    reportEl.classList.remove("capture-mode");
  }
}


function freezeLeafletTransform(map) {
  const panes = map.getPanes();
  const targets = [panes.tilePane, panes.overlayPane, panes.markerPane, panes.shadowPane];

  targets.forEach((el) => {
    if (!el) return;
    const cs = getComputedStyle(el).transform;
    el.dataset._transform = el.style.transform;   // 원래 inline 저장
    el.dataset._csTransform = cs;                 // computed도 참고용으로 저장
    el.style.transform = "translate3d(0px,0px,0px)";
  });
}

function restoreLeafletTransform(map) {
  const panes = map.getPanes();
  const targets = [panes.tilePane, panes.overlayPane, panes.markerPane, panes.shadowPane];

  targets.forEach((el) => {
    if (!el) return;
    if (el.dataset._transform !== undefined) {
      el.style.transform = el.dataset._transform;
      delete el.dataset._transform;
      delete el.dataset._csTransform;
    } else {
      el.style.transform = "";
    }
  });
}


// 기준(baseLon)에서 가장 가까운 월드로 targetLon을 맞춤(±360 보정)
function alignLngTo(baseLon, targetLon) {
  let b = Number(baseLon);
  let t = Number(targetLon);
  if (!Number.isFinite(b) || !Number.isFinite(t)) return targetLon;

  let d = t - b;
  if (d > 180) t -= 360;
  else if (d < -180) t += 360;

  return t;
}

function wrapLng(lng) {
  lng = Number(lng);
  if (!Number.isFinite(lng)) return lng;

  // -180 ~ 180 범위로 강제
  return ((lng + 180) % 360 + 360) % 360 - 180;
}
