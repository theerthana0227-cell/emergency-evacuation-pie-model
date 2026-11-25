/**
 * Building3DView Component
 * Converts the 2D architectural floor plan into a realistic, interactive 3D educational institution.
 * Uses Three.js with OrbitControls, custom architectural geometry, institutional furniture,
 * glowing emergency signage, particle smoke/fire hazards, and animated 3D human figures.
 */

class Building3DView {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.onZoneClick = options.onZoneClick || null;
    this.onEvacuationUpdate = options.onEvacuationUpdate || null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animId = null;

    // View settings
    this.isWallTransparent = false;
    this.isRoofVisible = false;
    this.activeViewPreset = 'perspective';

    // Simulation state
    this.model = null;
    this.occupants = []; // Array of 3D human meshes with path states
    this.hazardParticles = null;
    this.routeLines = { ux: null, opt: null };
    this.isEvacuating = false;
    this.isPaused = false;
    this.simSpeed = 1.0;
    this.simTime = 0;
    this.evacuatedCount = 0;
    this.totalOccupants = 0;

    // Room mesh references for raycasting & hazard tint
    this.roomMeshes = {};
    this.roomMaterials = {};
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.init();
  }

  init() {
    if (!this.container) return;

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 550;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0f1d);
    this.scene.fog = new THREE.FogExp2(0x0a0f1d, 0.0035);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 1500);
    this.camera.position.set(0, 140, 160);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Controls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below ground
      this.controls.minDistance = 30;
      this.controls.maxDistance = 450;
      this.controls.target.set(0, 5, 0);
    }

    // Lighting
    this.setupLighting();

    // Build the architectural institution
    this.buildInstitution();

    // Event listeners
    window.addEventListener('resize', () => this.onWindowResize());
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // Animation Loop
    this.clock = new THREE.Clock();
    this.animate();
  }

  setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.65);
    this.scene.add(ambientLight);

    // Main directional sunlight / overhead interior flood
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
    sunLight.position.set(80, 160, 90);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    const d = 100;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    // Soft fill blue light from opposite side
    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.35);
    fillLight.position.set(-80, 80, -90);
    this.scene.add(fillLight);
  }

  // Coordinate mapping: 2D floorplan [0..1000, 0..650] -> 3D scene [X: -75..75, Z: -50..50]
  map2DTo3D(x, y) {
    const scale = 0.16;
    const offsetX = 500;
    const offsetY = 325;
    return {
      x: (x - offsetX) * scale,
      z: (y - offsetY) * scale
    };
  }

  buildInstitution() {
    this.buildingGroup = new THREE.Group();
    this.scene.add(this.buildingGroup);

    // 1. Ground Campus Plinth
    const plinthGeo = new THREE.BoxGeometry(190, 2, 130);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
      metalness: 0.1
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -1;
    plinth.receiveShadow = true;
    this.buildingGroup.add(plinth);

    // Surrounding campus sidewalk & grass accents
    const grassGeo = new THREE.BoxGeometry(230, 1, 170);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.95 });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.position.y = -1.6;
    this.buildingGroup.add(grass);

    // 2. Build Educational Department Rooms
    this.buildRooms();

    // 3. Build Outer Architectural Perimeter & Openings
    this.buildPerimeterWalls();

    // 4. Build Detailed Institutional Furniture
    this.buildFurniture();

    // 5. Emergency Exit Signs & Lights
    this.buildEmergencyExitSigns();

    // 6. Removable Roof / Ceiling
    this.buildRoof();
  }

  buildRooms() {
    // Room configurations based on real floor plan coordinates
    const roomConfigs = [
      {
        id: 'zone_a',
        name: 'Lab A – Computer Vision',
        bounds: { x: 60, y: 70, w: 260, h: 180 },
        floorColor: 0x1e293b,
        accentColor: 0x38bdf8,
        pattern: 'lab'
      },
      {
        id: 'zone_b',
        name: 'Hall B – Robotics Arena',
        bounds: { x: 60, y: 390, w: 260, h: 190 },
        floorColor: 0x1e293b,
        accentColor: 0xa855f7,
        pattern: 'arena'
      },
      {
        id: 'zone_c',
        name: 'Central Corridor C – Spine Hub',
        bounds: { x: 340, y: 70, w: 320, h: 510 },
        floorColor: 0x334155,
        accentColor: 0x10b981,
        pattern: 'corridor'
      },
      {
        id: 'zone_d',
        name: 'Classroom D – AI DevOps',
        bounds: { x: 680, y: 70, w: 260, h: 180 },
        floorColor: 0x1e293b,
        accentColor: 0x06b6d4,
        pattern: 'classroom'
      },
      {
        id: 'zone_e',
        name: 'Auditorium E – Innovation Center',
        bounds: { x: 680, y: 390, w: 260, h: 190 },
        floorColor: 0x1e293b,
        accentColor: 0xf59e0b,
        pattern: 'auditorium'
      }
    ];

    roomConfigs.forEach(cfg => {
      const p1 = this.map2DTo3D(cfg.bounds.x, cfg.bounds.y);
      const p2 = this.map2DTo3D(cfg.bounds.x + cfg.bounds.w, cfg.bounds.y + cfg.bounds.h);
      const w = Math.abs(p2.x - p1.x);
      const d = Math.abs(p2.z - p1.z);
      const cx = (p1.x + p2.x) / 2;
      const cz = (p1.z + p2.z) / 2;

      // Floor tile
      const floorGeo = new THREE.BoxGeometry(w, 0.4, d);
      const floorMat = new THREE.MeshStandardMaterial({
        color: cfg.floorColor,
        roughness: 0.5,
        metalness: 0.2
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.position.set(cx, 0.2, cz);
      floorMesh.receiveShadow = true;
      floorMesh.userData = { zoneId: cfg.id, name: cfg.name, isRoomFloor: true };
      this.buildingGroup.add(floorMesh);

      this.roomMeshes[cfg.id] = floorMesh;
      this.roomMaterials[cfg.id] = floorMat;

      // Floor border accent trim
      const trimGeo = new THREE.BoxGeometry(w + 0.2, 0.45, d + 0.2);
      const trimEdges = new THREE.EdgesGeometry(trimGeo);
      const trimLine = new THREE.LineSegments(
        trimEdges,
        new THREE.LineBasicMaterial({ color: cfg.accentColor, transparent: true, opacity: 0.4 })
      );
      trimLine.position.copy(floorMesh.position);
      this.buildingGroup.add(trimLine);

      // Room Name Floor Inscription (3D Decal or canvas label)
      this.createRoomFloorLabel(cfg.name, cx, cz, w, d);
    });
  }

  createRoomFloorLabel(text, x, z, roomWidth, roomDepth) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(255, 255, 255, 0.0)';
    ctx.fillRect(0, 0, 512, 128);

    ctx.font = 'bold 36px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(text.toUpperCase(), 256, 75);

    const texture = new THREE.CanvasTexture(canvas);
    const labelGeo = new THREE.PlaneGeometry(roomWidth * 0.75, (roomWidth * 0.75) * (128 / 512));
    const labelMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.7,
      depthWrite: false
    });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.rotation.x = -Math.PI / 2;
    labelMesh.position.set(x, 0.42, z);
    this.buildingGroup.add(labelMesh);
  }

  buildPerimeterWalls() {
    this.walls = [];
    const wallHeight = 12;
    const wallThick = 1.2;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.7,
      metalness: 0.15,
      transparent: true,
      opacity: this.isWallTransparent ? 0.35 : 0.95
    });
    this.wallMaterial = wallMat;

    // Helper to add a wall segment
    const addWall = (x, z, w, d, rot = 0) => {
      const geo = new THREE.BoxGeometry(w, wallHeight, d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, wallHeight / 2, z);
      mesh.rotation.y = rot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.buildingGroup.add(mesh);
      this.walls.push(mesh);
      return mesh;
    };

    // Outer Perimeter with emergency exit gaps
    // North Wall: (split for North Exit 1 at X ~ 0)
    addWall(-44, -50, 68, wallThick);
    addWall(44, -50, 68, wallThick);
    // North Exit gate threshold opening width ~ 18m centered at 0

    // South Wall: (split for South Exit 2 at X ~ 0)
    addWall(-44, 50, 68, wallThick);
    addWall(44, 50, 68, wallThick);

    // West Wall: (split for West Exit 3 at Z ~ 0)
    addWall(-75, -28, wallThick, 44);
    addWall(-75, 28, wallThick, 44);

    // East Wall: (split for East Exit 4 at Z ~ 0)
    addWall(75, -28, wallThick, 44);
    addWall(75, 28, wallThick, 44);

    // Interior Partition Walls separating rooms and corridor
    // West partition (between Lab A / Hall B and Corridor C): X ~ -24
    addWall(-24, -36, wallThick, 26); // North section
    addWall(-24, 0, wallThick, 20);   // Middle section
    addWall(-24, 37, wallThick, 24);  // South section
    // Openings at Z ~ -24 (Lab A east door) and Z ~ 24 (Hall B east door)

    // East partition (between Classroom D / Auditorium E and Corridor C): X ~ 24
    addWall(24, -36, wallThick, 26);
    addWall(24, 0, wallThick, 20);
    addWall(24, 37, wallThick, 24);
    // Openings at Z ~ -24 (Class D door) and Z ~ 24 (Auditorium E door)

    // Horizontal partition between Lab A and Hall B: Z ~ 0, West side
    addWall(-50, 0, 48, wallThick);

    // Horizontal partition between Classroom D and Auditorium E: Z ~ 0, East side
    addWall(50, 0, 48, wallThick);

    // Institutional Glass Windows along exterior walls
    this.buildWindows();
  }

  buildWindows() {
    const winMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      metalness: 0.8,
      transmission: 0.6,
      ior: 1.5
    });

    const addWindowRow = (x, z, count, step, isX) => {
      for (let i = 0; i < count; i++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(isX ? 5 : 0.4, 6, isX ? 0.4 : 5), winMat);
        win.position.set(
          isX ? x + (i - (count - 1) / 2) * step : x,
          6,
          isX ? z : z + (i - (count - 1) / 2) * step
        );
        this.buildingGroup.add(win);
      }
    };

    // Windows on Lab A north wall
    addWindowRow(-48, -50, 5, 7, true);
    // Windows on Classroom D north wall
    addWindowRow(48, -50, 5, 7, true);
    // Windows on Hall B south wall
    addWindowRow(-48, 50, 5, 7, true);
    // Windows on Auditorium E south wall
    addWindowRow(48, 50, 5, 7, true);
  }

  buildFurniture() {
    // 1. LAB A (Computer Vision): Rows of computer lab benches and servers
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const pcMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });

    const createWorkstation = (x, z) => {
      // Table
      const table = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 3), benchMat);
      table.position.set(x, 1.2, z);
      table.castShadow = true;
      this.buildingGroup.add(table);

      // Dual Monitors
      const mon1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.15), screenMat);
      mon1.position.set(x - 1, 2.8, z);
      const mon2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.15), screenMat);
      mon2.position.set(x + 1, 2.8, z);
      this.buildingGroup.add(mon1, mon2);

      // Chair
      const chair = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4), pcMat);
      chair.position.set(x, 0.7, z + 2.2);
      this.buildingGroup.add(chair);
    };

    createWorkstation(-60, -38);
    createWorkstation(-46, -38);
    createWorkstation(-60, -26);
    createWorkstation(-46, -26);

    // Server rack tower in corner
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8 });
    const rack = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 3), rackMat);
    rack.position.set(-68, 4, -44);
    this.buildingGroup.add(rack);

    // 2. HALL B (Robotics Arena): Test field safety barriers & robot arm pedestals
    const arenaLineMat = new THREE.MeshBasicMaterial({ color: 0xeab308 });
    const arenaRing = new THREE.Mesh(new THREE.RingGeometry(8, 9, 32), arenaLineMat);
    arenaRing.rotation.x = -Math.PI / 2;
    arenaRing.position.set(-48, 0.43, 25);
    this.buildingGroup.add(arenaRing);

    // Robot Arm Pedestal
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6 });
    const armMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3 });
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 2.5, 16), baseMat);
    pedestal.position.set(-48, 1.25, 25);
    const armJoint = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3, 0.8), armMat);
    armJoint.position.set(-48, 3.5, 25);
    armJoint.rotation.z = 0.3;
    this.buildingGroup.add(pedestal, armJoint);

    // 3. CENTRAL CORRIDOR C (Spine Hub): Reception / Information Desk, Planters, Digital Kiosks
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
    const recepDesk = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 2.8, 16, 1, false, 0, Math.PI), deskMat);
    recepDesk.rotation.y = Math.PI / 2;
    recepDesk.position.set(0, 1.4, 0);
    recepDesk.castShadow = true;
    this.buildingGroup.add(recepDesk);

    // Green Planters in corridor
    const planterMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 });
    const createPlanter = (x, z) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.1, 2.2, 12), planterMat);
      pot.position.set(x, 1.1, z);
      const plant = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 8), leafMat);
      plant.position.set(x, 3.2, z);
      this.buildingGroup.add(pot, plant);
    };
    createPlanter(-18, -12);
    createPlanter(18, -12);
    createPlanter(-18, 12);
    createPlanter(18, 12);

    // 4. CLASSROOM D (AI DevOps): Clustered desks, Kanban screen, Lecturer Podium
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const desk = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.2, 2.4), benchMat);
        desk.position.set(42 + c * 8, 1.1, -40 + r * 7);
        desk.castShadow = true;
        this.buildingGroup.add(desk);

        const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.3), pcMat);
        ch.position.set(42 + c * 8, 0.65, -38 + r * 7);
        this.buildingGroup.add(ch);
      }
    }
    // Kanban Projector Board
    const boardMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const kanban = new THREE.Mesh(new THREE.BoxGeometry(9, 4.5, 0.2), boardMat);
    kanban.position.set(50, 5, -49);
    this.buildingGroup.add(kanban);

    // 5. AUDITORIUM E (Innovation Center): Tiered Curved Seating Rows & Presentation Stage
    const stageMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const stage = new THREE.Mesh(new THREE.BoxGeometry(18, 1.2, 7), stageMat);
    stage.position.set(50, 0.6, 45);
    this.buildingGroup.add(stage);

    // Projection Screen
    const screen = new THREE.Mesh(new THREE.BoxGeometry(14, 6.5, 0.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    screen.position.set(50, 6, 49);
    this.buildingGroup.add(screen);

    // Curved tiered seating
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.5 });
    for (let row = 0; row < 4; row++) {
      const radius = 14 + row * 4;
      const heightStep = 0.6 + row * 0.7;
      for (let s = -3; s <= 3; s++) {
        const angle = Math.PI / 2 + (s * 0.18);
        const sx = 50 + Math.cos(angle) * radius;
        const sz = 44 - Math.sin(angle) * radius;
        const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 1.6), seatMat);
        seat.position.set(sx, heightStep, sz);
        seat.lookAt(50, 1, 45);
        this.buildingGroup.add(seat);
      }
    }
  }

  buildEmergencyExitSigns() {
    this.exitSigns = [];
    const exitDefs = [
      { id: 'exit_north', name: 'EXIT 1 (North Main)', pos: [0, 10, -49.5], rot: 0, lightPos: [0, 9, -47] },
      { id: 'exit_south', name: 'EXIT 2 (South Courtyard)', pos: [0, 10, 49.5], rot: Math.PI, lightPos: [0, 9, 47] },
      { id: 'exit_west', name: 'EXIT 3 (West Emergency)', pos: [-74.5, 10, 0], rot: Math.PI / 2, lightPos: [-72, 9, 0] },
      { id: 'exit_east', name: 'EXIT 4 (East Garden)', pos: [74.5, 10, 0], rot: -Math.PI / 2, lightPos: [72, 9, 0] }
    ];

    exitDefs.forEach(e => {
      // Sign Box
      const signBox = new THREE.Mesh(
        new THREE.BoxGeometry(6, 2.2, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x111827 })
      );
      signBox.position.set(...e.pos);
      signBox.rotation.y = e.rot;
      this.buildingGroup.add(signBox);

      // Glowing Green Face
      const faceMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.8), faceMat);
      face.position.set(0, 0, 0.28);
      signBox.add(face);

      // Emergency Light Glow Source
      const greenLight = new THREE.PointLight(0x22c55e, 1.2, 28);
      greenLight.position.set(...e.lightPos);
      this.buildingGroup.add(greenLight);

      this.exitSigns.push({ id: e.id, mesh: signBox, light: greenLight });
    });
  }

  buildRoof() {
    this.roofGroup = new THREE.Group();
    this.roofGroup.visible = this.isRoofVisible;
    this.buildingGroup.add(this.roofGroup);

    // Roof slabs over wings
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85
    });

    // West wing roof
    const westRoof = new THREE.Mesh(new THREE.BoxGeometry(50, 0.8, 100), roofMat);
    westRoof.position.set(-49, 12.4, 0);
    this.roofGroup.add(westRoof);

    // East wing roof
    const eastRoof = new THREE.Mesh(new THREE.BoxGeometry(50, 0.8, 100), roofMat);
    eastRoof.position.set(49, 12.4, 0);
    this.roofGroup.add(eastRoof);

    // Glass Skylight over central corridor spine
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      transmission: 0.8
    });
    const skylight = new THREE.Mesh(new THREE.BoxGeometry(48, 0.5, 96), glassMat);
    skylight.position.set(0, 12.5, 0);
    this.roofGroup.add(skylight);
  }

  // Toggles and View Controls
  toggleWallTransparency(forceVal) {
    this.isWallTransparent = typeof forceVal === 'boolean' ? forceVal : !this.isWallTransparent;
    if (this.wallMaterial) {
      this.wallMaterial.opacity = this.isWallTransparent ? 0.32 : 0.95;
      this.wallMaterial.needsUpdate = true;
    }
    return this.isWallTransparent;
  }

  toggleRoof(forceVal) {
    this.isRoofVisible = typeof forceVal === 'boolean' ? forceVal : !this.isRoofVisible;
    if (this.roofGroup) {
      this.roofGroup.visible = this.isRoofVisible;
    }
    return this.isRoofVisible;
  }

  setViewPreset(preset) {
    this.activeViewPreset = preset;
    if (!this.camera || !this.controls) return;

    if (preset === 'top') {
      // Straight overhead architectural view
      this.camera.position.set(0, 210, 0.1);
      this.controls.target.set(0, 0, 0);
    } else if (preset === 'isometric') {
      // Classic 45-degree isometric projection angle
      this.camera.position.set(130, 140, 130);
      this.controls.target.set(0, 5, 0);
    } else {
      // Perspective dynamic view
      this.camera.position.set(0, 110, 150);
      this.controls.target.set(0, 5, 0);
    }
    this.controls.update();
  }

  // Pointer interaction for room click
  onPointerDown(event) {
    if (!this.onZoneClick || !this.container) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(Object.values(this.roomMeshes));

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (hit.userData && hit.userData.zoneId) {
        console.log('3D Room clicked:', hit.userData.zoneId);
        this.onZoneClick(hit.userData.zoneId);
      }
    }
  }

  // Create an animated 3D human figure
  createHumanFigure(x, z, color = 0x38bdf8) {
    const humanGroup = new THREE.Group();

    // Body material with varied casual clothes
    const shirtColors = [0x38bdf8, 0x818cf8, 0x34d399, 0xf472b6, 0xfbbf24, 0xa78bfa];
    const chosenColor = color || shirtColors[Math.floor(Math.random() * shirtColors.length)];
    const shirtMat = new THREE.MeshStandardMaterial({ color: chosenColor, roughness: 0.6 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.5 });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.5), shirtMat);
    torso.position.y = 1.45;
    torso.castShadow = true;
    humanGroup.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), skinMat);
    head.position.y = 2.25;
    head.castShadow = true;
    humanGroup.add(head);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.3, 1.0, 0.35);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.22, 0.5, 0);
    leftLeg.castShadow = true;
    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.22, 0.5, 0);
    rightLeg.castShadow = true;
    humanGroup.add(leftLeg, rightLeg);

    humanGroup.position.set(x, 0.2, z);

    return {
      mesh: humanGroup,
      leftLeg: leftLeg,
      rightLeg: rightLeg,
      targetPos: new THREE.Vector3(x, 0.2, z),
      waypoints: [],
      currentWpIndex: 0,
      speed: 1.1 + Math.random() * 0.4,
      isEvacuated: false,
      walkPhase: Math.random() * Math.PI * 2
    };
  }

  // Populate occupants in rooms according to current model occupancy
  populateOccupants(model) {
    // Clear existing occupants
    this.occupants.forEach(occ => {
      this.scene.remove(occ.mesh);
    });
    this.occupants = [];
    this.evacuatedCount = 0;

    if (!model || !model.zones) return;

    model.zones.forEach(zone => {
      const count = zone.current_occupancy || 0;
      const p1 = this.map2DTo3D(zone.coords.x + 20, zone.coords.y + 20);
      const p2 = this.map2DTo3D(zone.coords.x + zone.coords.w - 20, zone.coords.y + zone.coords.h - 20);

      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minZ = Math.min(p1.z, p2.z);
      const maxZ = Math.max(p1.z, p2.z);

      for (let i = 0; i < count; i++) {
        const randX = minX + Math.random() * (maxX - minX);
        const randZ = minZ + Math.random() * (maxZ - minZ);
        const occ = this.createHumanFigure(randX, randZ);
        occ.zoneId = zone.id;
        this.scene.add(occ.mesh);
        this.occupants.push(occ);
      }
    });

    this.totalOccupants = this.occupants.length;
  }

  // Build 3D smoke & fire hazard particles
  createHazardParticles(zoneId) {
    if (this.hazardParticles) {
      this.scene.remove(this.hazardParticles);
      this.hazardParticles = null;
    }

    if (!zoneId || !this.model) return;
    const zone = this.model.zones.find(z => z.id === zoneId);
    if (!zone) return;

    const center3D = this.map2DTo3D(zone.center.x, zone.center.y);

    const particleCount = 140;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);

    const cFire = new THREE.Color(0xef4444);
    const cSmoke = new THREE.Color(0xf97316);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 8;
      positions[i * 3] = center3D.x + Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 8;
      positions[i * 3 + 2] = center3D.z + Math.sin(angle) * radius;

      const col = Math.random() > 0.4 ? cFire : cSmoke;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      scales[i] = 1.0 + Math.random() * 2.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 3.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.hazardParticles = new THREE.Points(geometry, material);
    this.hazardParticles.userData = { center: center3D };
    this.scene.add(this.hazardParticles);
  }

  // Draw 3D glowing evacuation route lines
  drawRouteLines(latestSimulation) {
    // Remove existing route lines
    if (this.routeLines.ux) {
      this.scene.remove(this.routeLines.ux);
      this.routeLines.ux = null;
    }
    if (this.routeLines.opt) {
      this.scene.remove(this.routeLines.opt);
      this.routeLines.opt = null;
    }

    if (!latestSimulation || !latestSimulation.routing) return;
    const { uxFirstRoute, optimalRoute, selectedStrategy } = latestSimulation.routing;

    // Helper to build 3D tube path from 2D svgPoints
    const build3DRouteTube = (svgPoints, color, radius, isDashed) => {
      if (!svgPoints || svgPoints.length < 2) return null;
      const points3D = svgPoints.map(pt => {
        const p = this.map2DTo3D(pt[0], pt[1]);
        return new THREE.Vector3(p.x, 0.8, p.z);
      });

      const curve = new THREE.CatmullRomCurve3(points3D);
      const tubeGeo = new THREE.TubeGeometry(curve, 40, radius, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: isDashed ? 0.6 : 0.95
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      this.scene.add(tubeMesh);
      return tubeMesh;
    };

    if (uxFirstRoute && uxFirstRoute.svgPoints) {
      // Recommended UX-First route in bright glowing emerald
      const isSelected = selectedStrategy === 'ux-first';
      this.routeLines.ux = build3DRouteTube(uxFirstRoute.svgPoints, 0x10b981, isSelected ? 0.45 : 0.25, !isSelected);
    }

    if (optimalRoute && optimalRoute.svgPoints) {
      // Optimal route in glowing cyan
      const isSelected = selectedStrategy === 'optimal';
      this.routeLines.opt = build3DRouteTube(optimalRoute.svgPoints, 0x06b6d4, isSelected ? 0.45 : 0.25, !isSelected);
    }
  }

  // Update visual state when model changes
  render(model) {
    if (!model) return;
    this.model = model;

    // 1. Highlight Hazard Zone in Red Pulse
    Object.keys(this.roomMeshes).forEach(id => {
      const mesh = this.roomMeshes[id];
      const mat = this.roomMaterials[id];
      if (model.activeHazard && model.activeHazard.zoneId === id) {
        mat.color.setHex(0x991b1b);
        mat.emissive.setHex(0xef4444);
        mat.emissiveIntensity = 0.45;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
        mat.color.setHex(id === 'zone_c' ? 0x334155 : 0x1e293b);
      }
    });

    // 2. Hazard Smoke / Fire Particles
    if (model.activeHazard) {
      this.createHazardParticles(model.activeHazard.zoneId);
    } else if (this.hazardParticles) {
      this.scene.remove(this.hazardParticles);
      this.hazardParticles = null;
    }

    // 3. Draw 3D Route Lines
    this.drawRouteLines(model.latestSimulation);

    // 4. Update or Populate Occupants if not currently actively simulating
    if (!this.isEvacuating) {
      this.populateOccupants(model);
    }
  }

  // Prepare occupants with realistic path waypoints to assigned exit
  prepareEvacuationPaths() {
    if (!this.model || !this.model.latestSimulation) return;
    const { routing } = this.model.latestSimulation;
    if (!routing || !routing.recommendedRoute) return;

    const recRoute = routing.recommendedRoute;
    const svgPts = recRoute.svgPoints || [];

    // Convert route waypoints to 3D
    const mainWaypoints = svgPts.map(pt => {
      const p = this.map2DTo3D(pt[0], pt[1]);
      return new THREE.Vector3(p.x, 0.2, p.z);
    });

    this.occupants.forEach(occ => {
      occ.isEvacuated = false;
      // Each occupant starts from their position, moves towards room exit, then joins main corridor path
      const pStart = occ.mesh.position.clone();
      const randomizedWaypoints = mainWaypoints.map((wp, idx) => {
        // Add subtle lateral jitter so people don't walk in a rigid single file
        const jitter = (Math.random() - 0.5) * 2.2;
        return new THREE.Vector3(wp.x + (idx === mainWaypoints.length - 1 ? 0 : jitter), 0.2, wp.z + jitter);
      });
      occ.waypoints = [pStart, ...randomizedWaypoints];
      occ.currentWpIndex = 1;
    });

    this.evacuatedCount = 0;
  }

  startEvacuation() {
    if (!this.isEvacuating) {
      this.prepareEvacuationPaths();
    }
    this.isEvacuating = true;
    this.isPaused = false;
  }

  pauseEvacuation() {
    this.isPaused = true;
  }

  resumeEvacuation() {
    this.isPaused = false;
  }

  resetEvacuation() {
    this.isEvacuating = false;
    this.isPaused = false;
    this.simTime = 0;
    this.evacuatedCount = 0;
    this.populateOccupants(this.model);
    if (this.onEvacuationUpdate) {
      this.onEvacuationUpdate({
        evacuated: 0,
        remaining: this.totalOccupants,
        elapsedTime: 0,
        completed: false
      });
    }
  }

  setSpeed(speed) {
    this.simSpeed = parseFloat(speed) || 1.0;
  }

  // Animation Frame
  animate() {
    this.animId = requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

    if (this.controls) {
      this.controls.update();
    }

    // Animate Smoke / Fire Particles
    if (this.hazardParticles) {
      const pos = this.hazardParticles.geometry.attributes.position.array;
      const count = pos.length / 3;
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 1] += (delta * (4 + Math.random() * 3));
        if (pos[i * 3 + 1] > 14) {
          pos[i * 3 + 1] = 0.5;
        }
      }
      this.hazardParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Animate Evacuation of Occupants
    if (this.isEvacuating && !this.isPaused) {
      this.simTime += delta * this.simSpeed;
      let activeWalkers = 0;

      this.occupants.forEach(occ => {
        if (occ.isEvacuated) return;

        if (occ.waypoints && occ.currentWpIndex < occ.waypoints.length) {
          activeWalkers++;
          const targetWp = occ.waypoints[occ.currentWpIndex];
          const currPos = occ.mesh.position;

          const dir = new THREE.Vector3().subVectors(targetWp, currPos);
          const dist = dir.length();

          // Move towards current waypoint
          const step = occ.speed * delta * this.simSpeed * 8;

          if (dist <= step) {
            currPos.copy(targetWp);
            occ.currentWpIndex++;
            if (occ.currentWpIndex >= occ.waypoints.length) {
              // Reached final exit! Evacuated!
              occ.isEvacuated = true;
              occ.mesh.visible = false;
              this.evacuatedCount++;
            }
          } else {
            dir.normalize();
            currPos.add(dir.multiplyScalar(step));
            // Rotate human to face direction of travel
            occ.mesh.rotation.y = Math.atan2(dir.x, dir.z);

            // Animate leg swings
            occ.walkPhase += delta * this.simSpeed * 14;
            occ.leftLeg.rotation.x = Math.sin(occ.walkPhase) * 0.6;
            occ.rightLeg.rotation.x = -Math.sin(occ.walkPhase) * 0.6;
          }
        }
      });

      // Notify HUD
      if (this.onEvacuationUpdate) {
        this.onEvacuationUpdate({
          evacuated: this.evacuatedCount,
          remaining: Math.max(0, this.totalOccupants - this.evacuatedCount),
          elapsedTime: this.simTime,
          completed: activeWalkers === 0 && this.totalOccupants > 0
        });
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
    }
  }
}

window.Building3DView = Building3DView;
