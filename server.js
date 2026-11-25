/**
 * Local Development Server & API Backend
 * Zero-dependency Node.js HTTP server. Serves static files, trajectory data,
 * and provides full REST endpoints for the Evacuation Simulation Engine.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// Simulation State (in-memory backend)
let state = {
  building: {
    name: "JAIN University Tech Wing — Block 4",
    floor: "Level 2 (CSE & AI Department)",
    grid: { width: 1000, height: 650 }
  },
  zones: [
    { id: "zone_a", name: "Lab A (Computer Vision)", type: "lab", capacity: 60, current_occupancy: 45, risk_level: "normal", coords: { x: 60, y: 70, w: 260, h: 180 }, center: { x: 190, y: 160 }, door: { x: 320, y: 160 } },
    { id: "zone_b", name: "Hall B (Robotics Arena)", type: "lab", capacity: 55, current_occupancy: 40, risk_level: "normal", coords: { x: 60, y: 390, w: 260, h: 190 }, center: { x: 190, y: 485 }, door: { x: 320, y: 485 } },
    { id: "zone_c", name: "Central Corridor C (Spine Hub)", type: "corridor", capacity: 90, current_occupancy: 35, risk_level: "normal", coords: { x: 360, y: 120, w: 280, h: 410 }, center: { x: 500, y: 325 }, doors: [{ x: 360, y: 160, target: "zone_a" }, { x: 360, y: 485, target: "zone_b" }, { x: 640, y: 160, target: "zone_d" }, { x: 640, y: 485, target: "zone_e" }, { x: 500, y: 120, target: "exit_north" }, { x: 500, y: 530, target: "exit_south" }] },
    { id: "zone_d", name: "Classroom D (AI DevOps)", type: "classroom", capacity: 45, current_occupancy: 30, risk_level: "normal", coords: { x: 680, y: 70, w: 260, h: 180 }, center: { x: 810, y: 160 }, door: { x: 680, y: 160 } },
    { id: "zone_e", name: "Auditorium E (Innovation Center)", type: "auditorium", capacity: 85, current_occupancy: 50, risk_level: "normal", coords: { x: 680, y: 390, w: 260, h: 190 }, center: { x: 810, y: 485 }, door: { x: 680, y: 485 } }
  ],
  overlaps: [
    { id: "ov_ab", zone_ids: ["zone_a", "zone_b"], name: "Lab A ∩ Hall B Overlap", shared_occupancy: 6, description: "West vestibule camera covers both Lab A and Hall B — 6 people counted in both" },
    { id: "ov_ac", zone_ids: ["zone_a", "zone_c"], name: "Lab A ∩ Corridor C Overlap", shared_occupancy: 14, description: "Doorway sensor zone between Lab A and Corridor C — 14 people counted in both" },
    { id: "ov_bc", zone_ids: ["zone_b", "zone_c"], name: "Hall B ∩ Corridor C Overlap", shared_occupancy: 12, description: "Equipment staging area sensor overlap — 12 detected in both" },
    { id: "ov_dc", zone_ids: ["zone_d", "zone_c"], name: "Classroom D ∩ Corridor C Overlap", shared_occupancy: 9, description: "Discussion alcove sensor overlap — 9 people counted in both" },
    { id: "ov_de", zone_ids: ["zone_d", "zone_e"], name: "Classroom D ∩ Auditorium E Overlap", shared_occupancy: 5, description: "Shared washroom lobby sensor overlap — 5 people in both" },
    { id: "ov_ec", zone_ids: ["zone_e", "zone_c"], name: "Auditorium E ∩ Corridor C Overlap", shared_occupancy: 15, description: "Double-door lobby motion camera overlap — 15 counted in both" },
    { id: "ov_abc", zone_ids: ["zone_a", "zone_b", "zone_c"], name: "Lab A ∩ Hall B ∩ Corridor C (3-Way)", shared_occupancy: 5, description: "West-hub 3-way junction overlap — 5 people counted in all three" },
    { id: "ov_cde", zone_ids: ["zone_c", "zone_d", "zone_e"], name: "Corridor C ∩ Classroom D ∩ Auditorium E (3-Way)", shared_occupancy: 4, description: "East-hub vestibule 3-way overlap — 4 counted in all three" }
  ],
  exits: [
    { id: "exit_north", name: "Exit 1 (North Main Gates)", max_flow_rate: 25, current_load: 0, status: "open", coords: { x: 450, y: 20, w: 100, h: 40 }, target: { x: 500, y: 40 } },
    { id: "exit_south", name: "Exit 2 (South Courtyard Exit)", max_flow_rate: 20, current_load: 0, status: "open", coords: { x: 450, y: 590, w: 100, h: 40 }, target: { x: 500, y: 610 } },
    { id: "exit_west", name: "Exit 3 (West Emergency Fire Door)", max_flow_rate: 15, current_load: 0, status: "open", coords: { x: 10, y: 290, w: 40, h: 80 }, target: { x: 30, y: 330 } },
    { id: "exit_east", name: "Exit 4 (East Garden Gate)", max_flow_rate: 18, current_load: 0, status: "open", coords: { x: 950, y: 290, w: 40, h: 80 }, target: { x: 970, y: 330 } }
  ],
  paths: [
    { id: "path_a_ux_west", origin: "zone_a", exitId: "exit_west", zoneSequence: ["zone_a"], distanceMeters: 28, turns: 1, isIntuitive: true, title: "Direct West Egress", description: "Exit Lab A rear door directly down West stairwell to Exit 3. No corridor transit required.", svgPoints: [[190, 160], [40, 160], [30, 330]] },
    { id: "path_a_opt_north", origin: "zone_a", exitId: "exit_north", zoneSequence: ["zone_a", "zone_c"], distanceMeters: 24, turns: 3, isIntuitive: false, title: "North Corridor Short Cut", description: "Exit Lab A into Corridor C, sharp right, sharp left past Server Annex to North Gates.", svgPoints: [[190, 160], [360, 160], [420, 140], [500, 120], [500, 40]] },
    { id: "path_b_ux_west", origin: "zone_b", exitId: "exit_west", zoneSequence: ["zone_b"], distanceMeters: 29, turns: 1, isIntuitive: true, title: "Straight West Direct Line", description: "Exit Hall B directly westward into Exit 3 fire corridor. Zero turns once in hallway.", svgPoints: [[190, 485], [40, 485], [30, 330]] },
    { id: "path_b_opt_south", origin: "zone_b", exitId: "exit_south", zoneSequence: ["zone_b", "zone_c"], distanceMeters: 26, turns: 3, isIntuitive: false, title: "South Hub Zigzag", description: "Exit Hall B into Central Hub, turn right, angle around reception counter to Exit 2.", svgPoints: [[190, 485], [360, 485], [420, 510], [500, 530], [500, 610]] },
    { id: "path_d_ux_east", origin: "zone_d", exitId: "exit_east", zoneSequence: ["zone_d"], distanceMeters: 26, turns: 1, isIntuitive: true, title: "East Garden Direct Egress", description: "Exit Classroom D east door straight into East Garden Gate. Unobstructed line of sight.", svgPoints: [[810, 160], [940, 160], [970, 330]] },
    { id: "path_d_opt_north", origin: "zone_d", exitId: "exit_north", zoneSequence: ["zone_d", "zone_c"], distanceMeters: 25, turns: 3, isIntuitive: false, title: "North Gate Angle Pass", description: "Enter Central Corridor, weave past display kiosks to North Exit.", svgPoints: [[810, 160], [640, 160], [580, 140], [500, 120], [500, 40]] },
    { id: "path_e_ux_east", origin: "zone_e", exitId: "exit_east", zoneSequence: ["zone_e"], distanceMeters: 27, turns: 1, isIntuitive: true, title: "Auditorium East Direct", description: "Step out right exit of Auditorium directly into East Garden Exit 4.", svgPoints: [[810, 485], [940, 485], [970, 330]] },
    { id: "path_e_opt_south", origin: "zone_e", exitId: "exit_south", zoneSequence: ["zone_e", "zone_c"], distanceMeters: 25, turns: 3, isIntuitive: false, title: "South Corridor Route", description: "Exit left into Spine Hub, turn left around pillar to South Courtyard.", svgPoints: [[810, 485], [640, 485], [580, 510], [500, 530], [500, 610]] },
    { id: "path_c_ux_north", origin: "zone_c", exitId: "exit_north", zoneSequence: ["zone_c"], distanceMeters: 22, turns: 0, isIntuitive: true, title: "Straight North Corridor March", description: "Proceed directly forward down Central Corridor straight to North Main Gates.", svgPoints: [[500, 325], [500, 40]] },
    { id: "path_c_opt_south", origin: "zone_c", exitId: "exit_south", zoneSequence: ["zone_c"], distanceMeters: 22, turns: 0, isIntuitive: true, title: "Straight South Corridor March", description: "Proceed straight south through Corridor C to South Courtyard Doors.", svgPoints: [[500, 325], [500, 610]] }
  ],
  scenarios: [
    { id: "scenario_corridor_smoke", title: "Scenario 1: Central Spine Smoke Influx (PIE Overlap Demonstration)", badge: "Core PIE Stress Test", description: "Electrical smoke alarm triggers in Central Corridor C. Sensor zones overlap across all five areas. PIE corrects a 26% overcounting error (200 → 148), preventing false exit bottleneck alerts.", hazardZoneId: "zone_c", severity: "critical", originZoneId: "zone_a", occupancyOverrides: { zone_a: 45, zone_b: 40, zone_c: 35, zone_d: 30, zone_e: 50 }, defaultThreshold: 15 },
    { id: "scenario_north_bottleneck", title: "Scenario 2: Lab A Fire & Exit Load Diversion", badge: "Exit Load Balancing", description: "Chemical fire in Lab A. Zones A, B, and Corridor C share sensor overlaps. PIE corrects a 22.1% overcounting error (122 → 95), giving accurate exit load for safe routing.", hazardZoneId: "zone_a", severity: "critical", originZoneId: "zone_b", occupancyOverrides: { zone_a: 50, zone_b: 42, zone_c: 30, zone_d: 25, zone_e: 40 }, defaultThreshold: 15 },
    { id: "scenario_hicks_law", title: "Scenario 3: Hick's Law Cognitive Decision Test (Threshold Live Switch)", badge: "UX-First vs Optimal", description: "Auditorium E evacuation with hazard in Classroom D. The 3-turn shortcut is only 8.2% faster — rejected at the default 15% threshold. Slide the threshold to 8% or below to see the route decision switch to Optimal live.", hazardZoneId: "zone_d", severity: "moderate", originZoneId: "zone_e", occupancyOverrides: { zone_a: 30, zone_b: 30, zone_c: 20, zone_d: 35, zone_e: 70 }, defaultThreshold: 15 }
  ],
  activeHazard: null,
  activeOriginZoneId: "zone_a",
  thresholdPercent: 15,
  latestSimulation: null,
  logs: [
    { id: "log_init", timestamp: new Date().toLocaleTimeString(), action: "SYSTEM_INIT", details: "Building model initialized with default layout.", relatedIncident: null }
  ]
};

function calculateSimulation(hazardZoneId, originZoneId, thresholdPercent) {
  const hazardZone = state.zones.find(z => z.id === hazardZoneId) || state.zones[0];
  const originZone = state.zones.find(z => z.id === originZoneId) || state.zones[0];

  let affectedZoneIds = [];
  if (hazardZoneId === 'zone_c') {
    affectedZoneIds = ['zone_a', 'zone_b', 'zone_c', 'zone_d', 'zone_e'];
  } else if (hazardZoneId === 'zone_a' || hazardZoneId === 'zone_b') {
    affectedZoneIds = ['zone_a', 'zone_b', 'zone_c'];
  } else {
    affectedZoneIds = ['zone_c', 'zone_d', 'zone_e'];
  }

  const affectedZones = affectedZoneIds.map(zid => {
    const z = state.zones.find(x => x.id === zid);
    return { id: z.id, name: z.name, count: z.current_occupancy };
  });

  const rawSum = affectedZones.reduce((acc, z) => acc + z.count, 0);

  const activeOverlaps = state.overlaps.filter(ov =>
    ov.zone_ids.every(zid => affectedZoneIds.includes(zid))
  );

  const pairwise = activeOverlaps.filter(ov => ov.zone_ids.length === 2);
  const triple = activeOverlaps.filter(ov => ov.zone_ids.length === 3);

  const totalSubtracted = pairwise.reduce((acc, ov) => acc + ov.shared_occupancy, 0);
  const totalAddedBack = triple.reduce((acc, ov) => acc + ov.shared_occupancy, 0);

  const correctedOccupancy = rawSum - totalSubtracted + totalAddedBack;
  const overcountingError = rawSum - correctedOccupancy;
  const errorPercentage = rawSum > 0 ? Math.round((overcountingError / rawSum) * 100) : 0;

  const termsByLevel = [
    {
      k: 1,
      sign: "+",
      title: "Individual Zone Occupancies (Raw Sum)",
      subtotal: rawSum,
      items: affectedZones.map(z => `|${z.name}| = ${z.count}`)
    },
    {
      k: 2,
      sign: "−",
      title: "Pairwise Overlaps (Subtracted to eliminate double-counting)",
      subtotal: totalSubtracted,
      items: pairwise.map(ov => `|${ov.name}| = ${ov.shared_occupancy}`)
    }
  ];

  if (triple.length > 0) {
    termsByLevel.push({
      k: 3,
      sign: "+",
      title: "3-Way Overlaps (Added back to correct over-subtraction)",
      subtotal: totalAddedBack,
      items: triple.map(ov => `|${ov.name}| = ${ov.shared_occupancy}`)
    });
  }

  const stepByStepFormula = `${affectedZones.map(z => `|${z.name}|`).join(' + ')} − (${pairwise.map(ov => `|${ov.name}|`).join(' + ')})` +
    (triple.length > 0 ? ` + (${triple.map(ov => `|${ov.name}|`).join(' + ')})` : '');

  const pie = {
    rawSum,
    correctedOccupancy,
    overcountingError,
    errorPercentage,
    totalSubtracted,
    totalAddedBack,
    termsByLevel,
    stepByStepFormula
  };

  // Route Decision using Hick's Law
  const candidatePaths = state.paths.filter(p => p.origin === originZone.id);
  let uxRoute = candidatePaths.find(p => p.isIntuitive) || candidatePaths[0];
  let optRoute = candidatePaths.find(p => !p.isIntuitive) || candidatePaths[0];

  const walkingSpeed = 1.2;
  const exitLoadRate = 18;

  const uxExit = state.exits.find(e => e.id === uxRoute.exitId);
  const optExit = state.exits.find(e => e.id === optRoute.exitId);
  const uxFlowRate = uxExit?.max_flow_rate || 18;
  const optFlowRate = optExit?.max_flow_rate || 20;

  const uxTravel = parseFloat((uxRoute.distanceMeters / walkingSpeed).toFixed(1));
  const uxQueue = parseFloat((correctedOccupancy / uxFlowRate).toFixed(1));
  const uxTheoretical = parseFloat((uxTravel + uxQueue).toFixed(1));
  const uxStress = parseFloat((uxTheoretical * (1 + uxRoute.turns * 0.05)).toFixed(1));

  const optTravel = parseFloat((optRoute.distanceMeters / walkingSpeed).toFixed(1));
  const optQueue = parseFloat((correctedOccupancy / optFlowRate).toFixed(1));
  const optTheoretical = parseFloat((optTravel + optQueue).toFixed(1));
  const optStress = parseFloat((optTheoretical * (1 + optRoute.turns * 0.12)).toFixed(1));

  const speedupPercent = parseFloat((((uxTheoretical - optTheoretical) / uxTheoretical) * 100).toFixed(1));
  const timeSaved = parseFloat((uxTheoretical - optTheoretical).toFixed(1));

  const uxFirstRoute = {
    ...uxRoute,
    exitName: state.exits.find(e => e.id === uxRoute.exitId)?.name || 'Exit',
    exitFlowRate: 18,
    theoreticalTime: uxTheoretical,
    stressAdjustedTime: uxStress,
    cognitiveLoadIndex: 3.3,
    queueTime: uxQueue,
    travelTime: uxTravel,
    strategy: 'ux-first'
  };

  const optimalRoute = {
    ...optRoute,
    exitName: state.exits.find(e => e.id === optRoute.exitId)?.name || 'Exit',
    exitFlowRate: 20,
    theoreticalTime: optTheoretical,
    stressAdjustedTime: optStress,
    cognitiveLoadIndex: 9.4,
    queueTime: optQueue,
    travelTime: optTravel,
    strategy: 'optimal'
  };

  const chooseOptimal = speedupPercent > thresholdPercent;
  const selectedStrategy = chooseOptimal ? 'optimal' : 'ux-first';
  const recommendedRoute = chooseOptimal ? optimalRoute : uxFirstRoute;

  let rationale = '';
  if (chooseOptimal) {
    rationale = `Optimal route overrode UX-First: Shortcut is ${speedupPercent}% faster (saves ${timeSaved}s), exceeding the ${thresholdPercent}% simplicity threshold. Despite ${optimalRoute.turns} turns, the time advantage outweighs cognitive hesitation.`;
  } else {
    rationale = `UX-First route chosen: Saves ${optimalRoute.turns - uxFirstRoute.turns} direction change(s) with lower cognitive load (3.3/10 vs 9.4/10). The optimal route is only ${speedupPercent}% faster, which does not exceed the ${thresholdPercent}% simplicity threshold. Hick's Law: fewer decision points prevent crowd hesitation.`;
  }

  const routing = {
    selectedStrategy,
    threshold: thresholdPercent,
    rationale,
    speedupPercent,
    timeSaved,
    recommendedRoute,
    optimalRoute,
    uxFirstRoute
  };

  return {
    incident: {
      zoneId: hazardZone.id,
      zoneName: hazardZone.name,
      severity: 'critical',
      triggeredAt: new Date().toLocaleTimeString()
    },
    affectedZones,
    pie,
    routing,
    evaluatedAt: new Date().toLocaleTimeString()
  };
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // REST API Routes
  if (pathname === '/api/model' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: state }));
    return;
  }

  if (pathname === '/api/simulate/hazard' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      state.activeHazard = {
        zoneId: data.hazardZoneId,
        severity: data.severity || 'critical',
        triggeredAt: new Date().toLocaleTimeString()
      };
      state.activeOriginZoneId = data.originZoneId || 'zone_a';

      const sim = calculateSimulation(data.hazardZoneId, state.activeOriginZoneId, state.thresholdPercent);
      state.latestSimulation = sim;

      state.logs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        action: 'HAZARD_SIMULATED',
        details: `Hazard in ${sim.incident.zoneName}. Affected: ${sim.pie.correctedOccupancy} evacuees (PIE corrected from raw ${sim.pie.rawSum}). Route chosen: ${sim.routing.selectedStrategy.toUpperCase()}`
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: sim }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  if (pathname === '/api/simulate/reset' && req.method === 'POST') {
    state.activeHazard = null;
    state.latestSimulation = null;
    state.logs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      action: 'SIMULATION_RESET',
      details: 'All hazard alarms cleared. System returned to nominal monitoring state.'
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: state }));
    return;
  }

  if (pathname === '/api/scenarios/load' && req.method === 'POST') {
    try {
      const { scenarioId } = await parseJsonBody(req);
      const sc = state.scenarios.find(s => s.id === scenarioId);
      if (!sc) throw new Error('Unknown scenario ' + scenarioId);

      if (sc.occupancyOverrides) {
        Object.entries(sc.occupancyOverrides).forEach(([zid, count]) => {
          const z = state.zones.find(x => x.id === zid);
          if (z) z.current_occupancy = count;
        });
      }

      state.thresholdPercent = sc.defaultThreshold || 15;
      state.activeHazard = {
        zoneId: sc.hazardZoneId,
        severity: sc.severity,
        triggeredAt: new Date().toLocaleTimeString()
      };
      state.activeOriginZoneId = sc.originZoneId;

      const sim = calculateSimulation(sc.hazardZoneId, sc.originZoneId, state.thresholdPercent);
      state.latestSimulation = sim;

      state.logs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        action: 'SCENARIO_LOADED',
        details: `Loaded scenario: "${sc.title}"`
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: sim, model: state }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  if (pathname === '/api/config/threshold' && req.method === 'PUT') {
    try {
      const { thresholdPercent } = await parseJsonBody(req);
      state.thresholdPercent = thresholdPercent;
      if (state.activeHazard) {
        state.latestSimulation = calculateSimulation(state.activeHazard.zoneId, state.activeOriginZoneId, thresholdPercent);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: { thresholdPercent } }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA routes
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, indexContent) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(indexContent);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Emergency Evacuation System running at http://localhost:${PORT}`);
});
