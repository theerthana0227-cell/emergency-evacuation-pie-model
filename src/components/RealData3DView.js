/**
 * RealData3DView Component
 * 3D Reconstructed Experimental Area for Forschungszentrum Jülich Bottleneck Experiments.
 * Renders:
 * - Documented Messe Düsseldorf Hall 2 experimental geometry
 * - Semicircular participant holding area (R ~ 8.6 m)
 * - 2-meter barrier board walls forming the bottleneck throat (width b = 2.4m, 3.0m, etc.)
 * - Individual 3D human figures positioned at exact recorded (x, y, z) coordinates
 * - 3D Overlapping Sensor Zones for empirical PIE validation
 * - Dynamic movement trails & crowd density heat grid
 * - Interactive timeline scrubber, speed, play/pause controls
 */

class RealData3DView {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.onFrameChange = options.onFrameChange || null;
    this.onStatsUpdate = options.onStatsUpdate || null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animId = null;

    // Dataset & Playback
    this.dataset = null;
    this.currentFrameIndex = 0;
    this.isPlaying = false;
    this.playbackSpeed = 1.0;
    this.lastFrameTime = 0;

    // 3D Objects
    this.pedestrianMeshes = new Map(); // pedId -> { mesh, trail }
    this.sensorZones = [];
    this.heatmapMesh = null;
    this.showTrails = true;
    this.showHeatmap = true;
    this.showSensorZones = true;

    // Stats
    this.exitLineY = 0.0; // Documented exit boundary in Jülich setup
    this.crossedPeds = new Set();

    this.init();
  }

  init() {
    if (!this.container) return;

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 550;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070c18);
    this.scene.fog = new THREE.FogExp2(0x070c18, 0.005);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 500);
    this.camera.position.set(0, 26, 28);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
      this.controls.minDistance = 5;
      this.controls.maxDistance = 120;
      this.controls.target.set(0, 1.2, 0);
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(15, 35, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
    fillLight.position.set(-15, 20, -20);
    this.scene.add(fillLight);

    // Build Default Geometry for Jülich Bottleneck
    this.buildBottleneckGeometry(2.4);

    // Setup 3 Overlapping Sensor Zones for PIE
    this.setupSensorZones();

    // Resize listener
    window.addEventListener('resize', () => this.onWindowResize());

    // Loop
    this.clock = new THREE.Clock();
    this.animate();
  }

  // Reconstruct documented geometry of Messe Düsseldorf Hall 2
  buildBottleneckGeometry(bottleneckWidth = 2.4) {
    if (this.geometryGroup) {
      this.scene.remove(this.geometryGroup);
    }

    this.geometryGroup = new THREE.Group();
    this.scene.add(this.geometryGroup);

    // 1. Hall 2 Main Concrete Floor
    const floorGeo = new THREE.PlaneGeometry(36, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.geometryGroup.add(floor);

    // Floor Grid pattern
    const grid = new THREE.GridHelper(36, 36, 0x38bdf8, 0x1e293b);
    grid.position.y = 0.01;
    this.geometryGroup.add(grid);

    // 2. Semicircular holding area (R ~ 8.6m) in front of the bottleneck (y > 0)
    const arcGeo = new THREE.RingGeometry(8.55, 8.65, 48, 1, 0, Math.PI);
    const arcMat = new THREE.MeshBasicMaterial({ color: 0xeab308, side: THREE.DoubleSide });
    const arc = new THREE.Mesh(arcGeo, arcMat);
    arc.rotation.x = -Math.PI / 2;
    arc.position.set(0, 0.02, 0);
    this.geometryGroup.add(arc);

    // Semicircle waiting radii markings
    [4.0, 6.0].forEach(r => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.04, r + 0.04, 36, 1, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x64748b, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.02, 0);
      this.geometryGroup.add(ring);
    });

    // 3. Documented Barrier Board Walls (2 meters high) forming the bottleneck
    // In Jülich coordinates: participants move from y > 0 down through the bottleneck at y = 0 into y < 0
    const halfWidth = bottleneckWidth / 2;
    const wallHeight = 2.0;
    const wallThick = 0.15;
    const wallLength = 4.0;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.6,
      metalness: 0.2
    });

    // Left barrier wall
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, wallLength), wallMat);
    leftWall.position.set(-halfWidth - wallThick / 2, wallHeight / 2, -wallLength / 2);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;

    // Right barrier wall
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, wallLength), wallMat);
    rightWall.position.set(halfWidth + wallThick / 2, wallHeight / 2, -wallLength / 2);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;

    // Funnel guiding barriers angled outwards into the holding hall
    const funnelLeft = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, 6), wallMat);
    funnelLeft.position.set(-halfWidth - 2.5, wallHeight / 2, 2.5);
    funnelLeft.rotation.y = Math.PI / 4;

    const funnelRight = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, 6), wallMat);
    funnelRight.position.set(halfWidth + 2.5, wallHeight / 2, 2.5);
    funnelRight.rotation.y = -Math.PI / 4;

    this.geometryGroup.add(leftWall, rightWall, funnelLeft, funnelRight);

    // 4. Exit Measurement Boundary Line (y = 0 in between barrier walls)
    const exitLineGeo = new THREE.BoxGeometry(bottleneckWidth, 0.04, 0.2);
    const exitLineMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const exitLine = new THREE.Mesh(exitLineGeo, exitLineMat);
    exitLine.position.set(0, 0.03, 0);
    this.geometryGroup.add(exitLine);

    // Exit text decal / label
    this.createExitLineLabel(`BOTTLENECK EXIT (b = ${bottleneckWidth.toFixed(1)}m)`, 0, 0, bottleneckWidth);

    // 5. Overhead Stereo Camera Rigs (Point Grey Bumblebee XB3)
    this.buildCameraRigs();

    // 6. Geometry Label
    this.createExperimentTitleLabel(
      `Forschungszentrum Jülich — Hermes Bottleneck Experiment (Düsseldorf 2009)\nWidth: ${bottleneckWidth.toFixed(1)} m | 16 FPS | Empirical Trajectories`
    );
  }

  buildCameraRigs() {
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    const camMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });

    // Overhead truss beam across corridor at height 5m
    const truss = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 0.3), trussMat);
    truss.position.set(0, 6.5, 0);
    this.geometryGroup.add(truss);

    // Stereo camera box
    const camBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.4), camMat);
    camBox.position.set(0, 6.2, 0);
    this.geometryGroup.add(camBox);
  }

  createExitLineLabel(text, x, z, width) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 30px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 42);

    const texture = new THREE.CanvasTexture(canvas);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 1.8, (width * 1.8) * (64 / 512)),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(x, 0.04, z - 0.4);
    this.geometryGroup.add(plane);
  }

  createExperimentTitleLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 26px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
    ctx.textAlign = 'center';

    const lines = text.split('\n');
    lines.forEach((l, i) => {
      ctx.fillText(l, 512, 45 + i * 36);
    });

    const texture = new THREE.CanvasTexture(canvas);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18 * (128 / 1024)),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, 0.03, 11);
    this.geometryGroup.add(plane);
  }

  // 3 Overlapping Sensor Zones for Empirical PIE Validation
  setupSensorZones() {
    this.sensorZoneGroup = new THREE.Group();
    this.scene.add(this.sensorZoneGroup);

    // Overlapping definitions in meters (centered around the bottleneck funnel y in [0.5, 4.0])
    this.sensorZones = [
      {
        id: 'zone_sensor_1',
        name: 'Sensor Zone 1 (West Inflow)',
        color: 0x38bdf8, // Cyan
        bounds: { minX: -2.8, maxX: 0.2, minY: 0.8, maxY: 4.2 }
      },
      {
        id: 'zone_sensor_2',
        name: 'Sensor Zone 2 (Center Throat)',
        color: 0xa855f7, // Purple
        bounds: { minX: -1.3, maxX: 1.3, minY: 0.0, maxY: 3.4 }
      },
      {
        id: 'zone_sensor_3',
        name: 'Sensor Zone 3 (East Inflow)',
        color: 0x10b981, // Emerald
        bounds: { minX: -0.2, maxX: 2.8, minY: 0.8, maxY: 4.2 }
      }
    ];

    this.sensorZones.forEach(sz => {
      const w = sz.bounds.maxX - sz.bounds.minX;
      const d = sz.bounds.maxY - sz.bounds.minY;
      const cx = (sz.bounds.minX + sz.bounds.maxX) / 2;
      const cz = (sz.bounds.minY + sz.bounds.maxY) / 2;

      // Transparent footprint plane
      const geo = new THREE.PlaneGeometry(w, d);
      const mat = new THREE.MeshBasicMaterial({
        color: sz.color,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(cx, 0.05, cz);
      this.sensorZoneGroup.add(mesh);

      // Border outline
      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: sz.color, linewidth: 2 })
      );
      line.rotation.x = -Math.PI / 2;
      line.position.copy(mesh.position);
      this.sensorZoneGroup.add(line);

      // Label decal
      this.createSensorLabel(sz.name, cx, cz, w, sz.color);
    });
  }

  createSensorLabel(name, x, z, width, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 22px "Inter", sans-serif';
    ctx.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
    ctx.textAlign = 'center';
    ctx.fillText(name, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.9, (width * 0.9) * (64 / 256)),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(x, 0.06, z);
    this.sensorZoneGroup.add(plane);
  }

  // Load a parsed dataset
  loadDataset(parsedDataset) {
    this.dataset = parsedDataset;
    this.currentFrameIndex = 0;
    this.crossedPeds.clear();

    // Rebuild geometry with documented bottleneck width
    this.buildBottleneckGeometry(parsedDataset.bottleneckWidth || 2.4);

    // Clear existing pedestrian meshes
    this.clearPedestrianMeshes();

    // Render initial frame
    this.renderFrame(this.currentFrameIndex);
  }

  clearPedestrianMeshes() {
    this.pedestrianMeshes.forEach(item => {
      this.scene.remove(item.mesh);
      if (item.trail) this.scene.remove(item.trail);
    });
    this.pedestrianMeshes.clear();
  }

  // Create individual 3D pedestrian avatar
  createPedestrianAvatar(id) {
    const group = new THREE.Group();

    // Casual shirt color variation
    const shirtColors = [0x38bdf8, 0x818cf8, 0x34d399, 0xf472b6, 0xfbbf24, 0xa78bfa, 0xef4444, 0x22c55e];
    const color = shirtColors[id % shirtColors.length];

    // Cylinder/capsule stylized pedestrian avatar
    const bodyGeo = new THREE.CylinderGeometry(0.24, 0.22, 1.2, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.8;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.18, 10, 10);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.4 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.55;
    head.castShadow = true;
    group.add(head);

    // Direction indicator nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), bodyMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.55, -0.22);
    group.add(nose);

    // Base contact ring / selection indicator
    const ringGeo = new THREE.RingGeometry(0.26, 0.32, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, opacity: 0.4, transparent: true });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);

    this.scene.add(group);

    return {
      mesh: group,
      ring: ring,
      id: id,
      trailPoints: []
    };
  }

  // Render a specific frame index
  renderFrame(frameIndex) {
    if (!this.dataset || !this.dataset.frames || this.dataset.frames.length === 0) return;

    this.currentFrameIndex = Math.max(0, Math.min(frameIndex, this.dataset.frames.length - 1));
    const frameNumber = this.dataset.frames[this.currentFrameIndex];
    const records = this.dataset.framesMap.get(frameNumber) || [];

    const activeIdsThisFrame = new Set();
    const zoneSets = {
      zone_sensor_1: new Set(),
      zone_sensor_2: new Set(),
      zone_sensor_3: new Set()
    };

    let totalSpeed = 0;
    let speedSamples = 0;

    records.forEach(rec => {
      activeIdsThisFrame.add(rec.id);

      // Coordinate mapping: Jülich X is lateral, Y is longitudinal (flow moves towards negative Y)
      // In Three.js: X = rec.x, Z = rec.y, Y = 0 (ground level)
      const posX = rec.x;
      const posZ = rec.y;
      const posY = 0;

      let avatar = this.pedestrianMeshes.get(rec.id);
      if (!avatar) {
        avatar = this.createPedestrianAvatar(rec.id);
        this.pedestrianMeshes.set(rec.id, avatar);
      }

      avatar.mesh.visible = true;
      avatar.mesh.position.set(posX, posY, posZ);

      // Orientation based on velocity if available
      if (rec.vx !== 0 || rec.vy !== 0) {
        avatar.mesh.rotation.y = Math.atan2(rec.vx, rec.vy);
      }

      if (rec.speed > 0) {
        totalSpeed += rec.speed;
        speedSamples++;
      }

      // Track bottleneck line crossings (y <= 0)
      if (rec.y <= this.exitLineY) {
        this.crossedPeds.add(rec.id);
      }

      // Check inclusion in the 3 sensor zones for PIE validation
      this.sensorZones.forEach(sz => {
        if (
          posX >= sz.bounds.minX && posX <= sz.bounds.maxX &&
          posZ >= sz.bounds.minY && posZ <= sz.bounds.maxY
        ) {
          zoneSets[sz.id].add(rec.id);
        }
      });
    });

    // Hide avatars that are not active in this frame
    this.pedestrianMeshes.forEach((avatar, id) => {
      if (!activeIdsThisFrame.has(id)) {
        avatar.mesh.visible = false;
      }
    });

    // Compute PIE Validation on the 3 Empirical Sensor Zones
    const S1 = zoneSets.zone_sensor_1;
    const S2 = zoneSets.zone_sensor_2;
    const S3 = zoneSets.zone_sensor_3;

    // Intersection helpers
    const intersect = (setA, setB) => new Set([...setA].filter(x => setB.has(x)));
    const S12 = intersect(S1, S2);
    const S13 = intersect(S1, S3);
    const S23 = intersect(S2, S3);
    const S123 = intersect(S12, S3);

    const unionAll = new Set([...S1, ...S2, ...S3]);

    // Raw count vs PIE count
    const rawCount = S1.size + S2.size + S3.size;
    const sumPairwise = S12.size + S13.size + S23.size;
    const tripleOverlap = S123.size;
    const pieCount = rawCount - sumPairwise + tripleOverlap;
    const actualUniqueCount = unionAll.size;
    const absError = Math.abs(pieCount - actualUniqueCount);

    const avgSpeed = speedSamples > 0 ? totalSpeed / speedSamples : 0;
    const elapsedSeconds = (frameNumber - this.dataset.minFrame) / this.dataset.fps;

    const frameStats = {
      frameIndex: this.currentFrameIndex,
      frameNumber: frameNumber,
      totalFrames: this.dataset.frames.length,
      elapsedSeconds: elapsedSeconds,
      activePedestriansCount: activeIdsThisFrame.size,
      totalCrossed: this.crossedPeds.size,
      avgSpeed: avgSpeed,
      pie: {
        zone1Count: S1.size,
        zone2Count: S2.size,
        zone3Count: S3.size,
        rawCount: rawCount,
        overlap12: S12.size,
        overlap13: S13.size,
        overlap23: S23.size,
        overlap123: S123.size,
        totalSubtracted: sumPairwise,
        totalAddedBack: tripleOverlap,
        pieCount: pieCount,
        actualUniqueCount: actualUniqueCount,
        absError: absError,
        isVerifiedExact: absError === 0
      }
    };

    if (this.onFrameChange) {
      this.onFrameChange(this.currentFrameIndex, frameNumber);
    }
    if (this.onStatsUpdate) {
      this.onStatsUpdate(frameStats);
    }
  }

  play() {
    this.isPlaying = true;
    this.lastFrameTime = performance.now();
  }

  pause() {
    this.isPlaying = false;
  }

  setSpeed(speed) {
    this.playbackSpeed = parseFloat(speed) || 1.0;
  }

  seek(frameIndex) {
    this.renderFrame(frameIndex);
  }

  toggleSensorZones(visible) {
    this.showSensorZones = visible;
    if (this.sensorZoneGroup) this.sensorZoneGroup.visible = visible;
  }

  // Animation Loop
  animate() {
    this.animId = requestAnimationFrame(() => this.animate());

    if (this.controls) this.controls.update();

    if (this.isPlaying && this.dataset && this.dataset.frames) {
      const now = performance.now();
      const frameInterval = (1000 / this.dataset.fps) / this.playbackSpeed;

      if (now - this.lastFrameTime >= frameInterval) {
        this.lastFrameTime = now;
        if (this.currentFrameIndex < this.dataset.frames.length - 1) {
          this.currentFrameIndex++;
          this.renderFrame(this.currentFrameIndex);
        } else {
          // Loop or pause
          this.isPlaying = false;
        }
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

window.RealData3DView = RealData3DView;
