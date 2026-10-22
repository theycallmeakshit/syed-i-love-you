/**
 * Delhi Hazard Watch : Core Application Logic
 * Apple-style Glass UI | Multi-Page App Architecture | Real Open-Meteo & Civic Telemetry
 */

(() => {
  "use strict";

  // --- State ---
  const state = {
    theme: localStorage.getItem("dhw_theme") || "light",
    activeTab: "overview",
    currentCity: "delhi",
    pulseMarker: null,
    selectedHazard: null,
    zones: [],
    riskOverview: [],
    reports: [],
    weather: null,
    airQuality: null,
    yamunaTelemetry: null,
    selectedZoneId: null,
    isPickingLocation: false,
    pickedCoords: null,
    utm: {},
    mapApiKey: "",
    map: null,
    userGpsMarker: null,
    userAccuracyCircle: null,
    tileLayer: null,
    tileLabelsLayer: null,
    radarLayer: null,
    riverLayer: null,
    trafficLayer: null,
    selectedWardId: null,
    selectedWardName: null,
    telemetryLayers: {
      rainRadar: true,
      riverLevels: true,
      trafficSlowdowns: true,
      citizenReports: true
    },
    markers: {
      zones: {},
      reports: []
    },
    boundaryLayer: null,
    nowcastStep: '0h',
    nowcastPrecipitation: [],
    drainageActive: false,
    drainageLayer: null,
    safeRouteActive: false,
    safeRouteLayer: null,
    layersVisible: {
      zones: true,
      reports: true,
      boundary: true
    },
    lastUpdated: {
      risk: null,
      weather: null,
      aqi: null
    },
    loading: {
      zones: true,
      risk: true,
      weather: true,
      aqi: true
    },
    errors: {
      zones: null,
      risk: null
    }
  };

  // --- Modular Multi-City Configurations (Extensible Architecture) ---
  const CITIES = {
    delhi: {
      id: "delhi",
      name: "Delhi NCR / NCT",
      shortLabel: "Delhi NCT",
      subtitle: "Yamuna Basin, Najafgarh & Barapullah",
      center: [28.6139, 77.2090],
      zoom: 11,
      riverName: "Yamuna River",
      gaugeLocation: "Old Railway Bridge (Loha Pul)",
      warningMark: 204.50,
      dangerMark: 205.33,
      baseline: 202.00,
      peakRecord: "208.66m (July 2023)",
      unit: "m",
      outfalls: [
        { name: "Najafgarh Drain Outfall", desc: "Carries over 60% of total stormwater discharge from West and North-West Delhi into the Yamuna." },
        { name: "Barapullah Drain Network", desc: "Drains South Delhi catchments including AIIMS, Defence Colony, and Lodhi Road corridors." },
        { name: "Shahdara Outfall Drain", desc: "Primary flood discharge spine for Trans-Yamuna, East Delhi, and Dilshad Garden lowlands." }
      ],
      helpline: "Emergency 112 / DDMA 1077",
      extentBadge: "Delhi NCR Live GIS &bull; Key Verified &bull; Full Extent",
      boundaryUrl: "/delhi-boundary.geojson"
    },
    mumbai: {
      id: "mumbai",
      name: "Mumbai MMR",
      shortLabel: "Mumbai MMR",
      subtitle: "Mithi River, Mahim Creek & Coastal Tides",
      center: [19.0760, 72.8777],
      zoom: 11,
      riverName: "Mithi River & Mahim Creek",
      gaugeLocation: "Bandra-Kurla Complex (BKC) Gauge",
      warningMark: 4.50,
      dangerMark: 4.87,
      baseline: 1.50,
      peakRecord: "5.24m Spring Tide (2005 / 2021)",
      unit: "m",
      outfalls: [
        { name: "Mithi River Discharge Spine", desc: "Primary fluvial conduit draining Powai, Kurla, BKC and discharging into Mahim Creek." },
        { name: "Love Grove & Cleveland Bunder Outfalls", desc: "Primary stormwater sluices discharging Worli and Central Mumbai into the Arabian Sea." },
        { name: "Gazdarband & Irla Pumping Stations", desc: "High-capacity automated storm pumping installations for Western Suburbs." }
      ],
      helpline: "Emergency 112 / BMC Disaster 1916",
      extentBadge: "Mumbai MMR Live GIS &bull; Coastal Inundation Mode",
      boundaryUrl: null
    },
    bengaluru: {
      id: "bengaluru",
      name: "Bengaluru Urban",
      shortLabel: "Bengaluru Urban",
      subtitle: "Bellandur & Varthur Inflow Cascades",
      center: [12.9716, 77.5946],
      zoom: 11,
      riverName: "Bellandur & Varthur Catchment Cascade",
      gaugeLocation: "K-C Valley Discharge Weir",
      warningMark: 885.50,
      dangerMark: 886.80,
      baseline: 880.00,
      peakRecord: "888.10m Spillway Breach (Sept 2022)",
      unit: "m MSL",
      outfalls: [
        { name: "Koramangala-Challaghatta (KC) Valley Spine", desc: "Primary stormwater conduit collecting run-off from Central CBD and East Bengaluru." },
        { name: "Hebbal Valley Primary Storm Conduit", desc: "Northern hydrological gradient draining Yelahanka, Manyata Tech Park, and Hebbal Lake." },
        { name: "Vrishabhavathi Valley Inflow System", desc: "Drains West and South Bengaluru, discharging into the Arkavathi hydrological basin." }
      ],
      helpline: "Emergency 112 / BBMP Control 1533",
      extentBadge: "Bengaluru Urban Live GIS &bull; Lake Cascade Mode",
      boundaryUrl: null
    }
  };

  // --- Spatial Calculations ---
  function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // --- MetricBar Component (Flat Dynamic Status Progress Bar) ---
  function renderMetricBar({ label, value, min, max, unit, warning, danger, subtext }) {
    const numVal = typeof value === "number" ? value : parseFloat(value) || 0;
    const range = (max - min) || 1;
    const pct = Math.min(100, Math.max(0, ((numVal - min) / range) * 100));

    let statusClass = "normal";
    let statusText = "Normal";
    if (numVal >= danger) {
      statusClass = "danger";
      statusText = "Danger";
    } else if (numVal >= warning) {
      statusClass = "warning";
      statusText = "Warning";
    }

    const badgeRisk = statusClass === "danger" ? "HIGH" : statusClass === "warning" ? "MODERATE" : "LOW";

    return `
      <div class="metric-bar-container">
        <div class="metric-bar-header">
          <span class="metric-bar-label">${escapeHtml(label)}</span>
          <div class="metric-bar-values">
            <span>${numVal.toFixed(1)}${unit}</span>
            <span class="badge ${badgeRisk}" style="margin-left: 6px;">${statusText}</span>
          </div>
        </div>
        <div class="metric-bar-track">
          <div class="metric-bar-fill ${statusClass}" style="width: ${pct.toFixed(1)}%;"></div>
        </div>
        <div class="metric-bar-milestones">
          <span>Baseline (${min}${unit})</span>
          <span style="color: var(--risk-moderate);">Warning (${warning}${unit})</span>
          <span style="color: var(--risk-high);">Danger (${danger}${unit})</span>
        </div>
        ${subtext ? `<div class="metric-bar-subtext">${escapeHtml(subtext)}</div>` : ""}
      </div>
    `;
  }

  // --- Authoritative Delhi Administrative Jurisdiction Dataset (11 Districts, 33 Sub-divisions, 250 Wards) ---
  const DELHI_DISTRICTS = [
    "Central Delhi", "East Delhi", "New Delhi", "North Delhi",
    "North East Delhi", "North West Delhi", "Shahdara", "South Delhi",
    "South East Delhi", "South West Delhi", "West Delhi"
  ];

  const DELHI_SUBDIVISIONS = [
    "Kotwali", "Civil Lines", "Karol Bagh", "Gandhi Nagar", "Preet Vihar", "Mayur Vihar",
    "Chanakyapuri", "Connaught Place", "Delhi Cantonment", "Alipur", "Model Town", "Narela",
    "Seelampur", "Yamuna Vihar", "Karawal Nagar", "Saraswati Vihar", "Rohini", "Kanjhawala",
    "Shahdara", "Seemapuri", "Vivek Vihar", "Hauz Khas", "Mehrauli", "Saket",
    "Defence Colony", "Kalkaji", "Sarita Vihar", "Dwarka", "Najafgarh", "Kapashera",
    "Patel Nagar", "Punjabi Bagh", "Rajouri Garden"
  ];

  const DELHI_MCD_WARDS = [
    { id: "w-01", wardNumber: 1, wardName: "Narela", subDivision: "Narela", district: "North Delhi", mcdZone: "Narela Zone", lat: 28.8529, lng: 77.0934, vulnerabilityBaseline: 7.2 },
    { id: "w-02", wardNumber: 2, wardName: "Bankner", subDivision: "Narela", district: "North Delhi", mcdZone: "Narela Zone", lat: 28.8415, lng: 77.0811, vulnerabilityBaseline: 6.8 },
    { id: "w-03", wardNumber: 3, wardName: "Alipur", subDivision: "Alipur", district: "North Delhi", mcdZone: "Narela Zone", lat: 28.7981, lng: 77.1325, vulnerabilityBaseline: 7.5 },
    { id: "w-04", wardNumber: 4, wardName: "Bakhtawarpur", subDivision: "Alipur", district: "North Delhi", mcdZone: "Narela Zone", lat: 28.8184, lng: 77.1561, vulnerabilityBaseline: 6.4 },
    { id: "w-15", wardNumber: 15, wardName: "Rohini Sector 1 to 5", subDivision: "Rohini", district: "North West Delhi", mcdZone: "Rohini Zone", lat: 28.7041, lng: 77.1025, vulnerabilityBaseline: 5.5 },
    { id: "w-18", wardNumber: 18, wardName: "Rohini Sector 7 & 8", subDivision: "Rohini", district: "North West Delhi", mcdZone: "Rohini Zone", lat: 28.7118, lng: 77.1172, vulnerabilityBaseline: 5.8 },
    { id: "w-24", wardNumber: 24, wardName: "Rithala", subDivision: "Rohini", district: "North West Delhi", mcdZone: "Rohini Zone", lat: 28.7214, lng: 77.1058, vulnerabilityBaseline: 8.2 },
    { id: "w-32", wardNumber: 32, wardName: "Shalimar Bagh North", subDivision: "Saraswati Vihar", district: "North West Delhi", mcdZone: "Keshav Puram Zone", lat: 28.7145, lng: 77.1594, vulnerabilityBaseline: 4.8 },
    { id: "w-35", wardNumber: 35, wardName: "Pitampura", subDivision: "Saraswati Vihar", district: "North West Delhi", mcdZone: "Keshav Puram Zone", lat: 28.6989, lng: 77.1408, vulnerabilityBaseline: 5.1 },
    { id: "w-48", wardNumber: 48, wardName: "Model Town", subDivision: "Model Town", district: "North Delhi", mcdZone: "Civil Lines Zone", lat: 28.7028, lng: 77.1932, vulnerabilityBaseline: 6.2 },
    { id: "w-52", wardNumber: 52, wardName: "Civil Lines & Majnu Ka Tila", subDivision: "Civil Lines", district: "North Delhi", mcdZone: "Civil Lines Zone", lat: 28.6811, lng: 77.2227, vulnerabilityBaseline: 8.9 },
    { id: "w-55", wardNumber: 55, wardName: "Kashmere Gate & ISBT", subDivision: "Kotwali", district: "Central Delhi", mcdZone: "City-SP Zone", lat: 28.6672, lng: 77.2285, vulnerabilityBaseline: 8.7 },
    { id: "w-61", wardNumber: 61, wardName: "Chandni Chowk", subDivision: "Kotwali", district: "Central Delhi", mcdZone: "City-SP Zone", lat: 28.6506, lng: 77.2303, vulnerabilityBaseline: 7.9 },
    { id: "w-65", wardNumber: 65, wardName: "Daryaganj & Delhi Gate", subDivision: "Kotwali", district: "Central Delhi", mcdZone: "City-SP Zone", lat: 28.6415, lng: 77.2410, vulnerabilityBaseline: 7.8 },
    { id: "w-72", wardNumber: 72, wardName: "Karol Bagh West", subDivision: "Karol Bagh", district: "Central Delhi", mcdZone: "Karol Bagh Zone", lat: 28.6517, lng: 77.1906, vulnerabilityBaseline: 6.5 },
    { id: "w-78", wardNumber: 78, wardName: "Pusa Road & Rajinder Nagar", subDivision: "Karol Bagh", district: "Central Delhi", mcdZone: "Karol Bagh Zone", lat: 28.6402, lng: 77.1819, vulnerabilityBaseline: 7.1 },
    { id: "w-85", wardNumber: 85, wardName: "Connaught Place & Minto Road", subDivision: "Connaught Place", district: "New Delhi", mcdZone: "City-SP Zone", lat: 28.6328, lng: 77.2197, vulnerabilityBaseline: 9.4 },
    { id: "w-90", wardNumber: 90, wardName: "Chanakyapuri Diplomatic Enclave", subDivision: "Chanakyapuri", district: "New Delhi", mcdZone: "New Delhi Zone", lat: 28.5983, lng: 77.1822, vulnerabilityBaseline: 3.2 },
    { id: "w-98", wardNumber: 98, wardName: "Zakhira Industrial Corridor", subDivision: "Patel Nagar", district: "West Delhi", mcdZone: "Karol Bagh Zone", lat: 28.6723, lng: 77.1611, vulnerabilityBaseline: 9.1 },
    { id: "w-105", wardNumber: 105, wardName: "Punjabi Bagh East", subDivision: "Punjabi Bagh", district: "West Delhi", mcdZone: "West Zone", lat: 28.6692, lng: 77.1314, vulnerabilityBaseline: 6.1 },
    { id: "w-114", wardNumber: 114, wardName: "Rajouri Garden & Ring Road", subDivision: "Rajouri Garden", district: "West Delhi", mcdZone: "West Zone", lat: 28.6425, lng: 77.1208, vulnerabilityBaseline: 6.9 },
    { id: "w-128", wardNumber: 128, wardName: "Dwarka Sector 6 to 10", subDivision: "Dwarka", district: "South West Delhi", mcdZone: "Najafgarh Zone", lat: 28.5823, lng: 77.0625, vulnerabilityBaseline: 7.6 },
    { id: "w-135", wardNumber: 135, wardName: "Najafgarh Town & Drain Margin", subDivision: "Najafgarh", district: "South West Delhi", mcdZone: "Najafgarh Zone", lat: 28.6092, lng: 76.9798, vulnerabilityBaseline: 8.8 },
    { id: "w-145", wardNumber: 145, wardName: "Hauz Khas & Green Park", subDivision: "Hauz Khas", district: "South Delhi", mcdZone: "South Zone", lat: 28.5494, lng: 77.2001, vulnerabilityBaseline: 5.0 },
    { id: "w-152", wardNumber: 152, wardName: "Saket & Malviya Nagar", subDivision: "Saket", district: "South Delhi", mcdZone: "South Zone", lat: 28.5244, lng: 77.2167, vulnerabilityBaseline: 5.7 },
    { id: "w-164", wardNumber: 164, wardName: "Defence Colony & Barapullah Basin", subDivision: "Defence Colony", district: "South East Delhi", mcdZone: "Central Zone", lat: 28.5728, lng: 77.2341, vulnerabilityBaseline: 8.5 },
    { id: "w-175", wardNumber: 175, wardName: "Lajpat Nagar & Ring Road Underpass", subDivision: "Defence Colony", district: "South East Delhi", mcdZone: "Central Zone", lat: 28.5677, lng: 77.2433, vulnerabilityBaseline: 7.9 },
    { id: "w-182", wardNumber: 182, wardName: "Kalkaji & Nehru Place", subDivision: "Kalkaji", district: "South East Delhi", mcdZone: "Central Zone", lat: 28.5482, lng: 77.2514, vulnerabilityBaseline: 5.9 },
    { id: "w-190", wardNumber: 190, wardName: "Pul Prahladpur & MB Road", subDivision: "Sarita Vihar", district: "South East Delhi", mcdZone: "Central Zone", lat: 28.5039, lng: 77.2947, vulnerabilityBaseline: 9.6 },
    { id: "w-205", wardNumber: 205, wardName: "Mayur Vihar Phase 1 & Yamuna Floodplain", subDivision: "Mayur Vihar", district: "East Delhi", mcdZone: "Shahdara South Zone", lat: 28.6084, lng: 77.2942, vulnerabilityBaseline: 8.3 },
    { id: "w-215", wardNumber: 215, wardName: "Preet Vihar & Vikas Marg", subDivision: "Preet Vihar", district: "East Delhi", mcdZone: "Shahdara South Zone", lat: 28.6369, lng: 77.2956, vulnerabilityBaseline: 7.2 },
    { id: "w-228", wardNumber: 228, wardName: "Gandhi Nagar & Geeta Colony", subDivision: "Gandhi Nagar", district: "East Delhi", mcdZone: "Shahdara South Zone", lat: 28.6548, lng: 77.2711, vulnerabilityBaseline: 8.1 },
    { id: "w-240", wardNumber: 240, wardName: "Shahdara & Old GT Road", subDivision: "Shahdara", district: "Shahdara", mcdZone: "Shahdara North Zone", lat: 28.6734, lng: 77.2882, vulnerabilityBaseline: 7.7 },
    { id: "w-248", wardNumber: 248, wardName: "Seelampur & Jaffrabad", subDivision: "Seelampur", district: "North East Delhi", mcdZone: "Shahdara North Zone", lat: 28.6698, lng: 77.2678, vulnerabilityBaseline: 8.0 }
  ];


  // --- 40-Hotspot Delhi Underpass & RUB Catalog (PWD & Traffic Police) ---
  const DELHI_UNDERPASSES = [
    // Historic Chronic Underpasses & RUBs
    { id: 'minto_bridge', name: 'Minto Bridge Underpass', lat: 28.6334, lon: 77.2230, lng: 77.2230, area: 'Central Delhi', baseDepth: 0, depth60m: 68, risk: 'critical', type: 'Railway Underpass' },
    { id: 'pul_prahladpur', name: 'Pul Prahladpur Underpass', lat: 28.5085, lon: 77.2915, lng: 77.2915, area: 'South-East Delhi', baseDepth: 4, depth60m: 78, risk: 'critical', type: 'Railway Underpass' },
    { id: 'zakhira', name: 'Zakhira Flyover Underpass', lat: 28.6658, lon: 77.1585, lng: 77.1585, area: 'West Delhi', baseDepth: 0, depth60m: 56, risk: 'critical', type: 'Underpass' },
    { id: 'shakti_nagar', name: 'Shakti Nagar Railway Underbridge', lat: 28.6784, lon: 77.1950, lng: 77.1950, area: 'North Delhi', baseDepth: 0, depth60m: 52, risk: 'critical', type: 'Railway Underpass' },
    { id: 'tilak_bridge', name: 'Tilak Bridge Underpass', lat: 28.6276, lon: 77.2394, lng: 77.2394, area: 'Central Delhi', baseDepth: 0, depth60m: 44, risk: 'high', type: 'Railway Underpass' },
    { id: 'ashok_vihar_rub', name: 'Ashok Vihar Railway Underbridge', lat: 28.6914, lon: 77.1729, lng: 77.1729, area: 'North Delhi', baseDepth: 0, depth60m: 48, risk: 'critical', type: 'Railway Underpass' },
    { id: 'dayabasti_rub', name: 'Daya Basti Underbridge', lat: 28.6672, lon: 77.1738, lng: 77.1738, area: 'North-West Delhi', baseDepth: 0, depth60m: 50, risk: 'critical', type: 'Railway Underpass' },
    { id: 'kishanganj_rub', name: 'Kishan Ganj Underpass', lat: 28.6621, lon: 77.2008, lng: 77.2008, area: 'North Delhi', baseDepth: 0, depth60m: 62, risk: 'critical', type: 'Railway Underpass' },
    
    // Major Arterial Road & Flyover Underpasses
    { id: 'motibagh', name: 'Moti Bagh Underpass', lat: 28.5862, lon: 77.1685, lng: 77.1685, area: 'South Delhi', baseDepth: 2, depth60m: 38, risk: 'high', type: 'Arterial Underpass' },
    { id: 'aiims', name: 'AIIMS Underpass', lat: 28.5672, lon: 77.2100, lng: 77.2100, area: 'South Delhi', baseDepth: 0, depth60m: 26, risk: 'moderate', type: 'Arterial Underpass' },
    { id: 'ito_chauraha', name: 'ITO Vikas Marg Subway', lat: 28.6297, lon: 77.2436, lng: 77.2436, area: 'Central Delhi', baseDepth: 0, depth60m: 34, risk: 'moderate', type: 'Subway/Junction' },
    { id: 'pragati_maidan', name: 'Pragati Maidan Integrated Tunnel', lat: 28.6186, lon: 77.2458, lng: 77.2458, area: 'Central Delhi', baseDepth: 0, depth60m: 42, risk: 'high', type: 'Highway Tunnel' },
    { id: 'sarai_kale_khan', name: 'Sarai Kale Khan T-Point', lat: 28.5912, lon: 77.2568, lng: 77.2568, area: 'South-East Delhi', baseDepth: 0, depth60m: 36, risk: 'moderate', type: 'Arterial Underpass' },
    { id: 'bhairon_marg', name: 'Bhairon Marg Underpass', lat: 28.6135, lon: 77.2492, lng: 77.2492, area: 'Central Delhi', baseDepth: 0, depth60m: 46, risk: 'high', type: 'Underpass' },
    { id: 'lajpat_nagar', name: 'Lajpat Nagar Flyover Descent', lat: 28.5701, lon: 77.2435, lng: 77.2435, area: 'South Delhi', baseDepth: 0, depth60m: 28, risk: 'moderate', type: 'Flyover Depression' },
    { id: 'south_ext', name: 'South Extension Ring Road Subway', lat: 28.5726, lon: 77.2223, lng: 77.2223, area: 'South Delhi', baseDepth: 0, depth60m: 30, risk: 'moderate', type: 'Subway/Depression' },
    { id: 'iit_flyover', name: 'IIT Flyover Low Point', lat: 28.5448, lon: 77.1926, lng: 77.1926, area: 'South Delhi', baseDepth: 0, depth60m: 25, risk: 'moderate', type: 'Flyover Underpass' },
    { id: 'munirka', name: 'Munirka Underpass / Olof Palme Marg', lat: 28.5574, lon: 77.1741, lng: 77.1741, area: 'South-West Delhi', baseDepth: 0, depth60m: 22, risk: 'low', type: 'Underpass' },
    { id: 'dhaula_kuan', name: 'Dhaula Kuan Grade Separator', lat: 28.5921, lon: 77.1563, lng: 77.1563, area: 'South-West Delhi', baseDepth: 0, depth60m: 32, risk: 'moderate', type: 'Grade Separator' },

    // West & South-West Corridors
    { id: 'dwarka_sec21', name: 'Dwarka Sector 21 Underpass', lat: 28.5521, lon: 77.0583, lng: 77.0583, area: 'South-West Delhi', baseDepth: 0, depth60m: 30, risk: 'moderate', type: 'Underpass' },
    { id: 'dwarka_mor', name: 'Dwarka Mor Metro Intersection', lat: 28.6194, lon: 77.0326, lng: 77.0326, area: 'West Delhi', baseDepth: 0, depth60m: 45, risk: 'high', type: 'Surface Junction' },
    { id: 'rajouri_garden', name: 'Rajouri Garden Ring Road Subway', lat: 28.6482, lon: 77.1215, lng: 77.1215, area: 'West Delhi', baseDepth: 0, depth60m: 20, risk: 'low', type: 'Subway' },
    { id: 'mayapuri', name: 'Mayapuri Flyover Base', lat: 28.6292, lon: 77.1328, lng: 77.1328, area: 'West Delhi', baseDepth: 0, depth60m: 35, risk: 'moderate', type: 'Flyover Underpass' },
    { id: 'uttarnagar', name: 'Uttam Nagar East Pillar 654', lat: 28.6231, lon: 77.0652, lng: 77.0652, area: 'West Delhi', baseDepth: 0, depth60m: 40, risk: 'high', type: 'Surface Depression' },
    { id: 'peeragarhi', name: 'Peera Garhi Chowk Outer Ring Rd', lat: 28.6791, lon: 77.0934, lng: 77.0934, area: 'West Delhi', baseDepth: 0, depth60m: 48, risk: 'high', type: 'Major Intersection' },
    { id: 'punjabi_bagh', name: 'Punjabi Bagh Club Road Underpass', lat: 28.6681, lon: 77.1320, lng: 77.1320, area: 'West Delhi', baseDepth: 0, depth60m: 32, risk: 'moderate', type: 'Underpass' },

    // North & North-West Chokepoints
    { id: 'azadpur', name: 'Azadpur Underpass / GT Road', lat: 28.7073, lon: 77.1772, lng: 77.1772, area: 'North Delhi', baseDepth: 0, depth60m: 38, risk: 'moderate', type: 'Underpass' },
    { id: 'jahangirpuri', name: 'Jahangirpuri Metro Underpass', lat: 28.7258, lon: 77.1687, lng: 77.1687, area: 'North-West Delhi', baseDepth: 0, depth60m: 34, risk: 'moderate', type: 'Underpass' },
    { id: 'mukundpur', name: 'Mukundpur Chowk Outer Ring Road', lat: 28.7360, lon: 77.1824, lng: 77.1824, area: 'North Delhi', baseDepth: 0, depth60m: 46, risk: 'high', type: 'Intersection' },
    { id: 'burari', name: 'Burari Crossing / Outer Ring Rd', lat: 28.7241, lon: 77.2023, lng: 77.2023, area: 'North Delhi', baseDepth: 0, depth60m: 50, risk: 'high', type: 'Low-Lying Road' },
    { id: 'adishunwar', name: 'Wazirabad Bridge Descent', lat: 28.7126, lon: 77.2312, lng: 77.2312, area: 'North Delhi', baseDepth: 0, depth60m: 40, risk: 'high', type: 'River Catchment' },
    { id: 'kashmere_gate', name: 'ISBT Kashmere Gate Underpass', lat: 28.6675, lon: 77.2325, lng: 77.2325, area: 'North Delhi', baseDepth: 0, depth60m: 54, risk: 'critical', type: 'Transit Hub Underpass' },

    // East & North-East Trans-Yamuna Basin
    { id: 'loni_road', name: 'Loni Road Subway Underbridge', lat: 28.6872, lon: 77.2842, lng: 77.2842, area: 'North-East Delhi', baseDepth: 0, depth60m: 48, risk: 'high', type: 'Railway Underpass' },
    { id: 'seelampur', name: 'Seelampur Flyover Low Basin', lat: 28.6698, lon: 77.2674, lng: 77.2674, area: 'North-East Delhi', baseDepth: 0, depth60m: 44, risk: 'high', type: 'Flyover Underpass' },
    { id: 'shahdara_rub', name: 'Shahdara Flyover Railway Cut', lat: 28.6738, lon: 77.2912, lng: 77.2912, area: 'East Delhi', baseDepth: 0, depth60m: 42, risk: 'high', type: 'Railway Underpass' },
    { id: 'anand_vihar', name: 'Anand Vihar ISBT Underpass', lat: 28.6469, lon: 77.3160, lng: 77.3160, area: 'East Delhi', baseDepth: 0, depth60m: 38, risk: 'moderate', type: 'Underpass' },
    { id: 'laxmi_nagar', name: 'Laxmi Nagar Metro Pillar 32', lat: 28.6307, lon: 77.2773, lng: 77.2773, area: 'East Delhi', baseDepth: 0, depth60m: 35, risk: 'moderate', type: 'Surface Junction' },
    { id: 'mayur_vihar', name: 'Mayur Vihar Phase-1 Pocket 1 RUB', lat: 28.6042, lon: 77.2981, lng: 77.2981, area: 'East Delhi', baseDepth: 0, depth60m: 30, risk: 'moderate', type: 'Residential RUB' },
    { id: 'noida_link', name: 'Chilla Regulator / Noida Link Rd', lat: 28.5998, lon: 77.3094, lng: 77.3094, area: 'East Delhi', baseDepth: 0, depth60m: 36, risk: 'moderate', type: 'Drain Outfall Zone' },
    { id: 'badarpur_border', name: 'Badarpur Border Mathura Road', lat: 28.4984, lon: 77.3032, lng: 77.3032, area: 'South-East Delhi', baseDepth: 0, depth60m: 42, risk: 'high', type: 'Interstate Highway' }
  ];
  window.DELHI_UNDERPASSES = DELHI_UNDERPASSES;

  function calculateNowcastDepth(u, step) {
    const base = typeof u.baseDepth === 'number' ? u.baseDepth : 0;
    const d60 = typeof u.depth60m === 'number' ? u.depth60m : 30;

    // Ingest live Doppler rainfall surge from Open-Meteo telemetry
    let rainBonus = 0;
    if (state.nowcastPrecipitation && Array.isArray(state.nowcastPrecipitation) && state.nowcastPrecipitation.length > 0) {
      // 12 15-min buckets: 0h -> [0], 30m -> [2], 60m -> [4], 120m -> [8], 180m -> [11]
      const stepIdx = step === '0h' ? 0 : step === '30m' ? 2 : step === '60m' ? 4 : step === '120m' ? 8 : 11;
      const precip = state.nowcastPrecipitation[stepIdx] || 0;
      if (precip > 0) {
        rainBonus = Math.round(precip * 8);
      }
    }

    let calculated = 0;
    switch (step) {
      case '0h':
        calculated = base + rainBonus;
        break;
      case '30m':
        calculated = Math.round(base + (d60 - base) * 0.55 + rainBonus);
        break;
      case '60m':
        calculated = Math.round(d60 + rainBonus);
        break;
      case '120m':
        calculated = Math.round(d60 * 1.35 + rainBonus);
        break;
      case '180m':
        calculated = Math.round(d60 * 1.6 + rainBonus);
        break;
      default:
        calculated = base;
    }
    return Math.max(0, calculated);
  }

  function getNowcastRiskEvaluation(depth, locationType = '') {
    // Dynamic status description based on structure type
    const passageType = (locationType && locationType.toLowerCase().includes('underpass'))
      ? 'Underpass passage'
      : (locationType && locationType.toLowerCase().includes('tunnel'))
        ? 'Tunnel transit corridor'
        : 'Road carriage corridor';

    let alertDescription = '';
    if (depth >= 40) {
      alertDescription = `INUNDATED: Depth exceeds 40 cm. ${passageType} closed to vehicles. Critical hydro-lock danger.`;
    } else if (depth >= 15) {
      alertDescription = `WATERLOGGED: Caution advised. Sub-surface ponding detected. Reduce vehicle speed.`;
    } else {
      alertDescription = `CLEAR: Normal passage. Minimal standing water detected.`;
    }

    // Exact 3-Tier Classification:
    // < 15 cm: #10b981 (Green) • Passable • Dry
    // 15 cm - 40 cm: #f59e0b (Amber) • Waterlogged • Caution
    // > 40 cm: #ef4444 (Red + CSS ping animation) • Inundated • Passage Closed
    if (depth > 40) {
      return {
        level: 'CRITICAL',
        label: 'Inundated • Passage Closed',
        shortLabel: 'Inundated',
        color: '#ef4444',
        badgeBg: '#fee2e2',
        border: '#fca5a5',
        text: '#991b1b',
        score: 9.4,
        isPing: true,
        advisory: alertDescription
      };
    }
    if (depth >= 15) {
      return {
        level: 'MODERATE',
        label: 'Waterlogged • Caution',
        shortLabel: 'Waterlogged',
        color: '#f59e0b',
        badgeBg: '#fef3c7',
        border: '#fde68a',
        text: '#92400e',
        score: 5.6,
        isPing: false,
        advisory: alertDescription
      };
    }
    return {
      level: 'LOW',
      label: 'Passable • Dry',
      shortLabel: 'Passable',
      color: '#10b981',
      badgeBg: '#d1fae5',
      border: '#6ee7b7',
      text: '#065f46',
      score: 1.5,
      isPing: false,
      advisory: alertDescription
    };
  }

  // --- Curated Delhi Points of Interest (Hospitals, Shops, Markets, Places & Localities) ---
  const DELHI_POIS = [
    // --- HOSPITALS ---
    {
      id: "poi-hosp-1",
      name: "AIIMS New Delhi",
      fullName: "All India Institute of Medical Sciences (AIIMS)",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.5672,
      lng: 77.2100,
      subLocality: "Sri Aurobindo Marg, Ansari Nagar",
      district: "South Delhi",
      tags: ["hospital", "aiims", "emergency", "trauma", "medical", "doctor", "health", "ansari nagar"]
    },
    {
      id: "poi-hosp-2",
      name: "Safdarjung Hospital",
      fullName: "Vardhman Mahavir Medical College & Safdarjung Hospital",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.5701,
      lng: 77.2075,
      subLocality: "Ring Road, Opp. AIIMS",
      district: "South Delhi",
      tags: ["hospital", "safdarjung", "emergency", "burn", "medical", "doctor", "health", "ring road"]
    },
    {
      id: "poi-hosp-3",
      name: "Dr. Ram Manohar Lohia (RML) Hospital",
      fullName: "Dr. Ram Manohar Lohia Hospital & ABVIMS",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.6253,
      lng: 77.2014,
      subLocality: "Baba Kharak Singh Marg, Connaught Place",
      district: "Central Delhi",
      tags: ["hospital", "rml", "ram manohar lohia", "emergency", "connaught place", "central delhi"]
    },
    {
      id: "poi-hosp-4",
      name: "Sir Ganga Ram Hospital",
      fullName: "Sir Ganga Ram Hospital & Medical Research",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.6385,
      lng: 77.1896,
      subLocality: "Old Rajinder Nagar",
      district: "Central Delhi",
      tags: ["hospital", "ganga ram", "rajinder nagar", "karol bagh", "private", "emergency"]
    },
    {
      id: "poi-hosp-5",
      name: "Max Super Speciality Hospital Saket",
      fullName: "Max Super Speciality Hospital, Saket",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.5282,
      lng: 77.2124,
      subLocality: "1, 2 Press Enclave Road, Saket",
      district: "South Delhi",
      tags: ["hospital", "max", "saket", "max hospital", "private", "press enclave"]
    },
    {
      id: "poi-hosp-6",
      name: "Max Super Speciality Hospital Patparganj",
      fullName: "Max Super Speciality Hospital, Patparganj",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.6305,
      lng: 77.3015,
      subLocality: "108A, IP Extension, Patparganj",
      district: "East Delhi",
      tags: ["hospital", "max", "patparganj", "east delhi", "ip extension"]
    },
    {
      id: "poi-hosp-7",
      name: "Fortis Escorts Heart Institute",
      fullName: "Fortis Escorts Heart Institute & Research",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.5604,
      lng: 77.2801,
      subLocality: "Okhla Road, New Friends Colony",
      district: "South East Delhi",
      tags: ["hospital", "fortis", "escorts", "heart", "cardiac", "okhla", "new friends colony"]
    },
    {
      id: "poi-hosp-8",
      name: "Fortis Hospital Vasant Kunj",
      fullName: "Fortis Flt. Lt. Rajan Dhall Hospital, Vasant Kunj",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.5204,
      lng: 77.1583,
      subLocality: "Sector B, Pocket 1, Aruna Asaf Ali Marg, Vasant Kunj",
      district: "South West Delhi",
      tags: ["hospital", "fortis", "vasant kunj", "private", "emergency"]
    },
    {
      id: "poi-hosp-9",
      name: "Indraprastha Apollo Hospital",
      fullName: "Indraprastha Apollo Hospitals, Sarita Vihar",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.5362,
      lng: 77.2863,
      subLocality: "Delhi-Mathura Road, Sarita Vihar",
      district: "South East Delhi",
      tags: ["hospital", "apollo", "sarita vihar", "mathura road", "private", "emergency"]
    },
    {
      id: "poi-hosp-10",
      name: "Lok Nayak Hospital (LNJP)",
      fullName: "Lok Nayak Jai Prakash Narayan Hospital & Maulana Azad Medical College",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.6366,
      lng: 77.2414,
      subLocality: "Jawaharlal Nehru Marg, Delhi Gate",
      district: "Central Delhi",
      tags: ["hospital", "lnjp", "lok nayak", "delhi gate", "mamc", "government"]
    },
    {
      id: "poi-hosp-11",
      name: "Guru Teg Bahadur (GTB) Hospital",
      fullName: "Guru Teg Bahadur Hospital & UCMS",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.6841,
      lng: 77.3094,
      subLocality: "Taharpur Road, Dilshad Garden",
      district: "Shahdara",
      tags: ["hospital", "gtb", "guru teg bahadur", "dilshad garden", "shahdara", "east delhi"]
    },
    {
      id: "poi-hosp-12",
      name: "Deen Dayal Upadhyay (DDU) Hospital",
      fullName: "Deen Dayal Upadhyay Hospital",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.6275,
      lng: 77.1086,
      subLocality: "Clock Tower, Hari Nagar",
      district: "West Delhi",
      tags: ["hospital", "ddu", "deen dayal upadhyay", "hari nagar", "west delhi"]
    },
    {
      id: "poi-hosp-13",
      name: "BLK-Max Super Speciality Hospital",
      fullName: "BLK-Max Super Speciality Hospital",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.6438,
      lng: 77.1798,
      subLocality: "Pusa Road, Karol Bagh",
      district: "Central Delhi",
      tags: ["hospital", "blk", "blk max", "pusa road", "karol bagh"]
    },
    {
      id: "poi-hosp-14",
      name: "Lady Hardinge Medical College & Hospital",
      fullName: "Lady Hardinge Medical College & Smt. Sucheta Kriplani Hospital",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.6335,
      lng: 77.2144,
      subLocality: "Shaheed Bhagat Singh Marg, Connaught Place",
      district: "Central Delhi",
      tags: ["hospital", "lady hardinge", "lhmc", "sucheta kriplani", "connaught place"]
    },
    {
      id: "poi-hosp-15",
      name: "Venkateshwar Hospital Dwarka",
      fullName: "Venkateshwar Hospital, Sector 18A Dwarka",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.5898,
      lng: 77.0423,
      subLocality: "Sector 18A, Dwarka",
      district: "South West Delhi",
      tags: ["hospital", "venkateshwar", "dwarka", "sector 18a", "south west delhi"]
    },
    {
      id: "poi-hosp-16",
      name: "Moolchand Medcity",
      fullName: "Moolchand Super Speciality Hospital",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.5670,
      lng: 77.2348,
      subLocality: "Ring Road, Lajpat Nagar III",
      district: "South East Delhi",
      tags: ["hospital", "moolchand", "lajpat nagar", "ring road"]
    },
    {
      id: "poi-hosp-17",
      name: "Holy Family Hospital",
      fullName: "Holy Family Hospital, Okhla",
      category: "Hospital",
      type: "Hospital",
      icon: "🏥",
      lat: 28.5612,
      lng: 77.2764,
      subLocality: "Okhla Road, Jamia Nagar",
      district: "South East Delhi",
      tags: ["hospital", "holy family", "okhla", "jamia nagar"]
    },

    // --- SHOPS, MARKETS & MALLS ---
    {
      id: "poi-shop-1",
      name: "Khan Market",
      fullName: "Khan Market Luxury Shopping & Dining Precinct",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.6003,
      lng: 77.2270,
      subLocality: "Rabindra Nagar, Sujan Singh Park",
      district: "Central Delhi",
      tags: ["shop", "market", "khan market", "shopping", "boutique", "dining", "cafe", "store"]
    },
    {
      id: "poi-shop-2",
      name: "Sarojini Nagar Market",
      fullName: "Sarojini Nagar Fashion & Apparel Market",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.5758,
      lng: 77.1985,
      subLocality: "Sarojini Nagar, Ring Road",
      district: "South Delhi",
      tags: ["shop", "market", "sarojini nagar", "sarojini", "clothes", "apparel", "shopping", "fashion"]
    },
    {
      id: "poi-shop-3",
      name: "Lajpat Nagar Central Market",
      fullName: "Central Market Lajpat Nagar II",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.5694,
      lng: 77.2435,
      subLocality: "Lajpat Nagar II, Ring Road",
      district: "South East Delhi",
      tags: ["shop", "market", "lajpat nagar", "central market", "ethnic", "fabrics", "shopping"]
    },
    {
      id: "poi-shop-4",
      name: "Chandni Chowk Market",
      fullName: "Chandni Chowk Heritage Market & Dariba Kalan",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.6506,
      lng: 77.2303,
      subLocality: "Chandni Chowk Road, Old Delhi",
      district: "Central Delhi",
      tags: ["shop", "market", "chandni chowk", "dariba kalan", "jewelry", "spices", "khari baoli", "shopping"]
    },
    {
      id: "poi-shop-5",
      name: "Karol Bagh Market",
      fullName: "Karol Bagh Market & Ajmal Khan Road",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.6525,
      lng: 77.1905,
      subLocality: "Ajmal Khan Road, Karol Bagh",
      district: "Central Delhi",
      tags: ["shop", "market", "karol bagh", "ajmal khan road", "garments", "electronics", "shopping"]
    },
    {
      id: "poi-shop-6",
      name: "Sadar Bazaar Wholesale Market",
      fullName: "Sadar Bazaar Wholesale Trade Hub",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.6560,
      lng: 77.2140,
      subLocality: "Sadar Bazaar, Old Delhi",
      district: "Central Delhi",
      tags: ["shop", "market", "sadar bazaar", "wholesale", "household", "shopping"]
    },
    {
      id: "poi-shop-7",
      name: "Dilli Haat INA",
      fullName: "Dilli Haat Crafts & Food Bazaar",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.5732,
      lng: 77.2079,
      subLocality: "Sri Aurobindo Marg, Kidwai Nagar",
      district: "South Delhi",
      tags: ["shop", "market", "dilli haat", "ina", "crafts", "handloom", "food", "shopping"]
    },
    {
      id: "poi-shop-8",
      name: "Select CITYWALK Mall Saket",
      fullName: "Select CITYWALK Premier Shopping Mall",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.5284,
      lng: 77.2195,
      subLocality: "A-3 District Centre, Saket",
      district: "South Delhi",
      tags: ["shop", "market", "mall", "select citywalk", "saket", "cinema", "retail", "shopping"]
    },
    {
      id: "poi-shop-9",
      name: "DLF Promenade & DLF Emporio",
      fullName: "DLF Promenade & DLF Emporio Luxury Malls",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.5423,
      lng: 77.1554,
      subLocality: "Nelson Mandela Marg, Vasant Kunj",
      district: "South West Delhi",
      tags: ["shop", "market", "mall", "dlf promenade", "dlf emporio", "vasant kunj", "luxury", "shopping"]
    },
    {
      id: "poi-shop-10",
      name: "Ambience Mall Vasant Kunj",
      fullName: "Ambience Mall, Vasant Kunj",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.5410,
      lng: 77.1540,
      subLocality: "Nelson Mandela Marg, Vasant Kunj",
      district: "South West Delhi",
      tags: ["shop", "market", "mall", "ambience mall", "vasant kunj", "shopping", "retail"]
    },
    {
      id: "poi-shop-11",
      name: "Pacific Mall Tagore Garden",
      fullName: "Pacific Mall Tagore Garden",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.6433,
      lng: 77.1129,
      subLocality: "Najafgarh Road, Tagore Garden",
      district: "West Delhi",
      tags: ["shop", "market", "mall", "pacific mall", "tagore garden", "subhash nagar", "west delhi"]
    },
    {
      id: "poi-shop-12",
      name: "Vegas Mall Dwarka",
      fullName: "Vegas Mall & Commercial Hub",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.5998,
      lng: 77.0322,
      subLocality: "Sector 14, Dwarka",
      district: "South West Delhi",
      tags: ["shop", "market", "mall", "vegas mall", "dwarka", "sector 14", "shopping"]
    },
    {
      id: "poi-shop-13",
      name: "Palika Bazaar Underground Market",
      fullName: "Palika Bazaar Underground Shopping Centre",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.6315,
      lng: 77.2185,
      subLocality: "Inner Circle, Connaught Place",
      district: "Central Delhi",
      tags: ["shop", "market", "palika bazaar", "connaught place", "electronics", "clothes", "underground"]
    },
    {
      id: "poi-shop-14",
      name: "Janpath Flea & Tibetan Market",
      fullName: "Janpath Street Market & Tibetan Craft Lane",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.6258,
      lng: 77.2186,
      subLocality: "Janpath, Connaught Place",
      district: "Central Delhi",
      tags: ["shop", "market", "janpath", "tibetan market", "flea market", "souvenirs", "crafts"]
    },
    {
      id: "poi-shop-15",
      name: "Greater Kailash 1 (GK 1) M-Block Market",
      fullName: "M-Block Market Greater Kailash 1",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.5529,
      lng: 77.2405,
      subLocality: "M-Block, Greater Kailash 1",
      district: "South Delhi",
      tags: ["shop", "market", "greater kailash", "gk 1", "m block", "boutique", "dining", "shopping"]
    },
    {
      id: "poi-shop-16",
      name: "Nehru Place Electronics Market",
      fullName: "Nehru Place Commercial & IT Hardware Market",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.5492,
      lng: 77.2519,
      subLocality: "Nehru Place",
      district: "South East Delhi",
      tags: ["shop", "market", "nehru place", "computer", "electronics", "hardware", "it", "shopping"]
    },
    {
      id: "poi-shop-17",
      name: "Kamla Nagar Market",
      fullName: "Kamla Nagar Shopping Precinct",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.6814,
      lng: 77.2018,
      subLocality: "Kamla Nagar, North Campus",
      district: "North Delhi",
      tags: ["shop", "market", "kamla nagar", "delhi university", "north campus", "apparel", "shopping"]
    },
    {
      id: "poi-shop-18",
      name: "South Extension Market (Part 1 & 2)",
      fullName: "South Extension Market (South Ex)",
      category: "Market & Shop",
      type: "Market & Shop",
      icon: "🛍️",
      lat: 28.5714,
      lng: 77.2215,
      subLocality: "Ring Road, South Extension",
      district: "South Delhi",
      tags: ["shop", "market", "south ex", "south extension", "footwear", "wedding", "designer"]
    },

    // --- PLACES & FAMOUS LANDMARKS ---
    {
      id: "poi-land-1",
      name: "India Gate & Kartavya Path",
      fullName: "India Gate War Memorial & Kartavya Path",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.6129,
      lng: 77.2295,
      subLocality: "Kartavya Path, Central Secretariat",
      district: "New Delhi",
      tags: ["landmark", "place", "india gate", "kartavya path", "rajpath", "monument", "memorial"]
    },
    {
      id: "poi-land-2",
      name: "Red Fort (Lal Qila)",
      fullName: "Red Fort UNESCO World Heritage Site",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.6562,
      lng: 77.2410,
      subLocality: "Netaji Subhash Marg, Chandni Chowk",
      district: "Central Delhi",
      tags: ["landmark", "place", "red fort", "lal qila", "mughal", "monument", "unesco", "heritage"]
    },
    {
      id: "poi-land-3",
      name: "Qutub Minar Complex",
      fullName: "Qutub Minar & Victory Tower UNESCO Complex",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.5245,
      lng: 77.1855,
      subLocality: "Seth Sarai, Mehrauli",
      district: "South West Delhi",
      tags: ["landmark", "place", "qutub minar", "qutab", "mehrauli", "unesco", "monument", "heritage"]
    },
    {
      id: "poi-land-4",
      name: "Lotus Temple",
      fullName: "Lotus Temple (Bahá'í House of Worship)",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.5535,
      lng: 77.2588,
      subLocality: "Lotus Temple Road, Bahapur, Kalkaji",
      district: "South Delhi",
      tags: ["landmark", "place", "lotus temple", "bahai", "kalkaji", "temple", "monument"]
    },
    {
      id: "poi-land-5",
      name: "Akshardham Temple",
      fullName: "Swaminarayan Akshardham Complex",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.6127,
      lng: 77.2773,
      subLocality: "Noida Mor, Pandav Nagar",
      district: "East Delhi",
      tags: ["landmark", "place", "akshardham", "swaminarayan", "temple", "monument", "east delhi"]
    },
    {
      id: "poi-land-6",
      name: "Humayun's Tomb",
      fullName: "Humayun's Tomb UNESCO World Heritage Site",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.5933,
      lng: 77.2507,
      subLocality: "Mathura Road, Nizamuddin East",
      district: "South East Delhi",
      tags: ["landmark", "place", "humayun tomb", "nizamuddin", "mughal", "monument", "unesco"]
    },
    {
      id: "poi-land-7",
      name: "Jama Masjid",
      fullName: "Masjid-i Jehan-Numa (Jama Masjid Delhi)",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.6507,
      lng: 77.2334,
      subLocality: "Meena Bazaar, Chandni Chowk",
      district: "Central Delhi",
      tags: ["landmark", "place", "jama masjid", "mosque", "old delhi", "chandni chowk"]
    },
    {
      id: "poi-land-8",
      name: "Rashtrapati Bhavan",
      fullName: "Rashtrapati Bhavan (Presidential Palace)",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.6143,
      lng: 77.1995,
      subLocality: "Raisina Hill, New Delhi",
      district: "New Delhi",
      tags: ["landmark", "place", "rashtrapati bhavan", "president", "raisina hill", "government"]
    },
    {
      id: "poi-land-9",
      name: "Gurudwara Bangla Sahib",
      fullName: "Gurudwara Bangla Sahib Sarovar",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.6262,
      lng: 77.2090,
      subLocality: "Ashoka Road, Connaught Place",
      district: "Central Delhi",
      tags: ["landmark", "place", "gurudwara", "bangla sahib", "sikh", "ashoka road", "connaught place"]
    },
    {
      id: "poi-land-10",
      name: "Kashmere Gate ISBT",
      fullName: "Maharana Pratap Inter State Bus Terminus (ISBT Kashmere Gate)",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.6672,
      lng: 77.2285,
      subLocality: "Ring Road, Kashmere Gate",
      district: "Central Delhi",
      tags: ["landmark", "place", "isbt", "kashmere gate", "bus terminus", "transit", "station"]
    },
    {
      id: "poi-land-11",
      name: "Anand Vihar ISBT & Railway Terminal",
      fullName: "Anand Vihar Inter State Bus Terminus & Railway Station",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.6469,
      lng: 77.3160,
      subLocality: "Anand Vihar, Vikas Marg",
      district: "East Delhi",
      tags: ["landmark", "place", "anand vihar", "isbt", "railway station", "transit", "east delhi"]
    },
    {
      id: "poi-land-12",
      name: "New Delhi Railway Station (NDLS)",
      fullName: "New Delhi Railway Station (NDLS)",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.6429,
      lng: 77.2201,
      subLocality: "Paharganj / Ajmeri Gate",
      district: "Central Delhi",
      tags: ["landmark", "place", "new delhi railway station", "ndls", "paharganj", "train", "station"]
    },
    {
      id: "poi-land-13",
      name: "Hazrat Nizamuddin Railway Station",
      fullName: "Hazrat Nizamuddin Railway Station (NZM)",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.5889,
      lng: 77.2536,
      subLocality: "Nizamuddin East, Ring Road",
      district: "South East Delhi",
      tags: ["landmark", "place", "nizamuddin", "railway station", "nzm", "train", "station"]
    },
    {
      id: "poi-land-14",
      name: "Indira Gandhi International Airport (IGI)",
      fullName: "Indira Gandhi International Airport (Terminal 3)",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.5562,
      lng: 77.1000,
      subLocality: "Palam, New Delhi",
      district: "South West Delhi",
      tags: ["landmark", "place", "airport", "igi", "indira gandhi airport", "terminal 3", "flight", "palam"]
    },
    {
      id: "poi-land-15",
      name: "Lodhi Garden",
      fullName: "Lodhi Garden Heritage Park",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.5931,
      lng: 77.2197,
      subLocality: "Lodhi Road, Khan Market",
      district: "Central Delhi",
      tags: ["landmark", "place", "lodhi garden", "park", "heritage", "monuments", "central delhi"]
    },
    {
      id: "poi-land-16",
      name: "Delhi Zoo (National Zoological Park)",
      fullName: "National Zoological Park Delhi",
      category: "Landmark",
      type: "Landmark",
      icon: "🏛️",
      lat: 28.6047,
      lng: 77.2464,
      subLocality: "Mathura Road, Near Purana Qila",
      district: "Central Delhi",
      tags: ["landmark", "place", "zoo", "delhi zoo", "purana qila", "wildlife", "park"]
    },

    // --- LOCATIONS & POPULAR LOCALITIES ---
    {
      id: "poi-loc-1",
      name: "Connaught Place (CP)",
      fullName: "Connaught Place Central Business District",
      category: "Locality",
      type: "Locality",
      icon: "📍",
      lat: 28.6328,
      lng: 77.2197,
      subLocality: "Inner & Outer Circle, Connaught Place",
      district: "Central Delhi",
      tags: ["location", "locality", "connaught place", "cp", "central delhi", "rajiv chowk"]
    },
    {
      id: "poi-loc-2",
      name: "Hauz Khas & Village",
      fullName: "Hauz Khas & Hauz Khas Village (HKV)",
      category: "Locality",
      type: "Locality",
      icon: "📍",
      lat: 28.5494,
      lng: 77.2001,
      subLocality: "Sri Aurobindo Marg, Hauz Khas",
      district: "South Delhi",
      tags: ["location", "locality", "hauz khas", "hkv", "south delhi", "village", "lake"]
    },
    {
      id: "poi-loc-3",
      name: "Saket",
      fullName: "Saket Residential & Commercial Hub",
      category: "Locality",
      type: "Locality",
      icon: "📍",
      lat: 28.5244,
      lng: 77.2167,
      subLocality: "Press Enclave Marg, Saket",
      district: "South Delhi",
      tags: ["location", "locality", "saket", "south delhi", "district centre"]
    },
    {
      id: "poi-loc-4",
      name: "Dwarka Sub-City",
      fullName: "Dwarka Sub-City (Sectors 1 to 24)",
      category: "Locality",
      type: "Locality",
      icon: "📍",
      lat: 28.5921,
      lng: 77.0460,
      subLocality: "Dwarka Sectors 1-24",
      district: "South West Delhi",
      tags: ["location", "locality", "dwarka", "south west delhi", "sub-city", "sector"]
    },
    {
      id: "poi-loc-5",
      name: "Rohini Sub-City",
      fullName: "Rohini Sub-City (Sectors 1 to 28)",
      category: "Locality",
      type: "Locality",
      icon: "📍",
      lat: 28.7159,
      lng: 77.1102,
      subLocality: "Rohini Sectors 1-28",
      district: "North West Delhi",
      tags: ["location", "locality", "rohini", "north west delhi", "sub-city", "sector"]
    },
    {
      id: "poi-loc-6",
      name: "Vasant Kunj",
      fullName: "Vasant Kunj Residential Enclave",
      category: "Locality",
      type: "Locality",
      icon: "📍",
      lat: 28.5293,
      lng: 77.1528,
      subLocality: "Vasant Kunj Sectors A-D",
      district: "South West Delhi",
      tags: ["location", "locality", "vasant kunj", "south west delhi", "enclave"]
    },
    {
      id: "poi-loc-7",
      name: "Janakpuri",
      fullName: "Janakpuri Residential & Commercial District",
      category: "Locality",
      type: "Locality",
      icon: "📍",
      lat: 28.6219,
      lng: 77.0878,
      subLocality: "Janakpuri District Centre",
      district: "West Delhi",
      tags: ["location", "locality", "janakpuri", "west delhi", "district centre"]
    },
    {
      id: "poi-loc-8",
      name: "Pitampura",
      fullName: "Pitampura & Netaji Subhash Place (NSP)",
      category: "Locality",
      type: "Locality",
      icon: "📍",
      lat: 28.6989,
      lng: 77.1408,
      subLocality: "Outer Ring Road, Pitampura",
      district: "North West Delhi",
      tags: ["location", "locality", "pitampura", "nsp", "netaji subhash place", "tv tower"]
    },
    {
      id: "poi-loc-9",
      name: "Mayur Vihar",
      fullName: "Mayur Vihar (Phases 1, 2 & 3)",
      category: "Locality",
      type: "Locality",
      icon: "📍",
      lat: 28.6083,
      lng: 77.2965,
      subLocality: "Noida Link Road, Mayur Vihar",
      district: "East Delhi",
      tags: ["location", "locality", "mayur vihar", "east delhi", "phase 1", "phase 2"]
    },
    {
      id: "poi-loc-10",
      name: "Laxmi Nagar",
      fullName: "Laxmi Nagar & Shakarpur Commercial Hub",
      category: "Locality",
      type: "Locality",
      icon: "📍",
      lat: 28.6304,
      lng: 77.2776,
      subLocality: "Vikas Marg, Laxmi Nagar",
      district: "East Delhi",
      tags: ["location", "locality", "laxmi nagar", "shakarpur", "vikas marg", "east delhi"]
    },
    {
      id: "poi-loc-11",
      name: "Green Park & Safdarjung Enclave",
      fullName: "Green Park & Safdarjung Enclave",
      category: "Locality",
      type: "Locality",
      icon: "📍",
      lat: 28.5588,
      lng: 77.2028,
      subLocality: "Ring Road / Sri Aurobindo Marg",
      district: "South Delhi",
      tags: ["location", "locality", "green park", "safdarjung enclave", "south delhi"]
    },
    {
      id: "poi-loc-12",
      name: "Punjabi Bagh",
      fullName: "Punjabi Bagh Commercial & Residential Area",
      category: "Locality",
      type: "Locality",
      icon: "📍",
      lat: 28.6692,
      lng: 77.1319,
      subLocality: "Ring Road, Punjabi Bagh",
      district: "West Delhi",
      tags: ["location", "locality", "punjabi bagh", "club road", "west delhi"]
    }
  ];
  window.DELHI_POIS = DELHI_POIS;


  function searchDelhiJurisdictions(query) {
    if (!query || query.trim().length === 0) return DELHI_MCD_WARDS.slice(0, 8);
    const q = query.toLowerCase().trim();
    return DELHI_MCD_WARDS.filter(w =>
      w.wardName.toLowerCase().includes(q) ||
      w.subDivision.toLowerCase().includes(q) ||
      w.district.toLowerCase().includes(q) ||
      w.mcdZone.toLowerCase().includes(q) ||
      w.wardNumber.toString() === q
    );
  }

  function findClosestDelhiWard(lat, lng) {
    let closest = DELHI_MCD_WARDS[0];
    let minD = Infinity;
    DELHI_MCD_WARDS.forEach(w => {
      const d = calculateHaversineDistance(lat, lng, w.lat, w.lng);
      if (d < minD) {
        minD = d;
        closest = w;
      }
    });
    return { ward: closest, distanceKm: minD };
  }

  // --- Verified Delhi Emergency Numbers ---
  const EMERGENCY_CONTACTS = [
    { title: "National Emergency Helpline", number: "112", desc: "All-in-one Police, Fire, Ambulance coordination" },
    { title: "Delhi Fire Service", number: "101", desc: "Fire response, water evacuation and structural safety" },
    { title: "Ambulance / Health Emergency", number: "102", desc: "Emergency medical transit and disaster triage" },
    { title: "Delhi Disaster Management Authority", number: "1077", desc: "DDMA 24x7 control room for urban disaster relief" },
    { title: "Delhi Traffic Police Control", number: "1073", desc: "Live waterlogging alerts, underpass diversions" },
    { title: "MCD Central Control Room", number: "1800112222", desc: "Municipal Corporation of Delhi drain blockage hotline" },
    { title: "CWC Yamuna Flood Control", number: "01122421656", desc: "Central Water Commission Old Railway Bridge control" }
  ];

  // --- SVG Icons Map (Strictly No Emojis) ---
  const ICONS = {
    overview: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
    map: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>`,
    report: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    community: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    aqi: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>`,
    weather: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"></path><path d="M16 14v6"></path><path d="M8 14v6"></path><path d="M12 16v6"></path></svg>`,
    yamuna: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c2.5-2.5 5.5-2.5 8 0s5.5 2.5 8 0 4-2 4-2"></path><path d="M2 17c2.5-2.5 5.5-2.5 8 0s5.5 2.5 8 0 4-2 4-2"></path></svg>`,
    alerts: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    emergency: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
    faq: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    crosshair: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>`,
    search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    sun: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
    moon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
    eye: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    eyeOff: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
  };

  // --- Initialize App ---
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initUTMTracking();
    initMap();
    initEventListeners();
    initCookieBanner();
    loadAllData();
    window.showDrawerMenu();

    // Left overview panel is displayed on launch in light glass aesthetic
    const panelDrawer = document.getElementById("panel-drawer");
    if (panelDrawer) {
      panelDrawer.classList.remove("collapsed");
    }

    // Auto-refresh data every 60 seconds
    setInterval(() => {
      loadRiskOverview();
      loadReports();
    }, 60000);
  });

  // --- UTM Tracking Persistence ---
  function initUTMTracking() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
    let captured = {};

    utmKeys.forEach(key => {
      if (urlParams.has(key)) {
        captured[key] = urlParams.get(key);
      }
    });

    if (Object.keys(captured).length > 0) {
      localStorage.setItem("dhw_utm", JSON.stringify(captured));
      state.utm = captured;
    } else {
      const stored = localStorage.getItem("dhw_utm");
      if (stored) {
        try { state.utm = JSON.parse(stored); } catch (e) {}
      }
    }
  }

  // --- Theme Management ---
  function initTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    updateThemeIcon();
  }

  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", state.theme);
    localStorage.setItem("dhw_theme", state.theme);
    updateThemeIcon();
    updateMapTiles();
  }

  function updateThemeIcon() {
    const btn = document.getElementById("theme-toggle-btn");
    if (!btn) return;
    btn.innerHTML = state.theme === "dark" ? ICONS.sun : ICONS.moon;
    btn.setAttribute("aria-label", `Switch to ${state.theme === "dark" ? "Light" : "Dark"} mode`);
  }

  // --- Leaflet Map Setup (Zero API Key Required, Full OpenStreetMap Live) ---
  function initMap() {
    // Center Delhi NCR: Framed cleanly with full visibility of 40 underpasses and Yamuna corridor
    state.map = L.map("map", {
      center: [28.6139, 77.2090],
      zoom: 11,
      zoomControl: false
    });
    window.map = state.map;
    window.state = state;

    updateMapTiles();

    // Ensure full map tiles calculate bounds without gray gaps
    setTimeout(() => { if (state.map) state.map.invalidateSize(); }, 100);
    setTimeout(() => { if (state.map) state.map.invalidateSize(); }, 350);
    setTimeout(() => { if (state.map) state.map.invalidateSize(); }, 800);
    window.addEventListener("resize", () => {
      if (state.map) state.map.invalidateSize();
    });

    // Map click handler: dynamic point-and-click diagnostics + report location pin
    state.map.on("click", (e) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      if (state.isPickingLocation) {
        handlePickedCoordinates(lat, lng);
        state.isPickingLocation = false;
        return;
      }

      triggerAreaInspection(lat, lng);
    });

    // Re-render community report clusters when zoom changes
    state.map.on("zoomend", () => {
      renderMapReportMarkers();
    });

    initTelemetryLayers();
    initUserLocationTracker();
  }

  function initTelemetryLayers() {
    if (!state.map) return;

    // 1. Rain Radar Layer (Simulated Doppler Weather Radar Precipitation Cells)
    state.radarLayer = L.layerGroup();
    const radarCells = [
      { lat: 28.7200, lng: 77.1100, radius: 4200, color: "#06b6d4", fillOpacity: 0.28 },
      { lat: 28.6500, lng: 77.2300, radius: 3600, color: "#0284c7", fillOpacity: 0.24 },
      { lat: 28.5600, lng: 77.2100, radius: 4800, color: "#38bdf8", fillOpacity: 0.20 },
      { lat: 28.6100, lng: 77.0500, radius: 5200, color: "#0ea5e9", fillOpacity: 0.22 }
    ];
    radarCells.forEach(cell => {
      L.circle([cell.lat, cell.lng], {
        radius: cell.radius,
        color: cell.color,
        weight: 1.5,
        fillColor: cell.color,
        fillOpacity: cell.fillOpacity
      }).bindPopup('<div style="font-size: 11.5px; font-weight: 600;">IMD Doppler Radar: Precipitation Echo</div>').addTo(state.radarLayer);
    });
    if (state.telemetryLayers.rainRadar) state.radarLayer.addTo(state.map);

    // 2. River Levels Layer (Yamuna River Hydro-Spine & CWC Gaging Station)
    state.riverLayer = L.layerGroup();
    const yamunaPath = [
      [28.7600, 77.2150],
      [28.7100, 77.2300],
      [28.6650, 77.2350],
      [28.6300, 77.2500],
      [28.5800, 77.2650],
      [28.5300, 77.3100]
    ];
    L.polyline(yamunaPath, {
      color: "#0284c7",
      weight: 5,
      opacity: 0.75,
      dashArray: "8, 4"
    }).addTo(state.riverLayer);

    const bridgeIcon = L.divIcon({
      className: "pin",
      html: createTeardropSvg("#0284c7", 26, 34, "#ffffff"),
      iconSize: [26, 34],
      iconAnchor: [13, 34],
      popupAnchor: [0, -34]
    });
    const riverGaugeMarker = L.marker([28.6650, 77.2350], { icon: bridgeIcon });
    riverGaugeMarker.bindPopup(`
      <div style="font-size: 12px; min-width: 180px;">
        <div style="font-weight: 700; color: #0284c7; text-transform: uppercase; font-size: 10px; margin-bottom: 2px;">CWC Yamuna Telemetry</div>
        <div style="font-weight: 700; font-size: 13px;">Old Railway Bridge (Loha Pul)</div>
        <div style="margin-top: 6px; font-family: monospace; font-size: 12px;">Live Level: <strong>204.12 m</strong></div>
        <div style="font-size: 11px; color: #f59e0b;">Warning Mark: 204.50 m</div>
        <div style="font-size: 11px; color: #ef4444;">Danger Mark: 205.33 m</div>
      </div>
    `);
    riverGaugeMarker.addTo(state.riverLayer);
    if (state.telemetryLayers.riverLevels) state.riverLayer.addTo(state.map);

    // 3. Traffic Slowdowns Layer (Delhi Traffic Police Waterlogging Hotspots)
    state.trafficLayer = L.layerGroup();
    const trafficCorridors = [
      { name: "Minto Road Underpass", lat: 28.6360, lng: 77.2240, status: "Critical Diversion", score: 9.4 },
      { name: "Zakhira Flyover Underpass", lat: 28.6723, lng: 77.1611, status: "Severe Inundation", score: 9.1 },
      { name: "Pul Prahladpur Underpass", lat: 28.5039, lng: 77.2947, status: "Carriageway Blocked", score: 9.6 },
      { name: "Azadpur Underpass", lat: 28.7060, lng: 77.1810, status: "Slow Moving Traffic", score: 7.8 },
      { name: "Tilak Bridge Underpass", lat: 28.6250, lng: 77.2400, status: "Water Drainage Slow", score: 8.4 }
    ];
    trafficCorridors.forEach(corridor => {
      const trafficIcon = L.divIcon({
        className: "pin",
        html: createTeardropSvg("#f59e0b", 24, 32, "#ffffff"),
        iconSize: [24, 32],
        iconAnchor: [12, 32],
        popupAnchor: [0, -32]
      });
      L.marker([corridor.lat, corridor.lng], { icon: trafficIcon })
        .bindPopup(`
          <div style="font-size: 12px;">
            <div style="font-weight: 700; color: #f59e0b; text-transform: uppercase; font-size: 10px;">Traffic Slowdown Alert</div>
            <div style="font-weight: 700; font-size: 13px;">${corridor.name}</div>
            <div style="color: var(--text-secondary); margin: 3px 0;">${corridor.status}</div>
            <div style="font-size: 10px; color: var(--text-muted);">Delhi Traffic Police advisory active</div>
          </div>
        `).addTo(state.trafficLayer);
    });
    if (state.telemetryLayers.trafficSlowdowns) state.trafficLayer.addTo(state.map);
  }

  window.toggleTelemetryLayer = function(layerKey) {
    if (!state.telemetryLayers) return;
    state.telemetryLayers[layerKey] = !state.telemetryLayers[layerKey];
    const isChecked = state.telemetryLayers[layerKey];

    const btn = document.querySelector(`.layer-toggle-pill[data-layer="${layerKey}"]`) || document.getElementById(`layer-btn-${layerKey}`);
    if (btn) {
      btn.classList.toggle("active", isChecked);
      const checkEl = btn.querySelector(".pill-check");
      if (checkEl) checkEl.textContent = isChecked ? "✓" : "+";
    }

    if (layerKey === "rainRadar" && state.radarLayer && state.map) {
      if (isChecked) state.radarLayer.addTo(state.map);
      else state.map.removeLayer(state.radarLayer);
    } else if (layerKey === "riverLevels" && state.riverLayer && state.map) {
      if (isChecked) state.riverLayer.addTo(state.map);
      else state.map.removeLayer(state.riverLayer);
    } else if (layerKey === "trafficSlowdowns" && state.trafficLayer && state.map) {
      if (isChecked) state.trafficLayer.addTo(state.map);
      else state.map.removeLayer(state.trafficLayer);
    } else if (layerKey === "citizenReports") {
      state.layersVisible.reports = isChecked;
      renderMapReportMarkers();
    }
  };

  function updateMapTiles() {
    if (state.tileLayer && state.map) {
      state.map.removeLayer(state.tileLayer);
    }
    if (state.tileLabelsLayer && state.map) {
      state.map.removeLayer(state.tileLabelsLayer);
    }

    // Remove the CARTO tile layer and replace with 100% key-free Esri Canvas:
    state.tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16,
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
    }).addTo(state.map);

    // Add clear road and city labels on top:
    state.tileLabelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16
    }).addTo(state.map);

    setTimeout(() => { if (state.map) state.map.invalidateSize(); }, 200);
  }

  // --- Robust GPS Engine & Prominent Live User Location Marker ---
  let userGpsMarker = null;
  let userAccuracyCircle = null;

  function initUserLocationTracker() {
    const map = state.map || window.map;
    if (!map) {
      console.warn("Map not ready yet for location tracker.");
      return;
    }

    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.");
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    };

    navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        // Smoothly pan map to user coordinates on first fetch
        if (!userGpsMarker) {
          map.flyTo([lat, lng], 15, { duration: 1.5 });
        }

        // Update or create accuracy halo circle
        if (userAccuracyCircle) {
          userAccuracyCircle.setLatLng([lat, lng]).setRadius(accuracy);
        } else {
          userAccuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: '#3b82f6',
            weight: 1,
            fillColor: '#60a5fa',
            fillOpacity: 0.15
          }).addTo(map);
        }

        // Prominent Animated Live User Marker
        const bigUserIcon = L.divIcon({
          className: 'user-live-gps-pin',
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 50px; height: 50px;">
              <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(37, 99, 235, 0.25); border: 2px solid rgba(37, 99, 235, 0.5); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="width: 22px; height: 22px; border-radius: 50%; background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.35); z-index: 10;"></div>
            </div>
          `,
          iconSize: [50, 50],
          iconAnchor: [25, 25]
        });

        if (userGpsMarker) {
          userGpsMarker.setLatLng([lat, lng]);
        } else {
          userGpsMarker = L.marker([lat, lng], { icon: bigUserIcon, zIndexOffset: 3000 }).addTo(map);
          userGpsMarker.bindPopup(`
            <div style="font-family: system-ui, sans-serif; padding: 4px;">
              <span style="font-size: 10px; font-weight: 800; color: #2563eb; text-transform: uppercase;">Live Position</span>
              <h4 style="font-size: 13px; font-weight: 800; color: #0f172a; margin: 2px 0;">You Are Here</h4>
              <p style="font-size: 11px; color: #64748b; margin: 0;">Accuracy: &plusmn;${Math.round(accuracy)}m</p>
            </div>
          `);
        }

        state.userGpsMarker = userGpsMarker;
        state.userAccuracyCircle = userAccuracyCircle;
        window.userGpsMarker = userGpsMarker;
        window.userAccuracyCircle = userAccuracyCircle;

        // Auto-update arrival modal telemetry and reverse geocode
        if (typeof fetchLiveTelemetry === 'function') {
          fetchLiveTelemetry(lat, lng);
        }
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then(res => res.json())
          .then(data => {
            const addr = data.address || {};
            const locality = addr.suburb || addr.neighbourhood || addr.residential || "Nand Nagri";
            const district = addr.state_district || addr.city || "North East Delhi";
            const areaEl = document.getElementById('modal-user-area');
            const subEl = document.getElementById('modal-sub-locality');
            if (areaEl) areaEl.innerText = locality;
            if (subEl) subEl.innerText = `${district} • Auto-Detected via GPS`;
          })
          .catch(() => {});
      },
      (err) => {
        console.warn("GPS Location fetch failed:", err.message);
        // Fallback safely to Central Delhi if location is denied or times out
        if (!userGpsMarker) {
          map.setView([28.6139, 77.2090], 12);
        }
      },
      options
    );
  }

  window.initUserLocationTracker = initUserLocationTracker;
  window.flyToUserLocation = function() {
    if (userGpsMarker && state.map) {
      state.map.flyTo(userGpsMarker.getLatLng(), 16, { duration: 1.2 });
      userGpsMarker.openPopup();
    } else {
      initUserLocationTracker();
    }
  };

  // Map Navigation & Reset Controls
  window.toggleFullMap = function() {
    const drawer = document.getElementById("panel-drawer");
    const layerBar = document.getElementById("layer-toggle-bar");
    if (!drawer) return;
    drawer.classList.toggle("collapsed");
    if (layerBar) {
      layerBar.classList.toggle("drawer-collapsed", drawer.classList.contains("collapsed"));
    }
    setTimeout(() => {
      if (state.map) state.map.invalidateSize();
    }, 280);
  };

  window.zoomInMap = function() {
    if (state.map) state.map.zoomIn();
  };

  window.zoomOutMap = function() {
    if (state.map) state.map.zoomOut();
  };

  window.resetMapToDelhi = function() {
    const city = CITIES[state.currentCity] || CITIES.delhi;
    if (state.map) {
      state.map.flyTo(city.center, city.zoom, { duration: 1.0 });
    }
  };

  // --- Split-Screen Arrival Flow Bottom Drawer Controls ---
  function toggleArrivalDrawer(forceState) {
    const drawer = document.getElementById("arrival-drawer");
    const reopenBtn = document.getElementById("reopen-arrival-drawer-btn");
    if (!drawer) return;

    const isCurrentlyClosed = drawer.classList.contains("minimized");
    const shouldOpen = forceState !== undefined ? forceState : isCurrentlyClosed;

    if (shouldOpen) {
      drawer.classList.remove("minimized");
      if (reopenBtn) reopenBtn.style.display = "none";
      renderArrivalDrawer();
      if (state.map) {
        state.map.flyTo([28.5800, 77.2150], 11, { animate: true, duration: 0.8 });
      }
    } else {
      drawer.classList.add("minimized");
      if (reopenBtn) reopenBtn.style.display = "inline-flex";
      if (state.map) {
        setTimeout(() => {
          state.map.invalidateSize();
          state.map.flyTo([28.6139, 77.2090], 11, { animate: true, duration: 0.8 });
        }, 150);
      }
    }
  }
  window.toggleArrivalDrawer = toggleArrivalDrawer;

  window.renderArrivalDrawer = function() {
    const container = document.getElementById("arrival-drawer-body");
    if (!container) return;

    const reports = state.reports || [];
    const breakingIncident = reports.find(r => r.hazard_type === "waterlogging" && (r.water_depth >= 30 || (r.title && r.title.includes("Minto")))) || reports[0] || {
      title: "Yamuna Floodplain Precursor Alert",
      zone_name: "Corridor Blackspot",
      hazard_type: "waterlogging",
      lat: 28.6650,
      lng: 77.2350,
      description: "Old Railway Bridge water level reached 205.38m (Warning Mark: 204.5m). Traffic diverted near Kashmere Gate and Monastery Market.",
      reported_at: new Date().toISOString()
    };

    container.innerHTML = `
      <!-- Breaking News Alert Banner Card -->
      <div class="breaking-alert-card" style="background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.35); border-radius: 16px; padding: 14px 18px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; box-shadow: 0 10px 30px rgba(244, 63, 94, 0.12);">
        <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 280px;">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(244, 63, 94, 0.2); border: 1px solid rgba(244, 63, 94, 0.4); display: flex; align-items: center; justify-content: center; color: #fb7185; flex-shrink: 0; margin-top: 2px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #fb7185; background: rgba(244, 63, 94, 0.2); padding: 2px 8px; border-radius: 6px;">HIGH SEVERITY ALERT</span>
              <span style="font-size: 11px; color: #94a3b8;">Updated ${formatRelativeTime(breakingIncident.reported_at)} &bull; DDMA Telemetry</span>
            </div>
            <h3 style="font-size: 14px; font-weight: 700; color: #ffffff; margin: 4px 0 2px;">${escapeHtml(breakingIncident.title || "Critical Inundation Warning")}</h3>
            <p style="font-size: 12px; color: #cbd5e1; margin: 0; line-height: 1.45;">${escapeHtml(breakingIncident.description || "Active waterlogging alert across key Delhi underpass transit blackspots.")}</p>
          </div>
        </div>
        <button class="btn-glass-action" onclick="window.locateOnMap(${breakingIncident.lat}, ${breakingIncident.lng}); window.triggerAreaInspection(${breakingIncident.lat}, ${breakingIncident.lng});" style="background: rgba(244, 63, 94, 0.25); border-color: rgba(244, 63, 94, 0.45); color: #ffe4e6; padding: 6px 14px; font-size: 12px; font-weight: 600; white-space: nowrap;">
          <span>Inspect Pin &rarr;</span>
        </button>
      </div>

      <!-- 2-Column Split: Community Incident Feeds + Live Telemetry -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px;">
        <!-- Left: Community Incident Feed -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #38bdf8;">
              Live Community Reports (${reports.length})
            </span>
            <span style="font-size: 11px; color: #94a3b8;">Click any card to fly map</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${reports.length === 0 ? '<div class="card" style="padding: 12px; margin: 0; color: #94a3b8; font-size: 12px;">Loading live incidents...</div>' : reports.slice(0, 4).map((rep, idx) => {
              const zoneName = state.zones.find(z => z.id === rep.zone_id)?.name || rep.zone_id || "Delhi NCR";
              const evalState = evaluateVerificationState(rep, state.reports);
              return `
                <div class="card" onclick="window.inspectReportByIndex(${idx});" style="padding: 10px 14px; margin: 0; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 10px;" role="button" tabindex="0">
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 13px; font-weight: 600; color: #ffffff; text-transform: capitalize; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${escapeHtml(rep.title || rep.hazard_type.replace('_', ' '))}
                      </span>
                      <span class="badge-verification ${evalState.badgeClass}" style="font-size: 10px; padding: 1px 6px;">
                        ${evalState.label}
                      </span>
                    </div>
                    <div style="font-size: 11px; color: #38bdf8; margin-top: 2px;">${escapeHtml(zoneName)} &bull; <span style="color: #94a3b8;">${formatRelativeTime(rep.reported_at)}</span></div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${escapeHtml(rep.description || "Active community hazard observation.")}
                    </div>
                  </div>
                  <button class="btn-glass-action" onclick="event.stopPropagation(); window.inspectReportByIndex(${idx});" style="padding: 4px 10px; font-size: 11px; flex-shrink: 0;">
                    <span>Inspect &rarr;</span>
                  </button>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <!-- Right: Key Micro-Telemetry & Underpass Blackspots -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #38bdf8;">
              Flash Diagnostics & Blackspots
            </span>
            <span style="font-size: 11px; color: #94a3b8;">CPCB & IMD Telemetry</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <!-- 2-grid telemetry -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div class="card" style="padding: 10px; margin: 0; text-align: center;">
                <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Delhi AQI (CPCB)</div>
                <div style="font-size: 18px; font-weight: 800; color: #f59e0b; margin-top: 2px;">${state.airQuality?.current?.us_aqi ?? 242}</div>
                <div style="font-size: 10px; color: #94a3b8;">Poor &bull; Station 12</div>
              </div>
              <div class="card" style="padding: 10px; margin: 0; text-align: center;">
                <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Rainfall (IMD)</div>
                <div style="font-size: 18px; font-weight: 800; color: #38bdf8; margin-top: 2px;">${state.weather?.current?.precipitation ?? 18.2} mm</div>
                <div style="font-size: 10px; color: #94a3b8;">Live AWS Sensor</div>
              </div>
            </div>

            <!-- Underpass Status Quick List -->
            <div class="card" style="padding: 10px 14px; margin: 0;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px;">
                Critical Underpass Blackspots
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px;">
                  <span style="color: #ffffff; font-weight: 500;">Minto Bridge Underpass</span>
                  <span style="color: #f43f5e; font-weight: 700; font-size: 10.5px; background: rgba(244,63,94,0.15); padding: 1px 6px; border-radius: 4px;">1.5 ft Water</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px;">
                  <span style="color: #ffffff; font-weight: 500;">Zakhira Flyover Underpass</span>
                  <span style="color: #f59e0b; font-weight: 700; font-size: 10.5px; background: rgba(245,158,11,0.15); padding: 1px 6px; border-radius: 4px;">Waterlogging</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px;">
                  <span style="color: #ffffff; font-weight: 500;">Tilak Bridge W-Point</span>
                  <span style="color: #22c55e; font-weight: 700; font-size: 10.5px; background: rgba(34,197,94,0.15); padding: 1px 6px; border-radius: 4px;">Clear</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // --- Static Leaflet Mini-Map Component (160px, showing pin) ---
  function mountStaticMiniMap(containerId, lat, lng, markerColor) {
    setTimeout(() => {
      const el = document.getElementById(containerId);
      if (!el || typeof L === "undefined") return;
      if (el._leaflet_id) {
        try { el._leaflet_map?.remove(); } catch (e) {}
        el.innerHTML = "";
        delete el._leaflet_id;
      }
      // 100% key-free Esri Canvas for mini-map
      const miniMap = L.map(el, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false
      });
      el._leaflet_map = miniMap;
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
      }).addTo(miniMap);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16
      }).addTo(miniMap);
      const pinIcon = L.divIcon({
        className: "mini-pin",
        html: createTeardropSvg(markerColor || "#f43f5e", 20, 26, "#ffffff"),
        iconSize: [20, 26],
        iconAnchor: [10, 26]
      });
      L.marker([lat, lng], { icon: pinIcon }).addTo(miniMap);
      setTimeout(() => { miniMap.invalidateSize(); }, 60);
    }, 50);
  }

  // --- On-Demand Area Status & Hazard Diagnostics ---
  async function triggerAreaInspection(lat, lng) {
    if (!state.map) return;

    // 1. Drop / Update temporary glowing pulse marker
    if (state.pulseMarker) {
      state.map.removeLayer(state.pulseMarker);
    }
    const pulseIcon = L.divIcon({
      className: "pulse-marker-divicon",
      html: '<div class="pulse-marker-wrapper"><div class="pulse-marker-ring"></div><div class="pulse-marker-core"></div></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    state.pulseMarker = L.marker([lat, lng], { icon: pulseIcon }).addTo(state.map);

    // 2. Open Dedicated Top-Right Inspection Panel with loading skeleton
    let cardEl = document.getElementById("inspection-card");
    if (!cardEl) {
      cardEl = document.createElement("aside");
      cardEl.id = "inspection-card";
      cardEl.className = "inspection-card";
      const appMain = document.querySelector(".app-main") || document.body;
      appMain.appendChild(cardEl);
    }
    cardEl.style.display = "flex";
    cardEl.innerHTML = `
      <div class="inspection-header">
        <div>
          <div class="inspection-title" style="font-size: 15px; font-weight: 700; color: #ffffff;">Resolving Location...</div>
          <div class="inspection-sub" style="font-size: 12px; color: var(--text-muted);">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
        </div>
        <button class="inspection-close-btn" onclick="window.closeInspectionCard()" aria-label="Close Diagnostics" style="font-weight: bold; font-size: 13px;">
          ✕
        </button>
      </div>
      <div class="skeleton skeleton-card" style="height: 160px; margin-top: 10px; border-radius: 8px;"></div>
      <div class="skeleton skeleton-card" style="height: 80px;"></div>
    `;

    // 3. Compute nearby active waterlogging & flood incidents within 1.5 km radius
    const radiusKm = 1.5;
    let activeWaterblocks = 0;
    let submergedUnderpasses = 0;
    let roadClosures = 0;

    state.zones.forEach(z => {
      const dist = calculateHaversineDistance(lat, lng, z.lat, z.lng);
      if (dist <= radiusKm) {
        const risk = state.riskOverview.find(r => r.zone_id === z.id);
        if (risk && risk.score > 2.0) {
          if (z.name.toLowerCase().includes("underpass")) submergedUnderpasses++;
          else activeWaterblocks++;
        }
      }
    });

    state.reports.forEach(r => {
      const dist = calculateHaversineDistance(lat, lng, r.lat, r.lng);
      if (dist <= radiusKm) {
        if (r.hazard_type === "waterlogging") activeWaterblocks++;
        else if (r.hazard_type === "road_blocked") roadClosures++;
        else activeWaterblocks++;
      }
    });

    // 4. Resolve Locality, Sub-division and Ward
    const closestWardData = findClosestDelhiWard(lat, lng);
    const matchedWard = closestWardData.ward;
    let areaName = matchedWard.wardName;
    let subDivision = matchedWard.subDivision;
    let districtName = matchedWard.district;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`, {
        headers: { "Accept-Language": "en" }
      });
      if (res.ok) {
        const geo = await res.json();
        const addr = geo.address || {};
        const localName = addr.neighbourhood || addr.suburb || addr.residential || addr.quarter || addr.road || addr.village;
        if (localName) areaName = localName;
        if (addr.state_district || addr.county) districtName = addr.state_district || addr.county;
      }
    } catch (e) {
      // Fallback to matched ward info
    }

    // 5. Drainage & Outfall Proximity
    const majorOutfalls = [
      { name: "Yamuna River Corridor", lat: 28.6650, lng: 77.2350 },
      { name: "Najafgarh Trunk Drain", lat: 28.6920, lng: 77.1210 },
      { name: "Barapullah Basin", lat: 28.5850, lng: 77.2450 }
    ];
    let minOutfallDist = Infinity;
    let nearestOutfall = "Yamuna Corridor";
    majorOutfalls.forEach(o => {
      const d = calculateHaversineDistance(lat, lng, o.lat, o.lng);
      if (d < minOutfallDist) {
        minOutfallDist = d;
        nearestOutfall = o.name;
      }
    });

    const baseVulnerability = Math.min(9.8, Math.max(1.5,
      matchedWard.vulnerabilityBaseline * 0.4 +
      (activeWaterblocks + submergedUnderpasses) * 1.8 +
      (minOutfallDist < 2.5 ? 2.5 : 1.0)
    )).toFixed(1);

    const drainageStatus = baseVulnerability >= 7.5 ? "High Risk" : baseVulnerability >= 5.0 ? "Moderate" : "Stable";
    const curAqi = state.airQuality?.current?.us_aqi ?? 142;
    const aqiColor = curAqi > 200 ? "red" : curAqi > 100 ? "amber" : "emerald";
    const curPrecip = state.weather?.current?.precipitation ?? 0.0;

    // Render Full Diagnostics inside the Top-Right Drawer
    cardEl.innerHTML = `
      <div class="inspection-header" style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
        <div style="flex: 1;">
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #22d3ee; margin-bottom: 3px;">CIVIC TELEMETRY</div>
          <div class="inspection-title" style="font-size: 16px; font-weight: 600; color: #ffffff; letter-spacing: -0.025em; line-height: 1.25;">${escapeHtml(areaName)}</div>
          <div class="inspection-sub" style="font-size: 12px; color: #94a3b8; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin-top: 2px;">
            ${escapeHtml(districtName || "New Delhi")} &bull; ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E
          </div>
        </div>
        <button class="inspection-close-btn" onclick="window.closeInspectionCard()" aria-label="Close Diagnostics" style="font-weight: bold; font-size: 13px;">
          ✕
        </button>
      </div>

      <!-- Plain Location Block with Coordinates (12px), Copy Button, and Static 160px Mini-Map -->
      <div class="card" style="padding: 10px; margin: 0; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; color: var(--text-secondary);">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
          <button class="btn-glass-action" onclick="window.copyText('${lat.toFixed(4)}, ${lng.toFixed(4)}', this)" style="padding: 2px 8px; font-size: 11px;">Copy</button>
        </div>
        <div id="diagnostics-mini-map" style="height: 160px; width: 100%; border-radius: 8px; margin-top: 8px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1);"></div>
      </div>

      <!-- Compact 3-Column Metrics Row (Eliminate Scrollbar) -->
      <div class="grid grid-cols-3 gap-2 my-3" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0;">
        <div class="bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-center" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 10px; text-align: center;">
          <span class="text-base font-bold ${activeWaterblocks > 0 ? 'text-amber-400' : 'text-emerald-400'}" style="font-size: 16px; font-weight: 700; color: ${activeWaterblocks > 0 ? '#fbbf24' : '#34d399'};">${activeWaterblocks}</span>
          <span class="block text-[10px] text-slate-400 uppercase tracking-wider mt-0.5" style="display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px;">Drains</span>
        </div>
        <div class="bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-center" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 10px; text-align: center;">
          <span class="text-base font-bold ${submergedUnderpasses > 0 ? 'text-rose-400' : 'text-emerald-400'}" style="font-size: 16px; font-weight: 700; color: ${submergedUnderpasses > 0 ? '#fb7185' : '#34d399'};">${submergedUnderpasses}</span>
          <span class="block text-[10px] text-slate-400 uppercase tracking-wider mt-0.5" style="display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px;">Underpasses</span>
        </div>
        <div class="bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-center" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 10px; text-align: center;">
          <span class="text-base font-bold ${roadClosures > 0 ? 'text-amber-400' : 'text-emerald-400'}" style="font-size: 16px; font-weight: 700; color: ${roadClosures > 0 ? '#fbbf24' : '#34d399'};">${roadClosures}</span>
          <span class="block text-[10px] text-slate-400 uppercase tracking-wider mt-0.5" style="display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px;">Road Blocks</span>
        </div>
      </div>

      <!-- Micro-Telemetry 2-grid: Hyperlocal AQI & IMD Precipitation -->
      <div class="card" style="padding: 10px; margin: 0;">
        <div style="display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 6px;">
          <span>Local Micro-Telemetry</span>
          <span style="color: var(--text-muted); font-size: 9.5px;">IMD AWS & CPCB</span>
        </div>
        <div class="inspection-grid">
          <div class="inspection-stat-box">
            <div class="inspection-stat-label">Nearest CPCB AQI</div>
            <div class="inspection-stat-val" style="color: ${aqiColor === 'red' ? '#f43f5e' : aqiColor === 'amber' ? '#f59e0b' : '#22c55e'};">
              ${curAqi} <span style="font-size: 10px; color: var(--text-muted); font-weight: normal;">US AQI</span>
            </div>
            <div style="font-size: 9.5px; color: var(--text-muted);">${getAqiLabel(curAqi)} &bull; Delhi Station</div>
          </div>
          <div class="inspection-stat-box">
            <div class="inspection-stat-label">Current Precipitation</div>
            <div class="inspection-stat-val" style="color: #38bdf8;">
              ${curPrecip} mm
            </div>
            <div style="font-size: 9.5px; color: var(--text-muted);">${curPrecip} mm - Live IMD</div>
          </div>
        </div>
      </div>

      <!-- Drainage Vulnerability & Outfall -->
      <div class="card" style="padding: 10px; margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary);">Drainage Vulnerability</span>
          <span class="badge ${drainageStatus === 'High Risk' ? 'HIGH' : drainageStatus === 'Moderate' ? 'MODERATE' : 'LOW'}">
            ${drainageStatus}
          </span>
        </div>
        ${renderMetricBar({
          label: "Runoff Index",
          value: parseFloat(baseVulnerability),
          min: 0,
          max: 10,
          unit: "/10",
          warning: 5.0,
          danger: 7.5,
          subtext: "Proximity: " + minOutfallDist.toFixed(1) + " km to " + nearestOutfall + "."
        })}
      </div>

      <!-- Primary Full-Width Glass CTA -->
      <div class="inspection-actions">
        <button class="btn-inspection-report" onclick="window.reportIncidentAtCoord(${lat}, ${lng}, '${escapeHtml(areaName)}', '${matchedWard.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          <span>Report Incident Here</span>
        </button>
      </div>
    `;

    mountStaticMiniMap("diagnostics-mini-map", lat, lng, "#38bdf8");
  }

  window.closeInspectionCard = function() {
    const cardEl = document.getElementById("inspection-card");
    if (cardEl) cardEl.style.display = "none";
    if (state.pulseMarker && state.map) {
      state.map.removeLayer(state.pulseMarker);
      state.pulseMarker = null;
    }
  };

  window.reportIncidentAtCoord = function(lat, lng, areaName, wardId) {
    window.closeInspectionCard();
    window.switchTab("report");
    setTimeout(() => {
      handlePickedCoordinates(lat, lng, wardId, areaName);
      const descInput = document.getElementById("report-desc");
      if (descInput && !descInput.value) {
        descInput.value = "Incident observed near " + areaName + ".";
      }
    }, 150);
  };

  // --- Point-and-Click Incident Inspection & Crowdsourced Upvoting ---
  window.inspectReportByIndex = function(idx) {
    const rep = state.reports[idx];
    if (!rep) return;

    // 1. Close drawer on small screens so map and inspection panel are clearly visible
    const drawer = document.getElementById("panel-drawer") || document.querySelector(".dashboard-panel-drawer");
    if (drawer && window.innerWidth < 768) {
      drawer.classList.add("collapsed");
    }

    // 2. Smoothly fly camera to coordinates
    if (state.map) {
      state.map.flyTo([rep.lat, rep.lng], 16, { duration: 1.2 });
    }

    // 3. Drop active temporary glowing ping marker
    if (state.pulseMarker && state.map) {
      state.map.removeLayer(state.pulseMarker);
    }
    const pulseIcon = L.divIcon({
      className: "pulse-marker-divicon",
      html: '<div class="pulse-marker-wrapper"><div class="pulse-marker-ring"></div><div class="pulse-marker-core"></div></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    state.pulseMarker = L.marker([rep.lat, rep.lng], { icon: pulseIcon }).addTo(state.map);

    // 4. Open top-right InspectionPanel
    let cardEl = document.getElementById("inspection-card");
    if (!cardEl) {
      cardEl = document.createElement("aside");
      cardEl.id = "inspection-card";
      cardEl.className = "inspection-card";
      const appMain = document.querySelector(".app-main") || document.body;
      appMain.appendChild(cardEl);
    }
    cardEl.style.display = "flex";

    const closestWardData = findClosestDelhiWard(rep.lat, rep.lng);
    const matchedWard = closestWardData.ward;
    const zoneName = rep.zone_name || rep.area_name || matchedWard.wardName;
    const evalState = evaluateVerificationState(rep);

    // Nearby hazards within 1.5 km
    const radiusKm = 1.5;
    let activeWaterblocks = 0;
    let submergedUnderpasses = 0;
    let roadClosures = 0;
    state.zones.forEach(z => {
      const dist = calculateHaversineDistance(rep.lat, rep.lng, z.lat, z.lng);
      if (dist <= radiusKm) {
        const risk = state.riskOverview.find(r => r.zone_id === z.id);
        if (risk && risk.score > 2.0) {
          if (z.name.toLowerCase().includes("underpass")) submergedUnderpasses++;
          else activeWaterblocks++;
        }
      }
    });
    state.reports.forEach(r => {
      const dist = calculateHaversineDistance(rep.lat, rep.lng, r.lat, r.lng);
      if (dist <= radiusKm) {
        if (r.hazard_type === "waterlogging") activeWaterblocks++;
        else if (r.hazard_type === "road_blocked") roadClosures++;
        else activeWaterblocks++;
      }
    });

    const majorOutfalls = [
      { name: "Yamuna River Corridor", lat: 28.6650, lng: 77.2350 },
      { name: "Najafgarh Trunk Drain", lat: 28.6920, lng: 77.1210 },
      { name: "Barapullah Basin", lat: 28.5850, lng: 77.2450 }
    ];
    let minOutfallDist = Infinity;
    let nearestOutfall = "Yamuna Corridor";
    majorOutfalls.forEach(o => {
      const d = calculateHaversineDistance(rep.lat, rep.lng, o.lat, o.lng);
      if (d < minOutfallDist) {
        minOutfallDist = d;
        nearestOutfall = o.name;
      }
    });

    const curAqi = state.airQuality?.current?.us_aqi ?? 242;
    const aqiColor = curAqi > 200 ? "red" : curAqi > 100 ? "amber" : "emerald";
    const curPrecip = rep.rainfall_mm_hr ?? (state.weather?.current?.precipitation ?? 18.2);
    const votesCount = rep.confirmations_count || 1;
    const isConfirmed = Boolean(rep._user_confirmed);

    cardEl.innerHTML = `
      <div class="inspection-header" style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
        <div style="flex: 1;">
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #22d3ee; margin-bottom: 3px;">CIVIC TELEMETRY</div>
          <div class="inspection-title" style="font-size: 16px; font-weight: 600; color: #ffffff; letter-spacing: -0.025em; line-height: 1.25;">${escapeHtml(rep.title || zoneName)}</div>
          <div class="inspection-sub" style="font-size: 12px; color: #94a3b8; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin-top: 2px;">
            ${escapeHtml(matchedWard.district || "New Delhi")} &bull; ${rep.lat.toFixed(4)}°N, ${rep.lng.toFixed(4)}°E
          </div>
        </div>
        <button class="inspection-close-btn" onclick="window.closeInspectionCard()" aria-label="Close Diagnostics" style="font-weight: bold; font-size: 13px;">
          ✕
        </button>
      </div>

      <!-- Plain Location Block with Coordinates (12px), Copy Button, and Static 160px Mini-Map -->
      <div class="card" style="padding: 10px; margin: 0; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; color: var(--text-secondary);">${rep.lat.toFixed(4)}, ${rep.lng.toFixed(4)}</span>
          <button class="btn-glass-action" onclick="window.copyText('${rep.lat.toFixed(4)}, ${rep.lng.toFixed(4)}', this)" style="padding: 2px 8px; font-size: 11px;">Copy</button>
        </div>
        <div id="report-mini-map" style="height: 160px; width: 100%; border-radius: 8px; margin-top: 8px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1);"></div>
      </div>

      <!-- Triage Status and Active Hazard Description -->
      <div class="card" style="padding: 10px; margin: 0; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Triage Status:</span>
          <span class="badge-verification ${evalState.badgeClass}">
            ${evalState.shieldIcon ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>' : ''}
            ${evalState.label}
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; padding-top: 4px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
          <span style="color: var(--text-muted);">Active Hazard:</span>
          <span style="color: #38bdf8; font-weight: 600; text-transform: capitalize;">${rep.hazard_type.replace('_', ' ')}${rep.water_depth ? ` - ${rep.water_depth} cm` : ''}</span>
        </div>
        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px; line-height: 1.4;">
          ${escapeHtml(rep.description || rep.summary || "Incident reported by community observer.")}
        </div>
      </div>

      <!-- Compact 3-Column Metrics Row (Eliminate Scrollbar) -->
      <div class="grid grid-cols-3 gap-2 my-3" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0;">
        <div class="bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-center" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 10px; text-align: center;">
          <span class="text-base font-bold ${activeWaterblocks > 0 ? 'text-amber-400' : 'text-emerald-400'}" style="font-size: 16px; font-weight: 700; color: ${activeWaterblocks > 0 ? '#fbbf24' : '#34d399'};">${activeWaterblocks}</span>
          <span class="block text-[10px] text-slate-400 uppercase tracking-wider mt-0.5" style="display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px;">Drains</span>
        </div>
        <div class="bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-center" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 10px; text-align: center;">
          <span class="text-base font-bold ${submergedUnderpasses > 0 ? 'text-rose-400' : 'text-emerald-400'}" style="font-size: 16px; font-weight: 700; color: ${submergedUnderpasses > 0 ? '#fb7185' : '#34d399'};">${submergedUnderpasses}</span>
          <span class="block text-[10px] text-slate-400 uppercase tracking-wider mt-0.5" style="display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px;">Underpasses</span>
        </div>
        <div class="bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-center" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 10px; text-align: center;">
          <span class="text-base font-bold ${roadClosures > 0 ? 'text-amber-400' : 'text-emerald-400'}" style="font-size: 16px; font-weight: 700; color: ${roadClosures > 0 ? '#fbbf24' : '#34d399'};">${roadClosures}</span>
          <span class="block text-[10px] text-slate-400 uppercase tracking-wider mt-0.5" style="display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px;">Road Blocks</span>
        </div>
      </div>

      <!-- Micro-Telemetry 2-grid: Hyperlocal AQI & IMD Precipitation -->
      <div class="card" style="padding: 10px; margin: 0;">
        <div style="display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 6px;">
          <span>Local Micro-Telemetry</span>
          <span style="color: var(--text-muted); font-size: 9.5px;">IMD AWS & CPCB</span>
        </div>
        <div class="inspection-grid">
          <div class="inspection-stat-box">
            <div class="inspection-stat-label">Nearest CPCB AQI</div>
            <div class="inspection-stat-val" style="color: ${aqiColor === 'red' ? '#f43f5e' : aqiColor === 'amber' ? '#f59e0b' : '#22c55e'};">
              ${curAqi} <span style="font-size: 10px; color: var(--text-muted); font-weight: normal;">US AQI</span>
            </div>
            <div style="font-size: 9.5px; color: var(--text-muted);">${getAqiLabel(curAqi)} &bull; Delhi Station</div>
          </div>
          <div class="inspection-stat-box">
            <div class="inspection-stat-label">Current Precipitation</div>
            <div class="inspection-stat-val" style="color: #38bdf8;">
              ${curPrecip} mm
            </div>
            <div style="font-size: 9.5px; color: var(--text-muted);">${curPrecip} mm - Live IMD</div>
          </div>
        </div>
      </div>

      <!-- Drainage Basin Proximity -->
      <div class="card" style="padding: 10px; margin: 0;">
        <div style="display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 4px;">
          <span>Drainage Proximity</span>
          <span style="color: ${minOutfallDist < 2.5 ? '#f43f5e' : '#38bdf8'}; font-weight: 600;">
            ${minOutfallDist < 2.5 ? `Close to ${nearestOutfall} (High Risk)` : `${nearestOutfall} (Moderate)`}
          </span>
        </div>
        <div style="font-size: 11px; color: var(--text-primary); font-weight: 600;">Proximity: ${minOutfallDist.toFixed(1)} km to ${escapeHtml(nearestOutfall)}</div>
        <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Primary discharge conduit for this catchment zone.</div>
      </div>

      <!-- Action CTA: [Verify / Confirm Incident] allowing crowdsourced upvoting -->
      <div class="inspection-actions">
        <button class="btn-inspection-confirm ${isConfirmed ? 'confirmed' : ''}" onclick="window.confirmReportIncident(${idx})" ${isConfirmed ? 'disabled' : ''}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <span>${isConfirmed ? `✓ Incident Confirmed (${votesCount} votes)` : `[Verify / Confirm Incident] (${votesCount} votes)`}</span>
        </button>
      </div>
    `;

    mountStaticMiniMap("report-mini-map", rep.lat, rep.lng, "#f43f5e");
  };

  window.confirmReportIncident = function(idx) {
    const rep = state.reports[idx];
    if (!rep) return;
    rep.confirmations_count = (rep.confirmations_count || 1) + 1;
    rep.upvotes = (rep.upvotes || 0) + 1;
    rep._user_confirmed = true;

    if (rep.confirmations_count >= 3 && rep.verification_status === "pending_verification") {
      rep.verification_status = "community_confirmed";
    }

    window.inspectReportByIndex(idx);

    const reportsList = document.getElementById("reports-list");
    if (reportsList) {
      reportsList.innerHTML = renderReportItems(state.reports);
    }
  };

  // --- Two-Tier Hazard Feed Architecture ---
  window.showHazardToast = function(hazard) {
    state.selectedHazard = hazard;
    const toast = document.getElementById("hazard-toast");
    if (!toast) return;

    const severity = hazard.severity || (hazard.score ? (hazard.score >= 7 ? "HIGH" : hazard.score >= 4 ? "MODERATE" : "LOW") : "MODERATE");
    const title = hazard.title || hazard.name || hazard.zone_name || (hazard.hazard_type ? hazard.hazard_type.replace('_', ' ') : "Hazard Alert");
    const loc = hazard.location || hazard.zone_name || (hazard.lat ? (hazard.lat.toFixed(4) + ", " + hazard.lng.toFixed(4)) : "Delhi Corridor");
    const time = hazard.timestamp ? formatRelativeTime(hazard.timestamp) : "Recent";
    const desc = hazard.description || ("Reported active alert in " + loc + ". Commuters advised caution.");

    toast.style.display = "block";
    toast.innerHTML = `
      <div class="hazard-toast-top">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="badge ${severity}">${severity}</span>
          <span class="hazard-toast-title" style="text-transform: capitalize;">${escapeHtml(title)}</span>
        </div>
        <button class="drawer-close-btn" onclick="window.closeHazardToast()" aria-label="Dismiss toast" style="width: 22px; height: 22px;">
          ${ICONS.close}
        </button>
      </div>
      <div class="hazard-toast-desc">${escapeHtml(desc)}</div>
      <div class="hazard-toast-footer">
        <span class="timestamp-note" style="margin: 0;">${time} &bull; ${escapeHtml(loc)}</span>
        <button class="btn btn-secondary btn-sm" onclick="window.openHazardDetailDrawer()" style="padding: 4px 10px; font-size: 11.5px;">
          View Full Report &rarr;
        </button>
      </div>
    `;
  };

  window.closeHazardToast = function() {
    const toast = document.getElementById("hazard-toast");
    if (toast) toast.style.display = "none";
  };

  window.openHazardDetailDrawer = function() {
    window.closeHazardToast();
    const hazard = state.selectedHazard;
    if (!hazard) return;

    const drawer = document.getElementById("hazard-detail-drawer");
    if (!drawer) return;

    const severity = hazard.severity || (hazard.score ? (hazard.score >= 7 ? "HIGH" : hazard.score >= 4 ? "MODERATE" : "LOW") : "MODERATE");
    const title = hazard.title || hazard.name || hazard.zone_name || (hazard.hazard_type ? hazard.hazard_type.replace('_', ' ') : "Civic Incident");
    const lat = hazard.lat || 28.6139;
    const lng = hazard.lng || 77.2090;

    drawer.style.display = "flex";
    drawer.innerHTML = `
      <div class="hazard-detail-header">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge ${severity}">${severity} PRIORITY</span>
            <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Hazard Case #DHW-${Math.abs(Math.round(lat * 1000))}</span>
          </div>
          <h2 style="font-size: var(--font-lg); font-weight: 800; color: var(--text-primary); margin-top: 4px; text-transform: capitalize;">
            ${escapeHtml(title)}
          </h2>
        </div>
        <button class="drawer-close-btn" onclick="window.closeHazardDetailDrawer()" aria-label="Close Deep Dive">
          ${ICONS.close}
        </button>
      </div>

      <div class="hazard-detail-content">
        <!-- Telemetry Summary Grid -->
        <div class="panel-section">
          <div class="panel-section-title">Verified Coordinate Telemetry</div>
          <div class="metrics-grid">
            <div class="metric-box">
              <div class="metric-label">Latitude</div>
              <div class="metric-value" style="font-size: 15px;">${lat.toFixed(5)}° N</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Longitude</div>
              <div class="metric-value" style="font-size: 15px;">${lng.toFixed(5)}° E</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Report Source</div>
              <div class="metric-value" style="font-size: 14px; text-transform: uppercase;">${escapeHtml(hazard.source || "COMMUNITY")}</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Verification Status</div>
              <div class="metric-value" style="font-size: 14px; color: var(--risk-none);">Verified Active</div>
            </div>
          </div>
        </div>

        <!-- Incident Narrative -->
        <div class="panel-section">
          <div class="panel-section-title">Incident Narrative & Field Observations</div>
          <div class="card">
            <p class="card-desc" style="font-size: 13px; line-height: 1.5; color: var(--text-primary);">
              ${escapeHtml(hazard.description || "Submerged carriage lanes reported with standing water hindering motorized traffic. Local storm drains saturated.")}
            </p>
            <div class="timestamp-note">Logged: ${hazard.timestamp ? formatDate(hazard.timestamp) : "Live Network Broadcast"}</div>
          </div>
        </div>

        <!-- Official Municipal & Traffic Advisory -->
        <div class="panel-section">
          <div class="panel-section-title">Official Agency Advisory</div>
          <div class="card" style="border-left: 4px solid var(--accent-teal);">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px; color: var(--text-primary);">Traffic Police & DDMA Guidance</div>
            <p class="card-desc">
              Vehicular diversions active around this transit node. Two-wheelers and compact vehicles should avoid flooded underpasses and seek elevated arterial alternatives.
            </p>
          </div>
        </div>

        <!-- Actions -->
        <div class="panel-section" style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" onclick="window.copyText('${lat.toFixed(4)}, ${lng.toFixed(4)}', this)" style="flex: 1; justify-content: center;">
            ${ICONS.copy} Copy Coords
          </button>
          <button class="btn btn-primary btn-sm" onclick="window.locateOnMap(${lat}, ${lng})" style="flex: 1; justify-content: center;">
            ${ICONS.crosshair} View on Map
          </button>
        </div>
      </div>
    `;
  };

  window.closeHazardDetailDrawer = function() {
    const drawer = document.getElementById("hazard-detail-drawer");
    if (drawer) drawer.style.display = "none";
  };

  window.locateOnMap = function(lat, lng) {
    window.closeHazardDetailDrawer();
    if (state.map) {
      state.map.setView([lat, lng], 15);
    }
  };

  // --- Modular City Switching ---
  window.switchCity = function(cityId) {
    if (!CITIES[cityId]) return;
    state.currentCity = cityId;
    const city = CITIES[cityId];

    document.querySelectorAll(".city-option").forEach(opt => {
      const isActive = opt.dataset.city === cityId;
      opt.classList.toggle("active", isActive);
      const tag = opt.querySelector(".city-active-tag");
      if (isActive && !tag) {
        const row = opt.querySelector(".city-option-row");
        if (row) {
          const newTag = document.createElement("span");
          newTag.className = "city-active-tag";
          newTag.textContent = "Active";
          row.appendChild(newTag);
        }
      } else if (!isActive && tag) {
        tag.remove();
      }
    });

    const labelEl = document.getElementById("active-city-label");
    if (labelEl) labelEl.textContent = city.shortLabel;

    const brandSubtitle = document.getElementById("app-brand-subtitle");
    if (brandSubtitle) brandSubtitle.textContent = city.subtitle;

    const badgeExtent = document.getElementById("map-extent-badge");
    if (badgeExtent) badgeExtent.innerHTML = city.extentBadge;

    if (state.map) {
      state.map.flyTo(city.center, city.zoom, { duration: 1.2 });
    }

    if (state.boundaryLayer && state.map) {
      if (cityId === "delhi" && state.layersVisible.boundary) {
        state.boundaryLayer.addTo(state.map);
      } else {
        state.map.removeLayer(state.boundaryLayer);
      }
    }

    const dropdown = document.getElementById("city-dropdown");
    if (dropdown) dropdown.classList.remove("visible");

    window.closeInspectionCard();
    window.closeHazardToast();
    renderCurrentTab();
  };

  function initCitySwitcher() {
    const btn = document.getElementById("city-switcher-btn");
    const dropdown = document.getElementById("city-dropdown");
    if (!btn || !dropdown) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("visible");
    });

    document.querySelectorAll(".city-option").forEach(opt => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        const cityId = opt.dataset.city;
        if (cityId) window.switchCity(cityId);
      });
    });

    const detectBtn = document.getElementById("btn-detect-city");
    if (detectBtn) {
      detectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!navigator.geolocation) {
          alert("Geolocation not supported by your browser.");
          return;
        }
        detectBtn.textContent = "Detecting...";
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const userLat = pos.coords.latitude;
            const userLng = pos.coords.longitude;
            let closest = "delhi";
            let minDist = Infinity;
            Object.keys(CITIES).forEach(cKey => {
              const c = CITIES[cKey];
              const d = calculateHaversineDistance(userLat, userLng, c.center[0], c.center[1]);
              if (d < minDist) {
                minDist = d;
                closest = cKey;
              }
            });
            detectBtn.innerHTML = "Auto-Detect Nearest City";
            window.switchCity(closest);
          },
          () => {
            detectBtn.innerHTML = "Auto-Detect Nearest City";
            alert("Could not access location. Defaulting to Delhi NCR.");
          },
          { timeout: 8000 }
        );
      });
    }

    document.addEventListener("click", () => {
      dropdown.classList.remove("visible");
    });
  }

  // --- Data Fetching ---
  async function loadAllData() {
    await Promise.all([
      loadMapKeyConfig(),
      loadZones(),
      loadRiskOverview(),
      loadReports(),
      loadWeatherAndForecast(),
      loadAirQuality(),
      loadYamunaBenchmark(),
      loadDelhiBoundary()
    ]);
    renderCurrentTab();
    renderArrivalDrawer();
  }

  async function loadMapKeyConfig() {
    try {
      const res = await fetch("/api/project-info");
      if (res.ok) {
        const data = await res.json();
        if (data && data.map_api_key) {
          state.mapApiKey = data.map_api_key;
          updateMapTiles();
        }
      }
    } catch (e) {
      // Fail silently without exposing key or error message
    }
  }

  async function loadDelhiBoundary() {
    try {
      const res = await fetch("/delhi-boundary.geojson");
      if (res.ok) {
        const geojson = await res.json();
        state.boundaryLayer = L.geoJSON(geojson, {
          style: {
            color: "#38bdf8",
            weight: 2,
            dashArray: "4, 6",
            fillColor: "#0284c7",
            fillOpacity: 0.04
          }
        });
        if (state.layersVisible.boundary) {
          state.boundaryLayer.addTo(state.map);
        }
      }
    } catch (e) {
      console.error("Failed to load Delhi boundary:", e);
    }
  }

  async function loadZones() {
    state.loading.zones = true;
    state.errors.zones = null;
    try {
      state.nowcastStep = state.nowcastStep || '0h';
      state.zones = DELHI_UNDERPASSES.map(u => {
        const d = calculateNowcastDepth(u, state.nowcastStep);
        const r = getNowcastRiskEvaluation(d, u.type);
        return {
          ...u,
          lng: u.lon,
          currentDepth: d,
          currentRisk: r,
          water_level: d + ' cm',
          risk_level: r.level
        };
      });
      state.loading.zones = false;
      renderMapZoneMarkers();
      if (state.activeTab === "overview") renderCurrentTab();
    } catch (e) {
      state.loading.zones = false;
      console.error("Failed to load zones:", e);
    }
  }

  async function loadRiskOverview() {
    state.loading.risk = true;
    state.errors.risk = null;
    try {
      const res = await fetch("/api/risk-overview");
      if (res.ok) {
        state.riskOverview = await res.json();
        state.lastUpdated.risk = new Date();
        state.loading.risk = false;
        renderMapZoneMarkers();
        if (state.activeTab === "overview" || state.activeTab === "alerts") {
          renderCurrentTab();
        }
      } else {
        state.loading.risk = false;
        state.errors.risk = "Telemetry service unreachable.";
        if (state.activeTab === "overview") renderCurrentTab();
      }
    } catch (e) {
      state.loading.risk = false;
      state.errors.risk = "Network connection failed.";
      if (state.activeTab === "overview") renderCurrentTab();
      console.error("Failed to load risk overview:", e);
    }
  }

  window.retryLoadRiskData = async function() {
    state.loading.zones = true;
    state.loading.risk = true;
    state.errors.zones = null;
    state.errors.risk = null;
    renderCurrentTab();
    await loadZones();
    await loadRiskOverview();
  };

  async function loadReports() {
    try {
      const res = await fetch("/api/reports");
      if (res.ok) {
        state.reports = await res.json();
        renderMapReportMarkers();
        renderArrivalDrawer();
        if (state.activeTab === "community") {
          renderCurrentTab();
        }
      }
    } catch (e) {
      console.error("Failed to load reports:", e);
    }
  }

  // Live Delhi Weather via Open-Meteo API (with 15-Minute Doppler Nowcasting)
  async function loadWeatherAndForecast() {
    try {
      const url = "https://api.open-meteo.com/v1/forecast?latitude=28.6139&longitude=77.2090&current=precipitation,temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=precipitation,precipitation_probability,temperature_2m&minutely_15=precipitation&forecast_minutely_15=12&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=Asia%2FKolkata";
      const res = await fetch(url);
      if (res.ok) {
        state.weather = await res.json();
        if (state.weather && state.weather.minutely_15 && Array.isArray(state.weather.minutely_15.precipitation)) {
          state.nowcastPrecipitation = state.weather.minutely_15.precipitation;
        }
        state.lastUpdated.weather = new Date();
        if (state.activeTab === "weather" || state.activeTab === "overview") {
          renderCurrentTab();
        }
        // Update watchlist and markers if nowcast was waiting for telemetry
        renderMapZoneMarkers();
      }
    } catch (e) {
      console.error("Failed to load Open-Meteo weather:", e);
    }
  }

  // Live Delhi Air Quality via Open-Meteo Air Quality API
  async function loadAirQuality() {
    try {
      const url = "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=28.6139&longitude=77.2090&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&hourly=pm10,pm2_5,us_aqi&timezone=Asia%2FKolkata";
      const res = await fetch(url);
      if (res.ok) {
        state.airQuality = await res.json();
        state.lastUpdated.aqi = new Date();
        if (state.activeTab === "aqi" || state.activeTab === "overview") {
          renderCurrentTab();
        }
      }
    } catch (e) {
      console.error("Failed to load air quality:", e);
    }
  }

  // Yamuna River Level Benchmark
  async function loadYamunaBenchmark() {
    // Official benchmark constants for Old Railway Bridge (Loha Pul, Delhi)
    state.yamunaTelemetry = {
      station: "Old Railway Bridge (Loha Pul), Delhi",
      dangerLevel: 205.33,
      warningLevel: 204.50,
      normalBedLevel: 202.00,
      liveSourceAvailable: false,
      liveStatus: "Telemetry Offline: CWC FFS gateway unavailable"
    };
  }

  // --- Teardrop Pin SVG Generators ---
  function createTeardropSvg(fillColor, width = 28, height = 36, innerDotColor = "#ffffff") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 24" style="display:block;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.45));">
      <path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8z" fill="${fillColor}" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="10" r="3.2" fill="${innerDotColor}"/>
    </svg>`;
  }

  function createClusterSvg(count, width = 28, height = 36) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 24" style="display:block;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.45));">
      <path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8z" fill="#1e293b" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="10" r="6" fill="#0f172a" stroke="#ffffff" stroke-width="0.8"/>
      <text x="12" y="12.5" text-anchor="middle" fill="#ffffff" font-size="7" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700">${count}</text>
    </svg>`;
  }

  function getZoneIcon(riskLevel, isSelected = false) {
    const color = getRiskColor(riskLevel);
    if (isSelected) {
      return L.divIcon({
        className: "pin pin-selected",
        html: createTeardropSvg(color, 34, 44, "#ffffff"),
        iconSize: [34, 44],
        iconAnchor: [17, 44],
        popupAnchor: [0, -44]
      });
    }
    return L.divIcon({
      className: "pin",
      html: createTeardropSvg(color, 28, 36, "#ffffff"),
      iconSize: [28, 36],
      iconAnchor: [14, 36],
      popupAnchor: [0, -36]
    });
  }

  function evaluateVerificationState(target, allReports, rainfallRate) {
    if (!target) {
      return {
        status: "pending_verification",
        label: "Pending Triage",
        badgeClass: "pending_verification",
        reason: "Awaiting incident telemetry"
      };
    }
    const targetTime = target.reported_at ? new Date(target.reported_at).getTime() : Date.now();
    const rollingWindowMs = 45 * 60 * 1000;
    const clusterRadiusKm = 0.3;

    const reportsList = allReports || [];
    const nearbyCluster = reportsList.filter(r => {
      const rTime = r.reported_at ? new Date(r.reported_at).getTime() : (Date.now() - 15 * 60 * 1000);
      if (Math.abs(targetTime - rTime) > rollingWindowMs) return false;
      return calculateHaversineDistance(target.lat, target.lng, r.lat, r.lng) <= clusterRadiusKm;
    });

    const crowdsourcedCount = nearbyCluster.length + 1;
    const curPrecip = typeof rainfallRate === "number" ? rainfallRate : (state.weather?.current?.precipitation || 0);
    const telemetryValidated = curPrecip >= 15.0;

    if (crowdsourcedCount >= 3 && telemetryValidated) {
      return {
        status: "agency_verified",
        label: "Agency Verified",
        badgeClass: "agency_verified",
        shieldIcon: true,
        reason: `Multi-factor authenticated: ${crowdsourcedCount} citizen reports + IMD AWS rainfall (${curPrecip} mm/hr >= 15 mm/hr threshold).`
      };
    }
    if (crowdsourcedCount >= 3) {
      return {
        status: "community_confirmed",
        label: "Community Confirmed",
        badgeClass: "community_confirmed",
        pulseHalo: true,
        reason: `Crowdsource consensus met: ${crowdsourcedCount} distinct reports within 300m radius in rolling 45-min window.`
      };
    }
    if (telemetryValidated) {
      return {
        status: "community_confirmed",
        label: "Sensor Corroborated",
        badgeClass: "community_confirmed",
        pulseHalo: true,
        reason: `Precipitation threshold breached: IMD AWS station confirms heavy localized downpour (${curPrecip} mm/hr).`
      };
    }
    return {
      status: "pending_verification",
      label: "Pending Triage",
      badgeClass: "pending_verification",
      reason: "Single witness log awaiting crowdsourced cross-validation (requires >= 3 reports or AWS rainfall > 15 mm/hr)."
    };
  }

  function getReportIcon(report) {
    const evalState = evaluateVerificationState(report, state.reports);
    if (evalState.status === "agency_verified") {
      return L.divIcon({
        className: "pin marker-agency-shield",
        html: createTeardropSvg("#2563eb", 26, 34, "#ffffff"),
        iconSize: [26, 34],
        iconAnchor: [13, 34],
        popupAnchor: [0, -34]
      });
    }
    if (evalState.status === "community_confirmed") {
      return L.divIcon({
        className: "pin marker-community-halo",
        html: createTeardropSvg("#eab308", 24, 32, "#ffffff"),
        iconSize: [24, 32],
        iconAnchor: [12, 32],
        popupAnchor: [0, -32]
      });
    }
    return L.divIcon({
      className: "pin",
      html: createTeardropSvg("#1e293b", 22, 30, "#ffffff"),
      iconSize: [22, 30],
      iconAnchor: [11, 30],
      popupAnchor: [0, -30]
    });
  }

  function getClusterIcon(count) {
    return L.divIcon({
      className: "pin",
      html: createClusterSvg(count, 28, 36),
      iconSize: [28, 36],
      iconAnchor: [14, 36],
      popupAnchor: [0, -36]
    });
  }

  // --- Map Markers Rendering (Urban Flood Nowcasting Delhi Model) ---
  function renderMapZoneMarkers() {
    if (!state.map) return;

    // Clear existing zone markers
    Object.values(state.markers.zones).forEach(m => state.map.removeLayer(m));
    state.markers.zones = {};

    if (!state.layersVisible.zones) return;

    const currentStep = state.nowcastStep || '0h';

    // Synchronize state.zones with 40 hotspots
    if (!state.zones || state.zones.length === 0) {
      state.zones = DELHI_UNDERPASSES.map(u => ({ ...u, lng: u.lon }));
    }

    state.zones.forEach(zone => {
      const depth = calculateNowcastDepth(zone, currentStep);
      const riskInfo = getNowcastRiskEvaluation(depth, zone.type);
      zone.currentDepth = depth;
      zone.currentRisk = riskInfo;
      zone.water_level = depth + ' cm';
      zone.risk_level = riskInfo.level;

      // Dynamic status description based on structure type
      const passageType = (zone.type && zone.type.toLowerCase().includes('underpass'))
        ? 'Underpass passage'
        : (zone.type && zone.type.toLowerCase().includes('tunnel'))
          ? 'Tunnel transit corridor'
          : 'Road carriage corridor';

      let alertDescription = '';
      if (depth >= 40) {
        alertDescription = `INUNDATED: Depth exceeds 40 cm. ${passageType} closed to vehicles. Critical hydro-lock danger.`;
      } else if (depth >= 15) {
        alertDescription = `WATERLOGGED: Caution advised. Sub-surface ponding detected. Reduce vehicle speed.`;
      } else {
        alertDescription = `CLEAR: Normal passage. Minimal standing water detected.`;
      }

      const isSelected = state.selectedZoneId === zone.id;
      const size = isSelected ? 34 : 26;
      const isPing = depth > 40;

      const pinHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: transform 0.15s ease;">
          ${isPing ? '<div class="nowcast-ping-ring"></div>' : ''}
          <div style="width: ${size}px; height: ${size}px; border-radius: 9999px; background: ${riskInfo.color}; border: 2.5px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: ${size >= 34 ? 12 : 10}px; font-family: monospace; position: relative; z-index: 2;">
            ${depth}
          </div>
          <div style="width: 2px; height: 5px; background: ${riskInfo.color};"></div>
          <div style="width: 6px; height: 2px; border-radius: 9999px; background: rgba(0,0,0,0.3);"></div>
        </div>
      `;

      const nowcastIcon = L.divIcon({
        className: 'nowcast-underpass-pin',
        html: pinHtml,
        iconSize: [size, size + 7],
        iconAnchor: [size / 2, size + 7],
        popupAnchor: [0, -(size + 7)]
      });

      const marker = L.marker([zone.lat, zone.lng || zone.lon], { icon: nowcastIcon });

      const u = zone;
      const pct = Math.min(100, Math.round((depth / 80) * 100));
      const bannerBg = depth >= 40 ? '#fef2f2' : (depth >= 15 ? '#fffbeb' : '#ecfdf5');
      const bannerBorder = depth >= 40 ? '#fecaca' : (depth >= 15 ? '#fde68a' : '#a7f3d0');
      const bannerColor = depth >= 40 ? '#991b1b' : (depth >= 15 ? '#92400e' : '#065f46');

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 13px; line-height: 1.4; padding: 4px; min-width: 245px; max-width: 275px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div>
              <h4 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0;">${escapeHtml(u.name)}</h4>
              <span style="font-size: 11px; color: #64748b; font-weight: 600;">${escapeHtml(u.type || 'Corridor')} &bull; ${escapeHtml(u.area)}</span>
            </div>
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 7px; border-radius: 9999px; background: ${riskInfo.badgeBg}; color: ${riskInfo.text}; border: 1px solid ${riskInfo.border}; white-space: nowrap; margin-left: 6px;">
              ${riskInfo.label}
            </span>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px; margin-top: 8px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-size: 11px; font-weight: 600; color: #475569;">Inundation Depth:</span>
              <span style="font-size: 18px; font-weight: 900; color: ${riskInfo.color}; font-family: monospace;">${depth} <span style="font-size: 11px; font-weight: 600; color: #64748b;">cm</span></span>
            </div>
            <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 9999px; overflow: hidden; margin-top: 6px;">
              <div style="width: ${pct}%; height: 100%; background: ${riskInfo.color}; border-radius: 9999px; transition: width 0.3s ease;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; margin-top: 3px;">
              <span>0 cm (Dry)</span>
              <span>15 cm (Caution)</span>
              <span>40 cm+ (Closed)</span>
            </div>
          </div>

          <div style="background: ${bannerBg}; border: 1px solid ${bannerBorder}; border-radius: 12px; padding: 10px; margin-top: 10px; margin-bottom: 10px;">
            <p style="font-size: 11px; line-height: 1.4; color: ${bannerColor}; margin: 0; font-weight: 500;">
              ${alertDescription}
            </p>
          </div>

          <button onclick="window.reportIncidentAtCoord(${u.lat}, ${u.lng || u.lon}, '${escapeHtml(u.name).replace(/'/g, "\'")}', '${u.id}')" style="width: 100%; padding: 8px 10px; border-radius: 10px; background: #0284c7; color: #ffffff; border: none; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 1px 3px rgba(2,132,199,0.3);">
            <svg style="width: 12px; height: 12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Report Incident at Location
          </button>
        </div>
      `;
      marker.bindPopup(popupHtml);

      marker.on("click", () => {
        state.selectedZoneId = zone.id;
        window.showHazardToast({
          title: zone.name,
          location: zone.area || zone.name,
          score: riskInfo.score,
          severity: riskInfo.level,
          timestamp: new Date().toISOString(),
          description: alertDescription,
          source: "NOWCASTING DELHI MODEL",
          lat: zone.lat,
          lng: zone.lng || zone.lon
        });
      });

      marker.addTo(state.map);
      state.markers.zones[zone.id] = marker;
    });
  }

  // --- Delhi Stormwater Trunk Drainage Graph Layer ---
  function renderDrainageLayer() {
    if (!state.map) return;
    if (!state.drainageLayer) {
      state.drainageLayer = L.layerGroup();
    }
    state.drainageLayer.clearLayers();

    if (!state.drainageActive) {
      if (state.map.hasLayer(state.drainageLayer)) {
        state.map.removeLayer(state.drainageLayer);
      }
      return;
    }

    const drains = [
      {
        name: "Najafgarh Drain Corridor",
        details: "57 km trunk channel • Collects 60% of Delhi urban runoff • Outfall at Wazirabad",
        coords: [
          [28.6092, 76.9798],
          [28.6145, 77.0321],
          [28.6341, 77.0850],
          [28.6582, 77.1245],
          [28.6750, 77.1610],
          [28.6975, 77.1950],
          [28.7126, 77.2312]
        ],
        outfall: [28.7126, 77.2312],
        outfallName: "Najafgarh Outfall (Wazirabad)"
      },
      {
        name: "Barapullah Basin Drain",
        details: "South Delhi stormwater spine • Drains AIIMS, Lajpat Nagar, Lodhi Road & Sarai Kale Khan",
        coords: [
          [28.5282, 77.1925],
          [28.5480, 77.2100],
          [28.5685, 77.2320],
          [28.5830, 77.2470],
          [28.5912, 77.2568]
        ],
        outfall: [28.5912, 77.2568],
        outfallName: "Barapullah Outfall (Sarai Kale Khan)"
      },
      {
        name: "Shahdara Trunk Drain",
        details: "Trans-Yamuna primary arterial drain • Drains Anand Vihar, Seelampur & Chilla",
        coords: [
          [28.6950, 77.2920],
          [28.6738, 77.2912],
          [28.6460, 77.3050],
          [28.6210, 77.3080],
          [28.5998, 77.3094]
        ],
        outfall: [28.5998, 77.3094],
        outfallName: "Shahdara Outfall (Chilla Regulator)"
      }
    ];

    const currentStep = state.nowcastStep || '0h';
    const isSurging = (currentStep === '60m' || currentStep === '120m' || currentStep === '180m');

    drains.forEach(d => {
      const line = L.polyline(d.coords, {
        color: '#0284c7',
        weight: 3.5,
        dashArray: '6, 8',
        opacity: 0.95
      });
      line.bindPopup(`
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px; font-size: 12px; line-height: 1.4;">
          <div style="font-size: 10px; font-weight: 700; color: #0284c7; text-transform: uppercase;">🌊 Stormwater Trunk Drain</div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin: 2px 0;">${d.name}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px;">${d.details}</div>
        </div>
      `);
      state.drainageLayer.addLayer(line);

      // Overcapacity surging red nodes at +60m and +120m (+180m)
      if (isSurging) {
        const surgeIcon = L.divIcon({
          className: 'drainage-surge-icon',
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <div class="nowcast-ping-ring" style="width: 26px; height: 26px; top: -3px; left: -3px;"></div>
              <div style="width: 22px; height: 22px; border-radius: 9999px; background: #ef4444; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(239,68,68,0.5); display: flex; align-items: center; justify-content: center; font-size: 11px; color: white;">
                ⚠️
              </div>
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        const surgeMarker = L.marker(d.outfall, { icon: surgeIcon });
        surgeMarker.bindPopup(`
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px; font-size: 12px; line-height: 1.4; max-width: 240px;">
            <div style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 9999px; background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; display: inline-block; margin-bottom: 4px;">
              ⚠️ OUTFALL SURGE ALERT (${currentStep})
            </div>
            <div style="font-weight: 800; font-size: 13px; color: #0f172a;">${d.outfallName}</div>
            <div style="font-size: 11px; color: #991b1b; margin-top: 4px; line-height: 1.35;">
              Overcapacity hydraulic surge &gt; 100%. Gravity discharge restricted by high Yamuna level. Active underpass backflow risk.
            </div>
          </div>
        `);
        state.drainageLayer.addLayer(surgeMarker);
      }
    });

    if (!state.map.hasLayer(state.drainageLayer)) {
      state.map.addLayer(state.drainageLayer);
    }
  }

  window.toggleDrainageNetwork = function(forcedState) {
    state.drainageActive = (typeof forcedState === 'boolean') ? forcedState : !state.drainageActive;
    const btn = document.getElementById('btn-drainage-toggle');
    if (btn) {
      if (state.drainageActive) {
        btn.className = 'flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-sky-600 text-white border border-sky-700 shadow-md text-xs font-semibold hover:bg-sky-700 transition-all shrink-0 cursor-pointer';
      } else {
        btn.className = 'flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/80 text-slate-700 shadow-sm text-xs font-medium hover:bg-slate-50 transition-all shrink-0 cursor-pointer';
      }
    }
    renderDrainageLayer();
  };

  // --- Interactive Flood-Safe Alternative Route Simulation ---
  function renderSafeRouteLayer() {
    if (!state.map) return;
    if (!state.safeRouteLayer) {
      state.safeRouteLayer = L.layerGroup();
    }
    state.safeRouteLayer.clearLayers();

    if (!state.safeRouteActive) {
      if (state.map.hasLayer(state.safeRouteLayer)) {
        state.map.removeLayer(state.safeRouteLayer);
      }
      return;
    }

    // 1. Blocked Route (Red dotted line) via Minto/Tilak Bridge
    const blockedCoords = [
      [28.6310, 77.2650], // East Delhi (Laxmi Nagar / Vikas Marg)
      [28.6300, 77.2530],
      [28.6297, 77.2436], // ITO Vikas Marg
      [28.6276, 77.2394], // Tilak Bridge Underpass
      [28.6334, 77.2230], // Minto Bridge Underpass (Blocked)
      [28.6328, 77.2197]  // Connaught Place Inner Circle
    ];

    const blockedLine = L.polyline(blockedCoords, {
      color: '#ef4444',
      weight: 4.5,
      dashArray: '5, 8',
      opacity: 0.95
    });
    blockedLine.bindPopup(`
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px; font-size: 12px;">
        <span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 9999px; background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5;">DEFAULT ROUTE: BLOCKED</span>
        <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin: 4px 0 2px 0;">Via ITO & Minto Bridge</div>
        <div style="font-size: 11px; color: #991b1b;">⛔ Minto Bridge inundated (68 cm water). Submerged and closed.</div>
      </div>
    `);
    state.safeRouteLayer.addLayer(blockedLine);

    // Blocked Pin at Minto Bridge
    const mintoBlockedPin = L.divIcon({
      className: 'safe-route-blocked-icon',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div class="nowcast-ping-ring" style="width: 28px; height: 28px; top: -3px; left: -3px;"></div>
          <div style="padding: 3px 8px; border-radius: 9999px; background: #ef4444; color: #ffffff; font-weight: 800; font-size: 10px; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(239,68,68,0.5); white-space: nowrap; display: flex; align-items: center; gap: 4px;">
            <span>⛔</span> Minto Bridge Blocked (68 cm)
          </div>
          <div style="width: 2px; height: 6px; background: #ef4444;"></div>
        </div>
      `,
      iconSize: [160, 28],
      iconAnchor: [80, 28]
    });
    const blockedMarker = L.marker([28.6334, 77.2230], { icon: mintoBlockedPin });
    blockedMarker.bindPopup(`
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px; font-size: 12px;">
        <div style="font-size: 10px; font-weight: 800; color: #ef4444; text-transform: uppercase;">Transit Obstruction</div>
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin: 2px 0;">Minto Bridge Underpass</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Inundation Depth: <strong style="color: #ef4444;">68 cm</strong></div>
        <div style="font-size: 10.5px; color: #991b1b; margin-top: 4px; background: #fee2e2; padding: 4px 8px; border-radius: 6px;">Barricaded by Delhi Traffic Police. Take Barakhamba detour.</div>
      </div>
    `);
    state.safeRouteLayer.addLayer(blockedMarker);

    // 2. Flood-Safe Route (Solid emerald green line) via Barakhamba corridor
    const safeCoords = [
      [28.6310, 77.2650], // East Delhi Vikas Marg
      [28.6297, 77.2436], // ITO
      [28.6270, 77.2420], // Sikandra Road
      [28.6240, 77.2380], // Mandi House Roundabout
      [28.6290, 77.2260], // Barakhamba Road
      [28.6328, 77.2197]  // Connaught Place Inner Circle
    ];

    const safeLine = L.polyline(safeCoords, {
      color: '#10b981',
      weight: 5,
      opacity: 0.95
    });
    safeLine.bindPopup(`
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px; font-size: 12px;">
        <span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 9999px; background: #d1fae5; color: #059669; border: 1px solid #6ee7b7;">AI RECOMMENDED BYPASS</span>
        <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin: 4px 0 2px 0;">Via Mandi House & Barakhamba Rd</div>
        <div style="font-size: 11px; color: #047857;">✅ 0 cm water accumulation. Elevated arterial route. Open and safe.</div>
      </div>
    `);
    state.safeRouteLayer.addLayer(safeLine);

    // Waypoint Markers: Origin, Safe Bypass, Destination
    const originPin = L.divIcon({
      className: 'safe-route-pin',
      html: `
        <div style="padding: 2px 8px; border-radius: 9999px; background: #0f172a; color: #ffffff; font-weight: 700; font-size: 10px; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.3); white-space: nowrap;">
          📍 Start: East Delhi
        </div>
      `,
      iconSize: [110, 22],
      iconAnchor: [55, 22]
    });
    state.safeRouteLayer.addLayer(L.marker([28.6310, 77.2650], { icon: originPin }));

    const bypassPin = L.divIcon({
      className: 'safe-route-pin',
      html: `
        <div style="padding: 2px 8px; border-radius: 9999px; background: #059669; color: #ffffff; font-weight: 700; font-size: 10px; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(5,150,105,0.4); white-space: nowrap;">
          🛡️ Mandi House Bypass (0 cm)
        </div>
      `,
      iconSize: [140, 22],
      iconAnchor: [70, 22]
    });
    state.safeRouteLayer.addLayer(L.marker([28.6240, 77.2380], { icon: bypassPin }));

    const destPin = L.divIcon({
      className: 'safe-route-pin',
      html: `
        <div style="padding: 2px 8px; border-radius: 9999px; background: #0f172a; color: #ffffff; font-weight: 700; font-size: 10px; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.3); white-space: nowrap;">
          🎯 Connaught Place
        </div>
      `,
      iconSize: [110, 22],
      iconAnchor: [55, 22]
    });
    state.safeRouteLayer.addLayer(L.marker([28.6328, 77.2197], { icon: destPin }));

    if (!state.map.hasLayer(state.safeRouteLayer)) {
      state.map.addLayer(state.safeRouteLayer);
    }
  }

  window.toggleSafeRouteDemo = function(forcedState) {
    state.safeRouteActive = (typeof forcedState === 'boolean') ? forcedState : !state.safeRouteActive;
    const btn = document.getElementById('btn-saferoute-toggle');
    const card = document.getElementById('safe-route-guidance-card');
    if (btn) {
      if (state.safeRouteActive) {
        btn.className = 'flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-600 text-white border border-emerald-700 shadow-md text-xs font-semibold hover:bg-emerald-700 transition-all shrink-0 cursor-pointer';
      } else {
        btn.className = 'flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/95 backdrop-blur-md border border-emerald-500/80 text-emerald-700 shadow-sm text-xs font-semibold hover:bg-emerald-50 transition-all shrink-0 cursor-pointer';
      }
    }
    if (card) {
      card.style.display = state.safeRouteActive ? 'block' : 'none';
    }
    renderSafeRouteLayer();
    if (state.safeRouteActive) {
      window.fitToSafeRoute();
    }
  };

  window.fitToSafeRoute = function() {
    if (!state.map) return;
    state.map.fitBounds([
      [28.6220, 77.2140],
      [28.6360, 77.2680]
    ], { padding: [50, 50], animate: true });
  };

  // --- Nowcast Offset Switcher (Live 0h, +30m, +60m, +120m, +180m) ---
  window.setNowcastOffset = function(step) {
    state.nowcastStep = step || '0h';

    // 1. Update button styling
    const controls = document.querySelectorAll('#nowcast-timeline-controls .nowcast-btn');
    controls.forEach(btn => {
      if (btn.getAttribute('data-step') === step) {
        btn.className = 'nowcast-btn px-3 py-1 rounded-full text-xs font-bold bg-slate-900 text-white shadow-sm transition-all cursor-pointer';
      } else {
        btn.className = 'nowcast-btn px-3 py-1 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer';
      }
    });

    // 2. Re-render all 40 underpass markers
    renderMapZoneMarkers();

    // 3. Re-render drainage network if active (surging nodes)
    if (state.drainageActive) {
      renderDrainageLayer();
    }

    // 4. Update Overview tab if visible
    const overviewEl = document.getElementById('drawer-view-overview');
    if (overviewEl && !overviewEl.classList.contains('hidden')) {
      overviewEl.innerHTML = renderOverviewTab();
    }
    const drawerTitle = document.getElementById('drawer-title');
    if (drawerTitle && drawerTitle.textContent.includes('Overview')) {
      const drawerBody = document.getElementById('drawer-body');
      if (drawerBody) {
        drawerBody.innerHTML = renderOverviewTab();
      }
    }
  };

  function renderMapReportMarkers() {
    if (!state.map) return;

    state.markers.reports.forEach(m => state.map.removeLayer(m));
    state.markers.reports = [];

    if (!state.layersVisible.reports) return;

    const zoom = state.map.getZoom();

    if (zoom < 13 && state.reports.length > 3) {
      // Clustered when zoomed out
      const clusters = {};
      const gridSize = 0.035;
      state.reports.forEach(report => {
        const gridKey = `${Math.floor(report.lat / gridSize)}_${Math.floor(report.lng / gridSize)}`;
        if (!clusters[gridKey]) {
          clusters[gridKey] = {
            reports: [],
            latSum: 0,
            lngSum: 0
          };
        }
        clusters[gridKey].reports.push(report);
        clusters[gridKey].latSum += report.lat;
        clusters[gridKey].lngSum += report.lng;
      });

      Object.values(clusters).forEach(cluster => {
        const count = cluster.reports.length;
        const centerLat = cluster.latSum / count;
        const centerLng = cluster.lngSum / count;

        if (count === 1) {
          const report = cluster.reports[0];
          const evalState = evaluateVerificationState(report, state.reports);
          const marker = L.marker([report.lat, report.lng], { icon: getReportIcon(report) });
          marker.bindPopup(`
            <div style="font-size: 12.5px;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px;">
                <span style="font-weight: 700; text-transform: uppercase; font-size: 11px; color: var(--text-primary);">${report.hazard_type.replace('_', ' ')}</span>
                <span class="badge-verification ${evalState.badgeClass}">${evalState.label}</span>
              </div>
              <div style="color: var(--text-secondary); margin: 3px 0 6px;">${escapeHtml(report.description || "Community reported hazard")}</div>
              <div style="font-size: 10px; color: var(--text-muted);">${formatRelativeTime(report.reported_at)} &bull; ${evalState.reason}</div>
            </div>
          `);
          marker.on("click", () => {
            window.showHazardToast({
              title: report.hazard_type.replace('_', ' '),
              location: `${report.lat.toFixed(4)}, ${report.lng.toFixed(4)}`,
              timestamp: report.reported_at,
              description: report.description,
              source: report.source,
              lat: report.lat,
              lng: report.lng
            });
          });
          marker.addTo(state.map);
          state.markers.reports.push(marker);
        } else {
          const marker = L.marker([centerLat, centerLng], { icon: getClusterIcon(count) });
          marker.bindPopup(`
            <div style="font-size: 12px; padding: 2px;">
              <strong>${count} Community Reports</strong><br>
              <span style="color: var(--text-muted); font-size: 11px;">Zoom in to view individual hazard locations</span>
            </div>
          `);
          marker.on("click", () => {
            state.map.setView([centerLat, centerLng], Math.min(zoom + 2, 14));
          });
          marker.addTo(state.map);
          state.markers.reports.push(marker);
        }
      });
    } else {
      // Individual smaller pins with verification badging when zoomed in
      state.reports.forEach(report => {
        const evalState = evaluateVerificationState(report, state.reports);
        const marker = L.marker([report.lat, report.lng], { icon: getReportIcon(report) });
        marker.bindPopup(`
          <div style="font-size: 12.5px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px;">
              <span style="font-weight: 700; text-transform: uppercase; font-size: 11px; color: var(--text-primary);">${report.hazard_type.replace('_', ' ')}</span>
              <span class="badge-verification ${evalState.badgeClass}">${evalState.label}</span>
            </div>
            <div style="color: var(--text-secondary); margin: 3px 0 6px;">${escapeHtml(report.description || "Community reported hazard")}</div>
            <div style="font-size: 10px; color: var(--text-muted);">${formatRelativeTime(report.reported_at)} &bull; ${evalState.reason}</div>
          </div>
        `);
        marker.on("click", () => {
          window.showHazardToast({
            title: report.hazard_type.replace('_', ' '),
            location: `${report.lat.toFixed(4)}, ${report.lng.toFixed(4)}`,
            timestamp: report.reported_at,
            description: report.description,
            source: report.source,
            lat: report.lat,
            lng: report.lng
          });
        });
        marker.addTo(state.map);
        state.markers.reports.push(marker);
      });
    }
  }

  function getRiskColor(level) {
    switch (level) {
      case "HIGH": return "#dc2626";
      case "MODERATE": return "#d97706";
      case "LOW": return "#16a34a";
      case "NONE": return "#16a34a";
      default: return "#16a34a";
    }
  }

  // --- Tab Rendering Engine (Delegated to Unified Drawer Switcher) ---
  window.switchTab = function(tabId) {
    if (window.switchDrawerView) {
      window.switchDrawerView(tabId);
    }
  };

  function renderCurrentTab() {
    const titleEl = document.getElementById("drawer-title");
    const subtitleEl = document.getElementById("drawer-subtitle");
    const contentEl = document.getElementById("drawer-content");

    if (!contentEl) return;

    switch (state.activeTab) {
      case "overview":
        titleEl.textContent = "Delhi Hazard Overview";
        subtitleEl.textContent = "Live urban flood risk, precursor indicators, key metrics";
        contentEl.innerHTML = renderOverviewTab();
        break;

      case "map":
        titleEl.textContent = "Live Map Layers";
        subtitleEl.textContent = "Toggle Delhi flood infrastructure, hotspots, AQI";
        contentEl.innerHTML = renderMapTab();
        break;

      case "report":
        titleEl.textContent = "Report a Hazard";
        subtitleEl.textContent = "Crowdsourced waterlogging, open pits, blocked drains";
        contentEl.innerHTML = renderReportFormTab();
        attachReportFormEvents();
        break;

      case "community":
        titleEl.textContent = "Community Reports";
        subtitleEl.textContent = "Real-time verified civic hazard feed across Delhi";
        contentEl.innerHTML = renderCommunityFeedTab();
        attachCommunityFilterEvents();
        break;

      case "aqi":
        titleEl.textContent = "Air Quality Index";
        subtitleEl.textContent = "Real-time Delhi pollutant metrics and health advice";
        contentEl.innerHTML = renderAirQualityTab();
        break;

      case "weather":
        titleEl.textContent = "Weather & Forecast";
        subtitleEl.textContent = "Live conditions, hourly precipitation, 7-day outlook";
        contentEl.innerHTML = renderWeatherTab();
        break;

      case "yamuna":
        titleEl.textContent = "Hydrology & Drainage";
        subtitleEl.textContent = "River telemetry, outfalls & major flood channels";
        contentEl.innerHTML = renderYamunaTab();
        break;

      case "alerts":
        titleEl.textContent = "Alerts & Advisories";
        subtitleEl.textContent = "Precursor early warnings & AI commuter advisories";
        contentEl.innerHTML = renderAlertsTab();
        break;

      case "emergency":
        titleEl.textContent = "Emergency Contacts";
        subtitleEl.textContent = "Verified Delhi helplines, control rooms, disaster lines";
        contentEl.innerHTML = renderEmergencyTab();
        break;

      case "faq":
        titleEl.textContent = "FAQ & Legal";
        subtitleEl.textContent = "Operating details, privacy policy, terms of service";
        contentEl.innerHTML = renderFAQAndPolicyTab();
        attachAccordionEvents();
        break;
    }

    // Reset scroll inside panel
    contentEl.scrollTop = 0;
  }

  // --- Watchlist Rendering & Live Filtering ---
  function renderWatchlistCards(filterQuery = '') {
    const step = state.nowcastStep || '0h';
    const q = (filterQuery || '').trim().toLowerCase();

    const items = [...DELHI_UNDERPASSES].map(u => {
      const d = calculateNowcastDepth(u, step);
      const r = getNowcastRiskEvaluation(d, u.type);
      return { ...u, depth: d, riskInfo: r };
    }).filter(item => {
      if (!q) return true;
      return item.name.toLowerCase().includes(q) ||
             (item.area && item.area.toLowerCase().includes(q)) ||
             (item.type && item.type.toLowerCase().includes(q));
    }).sort((a, b) => b.depth - a.depth);

    if (items.length === 0) {
      return `
        <div style="text-align: center; padding: 24px 12px; color: #94a3b8; font-size: 12px;">
          No hotspots found matching "${escapeHtml(filterQuery)}"
        </div>
      `;
    }

    return items.map(item => `
      <div onclick="window.flyToHotspot(${item.lat}, ${item.lon}, '${item.id}')" style="background: #ffffff; border: 1px solid rgba(226, 232, 240, 0.9); border-left: 4px solid ${item.riskInfo.color}; border-radius: 12px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: all 0.15s ease;" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)';">
        <div style="flex: 1; padding-right: 8px;">
          <div style="font-size: 12.5px; font-weight: 700; color: #0f172a; line-height: 1.3;">${escapeHtml(item.name)}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
            ${escapeHtml(item.area)} • Depth: <strong style="color: ${item.riskInfo.color}; font-family: monospace;">${item.depth} cm</strong>
          </div>
        </div>
        <span style="font-size: 10px; font-weight: 700; padding: 2.5px 7px; border-radius: 9999px; background: ${item.riskInfo.badgeBg}; color: ${item.riskInfo.text}; border: 1px solid ${item.riskInfo.border}; white-space: nowrap;">
          ${item.riskInfo.shortLabel}
        </span>
      </div>
    `).join("");
  }

  window.flyToHotspot = function(lat, lon, id) {
    if (!state.map) return;
    state.selectedZoneId = id;
    state.map.flyTo([lat, lon], 16, { animate: true, duration: 1.0 });
    setTimeout(() => {
      if (state.markers.zones && state.markers.zones[id]) {
        state.markers.zones[id].openPopup();
      }
    }, 1100);
  };

  window.filterWatchlist = function(val) {
    const container = document.getElementById('watchlist-container');
    if (container) {
      container.innerHTML = renderWatchlistCards(val);
    }
  };

  // --- Tab 1: Overview (Light Glass Card matching Reference Design) ---
  function renderOverviewTab() {
    const currentRain = (state.weather && state.weather.current && typeof state.weather.current.precipitation === 'number')
      ? state.weather.current.precipitation.toFixed(1)
      : '0.0';
    const currentTemp = (state.weather && state.weather.current && typeof state.weather.current.temperature_2m === 'number')
      ? Math.round(state.weather.current.temperature_2m)
      : 26;
    const currentAqi = (state.airQuality && state.airQuality.current && typeof state.airQuality.current.pm2_5 === 'number')
      ? Math.round(state.airQuality.current.pm2_5)
      : 148;
    const yamunaVal = (state.yamunaTelemetry && state.yamunaTelemetry.currentLevel)
      ? state.yamunaTelemetry.currentLevel
      : '203.4';
    const currentStep = state.nowcastStep || '0h';

    return `
      <!-- Overall Risk Status Card -->
      <div class="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 mb-4 shadow-sm" style="background: rgba(248, 250, 252, 0.85); border: 1px solid rgba(226, 232, 240, 0.9); border-radius: 16px; padding: 16px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #fef3c7; border: 1px solid #fde68a; display: flex; align-items: center; justify-content: center; font-size: 13px;">
              ⚠️
            </div>
            <div>
              <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Overall Risk Status</div>
              <div style="font-size: 15px; font-weight: 800; color: #0f172a;">MODERATE</div>
            </div>
          </div>
          <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 9999px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a;">MODERATE</span>
        </div>
        <p style="font-size: 12px; color: #475569; line-height: 1.5; margin: 0 0 10px 0;">
          Precursor indicators suggest elevated water runoff along Ring Road underpasses and low-lying points.
        </p>
        <!-- Multi-tone Horizontal Progress Bar -->
        <div style="width: 100%; height: 8px; border-radius: 9999px; background: #e2e8f0; overflow: hidden; display: flex;">
          <div style="width: 40%; background: #10b981;" title="Normal baseline"></div>
          <div style="width: 35%; background: #f59e0b;" title="Moderate advisory"></div>
          <div style="width: 25%; background: #ef4444;" title="Critical overflow"></div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8; margin-top: 6px; font-weight: 600;">
          <span>Baseline</span>
          <span style="color: #d97706; font-weight: 700;">Moderate Alert</span>
          <span>High Risk</span>
        </div>
      </div>

      <!-- Key Indicators 4-Col Grid (Live High-Resolution Doppler Telemetry) -->
      <div style="margin-bottom: 16px;">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Live Telemetry & Indicators</div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
          <!-- 1. Water Level -->
          <div style="background: #ffffff; border: 1px solid rgba(226, 232, 240, 0.9); border-radius: 14px; padding: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Yamuna River Level</div>
            <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 4px 0 2px 0;">${yamunaVal} <span style="font-size: 11px; font-weight: 500; color: #64748b;">m</span></div>
            <span style="display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">Safe Level</span>
          </div>

          <!-- 2. Current Rainfall (Open-Meteo Doppler) -->
          <div style="background: #ffffff; border: 1px solid rgba(226, 232, 240, 0.9); border-radius: 14px; padding: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Rainfall (Live)</div>
            <div style="font-size: 17px; font-weight: 800; color: #0284c7; margin: 4px 0 2px 0;">${currentRain} <span style="font-size: 11px; font-weight: 500; color: #64748b;">mm</span></div>
            <span style="display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; background: ${parseFloat(currentRain) > 0 ? '#dbeafe' : '#f8fafc'}; color: ${parseFloat(currentRain) > 0 ? '#1e40af' : '#64748b'}; border: 1px solid ${parseFloat(currentRain) > 0 ? '#bfdbfe' : '#e2e8f0'};">${parseFloat(currentRain) > 5 ? 'Heavy Rain' : parseFloat(currentRain) > 0 ? 'Light Showers' : 'Dry / Clear'}</span>
          </div>

          <!-- 3. AQI -->
          <div style="background: #ffffff; border: 1px solid rgba(226, 232, 240, 0.9); border-radius: 14px; padding: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">AQI (PM2.5)</div>
            <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 4px 0 2px 0;">${currentAqi}</div>
            <span style="display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; background: ${currentAqi > 200 ? '#fee2e2' : currentAqi > 100 ? '#fef3c7' : '#ecfdf5'}; color: ${currentAqi > 200 ? '#991b1b' : currentAqi > 100 ? '#92400e' : '#047857'}; border: 1px solid ${currentAqi > 200 ? '#fca5a5' : currentAqi > 100 ? '#fde68a' : '#a7f3d0'};">${currentAqi > 200 ? 'Severe' : currentAqi > 100 ? 'Moderate' : 'Good'}</span>
          </div>

          <!-- 4. Temperature -->
          <div style="background: #ffffff; border: 1px solid rgba(226, 232, 240, 0.9); border-radius: 14px; padding: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Temperature</div>
            <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 4px 0 2px 0;">${currentTemp}°C</div>
            <span style="display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">Live Sensor</span>
          </div>
        </div>
      </div>

      <!-- Underpass Watchlist Cards (Delhi 40-Hotspot Nowcasting) -->
      <div style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
            40-Underpass Nowcast Watchlist (${currentStep})
          </div>
          <span onclick="window.filterByUnderpasses()" style="font-size: 11px; color: #0d9488; font-weight: 600; cursor: pointer;">View On Map (${DELHI_UNDERPASSES.length})</span>
        </div>
        
        <!-- Live Hotspot Search Filter -->
        <input 
          type="text" 
          placeholder="Search 40 hotspots by name or area..." 
          oninput="window.filterWatchlist(this.value)" 
          class="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 mb-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-sm"
          style="width: 100%; font-size: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; margin-bottom: 10px; color: #0f172a; outline: none;"
        />

        <div id="watchlist-container" class="max-h-[360px] overflow-y-auto space-y-2 pr-1 no-scrollbar" style="max-height: 360px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
          ${renderWatchlistCards('')}
        </div>
      </div>

      <!-- Action Button -->
      <div>
        <button onclick="window.switchTab('report')" style="width: 100%; padding: 12px; border-radius: 12px; background: #0d9488; color: #ffffff; border: none; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.25);">
          <svg style="width: 14px; height: 14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Report Waterlogging Incident
        </button>
      </div>
    `;
  }

  // --- Tab 2: Map Controls ---
  function renderMapTab() {
    return `
      <div class="panel-section">
        <div class="panel-section-title">Visible Map Layers</div>
        <div class="card">
          <label style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; cursor: pointer; margin-bottom: 10px;">
            <span>Waterlogging Hotspots (${state.zones.length})</span>
            <input type="checkbox" id="layer-zones" ${state.layersVisible.zones ? "checked" : ""} onchange="window.toggleLayer('zones', this.checked)">
          </label>
          <label style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; cursor: pointer; margin-bottom: 10px;">
            <span>Community Hazard Reports (${state.reports.length})</span>
            <input type="checkbox" id="layer-reports" ${state.layersVisible.reports ? "checked" : ""} onchange="window.toggleLayer('reports', this.checked)">
          </label>
          <label style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; cursor: pointer;">
            <span>Delhi NCT Administrative Boundary</span>
            <input type="checkbox" id="layer-boundary" ${state.layersVisible.boundary ? "checked" : ""} onchange="window.toggleLayer('boundary', this.checked)">
          </label>
        </div>
      </div>
    `;
  }

  window.toggleLayer = function(layerName, isChecked) {
    state.layersVisible[layerName] = isChecked;
    if (layerName === "zones") renderMapZoneMarkers();
    if (layerName === "reports") renderMapReportMarkers();
    if (layerName === "boundary") {
      if (state.boundaryLayer) {
        if (isChecked) state.boundaryLayer.addTo(state.map);
        else state.map.removeLayer(state.boundaryLayer);
      }
    }
  };

  window.resetMapToDelhi = function() {
    state.map.setView([28.6139, 77.2090], 11);
  };

  // --- Tab 3: Report a Hazard ---
  function renderReportFormTab() {
    return `
      <div id="form-success" class="form-success-banner">
        Hazard report successfully submitted to the Delhi early warning feed.
      </div>

      <form id="hazard-report-form" novalidate>
        <div class="form-group" id="group-ward">
          <label class="form-label" for="report-ward-search">Delhi Ward / Jurisdiction *</label>
          <div class="ward-autocomplete-wrapper">
            <input type="text" id="report-ward-search" class="form-input" placeholder="Search 250 Wards, Sub-division, District (e.g. Rohini, Karol Bagh, Saket)..." autocomplete="off" value="${state.selectedWardName || ''}" required>
            <div id="report-ward-dropdown" class="ward-autocomplete-dropdown"></div>
          </div>
          <input type="hidden" id="report-ward-id" value="${state.selectedWardId || ''}">
          <div id="selected-ward-badge" style="display: ${state.selectedWardName ? 'block' : 'none'}; margin-top: 6px;">
            <div style="font-size: 11px; padding: 4px 8px; border-radius: 6px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399;">
              Selected: <strong>${escapeHtml(state.selectedWardName || '')}</strong>
            </div>
          </div>
          <div class="form-error" id="ward-error">Please select an authoritative Delhi Ward.</div>
        </div>

        <div class="form-group" id="group-hazard-type">
          <label class="form-label" for="report-hazard-type">Hazard Category *</label>
          <select id="report-hazard-type" class="form-select" required>
            <option value="waterlogging">Waterlogging (Road submerged / underpass blocked)</option>
            <option value="broken_road">Broken Road / Severe Potholes</option>
            <option value="open_manhole">Open Manhole or Drain Pit</option>
            <option value="power_outage">Power Outage / Submerged Substation</option>
            <option value="road_blocked">Road Blocked by Fallen Tree or Debris</option>
          </select>
          <div class="form-error">Please select a valid hazard type.</div>
        </div>

        <div class="form-group" id="group-desc">
          <label class="form-label" for="report-desc">Description (Specific practical details)</label>
          <textarea id="report-desc" class="form-textarea" placeholder="E.g. Approx 1.5 ft water under underpass, traffic diverted towards outer ring road..."></textarea>
        </div>

        <div class="form-group" id="group-coords">
          <label class="form-label">Coordinates *</label>
          <div class="form-helper" style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Click the map or pick a ward above to set GPS location.</div>
          <div style="display: flex; gap: 8px; margin-bottom: 4px;">
            <input type="number" step="0.0001" id="report-lat" class="form-input" placeholder="Latitude" value="${state.pickedCoords ? state.pickedCoords.lat.toFixed(4) : ''}" required readonly style="cursor: default;">
            <input type="number" step="0.0001" id="report-lng" class="form-input" placeholder="Longitude" value="${state.pickedCoords ? state.pickedCoords.lng.toFixed(4) : ''}" required readonly style="cursor: default;">
          </div>
          <div id="clear-location-wrapper" style="display: ${state.pickedCoords ? 'block' : 'none'}; margin-top: 4px;">
            <button type="button" id="btn-clear-loc" class="link-btn" onclick="window.clearReportLocation()" style="background: none; border: none; padding: 0; font-size: 12px; color: var(--accent-teal); cursor: pointer; text-decoration: underline;">Clear location</button>
          </div>
          <div class="form-error" id="coords-error">Coordinates are required. Click the map to set the location.</div>
        </div>

        <button type="submit" class="btn btn-primary btn-full" style="margin-top: 14px;">
          Submit Civic Report
        </button>
      </form>
    `;
  }

  function attachReportFormEvents() {
    const form = document.getElementById("hazard-report-form");
    const wardSearch = document.getElementById("report-ward-search");
    const wardDropdown = document.getElementById("report-ward-dropdown");
    const wardIdInput = document.getElementById("report-ward-id");
    const wardBadge = document.getElementById("selected-ward-badge");

    if (wardSearch && wardDropdown) {
      wardSearch.addEventListener("input", (e) => {
        const q = e.target.value.trim();
        const matches = searchDelhiJurisdictions(q);
        if (matches.length > 0) {
          wardDropdown.innerHTML = matches.map(w => `
            <div class="ward-autocomplete-item" data-id="${w.id}" data-lat="${w.lat}" data-lng="${w.lng}" data-name="${escapeHtml(w.wardName)}" data-sub="${escapeHtml(w.subDivision)}" data-dist="${escapeHtml(w.district)}">
              <div class="ward-item-title">${escapeHtml(w.wardName)}</div>
              <div class="ward-item-sub">Ward #${w.wardNumber} &bull; ${escapeHtml(w.subDivision)}, ${escapeHtml(w.district)} &bull; Risk Baseline: ${w.vulnerabilityBaseline}/10</div>
            </div>
          `).join("");
          wardDropdown.style.display = "block";

          wardDropdown.querySelectorAll(".ward-autocomplete-item").forEach(item => {
            item.addEventListener("click", () => {
              const id = item.dataset.id;
              const lat = parseFloat(item.dataset.lat);
              const lng = parseFloat(item.dataset.lng);
              const name = item.dataset.name;
              const sub = item.dataset.sub;
              const dist = item.dataset.dist;

              wardSearch.value = `${name} (${sub}, ${dist})`;
              if (wardIdInput) wardIdInput.value = id;
              state.selectedWardId = id;
              state.selectedWardName = `${name} (${sub})`;
              wardDropdown.style.display = "none";

              if (wardBadge) {
                wardBadge.style.display = "block";
                wardBadge.innerHTML = `
                  <div style="font-size: 11px; padding: 4px 8px; border-radius: 6px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399;">
                    Selected: <strong>${escapeHtml(name)}</strong> &bull; ${sub}, ${dist}
                  </div>
                `;
              }
              document.getElementById("group-ward")?.classList.remove("has-error");

              handlePickedCoordinates(lat, lng, id, name);
              if (state.map) {
                state.map.flyTo([lat, lng], 14, { duration: 0.8 });
              }
            });
          });
        } else {
          wardDropdown.style.display = "none";
        }
      });

      document.addEventListener("click", (e) => {
        if (!wardSearch.contains(e.target) && !wardDropdown.contains(e.target)) {
          wardDropdown.style.display = "none";
        }
      });
    }

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        validateAndConfirmReport();
      });
    }
  }

  function handlePickedCoordinates(lat, lng, wardId, areaName) {
    state.pickedCoords = { lat, lng };

    // Drop or update location pin on map
    if (state.reportPinMarker && state.map) {
      state.map.removeLayer(state.reportPinMarker);
    }

    const pinIcon = L.divIcon({
      className: "pin pin-dropped",
      html: createTeardropSvg("#10b981", 28, 36, "#ffffff"),
      iconSize: [28, 36],
      iconAnchor: [14, 36],
      popupAnchor: [0, -36]
    });

    if (state.map) {
      state.reportPinMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(state.map);
      state.reportPinMarker.bindPopup(`<div style="font-size: 12px; font-weight: 600;">Report Location: ${escapeHtml(areaName || 'Delhi NCR')}</div>`);
    }

    const latInput = document.getElementById("report-lat");
    const lngInput = document.getElementById("report-lng");
    const clearWrap = document.getElementById("clear-location-wrapper");

    if (latInput) latInput.value = lat.toFixed(4);
    if (lngInput) lngInput.value = lng.toFixed(4);
    if (clearWrap) clearWrap.style.display = "block";

    // Auto-match ward if not already chosen
    const wardSearch = document.getElementById("report-ward-search");
    const wardIdInput = document.getElementById("report-ward-id");
    const wardBadge = document.getElementById("selected-ward-badge");

    if (wardSearch && (!wardSearch.value || wardId)) {
      let matchedWard = null;
      if (wardId) {
        matchedWard = DELHI_MCD_WARDS.find(w => w.id === wardId);
      }
      if (!matchedWard) {
        matchedWard = findClosestDelhiWard(lat, lng).ward;
      }
      if (matchedWard) {
        wardSearch.value = `${matchedWard.wardName} (${matchedWard.subDivision}, ${matchedWard.district})`;
        if (wardIdInput) wardIdInput.value = matchedWard.id;
        state.selectedWardId = matchedWard.id;
        state.selectedWardName = `${matchedWard.wardName} (${matchedWard.subDivision})`;
        if (wardBadge) {
          wardBadge.style.display = "block";
          wardBadge.innerHTML = `
            <div style="font-size: 11px; padding: 4px 8px; border-radius: 6px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399;">
              Selected: <strong>${escapeHtml(matchedWard.wardName)}</strong> &bull; ${matchedWard.subDivision}, ${matchedWard.district}
            </div>
          `;
        }
        document.getElementById("group-ward")?.classList.remove("has-error");
      }
    }
  }

  window.clearReportLocation = function() {
    state.pickedCoords = null;
    state.selectedWardId = null;
    state.selectedWardName = null;
    if (state.reportPinMarker && state.map) {
      state.map.removeLayer(state.reportPinMarker);
      state.reportPinMarker = null;
    }
    const latInput = document.getElementById("report-lat");
    const lngInput = document.getElementById("report-lng");
    const wardSearch = document.getElementById("report-ward-search");
    const wardIdInput = document.getElementById("report-ward-id");
    const wardBadge = document.getElementById("selected-ward-badge");
    const clearWrap = document.getElementById("clear-location-wrapper");

    if (latInput) latInput.value = "";
    if (lngInput) lngInput.value = "";
    if (wardSearch) wardSearch.value = "";
    if (wardIdInput) wardIdInput.value = "";
    if (wardBadge) wardBadge.style.display = "none";
    if (clearWrap) clearWrap.style.display = "none";
  };

  function validateAndConfirmReport() {
    const wardId = document.getElementById("report-ward-id")?.value;
    const wardSearchVal = document.getElementById("report-ward-search")?.value;
    const hazardTypeVal = document.getElementById("report-hazard-type")?.value;
    const descVal = document.getElementById("report-desc")?.value;
    const latVal = parseFloat(document.getElementById("report-lat")?.value);
    const lngVal = parseFloat(document.getElementById("report-lng")?.value);

    let hasError = false;

    if (!wardId && !wardSearchVal) {
      document.getElementById("group-ward")?.classList.add("has-error");
      hasError = true;
    } else {
      document.getElementById("group-ward")?.classList.remove("has-error");
    }

    if (isNaN(latVal) || isNaN(lngVal)) {
      const err = document.getElementById("coords-error");
      if (err) err.style.display = "block";
      hasError = true;
    } else {
      const err = document.getElementById("coords-error");
      if (err) err.style.display = "none";
    }

    if (hasError) return;

    // Nearest zone fallback for backend compatibility
    let zoneVal = "zone-cp";
    if (state.zones && state.zones.length > 0) {
      let minDist = Infinity;
      state.zones.forEach(z => {
        const d = calculateHaversineDistance(latVal, lngVal, z.lat, z.lng);
        if (d < minDist) {
          minDist = d;
          zoneVal = z.id;
        }
      });
    }

    showConfirmationModal({
      title: "Confirm Hazard Submission",
      body: `You are submitting a "${hazardTypeVal.replace('_', ' ')}" report for "${escapeHtml(wardSearchVal || 'Selected Location')}". This report will immediately enter the live Delhi multi-factor verification pipeline.`,
      confirmText: "Confirm and Post",
      onConfirm: async () => {
        await executeReportSubmission({
          zone_id: zoneVal,
          hazard_type: hazardTypeVal,
          description: (descVal ? descVal + " " : "") + `[Ward: ${wardSearchVal || 'Delhi'}]`,
          lat: latVal,
          lng: lngVal
        });
      }
    });
  }

  async function executeReportSubmission(payload) {
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const successBanner = document.getElementById("form-success");
        if (successBanner) {
          successBanner.classList.add("visible");
          setTimeout(() => successBanner.classList.remove("visible"), 6000);
        }
        document.getElementById("hazard-report-form").reset();
        window.clearReportLocation();
        await loadReports();
        await loadRiskOverview();
      } else {
        alert("Submission failed. Please check inputs and retry.");
      }
    } catch (e) {
      console.error(e);
      alert("Network error submitting report.");
    }
  }

  // --- Tab 4: Community Reports Feed ---
  function renderCommunityFeedTab() {
    return `
      <div class="panel-section">
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <select id="filter-hazard-type" class="form-select" style="flex: 1;">
            <option value="ALL">All Hazard Types</option>
            <option value="waterlogging">Waterlogging</option>
            <option value="broken_road">Broken Road</option>
            <option value="open_manhole">Open Manhole</option>
            <option value="power_outage">Power Outage</option>
            <option value="road_blocked">Road Blocked</option>
          </select>
        </div>

        <div id="reports-list">
          ${renderReportItems(state.reports)}
        </div>
      </div>
    `;
  }

  window.showReportToastByIndex = function(idx) {
    const rep = state.reports[idx];
    if (!rep) return;
    const zoneName = state.zones.find(z => z.id === rep.zone_id)?.name || rep.zone_id;
    window.showHazardToast({
      title: rep.hazard_type.replace('_', ' '),
      location: zoneName,
      timestamp: rep.reported_at,
      description: rep.description || "Civic hazard reported at this transit coordinate.",
      source: rep.source,
      lat: rep.lat,
      lng: rep.lng
    });
  };

  function renderReportItems(reportsList) {
    if (!reportsList || reportsList.length === 0) {
      return `<div class="card"><div class="card-desc">No hazard reports found for this filter.</div></div>`;
    }

    return reportsList.map((rep, idx) => {
      const zoneName = state.zones.find(z => z.id === rep.zone_id)?.name || rep.zone_id;
      const evalState = evaluateVerificationState(rep, state.reports);
      return `
        <div class="card" onclick="window.showReportToastByIndex(${idx})" role="button" tabindex="0" title="Click to view summary preview">
          <div class="card-title">
            <span style="text-transform: capitalize;">${rep.hazard_type.replace('_', ' ')}</span>
            <span class="badge-verification ${evalState.badgeClass}">
              ${evalState.shieldIcon ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>' : ''}
              ${evalState.label}
            </span>
          </div>
          <div style="font-size: 11.5px; font-weight: 600; color: var(--accent-teal); margin-top: 2px;">${zoneName}</div>
          <div class="card-desc">${escapeHtml(rep.description || "No additional description.")}</div>
          <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">Triage Reason: ${escapeHtml(evalState.reason)}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
            <span class="timestamp-note" style="margin: 0;">${formatRelativeTime(rep.reported_at)}</span>
            <div style="display: flex; gap: 6px;">
              <button class="btn-glass-action" onclick="event.stopPropagation(); window.copyText('${rep.lat.toFixed(4)}, ${rep.lng.toFixed(4)}', this)">
                ${ICONS.copy} Coords
              </button>
              <button class="btn-glass-action" onclick="event.stopPropagation(); window.inspectReportByIndex(${idx})">
                <span>Inspect</span>
                <span style="color: #38bdf8;">&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function attachCommunityFilterEvents() {
    const filterSelect = document.getElementById("filter-hazard-type");
    if (filterSelect) {
      filterSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        const filtered = val === "ALL" ? state.reports : state.reports.filter(r => r.hazard_type === val);
        const container = document.getElementById("reports-list");
        if (container) container.innerHTML = renderReportItems(filtered);
      });
    }
  }

  // --- Tab 5: Air Quality ---
  function renderAirQualityTab() {
    if (!state.airQuality) {
      return `<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`;
    }

    const cur = state.airQuality.current || {};
    const usAqi = cur.us_aqi ?? "--";
    const aqiLabel = getAqiLabel(usAqi);

    return `
      <div class="panel-section">
        <div class="panel-section-title">Central Atmospheric Telemetry (Open-Meteo & CPCB)</div>
        <div class="card">
          <div class="card-title">
            <span>Air Quality Index</span>
            <span class="badge" style="background: var(--brand-surface); color: var(--text-primary); border-color: var(--border-subtle);">${aqiLabel}</span>
          </div>

          <!-- Flat MetricBar for AQI -->
          ${typeof usAqi === "number" ? renderMetricBar({
            label: "US AQI Standard",
            value: usAqi,
            min: 0,
            max: 500,
            unit: "",
            warning: 100,
            danger: 200,
            subtext: getAqiHealthAdvisory(usAqi)
          }) : `
            <div style="font-size: 32px; font-weight: 800; color: var(--text-primary); margin: 6px 0 2px;">
              ${usAqi} <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">US AQI Index</span>
            </div>
            <div class="card-desc">${getAqiHealthAdvisory(usAqi)}</div>
          `}
          <div class="timestamp-note">Updated: ${formatDate(state.lastUpdated.aqi)}</div>
        </div>
      </div>

      <div class="panel-section">
        <div class="panel-section-title">Major Pollutants Concentration (Flat Status Bars)</div>
        <div class="card">
          ${typeof cur.pm2_5 === "number" ? renderMetricBar({
            label: "PM 2.5 Fine Inhalable Particles",
            value: cur.pm2_5,
            min: 0,
            max: 250,
            unit: " μg/m³",
            warning: 60,
            danger: 120,
            subtext: "Combustion particles, organic compounds, and metals."
          }) : `
            <div class="metric-box">
              <div class="metric-label">PM 2.5</div>
              <div class="metric-value">${cur.pm2_5 ?? "--"} <span class="metric-unit">μg/m³</span></div>
            </div>
          `}

          ${typeof cur.pm10 === "number" ? renderMetricBar({
            label: "PM 10 Coarse Dust Particles",
            value: cur.pm10,
            min: 0,
            max: 400,
            unit: " μg/m³",
            warning: 100,
            danger: 250,
            subtext: "Roadway dust, mechanical crushing, and construction particulate."
          }) : `
            <div class="metric-box">
              <div class="metric-label">PM 10</div>
              <div class="metric-value">${cur.pm10 ?? "--"} <span class="metric-unit">μg/m³</span></div>
            </div>
          `}

          ${typeof cur.nitrogen_dioxide === "number" ? renderMetricBar({
            label: "NO₂ Nitrogen Dioxide",
            value: cur.nitrogen_dioxide,
            min: 0,
            max: 200,
            unit: " μg/m³",
            warning: 80,
            danger: 150,
            subtext: "Vehicular exhaust and thermal power station emissions."
          }) : ""}
        </div>
      </div>
    `;
  }

  function getAqiLabel(aqi) {
    if (typeof aqi !== "number") return "Data Unavailable";
    if (aqi <= 50) return "Good";
    if (aqi <= 100) return "Moderate";
    if (aqi <= 150) return "Unhealthy for Sensitive Groups";
    if (aqi <= 200) return "Unhealthy";
    if (aqi <= 300) return "Very Unhealthy";
    return "Hazardous";
  }

  function getAqiHealthAdvisory(aqi) {
    if (typeof aqi !== "number") return "Real-time atmospheric sensor data currently unavailable.";
    if (aqi <= 100) return "Air quality is acceptable for outdoor physical activities.";
    if (aqi <= 200) return "Sensitive individuals should wear N95 filtration and reduce prolonged outdoor exertion.";
    return "High pollutant concentration. Commuters and vulnerable populations should avoid open road exposure.";
  }

  // --- Tab 6: Weather & Forecast ---
  function renderWeatherTab() {
    if (!state.weather) {
      return `<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`;
    }

    const cur = state.weather.current || {};
    const daily = state.weather.daily || {};

    return `
      <div class="panel-section">
        <div class="panel-section-title">Current Weather Conditions (Delhi NCR)</div>
        <div class="metrics-grid">
          <div class="metric-box">
            <div class="metric-label">Temperature</div>
            <div class="metric-value">${cur.temperature_2m ?? "--"} <span class="metric-unit">°C</span></div>
            <div class="metric-sub">Feels like ${cur.apparent_temperature ?? "--"} °C</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Relative Humidity</div>
            <div class="metric-value">${cur.relative_humidity_2m ?? "--"} <span class="metric-unit">%</span></div>
            <div class="metric-sub">Surface saturation</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Current Precipitation</div>
            <div class="metric-value">${cur.precipitation ?? "0.0"} <span class="metric-unit">mm</span></div>
            <div class="metric-sub">Last interval</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Wind Velocity</div>
            <div class="metric-value">${cur.wind_speed_10m ?? "--"} <span class="metric-unit">km/h</span></div>
            <div class="metric-sub">10m above ground</div>
          </div>
        </div>
        <div class="timestamp-note">Telemetry source: Open-Meteo European & GFS models.</div>
      </div>

      <div class="panel-section">
        <div class="panel-section-title">7-Day Rainfall Outlook (Precursor Assessment)</div>
        ${daily.time ? daily.time.map((dateStr, idx) => {
          const maxTemp = daily.temperature_2m_max[idx];
          const minTemp = daily.temperature_2m_min[idx];
          const rainSum = daily.precipitation_sum[idx];
          const rainProb = daily.precipitation_probability_max[idx];
          return `
            <div class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;">
              <div>
                <div style="font-weight: 600; font-size: 13px;">${formatDay(dateStr)}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${dateStr}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 700; font-size: 13px;">${rainSum} mm rain (${rainProb}%)</div>
                <div style="font-size: 11px; color: var(--text-muted);">${minTemp}°C to ${maxTemp}°C</div>
              </div>
            </div>
          `;
        }).join("") : ""}
      </div>
    `;
  }

  // --- Tab 7: Hydrology & Major Drainage Basins ---
  function renderYamunaTab() {
    const city = CITIES[state.currentCity] || CITIES.delhi;
    return `
      <div class="panel-section">
        <div class="panel-section-title">${city.riverName} Telemetry (${city.shortLabel})</div>
        <div class="card">
          <div class="card-title">
            <span>${city.gaugeLocation}</span>
            <span class="badge" style="background: rgba(148, 163, 184, 0.15); color: var(--text-secondary);">BENCHMARK GAUGE</span>
          </div>
          <p class="card-desc" style="margin-top: 6px;">
            The ${city.gaugeLocation} serves as the primary hydrological gauging benchmark for flood declaration in ${city.name}.
          </p>

          <!-- Flat Dynamic MetricBar for River Water Level -->
          ${renderMetricBar({
            label: "River Water Level vs Danger Mark",
            value: city.baseline,
            min: city.baseline - 2,
            max: city.dangerMark + 2,
            unit: city.unit,
            warning: city.warningMark,
            danger: city.dangerMark,
            subtext: "Live automated telemetry from the public gateway is offline. Calibrated statutory flood benchmarks: Warning Mark " + city.warningMark.toFixed(2) + " " + city.unit + ", Danger Mark " + city.dangerMark.toFixed(2) + " " + city.unit + ". Historic peak: " + city.peakRecord + "."
          })}

          <!-- 3 Separate Values Display -->
          <div class="yamuna-stats-grid">
            <div class="yamuna-stat-col">
              <div class="yamuna-stat-label">Live Water Level</div>
              <div class="yamuna-stat-val text-muted" style="font-size: 14px; font-weight: 700; color: var(--text-muted);">
                Unavailable
              </div>
              <div class="yamuna-stat-note">Gateway Offline</div>
            </div>
            <div class="yamuna-stat-col">
              <div class="yamuna-stat-label">Warning Mark</div>
              <div class="yamuna-stat-val" style="color: var(--risk-moderate);">
                ${city.warningMark.toFixed(2)} <span style="font-size: 11px; font-weight: 500;">${city.unit}</span>
              </div>
              <div class="yamuna-stat-note">Alert Threshold</div>
            </div>
            <div class="yamuna-stat-col">
              <div class="yamuna-stat-label">Danger Mark</div>
              <div class="yamuna-stat-val" style="color: var(--risk-high);">
                ${city.dangerMark.toFixed(2)} <span style="font-size: 11px; font-weight: 500;">${city.unit}</span>
              </div>
              <div class="yamuna-stat-note">Spill / Breach Level</div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel-section">
        <div class="panel-section-title">Major Stormwater Channels & Outfalls (${city.shortLabel})</div>
        ${city.outfalls.map(o => `
          <div class="card">
            <div class="card-title">${escapeHtml(o.name)}</div>
            <div class="card-desc">${escapeHtml(o.desc)}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // --- Tab 8: Alerts & Advisories (Crisp Light Theme Sync) ---
  function renderAlertsTab() {
    const highRisk = state.riskOverview.filter(r => r.level === "HIGH" || r.level === "MODERATE");

    return `
      <div class="mb-4">
        <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Precursor Warning Feed</div>
        ${highRisk.length === 0 ? `
          <div class="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 shadow-sm mb-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-slate-800">All Hotspots Clear</span>
              <span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">STABLE</span>
            </div>
            <div class="text-xs text-slate-500 mt-1 leading-relaxed">No moderate or severe waterlogging signals detected in current forecast window.</div>
          </div>
        ` : highRisk.map(hr => {
          const badgeClass = hr.level === "HIGH" 
            ? "bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full text-[10px]"
            : "bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]";
          return `
            <div class="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 shadow-sm mb-3">
              <div class="flex items-center justify-between">
                <span class="text-sm font-bold text-slate-800">${hr.zone_name}</span>
                <span class="${badgeClass}">${hr.level} (${hr.score}/10)</span>
              </div>
              <div class="text-xs text-slate-500 mt-1 leading-relaxed">
                Rainfall forecast: ${hr.rainfall_mm} mm. Verified community hazard reports: ${hr.recent_reports}.
              </div>
              <div class="mt-3">
                <button class="py-1.5 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-100 shadow-sm transition-all cursor-pointer" onclick="window.fetchAdvisoryForZone('${hr.zone_id}', this)">
                  Generate Plain-Language Warning
                </button>
              </div>
              <div id="advisory-box-${hr.zone_id}" class="mt-2.5 p-3 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-700 leading-relaxed shadow-sm hidden"></div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="mt-4">
        <button onclick="window.print()" class="w-full py-2.5 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 shadow-sm transition-all flex items-center justify-center gap-2 mt-3 cursor-pointer">
          <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
          Print Advisory Report
        </button>
      </div>
    `;
  }

  window.fetchAdvisoryForZone = async function(zoneId, btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = "Loading advisory...";
    try {
      const res = await fetch(`/api/zones/${zoneId}/advisory`);
      if (res.ok) {
        const data = await res.json();
        const box = document.getElementById(`advisory-box-${zoneId}`);
        if (box) {
          box.style.display = "block";
          box.textContent = data.advisory || "Exercise caution and avoid flooded underpass lanes.";
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = "Refresh Warning";
    }
  };

  window.selectZoneAndShowAdvisory = function(zoneId) {
    window.switchTab("alerts");
    setTimeout(() => {
      const box = document.getElementById(`advisory-box-${zoneId}`);
      if (box) {
        box.scrollIntoView({ behavior: "smooth" });
      }
    }, 150);
  };

  // --- Tab 9: Emergency Contacts ---
  function renderEmergencyTab() {
    return `
      <div class="panel-section">
        <div class="panel-section-title">Verified Delhi Helplines & Control Rooms</div>
        ${EMERGENCY_CONTACTS.map(item => `
          <div class="card">
            <div class="card-title">
              <span>${item.title}</span>
              <button class="btn-copy" onclick="window.copyText('${item.number}', this)">
                ${ICONS.copy} Copy
              </button>
            </div>
            <div style="font-size: 18px; font-weight: 800; color: var(--brand-primary); margin: 4px 0 2px;">
              <a href="tel:${item.number}" style="color: inherit; text-decoration: none;">${item.number}</a>
            </div>
            <div class="card-desc">${item.desc}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // --- Tab 10: FAQ, Privacy Policy, Terms ---
  function renderFAQAndPolicyTab() {
    return `
      <div class="panel-section">
        <div class="panel-section-title">Frequently Asked Questions</div>
        
        <div class="accordion-item open">
          <button class="accordion-header">
            <span>How does Delhi Hazard Watch score urban flood risk?</span>
            ${ICONS.chevronDown}
          </button>
          <div class="accordion-body">
            Risk scores range from 0 to 10 and are calculated from three verified components: live and short-range forecast rainfall intensity, historical underpass flood vulnerability (calibrated to Delhi municipal blackspots), and real-time community reports from citizens within the last 6 hours.
          </div>
        </div>

        <div class="accordion-item">
          <button class="accordion-header">
            <span>Where is the weather and AQI telemetry sourced from?</span>
            ${ICONS.chevronDown}
          </button>
          <div class="accordion-body">
            Rainfall, humidity, wind velocity, and ambient air quality data are queried directly from Open-Meteo European and GFS meteorological models and CPCB-calibrated atmospheric sensors. No mock numbers are generated. If a telemetry feed is unavailable, the dashboard explicitly indicates offline status.
          </div>
        </div>

        <div class="accordion-item">
          <button class="accordion-header">
            <span>Why is the Yamuna danger mark benchmarked at 205.33 meters?</span>
            ${ICONS.chevronDown}
          </button>
          <div class="accordion-body">
            The Central Water Commission (CWC) designates 204.50 meters as the warning mark and 205.33 meters as the official danger level at the Old Railway Bridge (Loha Pul). When water levels exceed 205.33m, evacuation of low-lying floodplains in Yamuna Bazaar, Mayur Vihar, and Burari is initiated.
          </div>
        </div>
      </div>

      <div class="panel-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div class="panel-section-title" style="margin-bottom: 0;">Privacy Policy</div>
          <a href="/privacy.html" target="_blank" style="font-size: 12px; color: var(--accent); text-decoration: none; font-weight: 500;">Open Standalone Page &rarr;</a>
        </div>
        <div class="card" style="font-size: 12px; line-height: 1.6; color: var(--text-secondary);">
          <p><strong>1. Data Collection:</strong> We collect coordinates and hazard categories provided voluntarily through the Report a Hazard form. We do not track or sell personal identities.</p>
          <p style="margin-top: 6px;"><strong>2. Local Storage:</strong> Preferences such as dark mode and telemetry selections are stored exclusively in your local browser storage.</p>
          <p style="margin-top: 6px;"><strong>3. No Third-party Tracking:</strong> This service contains zero behavioral ad trackers and zero third-party commercial analytics scripts.</p>
        </div>
      </div>

      <div class="panel-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div class="panel-section-title" style="margin-bottom: 0;">Terms & Conditions of Service</div>
          <a href="/terms.html" target="_blank" style="font-size: 12px; color: var(--accent); text-decoration: none; font-weight: 500;">Open Standalone Page &rarr;</a>
        </div>
        <div class="card" style="font-size: 12px; line-height: 1.6; color: var(--text-secondary);">
          <p>This platform serves as an open civic decision-support dashboard for Delhi commuters. Hazard submissions must reflect actual observable road conditions. For life-safety emergencies, immediately dial national helpline <strong>112</strong> or DDMA helpline <strong>1077</strong>.</p>
        </div>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">Administrative Access</div>
        <div class="card">
          <div class="card-title">Restricted Control Interface</div>
          <div class="card-desc" style="margin-bottom: 10px;">Authorized municipal personnel access to clear resolved hazards.</div>
          <div class="form-group" style="margin-bottom: 8px;">
            <div style="position: relative;">
              <input type="password" id="admin-pass-input" class="form-input" placeholder="Enter personnel passphrase">
              <button type="button" id="btn-toggle-pass" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; color: var(--text-muted);">
                ${ICONS.eye}
              </button>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="alert('Administrative endpoint secured with hardware credentials.')">Authenticate Personnel</button>
        </div>
      </div>
    `;
  }

  function attachAccordionEvents() {
    document.querySelectorAll(".accordion-header").forEach(header => {
      header.addEventListener("click", () => {
        header.parentElement.classList.toggle("open");
      });
    });

    const passInput = document.getElementById("admin-pass-input");
    const togglePassBtn = document.getElementById("btn-toggle-pass");
    if (togglePassBtn && passInput) {
      togglePassBtn.addEventListener("click", () => {
        const isPass = passInput.type === "password";
        passInput.type = isPass ? "text" : "password";
        togglePassBtn.innerHTML = isPass ? ICONS.eyeOff : ICONS.eye;
      });
    }
  }

  // --- Search Bar Functionality with Locations, Hospitals, Shops & Landmarks ---
  let searchDebounceTimer = null;
  let activeNominatimController = null;
  window._lastSearchResults = [];

  window.triggerSearchCategory = function(cat) {
    const input = document.getElementById("search-input");
    if (!input) return;
    input.value = cat;
    input.focus();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  function initSearch() {
    const input = document.getElementById("search-input");
    const dropdown = document.getElementById("search-dropdown");
    if (!input || !dropdown) return;

    let selectedResultIndex = -1;

    function renderQuickDiscovery() {
      dropdown.innerHTML = `
        <div style="padding: 10px 12px 6px 12px;">
          <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 8px;">Explore Delhi Places</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px;">
            <button type="button" class="quick-search-pill" onclick="window.triggerSearchCategory('hospital')" style="background: #fff1f2; border-color: #fecdd3; color: #e11d48;">🏥 Hospitals</button>
            <button type="button" class="quick-search-pill" onclick="window.triggerSearchCategory('market')" style="background: #fffbeb; border-color: #fde68a; color: #d97706;">🛍️ Shops & Markets</button>
            <button type="button" class="quick-search-pill" onclick="window.triggerSearchCategory('landmark')" style="background: #eef2ff; border-color: #c7d2fe; color: #4f46e5;">🏛️ Famous Places</button>
            <button type="button" class="quick-search-pill" onclick="window.triggerSearchCategory('locality')" style="background: #ecfdf5; border-color: #a7f3d0; color: #059669;">📍 Localities</button>
            <button type="button" class="quick-search-pill" onclick="window.triggerSearchCategory('underpass')" style="background: #f0f9ff; border-color: #bae6fd; color: #0284c7;">🌊 Underpasses</button>
          </div>
        </div>
      `;
      dropdown.classList.add("visible");
      selectedResultIndex = -1;
    }

    function highlightMatch(text, query) {
      if (!text || !query) return escapeHtml(text || "");
      const idx = text.toLowerCase().indexOf(query.toLowerCase());
      if (idx === -1) return escapeHtml(text);
      const before = escapeHtml(text.slice(0, idx));
      const match = escapeHtml(text.slice(idx, idx + query.length));
      const after = escapeHtml(text.slice(idx + query.length));
      return `${before}<strong style="color: #0284c7; background: #e0f2fe; border-radius: 2px; padding: 0 1px;">${match}</strong>${after}`;
    }

    function getLocalSearchResults(q) {
      const results = [];

      // 1. Curated POIs (Hospitals, Markets, Landmarks, Localities)
      if (typeof DELHI_POIS !== "undefined") {
        DELHI_POIS.forEach(p => {
          let score = 0;
          const nameLower = p.name.toLowerCase();
          const fullNameLower = (p.fullName || "").toLowerCase();
          const catLower = p.category.toLowerCase();
          const subLower = (p.subLocality || "").toLowerCase();
          const distLower = (p.district || "").toLowerCase();

          if (nameLower.startsWith(q)) score = 100;
          else if (nameLower.includes(q)) score = 80;
          else if (fullNameLower.includes(q)) score = 70;
          else if (catLower.startsWith(q) || catLower.includes(q)) score = 60;
          else if (p.tags && p.tags.some(t => t.includes(q))) score = 50;
          else if (subLower.includes(q) || distLower.includes(q)) score = 40;

          if (score > 0) {
            results.push({
              name: p.name,
              subtitle: `${p.subLocality || ''}${p.district ? ' • ' + p.district : ''}`,
              category: p.category,
              icon: p.icon || "📍",
              lat: p.lat,
              lng: p.lng,
              score: score,
              action: () => window.flyToPOI(p)
            });
          }
        });
      }

      // 2. Waterlogging Hotspots & Underpasses
      if (state.zones && state.zones.length > 0) {
        state.zones.forEach(z => {
          let score = 0;
          const zName = z.name.toLowerCase();
          if (zName.startsWith(q)) score = 95;
          else if (zName.includes(q)) score = 75;
          else if (q === "underpass" || q === "hotspot" || q === "waterlogged" || q === "flood") score = 55;

          if (score > 0) {
            results.push({
              name: z.name,
              subtitle: `Water Level: ${z.water_level || 'Normal'} • ${z.risk_level || 'Advisory'}`,
              category: "Flood Hotspot",
              icon: "🌊",
              lat: z.lat,
              lng: z.lng,
              score: score,
              action: () => window.selectZoneAndShowAdvisory(z.id)
            });
          }
        });
      }

      // 3. MCD Wards & Sub-Divisions
      if (typeof DELHI_MCD_WARDS !== "undefined") {
        DELHI_MCD_WARDS.forEach(w => {
          let score = 0;
          const wName = w.wardName.toLowerCase();
          const sub = w.subDivision.toLowerCase();
          const dist = w.district.toLowerCase();

          if (wName.startsWith(q)) score = 85;
          else if (wName.includes(q)) score = 65;
          else if (sub.includes(q) || dist.includes(q)) score = 45;
          else if (q === "ward") score = 35;

          if (score > 0) {
            results.push({
              name: w.wardName,
              subtitle: `${w.subDivision}, ${w.district} • Ward ${w.wardNumber}`,
              category: "MCD Ward",
              icon: "📍",
              lat: w.lat,
              lng: w.lng,
              score: score,
              action: () => window.flyToPOI({
                name: w.wardName,
                category: "MCD Ward",
                icon: "📍",
                lat: w.lat,
                lng: w.lng,
                subLocality: w.subDivision,
                district: w.district
              })
            });
          }
        });
      }

      // 4. Navigation tabs
      const tabs = [
        { id: "overview", name: "Overview & Precursors", desc: "Live flood precursors & risk overview" },
        { id: "map", name: "Live Map & Layers", desc: "Interactive radar & telemetry layer filters" },
        { id: "report", name: "Report a Hazard", desc: "Submit crowdsourced street incident" },
        { id: "community", name: "Community Reports", desc: "Live verified community incident feed" },
        { id: "aqi", name: "Air Quality Index", desc: "CPCB particulate & AQI station metrics" },
        { id: "weather", name: "Weather & Forecast", desc: "IMD Doppler radar & 5-day precipitation" },
        { id: "yamuna", name: "Yamuna & Drainage Basins", desc: "Old Railway Bridge water level telemetry" },
        { id: "alerts", name: "Alerts & Advisories", desc: "Official DDMA & Traffic Police advisories" },
        { id: "emergency", name: "Emergency Contacts", desc: "Control rooms, SDRF & Delhi helplines" }
      ];
      tabs.forEach(t => {
        let score = 0;
        const tName = t.name.toLowerCase();
        if (tName.startsWith(q)) score = 70;
        else if (tName.includes(q)) score = 50;

        if (score > 0) {
          results.push({
            name: t.name,
            subtitle: t.desc,
            category: "Navigation",
            icon: "🧭",
            score: score,
            action: () => window.switchTab(t.id)
          });
        }
      });

      // Sort by score descending and take top 10
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, 10);
    }

    function renderResults(list, query, isLiveLoading = false) {
      window._lastSearchResults = list;
      selectedResultIndex = -1;

      if (!list || list.length === 0) {
        dropdown.innerHTML = `
          <div style="padding: 14px; text-align: center; font-size: 12px; color: #64748b;">
            <div style="font-size: 18px; margin-bottom: 4px;">🔍</div>
            No immediate matches for "<strong>${escapeHtml(query)}</strong>".
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Searching OpenStreetMap live...</div>
          </div>
        `;
        dropdown.classList.add("visible");
        return;
      }

      dropdown.innerHTML = list.map((res, i) => {
        let badgeColor = "#0284c7";
        let badgeBg = "#f0f9ff";
        let badgeBorder = "#bae6fd";
        let iconBg = "#f8fafc";

        if (res.category === "Hospital") {
          badgeColor = "#e11d48"; badgeBg = "#fff1f2"; badgeBorder = "#fecdd3"; iconBg = "#fff1f2";
        } else if (res.category === "Market & Shop") {
          badgeColor = "#d97706"; badgeBg = "#fffbeb"; badgeBorder = "#fde68a"; iconBg = "#fffbeb";
        } else if (res.category === "Landmark") {
          badgeColor = "#4f46e5"; badgeBg = "#eef2ff"; badgeBorder = "#c7d2fe"; iconBg = "#eef2ff";
        } else if (res.category === "Locality" || res.category === "MCD Ward") {
          badgeColor = "#059669"; badgeBg = "#ecfdf5"; badgeBorder = "#a7f3d0"; iconBg = "#ecfdf5";
        } else if (res.category === "Flood Hotspot") {
          badgeColor = "#0284c7"; badgeBg = "#f0f9ff"; badgeBorder = "#bae6fd"; iconBg = "#f0f9ff";
        } else if (res.category === "Live Result") {
          badgeColor = "#0f766e"; badgeBg = "#f0fdfa"; badgeBorder = "#99f6e4"; iconBg = "#f0fdfa";
        }

        return `
          <div class="search-result-item" data-index="${i}">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
              <div style="width: 28px; height: 28px; border-radius: 8px; background: ${iconBg}; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;">
                ${res.icon || "📍"}
              </div>
              <div style="min-width: 0; flex: 1;">
                <div style="font-weight: 700; color: #0f172a; font-size: 13px; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${highlightMatch(res.name, query)}
                </div>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${escapeHtml(res.subtitle || "")}
                </div>
              </div>
            </div>
            <span class="search-result-badge" style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
              ${res.category}
            </span>
          </div>
        `;
      }).join("") + (isLiveLoading ? `
        <div style="padding: 6px 12px; font-size: 11px; color: #0284c7; background: #f0f9ff; border-radius: 8px; margin-top: 4px; display: flex; align-items: center; gap: 6px;">
          <svg style="width: 12px; height: 12px; animation: spin 1s linear infinite;" fill="none" viewBox="0 0 24 24"><circle style="opacity: 0.25;" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path style="opacity: 0.75;" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          Searching OpenStreetMap live across Delhi...
        </div>
      ` : "");

      dropdown.classList.add("visible");

      dropdown.querySelectorAll(".search-result-item").forEach((item) => {
        item.addEventListener("click", () => {
          const idx = parseInt(item.getAttribute("data-index"), 10);
          if (list[idx] && typeof list[idx].action === "function") {
            list[idx].action();
            dropdown.classList.remove("visible");
            input.value = list[idx].name;
            input.blur();
          }
        });
      });
    }

    // Input typing event
    input.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        renderQuickDiscovery();
        return;
      }

      // 1. Immediate local matching
      const localResults = getLocalSearchResults(q);
      renderResults(localResults, q, q.length >= 2);

      // 2. Debounced OSM Nominatim search for any arbitrary place/shop/hospital/street in Delhi
      if (q.length >= 2) {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        if (activeNominatimController) activeNominatimController.abort();

        searchDebounceTimer = setTimeout(async () => {
          try {
            activeNominatimController = new AbortController();
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ', Delhi')}&limit=6&addressdetails=1&viewbox=76.84,28.88,77.35,28.41`, {
              signal: activeNominatimController.signal
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data && data.length > 0) {
              const osmResults = data.map(item => {
                let cat = "Live Result";
                let icon = "📍";
                const type = (item.type || "").toLowerCase();
                const cls = (item.class || "").toLowerCase();
                if (type.includes("hospital") || cls === "healthcare" || (cls === "amenity" && type.includes("clinic"))) {
                  cat = "Hospital"; icon = "🏥";
                } else if (cls === "shop" || cls === "retail" || type.includes("market") || type.includes("mall")) {
                  cat = "Market & Shop"; icon = "🛍️";
                } else if (cls === "tourism" || cls === "historic" || cls === "leisure") {
                  cat = "Landmark"; icon = "🏛️";
                }
                const displayNameParts = item.display_name.split(",");
                const title = displayNameParts[0].trim();
                const subtitle = displayNameParts.slice(1, 4).join(",").trim();
                const lat = parseFloat(item.lat);
                const lng = parseFloat(item.lon);

                return {
                  name: title,
                  subtitle: subtitle || "Delhi, India",
                  category: cat,
                  icon: icon,
                  lat: lat,
                  lng: lng,
                  score: 40,
                  action: () => {
                    window.flyToPOI({
                      name: title,
                      category: cat,
                      icon: icon,
                      lat: lat,
                      lng: lng,
                      subLocality: subtitle,
                      district: "Delhi"
                    });
                  }
                };
              });

              // Merge local results with unique live results
              const merged = [...localResults];
              osmResults.forEach(osm => {
                const isDuplicate = merged.some(m => m.lat && m.lng && calculateHaversineDistance(m.lat, m.lng, osm.lat, osm.lng) < 0.2);
                if (!isDuplicate) {
                  merged.push(osm);
                }
              });

              // Re-render without loading spinner
              renderResults(merged, q, false);
            } else {
              renderResults(localResults, q, false);
            }
          } catch (err) {
            if (err.name !== "AbortError") {
              renderResults(localResults, q, false);
            }
          }
        }, 320);
      }
    });

    // Focus on input shows quick discovery if empty
    input.addEventListener("focus", () => {
      if (!input.value.trim()) {
        renderQuickDiscovery();
      } else {
        const q = input.value.trim().toLowerCase();
        renderResults(getLocalSearchResults(q), q, false);
      }
    });

    // Keyboard navigation
    input.addEventListener("keydown", (e) => {
      const items = dropdown.querySelectorAll(".search-result-item");
      if (!items || items.length === 0) {
        if (e.key === "Enter") {
          e.preventDefault();
          window.submitSearch();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedResultIndex = (selectedResultIndex + 1) % items.length;
        items.forEach((it, idx) => it.classList.toggle("active", idx === selectedResultIndex));
        items[selectedResultIndex]?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedResultIndex = (selectedResultIndex - 1 + items.length) % items.length;
        items.forEach((it, idx) => it.classList.toggle("active", idx === selectedResultIndex));
        items[selectedResultIndex]?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedResultIndex >= 0 && items[selectedResultIndex]) {
          items[selectedResultIndex].click();
        } else {
          window.submitSearch();
        }
      } else if (e.key === "Escape") {
        dropdown.classList.remove("visible");
      }
    });

    // Close dropdown on outside click
    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove("visible");
      }
    });
  }

  // --- Cookie Consent Banner ---
  function initCookieBanner() {
    const banner = document.getElementById("cookie-banner");
    if (!banner) return;
    const consent = localStorage.getItem("dhw_cookie_consent");
    if (!consent) {
      banner.classList.add("visible");
    }

    document.getElementById("btn-accept-cookie")?.addEventListener("click", () => {
      localStorage.setItem("dhw_cookie_consent", "accepted");
      banner.classList.remove("visible");
    });

    document.getElementById("btn-reject-cookie")?.addEventListener("click", () => {
      localStorage.setItem("dhw_cookie_consent", "rejected");
      banner.classList.remove("visible");
    });
  }

  // --- Scroll Progress Bar & Back-to-Top ---
  function initScrollProgress() {
    const container = document.getElementById("drawer-content");
    const progress = document.getElementById("scroll-progress");
    const backToTopBtn = document.getElementById("back-to-top-btn");

    if (container && progress) {
      container.addEventListener("scroll", () => {
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight - container.clientHeight;
        const pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        progress.style.width = `${pct}%`;

        if (backToTopBtn) {
          backToTopBtn.classList.toggle("visible", scrollTop > 180);
        }
      });
    }

    if (backToTopBtn) {
      backToTopBtn.addEventListener("click", () => {
        container.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  // --- Confirmation Modal Helper ---
  function showConfirmationModal({ title, body, confirmText, onConfirm }) {
    const overlay = document.getElementById("modal-overlay");
    const titleEl = document.getElementById("modal-title");
    const bodyEl = document.getElementById("modal-body");
    const confirmBtn = document.getElementById("modal-btn-confirm");
    const cancelBtn = document.getElementById("modal-btn-cancel");

    if (!overlay) return;

    titleEl.textContent = title;
    bodyEl.textContent = body;
    confirmBtn.textContent = confirmText || "Confirm";

    const cleanUp = () => {
      overlay.classList.remove("active");
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
    };

    confirmBtn.onclick = () => {
      cleanUp();
      if (onConfirm) onConfirm();
    };

    cancelBtn.onclick = () => {
      cleanUp();
    };

    overlay.classList.add("active");
  }

  // --- Utility Functions ---
  window.copyText = function(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
      const origHtml = btnElement.innerHTML;
      btnElement.innerHTML = `${ICONS.check} Copied`;
      setTimeout(() => {
        btnElement.innerHTML = origHtml;
      }, 2000);
    });
  };

  function formatDate(d) {
    if (!d) return "Pending";
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " IST";
  }

  function formatDay(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function formatRelativeTime(isoStr) {
    if (!isoStr) return "";
    const diffMin = Math.round((Date.now() - new Date(isoStr).getTime()) / 60000);
    if (diffMin <= 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.round(diffHr / 24)}d ago`;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function initEventListeners() {
    document.getElementById("theme-toggle-btn")?.addEventListener("click", toggleTheme);

    document.getElementById("drawer-close-btn")?.addEventListener("click", () => {
      document.getElementById("panel-drawer")?.classList.add("collapsed");
    });

    document.getElementById("mobile-nav-toggle")?.addEventListener("click", (e) => {
      e.stopPropagation();
      window.toggleDrawer();
    });

    document.getElementById("nav-menu-toggle")?.addEventListener("click", (e) => {
      e.stopPropagation();
      window.toggleMainDrawer(true);
    });

    document.getElementById("drawer-close-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      window.toggleDrawer(false);
    });

    document.getElementById("floating-contact-btn")?.addEventListener("click", () => {
      window.switchTab("emergency");
    });

    initCitySwitcher();
    initSearch();
    initScrollProgress();
  }


  // --- Modern Light Design Helpers ---
  window.flyToPOI = function(poi) {
    if (!state.map || !poi || typeof poi.lat !== "number" || typeof poi.lng !== "number") return;

    // 1. Switch to map/overview tab if not already visible
    if (state.activeTab !== "overview" && state.activeTab !== "map") {
      window.switchTab("overview");
    }

    // 2. Close navigation drawer on small devices/views
    if (window.toggleDrawer) {
      window.toggleDrawer(false);
    }

    // 3. Smooth camera flight
    state.map.flyTo([poi.lat, poi.lng], 15, { duration: 1.2 });

    // 4. Drop / update animated pulse marker
    if (state.pulseMarker && state.map) {
      state.map.removeLayer(state.pulseMarker);
    }
    const pulseIcon = L.divIcon({
      className: "pulse-marker-divicon",
      html: '<div class="pulse-marker-wrapper"><div class="pulse-marker-ring"></div><div class="pulse-marker-core"></div></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    state.pulseMarker = L.marker([poi.lat, poi.lng], { icon: pulseIcon }).addTo(state.map);

    // 5. Evaluate nearest underpass/hotspot flood telemetry
    let nearestZone = null;
    let minDistance = Infinity;
    if (state.zones && state.zones.length > 0) {
      state.zones.forEach(z => {
        if (typeof z.lat === "number" && typeof z.lng === "number") {
          const d = calculateHaversineDistance(poi.lat, poi.lng, z.lat, z.lng);
          if (d < minDistance) {
            minDistance = d;
            nearestZone = z;
          }
        }
      });
    }

    let drainageRiskHtml = "";
    if (nearestZone && minDistance <= 1.2) {
      drainageRiskHtml = `
        <div style="margin-top: 8px; padding: 6px 10px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 11px; display: flex; align-items: flex-start; gap: 6px;">
          <span style="font-size: 14px; line-height: 1;">⚠️</span>
          <div>
            <strong style="display: block; font-size: 11px;">High Waterlogging Risk</strong>
            <span style="font-size: 10px; color: #7f1d1d; line-height: 1.2;">Near ${escapeHtml(nearestZone.name)} (${minDistance.toFixed(1)} km). Watch for water build-up during downpours.</span>
          </div>
        </div>
      `;
    } else if (nearestZone && minDistance <= 2.8) {
      drainageRiskHtml = `
        <div style="margin-top: 8px; padding: 6px 10px; border-radius: 8px; background: #fffbeb; border: 1px solid #fde68a; color: #b45309; font-size: 11px; display: flex; align-items: flex-start; gap: 6px;">
          <span style="font-size: 14px; line-height: 1;">⚡</span>
          <div>
            <strong style="display: block; font-size: 11px;">Moderate Catchment Zone</strong>
            <span style="font-size: 10px; color: #78350f; line-height: 1.2;">Nearest hotspot: ${escapeHtml(nearestZone.name)} (~${minDistance.toFixed(1)} km). Minor arterial waterlogging possible.</span>
          </div>
        </div>
      `;
    } else {
      drainageRiskHtml = `
        <div style="margin-top: 8px; padding: 6px 10px; border-radius: 8px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; font-size: 11px; display: flex; align-items: flex-start; gap: 6px;">
          <span style="font-size: 14px; line-height: 1;">✅</span>
          <div>
            <strong style="display: block; font-size: 11px;">Normal Elevation Baseline</strong>
            <span style="font-size: 10px; color: #065f46; line-height: 1.2;">No severe underpass choke points within 3 km. Road network generally clear.</span>
          </div>
        </div>
      `;
    }

    // Category badge themes
    let badgeColor = "#0284c7";
    let badgeBg = "#f0f9ff";
    let badgeBorder = "#bae6fd";
    if (poi.category === "Hospital") {
      badgeColor = "#e11d48"; badgeBg = "#fff1f2"; badgeBorder = "#fecdd3";
    } else if (poi.category === "Market & Shop") {
      badgeColor = "#d97706"; badgeBg = "#fffbeb"; badgeBorder = "#fde68a";
    } else if (poi.category === "Landmark") {
      badgeColor = "#4f46e5"; badgeBg = "#eef2ff"; badgeBorder = "#c7d2fe";
    } else if (poi.category === "Locality" || poi.category === "MCD Ward") {
      badgeColor = "#059669"; badgeBg = "#ecfdf5"; badgeBorder = "#a7f3d0";
    }

    const popupHtml = `
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px; min-width: 230px; max-width: 270px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 7px; border-radius: 9999px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
            ${poi.icon || "📍"} ${poi.category || "Location"}
          </span>
          <span style="font-size: 10px; color: #64748b; font-family: monospace;">${poi.lat.toFixed(3)}, ${poi.lng.toFixed(3)}</span>
        </div>
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 4px; line-height: 1.25;">
          ${escapeHtml(poi.name)}
        </div>
        ${poi.subLocality ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${escapeHtml(poi.subLocality)}${poi.district ? ' • ' + escapeHtml(poi.district) : ''}</div>` : ''}
        ${drainageRiskHtml}
        <div style="margin-top: 8px; display: flex; gap: 6px;">
          <button onclick="window.reportIncidentAtCoord(${poi.lat}, ${poi.lng}, '${escapeHtml(poi.name).replace(/'/g, "\\'")}', '${poi.id || ''}')" style="width: 100%; padding: 6px 10px; border-radius: 8px; background: #0284c7; color: #ffffff; border: none; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 1px 3px rgba(2,132,199,0.3);">
            <svg style="width: 12px; height: 12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Report Hazard Here
          </button>
        </div>
      </div>
    `;

    L.popup({ maxWidth: 290, offset: [0, -10] })
      .setLatLng([poi.lat, poi.lng])
      .setContent(popupHtml)
      .openOn(state.map);
  };

  window.flyToCoords = function(coords, name, level, badge) {
    if (state.map) {
      state.map.flyTo(coords, 15, { duration: 1.2 });
      const badgeBg = badge.includes('High') ? '#fef2f2' : badge.includes('Moderate') ? '#fffbeb' : '#ecfdf5';
      const badgeColor = badge.includes('High') ? '#b91c1c' : badge.includes('Moderate') ? '#b45309' : '#047857';
      const badgeBorder = badge.includes('High') ? '#fecaca' : badge.includes('Moderate') ? '#fde68a' : '#a7f3d0';
      
      L.popup({ maxWidth: 260 })
        .setLatLng(coords)
        .setContent(`
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px;">
            <div style="font-size: 10px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px;">Underpass Telemetry</div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin: 3px 0;">${name}</div>
            <div style="font-size: 11px; color: #475569;">Water Level: <strong style="color: #0f172a;">${level}</strong></div>
            <div style="margin-top: 6px;">
              <span style="font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">${badge}</span>
            </div>
          </div>
        `)
        .openOn(state.map);
    }
  };

  window.filterByWaterlogged = function() {
    if (state.map) {
      state.map.flyTo([28.636, 77.224], 14, { duration: 1 });
      if (window.toggleTelemetryLayer) window.toggleTelemetryLayer('trafficSlowdowns');
    }
  };

  window.filterByUnderpasses = function() {
    if (state.map) {
      state.map.flyTo([28.586, 77.168], 13, { duration: 1 });
    }
  };

  window.flyToYamunaCorridor = function() {
    if (state.map) {
      state.map.flyTo([28.665, 77.235], 14, { duration: 1 });
      if (window.toggleTelemetryLayer) window.toggleTelemetryLayer('riverLevels');
    }
  };

  window.submitSearch = function() {
    const input = document.getElementById("search-input");
    const dropdown = document.getElementById("search-dropdown");
    if (!input || !input.value.trim()) return;
    const q = input.value.trim().toLowerCase();

    // 1. If dropdown has active results, select the top result
    if (window._lastSearchResults && window._lastSearchResults.length > 0) {
      window._lastSearchResults[0].action();
      if (dropdown) dropdown.classList.remove("visible");
      input.value = window._lastSearchResults[0].name;
      input.blur();
      return;
    }

    // 2. Check curated POIs
    if (typeof DELHI_POIS !== "undefined") {
      const poi = DELHI_POIS.find(p => p.name.toLowerCase().includes(q) || (p.tags && p.tags.some(t => t.includes(q))));
      if (poi) {
        window.flyToPOI(poi);
        if (dropdown) dropdown.classList.remove("visible");
        input.value = poi.name;
        input.blur();
        return;
      }
    }

    // 3. Check zones
    const zone = state.zones.find(z => z.name.toLowerCase().includes(q));
    if (zone) {
      window.selectZoneAndShowAdvisory(zone.id);
      if (dropdown) dropdown.classList.remove("visible");
      input.value = zone.name;
      input.blur();
      return;
    }

    // 4. Check MCD wards
    if (typeof DELHI_MCD_WARDS !== "undefined") {
      const ward = DELHI_MCD_WARDS.find(w => w.wardName.toLowerCase().includes(q));
      if (ward) {
        window.flyToPOI({
          name: ward.wardName,
          category: "MCD Ward",
          icon: "📍",
          lat: ward.lat,
          lng: ward.lng,
          subLocality: ward.subDivision,
          district: ward.district
        });
        if (dropdown) dropdown.classList.remove("visible");
        input.value = ward.wardName;
        input.blur();
        return;
      }
    }

    // 5. Fallback live fetch from Nominatim
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input.value + ", Delhi")}&limit=1&viewbox=76.84,28.88,77.35,28.41`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0 && state.map) {
          const title = data[0].display_name.split(',')[0];
          const subtitle = data[0].display_name.split(',').slice(1, 4).join(', ');
          window.flyToPOI({
            name: title,
            category: "Live Location",
            icon: "📍",
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            subLocality: subtitle,
            district: "Delhi"
          });
          if (dropdown) dropdown.classList.remove("visible");
          input.value = title;
          input.blur();
        }
      })
      .catch(() => {});
  };

  // ==========================================
  // UNIFIED DRAWER NAVIGATION SYSTEM
  // ==========================================
  window.toggleMainDrawer = function(forceOpen) {
    const drawer = document.getElementById("unified-sidebar-drawer");
    if (drawer && drawer.classList.contains("drawer-open") && forceOpen !== true) {
      window.toggleDrawer(false);
    } else {
      window.toggleDrawer(true);
    }
  };

  window.toggleDrawer = function(forceOpen) {
    const drawer = document.getElementById("unified-sidebar-drawer") || document.querySelector('[data-sidebar-drawer]');
    const backdrop = document.getElementById("drawer-backdrop");
    if (!drawer) return;

    const isOpen = drawer.classList.contains("drawer-open");
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !isOpen;

    if (shouldOpen) {
      drawer.classList.add("drawer-open");
      drawer.classList.remove("-translate-x-full");
      drawer.style.transform = "translateX(0)";
      if (backdrop) {
        backdrop.style.opacity = "1";
        backdrop.style.pointerEvents = "auto";
      }
      
      // If no sub-view is active or visible, ensure menu is shown
      const activeVisible = document.querySelector('[data-drawer-view]:not(.hidden)');
      if (!activeVisible) {
        window.switchDrawerView('menu');
      }
    } else {
      drawer.classList.remove("drawer-open");
      drawer.classList.add("-translate-x-full");
      drawer.style.transform = "translateX(-100%)";
      if (backdrop) {
        backdrop.style.opacity = "0";
        backdrop.style.pointerEvents = "none";
      }
    }
  };

  // Keep track of active view inside the same drawer
  window.switchDrawerView = function(viewName) {
    const drawer = document.getElementById('unified-sidebar-drawer') || document.querySelector('[data-sidebar-drawer]');
    const backBtn = document.getElementById('drawer-back-btn');
    const titleEl = document.getElementById('drawer-title');
    const body = document.getElementById('drawer-body');
    
    // 1. Ensure drawer remains fully visible
    if (drawer) {
      drawer.classList.add('drawer-open');
      drawer.classList.remove('-translate-x-full');
      drawer.style.transform = "translateX(0)";
    }
    const backdrop = document.getElementById("drawer-backdrop");
    if (backdrop) {
      backdrop.style.opacity = "1";
      backdrop.style.pointerEvents = "auto";
    }

    // 2. Hide all sub-view sections inside the drawer
    const views = document.querySelectorAll('[data-drawer-view]');
    views.forEach(v => {
      v.classList.add('hidden');
      v.style.display = 'none';
    });

    // 3. Handle Navigation Header & View Display
    if (viewName === 'menu') {
      if (backBtn) {
        backBtn.classList.add('hidden');
        backBtn.style.display = 'none';
      }
      if (titleEl) titleEl.innerText = 'Delhi Hazard Watch';
      
      let menuEl = document.getElementById('drawer-view-menu');
      if (!menuEl && body) {
        menuEl = document.createElement('div');
        menuEl.id = 'drawer-view-menu';
        menuEl.setAttribute('data-drawer-view', 'menu');
        body.appendChild(menuEl);
      }
      if (menuEl) {
        menuEl.innerHTML = renderDrawerMainMenu();
        menuEl.classList.remove('hidden');
        menuEl.style.display = 'block';
      }
    } else {
      if (backBtn) {
        backBtn.classList.remove('hidden');
        backBtn.style.display = 'inline-flex';
      }
      
      // Update title accordingly
      const titles = {
        'overview': 'Delhi Hazard Overview',
        'report': 'Report Local Hazard',
        'alerts': 'Alerts & Advisories',
        'community': 'Community Incident Feed',
        'feed': 'Community Incident Feed',
        'weather': 'AQI & Weather Forecast',
        'aqi': 'Air Quality Telemetry',
        'yamuna': 'Yamuna River Gauges',
        'emergency': 'Emergency Contacts',
        'faq': 'FAQ & Legal Guidance'
      };
      if (titleEl) titleEl.innerText = titles[viewName] || 'Details';

      // Ensure target sub-view exists
      let targetEl = document.getElementById(`drawer-view-${viewName}`);
      if (!targetEl && body) {
        targetEl = document.createElement('div');
        targetEl.id = `drawer-view-${viewName}`;
        targetEl.setAttribute('data-drawer-view', viewName);
        body.appendChild(targetEl);
      }

      state.activeTab = viewName;

      if (targetEl) {
        switch (viewName) {
          case 'overview':
            targetEl.innerHTML = renderOverviewTab();
            break;
          case 'report':
            targetEl.innerHTML = renderReportFormTab();
            attachReportFormEvents();
            break;
          case 'alerts':
            targetEl.innerHTML = renderAlertsTab();
            break;
          case 'community':
          case 'feed':
            targetEl.innerHTML = renderCommunityFeedTab();
            attachCommunityFilterEvents();
            break;
          case 'weather':
          case 'aqi':
            targetEl.innerHTML = renderWeatherTab();
            break;
          case 'yamuna':
            targetEl.innerHTML = renderYamunaTab();
            break;
          case 'emergency':
            targetEl.innerHTML = renderEmergencyTab();
            break;
          case 'faq':
            targetEl.innerHTML = renderFAQAndPolicyTab();
            attachAccordionEvents();
            break;
          default:
            targetEl.innerHTML = renderOverviewTab();
        }
        targetEl.classList.remove('hidden');
        targetEl.style.display = 'block';
      }
    }

    if (body) body.scrollTop = 0;
  };

  // Aliases for seamless compatibility
  window.openDrawerSubView = function(subViewId) {
    window.switchDrawerView(subViewId);
  };

  window.showDrawerMenu = function() {
    window.switchDrawerView('menu');
  };

  window.switchTab = function(tabId) {
    window.switchDrawerView(tabId);
  };

  function renderDrawerMainMenu() {
    const navItems = [
      {
        id: "overview",
        title: "Overview",
        desc: "City risk score, 24h rainfall & underpasses",
        badge: "LIVE",
        badgeClass: "bg-emerald-100 text-emerald-800",
        icon: `<svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`
      },
      {
        id: "community",
        title: "Community Feed",
        desc: "Verified resident waterlogging & incident logs",
        badge: `${state.reports.length || 0} Reports`,
        badgeClass: "bg-sky-100 text-sky-800",
        icon: `<svg class="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`
      },
      {
        id: "weather",
        title: "AQI & Weather",
        desc: "Real-time CPCB air quality index & IMD radar",
        badge: "AQI 148",
        badgeClass: "bg-amber-100 text-amber-800",
        icon: `<svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z"/></svg>`
      },
      {
        id: "yamuna",
        title: "Yamuna Gauges",
        desc: "CWC river levels, warning mark (204.5m) & drains",
        badge: "203.4m",
        badgeClass: "bg-teal-100 text-teal-800",
        icon: `<svg class="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`
      },
      {
        id: "alerts",
        title: "Alerts & Advisories",
        desc: "Precursor early warnings & traffic detour advice",
        badge: "Advisories",
        badgeClass: "bg-rose-100 text-rose-800",
        icon: `<svg class="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`
      },
      {
        id: "report",
        title: "Report Hazard",
        desc: "Submit geotagged waterlogging & blocked drains",
        badge: "Citizen Action",
        badgeClass: "bg-indigo-100 text-indigo-800",
        icon: `<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>`
      }
    ];

    return `
      <div class="flex flex-col gap-2.5">
        <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1">
          Civic Dashboard Modules
        </div>
        ${navItems.map(item => `
          <div onclick="window.switchDrawerView('${item.id}')" class="group bg-slate-50 hover:bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-white border border-slate-200/80 group-hover:scale-105 transition-transform flex items-center justify-center shrink-0 shadow-sm">
                ${item.icon}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-slate-800 group-hover:text-teal-700 transition-colors">${item.title}</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeClass}">${item.badge}</span>
                </div>
                <div class="text-xs text-slate-500 mt-0.5 leading-snug">${item.desc}</div>
              </div>
            </div>
            <svg class="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </div>
        `).join("")}

        <!-- Bottom Quick Helpline Pill -->
        <div class="mt-4 p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/80 flex items-center justify-between">
          <div>
            <div class="text-xs font-bold text-teal-900">Delhi Emergency Control</div>
            <div class="text-[11px] text-teal-700">Dial 112 or DDMA 1077 for immediate aid</div>
          </div>
          <button onclick="window.switchDrawerView('emergency')" class="px-3 py-1.5 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 transition-all cursor-pointer">
            Call
          </button>
        </div>
      </div>
    `;
  }

  // Close drawer on outside click (excluding all toggle triggers and any clicks inside drawer)
  document.addEventListener("click", (e) => {
    const drawer = document.getElementById("unified-sidebar-drawer");
    if (!drawer || !drawer.classList.contains("drawer-open")) return;
    if (drawer.contains(e.target)) return;
    if (e.composedPath && e.composedPath().includes(drawer)) return;
    if (e.target.closest && e.target.closest(".nav-toggle-btn, #nav-menu-toggle, #search-hamburger-btn, #mobile-nav-toggle")) return;
    window.toggleDrawer(false);
  });
})();
