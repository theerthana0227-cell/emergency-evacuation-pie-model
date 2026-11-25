/**
 * Main Application Coordinator
 * Connects 2D Floor Plan, 3D Building Visualization, Evacuation Engine,
 * Forschungszentrum Jülich Real Data Validation, PIE Engine, and Analytics.
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing Emergency Evacuation Planning System (3D & Empirical PIE)...');

  // =========================================================================
  // 1. MODAL & HEADER CONTROLS
  // =========================================================================
  const modalOverlay = document.getElementById('viva-modal-overlay');
  const btnOpenViva = document.getElementById('btn-open-viva');
  const btnCloseViva = document.getElementById('btn-close-modal');

  if (btnOpenViva && modalOverlay) {
    btnOpenViva.addEventListener('click', () => modalOverlay.classList.add('active'));
  }
  if (btnCloseViva && modalOverlay) {
    btnCloseViva.addEventListener('click', () => modalOverlay.classList.remove('active'));
  }
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.classList.remove('active');
    });
  }

  const statusIndicator = document.getElementById('system-status-indicator');
  const statusText = document.getElementById('system-status-text');

  function updateStatus(isHazard) {
    if (!statusIndicator || !statusText) return;
    if (isHazard) {
      statusIndicator.className = 'status-indicator hazard-active';
      statusText.textContent = 'DEFCON 1 • HAZARD ACTIVE';
    } else {
      statusIndicator.className = 'status-indicator';
      statusText.textContent = 'SYSTEM ACTIVE • MONITORING';
    }
  }

  // =========================================================================
  // 2. TAB NAVIGATION
  // =========================================================================
  const tabBtnBuilding = document.getElementById('tab-btn-building');
  const tabBtnRealData = document.getElementById('tab-btn-realdata');
  const tabContentBuilding = document.getElementById('tab-content-building');
  const tabContentRealData = document.getElementById('tab-content-realdata');

  let realDataInitialized = false;

  tabBtnBuilding.addEventListener('click', () => {
    tabBtnBuilding.classList.add('active');
    tabBtnRealData.classList.remove('active');
    tabContentBuilding.style.display = 'grid';
    tabContentRealData.style.display = 'none';
    if (building3DView) building3DView.onWindowResize();
  });

  tabBtnRealData.addEventListener('click', async () => {
    tabBtnRealData.classList.add('active');
    tabBtnBuilding.classList.remove('active');
    tabContentBuilding.style.display = 'none';
    tabContentRealData.style.display = 'grid';
    if (!realDataInitialized) {
      realDataInitialized = true;
      await initRealDataTab();
    } else if (realData3DView) {
      realData3DView.onWindowResize();
    }
  });

  // =========================================================================
  // 3. TAB 1: 3D & 2D BUILDING EVACUATION COMPONENTS
  // =========================================================================
  let currentModel = null;
  let activeScenarioId = null;

  // Handler when user clicks on a room (in 2D floorplan or 3D view)
  async function handleZoneClick(zoneId) {
    if (!currentModel) return;
    try {
      console.log('Room clicked:', zoneId);
      if (currentModel.activeHazard) {
        await apiClient.simulateHazard({
          hazardZoneId: currentModel.activeHazard.zoneId,
          originZoneId: zoneId,
          severity: currentModel.activeHazard.severity
        });
      } else {
        await apiClient.simulateHazard({
          hazardZoneId: zoneId,
          originZoneId: zoneId === 'zone_a' ? 'zone_b' : 'zone_a',
          severity: 'critical'
        });
      }
      await refreshState();
    } catch (err) {
      console.error('Zone click error:', err);
    }
  }

  // 2D Floor Plan View
  const floorPlan = new FloorPlanView('floor-plan-container', handleZoneClick);

  // 3D Building View
  const building3DView = new Building3DView('building-3d-container', {
    onZoneClick: handleZoneClick,
    onEvacuationUpdate: (evacStats) => {
      const hudEvacuated = document.getElementById('hud-evacuated-count');
      const hudRemaining = document.getElementById('hud-remaining-count');
      const hudElapsed = document.getElementById('hud-elapsed-time');
      const hudStatus = document.getElementById('hud-evac-status');

      if (hudEvacuated) hudEvacuated.textContent = evacStats.evacuated;
      if (hudRemaining) hudRemaining.textContent = evacStats.remaining;
      if (hudElapsed) hudElapsed.textContent = `${evacStats.elapsedTime.toFixed(1)}s`;
      if (hudStatus) {
        if (evacStats.completed) {
          hudStatus.textContent = 'EVACUATED';
          hudStatus.style.color = '#34d399';
        } else if (evacStats.elapsedTime > 0) {
          hudStatus.textContent = 'EVACUATING';
          hudStatus.style.color = '#f59e0b';
        } else {
          hudStatus.textContent = 'IDLE';
          hudStatus.style.color = '#a78bfa';
        }
      }
    }
  });

  // 2D vs 3D View Toggles
  const btnToggle2D = document.getElementById('btn-toggle-2d');
  const btnToggle3D = document.getElementById('btn-toggle-3d');
  const view2DContainer = document.getElementById('floor-plan-container');
  const view3DWrapper = document.getElementById('building-3d-wrapper');
  const controlsBar3D = document.getElementById('controls-bar-3d');

  btnToggle2D.addEventListener('click', () => {
    btnToggle2D.classList.add('active');
    btnToggle3D.classList.remove('active');
    view2DContainer.style.display = 'block';
    view3DWrapper.style.display = 'none';
    if (controlsBar3D) controlsBar3D.style.display = 'none';
  });

  btnToggle3D.addEventListener('click', () => {
    btnToggle3D.classList.add('active');
    btnToggle2D.classList.remove('active');
    view2DContainer.style.display = 'none';
    view3DWrapper.style.display = 'block';
    if (controlsBar3D) controlsBar3D.style.display = 'flex';
    building3DView.onWindowResize();
  });

  // 3D Camera Preset Buttons
  const btnCamPersp = document.getElementById('btn-cam-perspective');
  const btnCamIso = document.getElementById('btn-cam-iso');
  const btnCamTop = document.getElementById('btn-cam-top');

  [btnCamPersp, btnCamIso, btnCamTop].forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      [btnCamPersp, btnCamIso, btnCamTop].forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn === btnCamPersp) building3DView.setViewPreset('perspective');
      else if (btn === btnCamIso) building3DView.setViewPreset('isometric');
      else if (btn === btnCamTop) building3DView.setViewPreset('top');
    });
  });

  // 3D Visual Toggles
  const btnToggleTransp = document.getElementById('btn-toggle-transp');
  const btnToggleRoof = document.getElementById('btn-toggle-roof');

  if (btnToggleTransp) {
    btnToggleTransp.addEventListener('click', () => {
      const isTransp = building3DView.toggleWallTransparency();
      btnToggleTransp.classList.toggle('active', isTransp);
    });
  }

  if (btnToggleRoof) {
    btnToggleRoof.addEventListener('click', () => {
      const isRoof = building3DView.toggleRoof();
      btnToggleRoof.classList.toggle('active', isRoof);
    });
  }

  // Evacuation Playback Buttons
  const btnEvacStart = document.getElementById('btn-evac-start');
  const btnEvacPause = document.getElementById('btn-evac-pause');
  const btnEvacResume = document.getElementById('btn-evac-resume');
  const btnEvacReset = document.getElementById('btn-evac-reset');
  const selectEvacSpeed = document.getElementById('select-evac-speed');

  if (btnEvacStart) btnEvacStart.addEventListener('click', () => building3DView.startEvacuation());
  if (btnEvacPause) btnEvacPause.addEventListener('click', () => building3DView.pauseEvacuation());
  if (btnEvacResume) btnEvacResume.addEventListener('click', () => building3DView.resumeEvacuation());
  if (btnEvacReset) btnEvacReset.addEventListener('click', () => building3DView.resetEvacuation());
  if (selectEvacSpeed) {
    selectEvacSpeed.addEventListener('change', (e) => building3DView.setSpeed(e.target.value));
  }

  // Dashboard Telemetry & Formula Components
  const pieVisualizer = new OccupancyComparison('pie-comparison-container');
  const routePanel = new RoutePanel('route-panel-container');
  const exitMeter = new ExitLoadMeter('exit-meter-container');
  const activityLog = new ActivityLog('activity-log-container');

  const scenarioPresets = new ScenarioPresets('scenario-presets-container', async (scId) => {
    try {
      activeScenarioId = scId;
      await apiClient.loadScenario(scId);
      await refreshState();
    } catch (err) {
      console.error('Failed to load scenario:', err);
    }
  });

  const thresholdSlider = new ThresholdSlider('threshold-slider-container', async (newThreshold) => {
    try {
      await apiClient.setThreshold(newThreshold);
      await refreshState();
    } catch (err) {
      console.error('Failed to set threshold:', err);
    }
  });

  const hazardTrigger = new HazardTrigger(
    'hazard-trigger-container',
    async ({ hazardZoneId, originZoneId, severity }) => {
      try {
        activeScenarioId = null;
        await apiClient.simulateHazard({ hazardZoneId, originZoneId, severity });
        await refreshState();
      } catch (err) {
        console.error('Hazard simulation failed:', err);
      }
    },
    async () => {
      try {
        activeScenarioId = null;
        await apiClient.resetSimulation();
        await refreshState();
      } catch (err) {
        console.error('Reset failed:', err);
      }
    }
  );

  const zoneEditor = new ZoneEditor('zone-editor-container', async (zoneId, count) => {
    try {
      await apiClient.updateOccupancy(zoneId, count);
      await refreshState();
    } catch (err) {
      console.error('Occupancy update failed:', err);
    }
  });

  // Global reset button in header
  const btnResetHeader = document.getElementById('btn-reset-header');
  if (btnResetHeader) {
    btnResetHeader.addEventListener('click', async () => {
      activeScenarioId = null;
      await apiClient.resetSimulation();
      await refreshState();
    });
  }

  // Refresh entire UI state
  async function refreshState() {
    try {
      currentModel = await apiClient.getModel();
      updateStatus(!!currentModel.activeHazard);

      floorPlan.render(currentModel);
      building3DView.render(currentModel);
      pieVisualizer.render(currentModel.latestSimulation);
      routePanel.render(currentModel.latestSimulation);
      exitMeter.render(currentModel);
      scenarioPresets.render(currentModel.scenarios, activeScenarioId);
      thresholdSlider.render(currentModel.thresholdPercent);
      hazardTrigger.render(currentModel);
      zoneEditor.render(currentModel.zones);
      activityLog.render(currentModel.logs);

      // Update remaining count HUD
      const hudRemaining = document.getElementById('hud-remaining-count');
      if (hudRemaining && currentModel.zones) {
        const total = currentModel.zones.reduce((sum, z) => sum + (z.current_occupancy || 0), 0);
        hudRemaining.textContent = total;
      }
    } catch (err) {
      console.error('State refresh failed:', err);
    }
  }

  // Initial load: Scenario 1
  try {
    currentModel = await apiClient.getModel();
    activeScenarioId = 'scenario_corridor_smoke';
    await apiClient.loadScenario(activeScenarioId);
    await refreshState();
  } catch (err) {
    console.error('App initialization failed:', err);
  }

  // =========================================================================
  // 4. TAB 2: REAL DATA VALIDATION (FORSCHUNGSZENTRUM JÜLICH)
  // =========================================================================
  let datasetParser = new PedestrianDatasetParser();
  let currentDataset = null;
  let latestStats = null;

  const realData3DView = new RealData3DView('real-data-3d-container', {
    onFrameChange: (frameIndex, frameNumber) => {
      const lblFrame = document.getElementById('lbl-current-frame');
      const lblTime = document.getElementById('lbl-current-time');
      const slider = document.getElementById('real-timeline-slider');

      if (lblFrame) lblFrame.textContent = frameNumber;
      if (slider) slider.value = frameIndex;
      if (lblTime && currentDataset) {
        const timeSec = ((frameNumber - currentDataset.minFrame) / currentDataset.fps).toFixed(1);
        lblTime.textContent = `${timeSec}s`;
      }
    },
    onStatsUpdate: (stats) => {
      latestStats = stats;
      const hudActive = document.getElementById('hud-real-active');
      const hudCrossed = document.getElementById('hud-real-crossed');
      const hudSpeed = document.getElementById('hud-real-speed');

      if (hudActive) hudActive.textContent = stats.activePedestriansCount;
      if (hudCrossed) hudCrossed.textContent = stats.totalCrossed;
      if (hudSpeed) hudSpeed.textContent = `${stats.avgSpeed.toFixed(2)} m/s`;

      realPiePanel.render(stats);
      exitFlowAnalytics.render(currentDataset, stats);
    }
  });

  const realPiePanel = new RealDataPiePanel('real-pie-container');
  const exitFlowAnalytics = new ExitFlowAnalytics('exit-flow-container');

  // Load and parse a trajectory URL or File
  async function loadTrajectorySource(urlOrFile, isFile = false) {
    try {
      const statusBadge = document.getElementById('playback-status-badge');
      if (statusBadge) {
        statusBadge.textContent = 'Parsing...';
        statusBadge.className = 'badge-tag badge-purple';
      }

      let parsed = null;
      if (isFile) {
        parsed = await datasetParser.parseFile(urlOrFile);
      } else {
        const res = await fetch(urlOrFile);
        if (!res.ok) throw new Error(`HTTP Error ${res.status}: Failed to fetch ${urlOrFile}`);
        const text = await res.text();
        const filename = urlOrFile.split('/').pop();
        parsed = datasetParser.parseText(text, filename);
      }

      currentDataset = parsed;

      // Update metadata card
      const metaPeds = document.getElementById('meta-peds-count');
      if (metaPeds) metaPeds.textContent = parsed.uniquePedestriansCount;

      const lblTotal = document.getElementById('lbl-total-frames');
      if (lblTotal) lblTotal.textContent = `/ ${parsed.frames.length}`;

      const slider = document.getElementById('real-timeline-slider');
      if (slider) {
        slider.min = 0;
        slider.max = parsed.frames.length - 1;
        slider.value = 0;
      }

      // Load into 3D viewer & analytics
      realData3DView.loadDataset(parsed);
      realPiePanel.render(null);
      exitFlowAnalytics.render(parsed, null);

      if (statusBadge) {
        statusBadge.textContent = 'Ready';
        statusBadge.className = 'badge-tag badge-cyan';
      }

      console.log('Jülich dataset loaded successfully:', parsed.filename, parsed.uniquePedestriansCount, 'peds');
    } catch (err) {
      console.error('Dataset load error:', err);
      alert('Error parsing dataset: ' + err.message);
    }
  }

  // Initialize Real Data Tab
  async function initRealDataTab() {
    realData3DView.onWindowResize();
    // Default load first dataset: ao-240-400.txt
    const selectDataset = document.getElementById('select-juelich-dataset');
    const initialUrl = selectDataset ? selectDataset.value : 'data/ao-240-400.txt';
    await loadTrajectorySource(initialUrl, false);
  }

  // Pre-bundled selector change
  const selectDataset = document.getElementById('select-juelich-dataset');
  if (selectDataset) {
    selectDataset.addEventListener('change', async (e) => {
      await loadTrajectorySource(e.target.value, false);
    });
  }

  // Custom File Uploader
  const btnBrowse = document.getElementById('btn-browse-dataset');
  const inputDataset = document.getElementById('input-custom-dataset');

  if (btnBrowse && inputDataset) {
    btnBrowse.addEventListener('click', () => inputDataset.click());
    inputDataset.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        await loadTrajectorySource(e.target.files[0], true);
      }
    });
  }

  // Playback Controls
  const btnRealPlay = document.getElementById('btn-real-play');
  const btnRealPause = document.getElementById('btn-real-pause');
  const btnRealReset = document.getElementById('btn-real-reset');
  const selectRealSpeed = document.getElementById('select-real-speed');
  const timelineSlider = document.getElementById('real-timeline-slider');

  if (btnRealPlay) {
    btnRealPlay.addEventListener('click', () => {
      realData3DView.play();
      const statusBadge = document.getElementById('playback-status-badge');
      if (statusBadge) {
        statusBadge.textContent = 'Playing';
        statusBadge.className = 'badge-tag badge-emerald';
      }
    });
  }

  if (btnRealPause) {
    btnRealPause.addEventListener('click', () => {
      realData3DView.pause();
      const statusBadge = document.getElementById('playback-status-badge');
      if (statusBadge) {
        statusBadge.textContent = 'Paused';
        statusBadge.className = 'badge-tag badge-purple';
      }
    });
  }

  if (btnRealReset) {
    btnRealReset.addEventListener('click', () => {
      realData3DView.pause();
      realData3DView.seek(0);
      const statusBadge = document.getElementById('playback-status-badge');
      if (statusBadge) {
        statusBadge.textContent = 'Ready';
        statusBadge.className = 'badge-tag badge-cyan';
      }
    });
  }

  if (selectRealSpeed) {
    selectRealSpeed.addEventListener('change', (e) => {
      realData3DView.setSpeed(e.target.value);
    });
  }

  if (timelineSlider) {
    timelineSlider.addEventListener('input', (e) => {
      const idx = parseInt(e.target.value);
      realData3DView.seek(idx);
    });
  }

  // Real Data 3D Camera Controls
  const btnRealPersp = document.getElementById('btn-real-cam-persp');
  const btnRealIso = document.getElementById('btn-real-cam-iso');
  const btnRealTop = document.getElementById('btn-real-cam-top');

  if (btnRealPersp && realData3DView.camera) {
    btnRealPersp.addEventListener('click', () => {
      [btnRealPersp, btnRealIso, btnRealTop].forEach(b => b.classList.remove('active'));
      btnRealPersp.classList.add('active');
      realData3DView.camera.position.set(0, 26, 28);
      realData3DView.controls.target.set(0, 1.2, 0);
      realData3DView.controls.update();
    });
  }

  if (btnRealIso && realData3DView.camera) {
    btnRealIso.addEventListener('click', () => {
      [btnRealPersp, btnRealIso, btnRealTop].forEach(b => b.classList.remove('active'));
      btnRealIso.classList.add('active');
      realData3DView.camera.position.set(22, 28, 22);
      realData3DView.controls.target.set(0, 1.2, 0);
      realData3DView.controls.update();
    });
  }

  if (btnRealTop && realData3DView.camera) {
    btnRealTop.addEventListener('click', () => {
      [btnRealPersp, btnRealIso, btnRealTop].forEach(b => b.classList.remove('active'));
      btnRealTop.classList.add('active');
      realData3DView.camera.position.set(0, 36, 0.1);
      realData3DView.controls.target.set(0, 0, 0);
      realData3DView.controls.update();
    });
  }

  // =========================================================================
  // 5. CSV EXPORT & PRINTABLE REPORT
  // =========================================================================
  const btnExportCSV = document.getElementById('btn-export-csv');
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', () => {
      if (!currentDataset) {
        alert('Please load a dataset before exporting validation data.');
        return;
      }

      // Generate validation rows for all frames
      let csvContent = 'Frame,Elapsed_Sec,Raw_Sensor_Sum,PIE_Corrected_Count,Ground_Truth_Unique,Duplicates_Removed,Abs_Error,Pass_Status\n';
      
      const step = Math.max(1, Math.floor(currentDataset.frames.length / 100));
      currentDataset.frames.forEach((fr, i) => {
        if (i % step !== 0) return;
        const recs = currentDataset.framesMap.get(fr) || [];
        const sec = ((fr - currentDataset.minFrame) / currentDataset.fps).toFixed(2);

        // Calculate zone counts
        const S1 = new Set();
        const S2 = new Set();
        const S3 = new Set();

        recs.forEach(r => {
          if (r.x >= -2.8 && r.x <= 0.2 && r.y >= 0.8 && r.y <= 4.2) S1.add(r.id);
          if (r.x >= -1.3 && r.x <= 1.3 && r.y >= 0.0 && r.y <= 3.4) S2.add(r.id);
          if (r.x >= -0.2 && r.x <= 2.8 && r.y >= 0.8 && r.y <= 4.2) S3.add(r.id);
        });

        const raw = S1.size + S2.size + S3.size;
        const o12 = new Set([...S1].filter(x => S2.has(x))).size;
        const o13 = new Set([...S1].filter(x => S3.has(x))).size;
        const o23 = new Set([...S2].filter(x => S3.has(x))).size;
        const o123 = new Set([...S1].filter(x => S2.has(x) && S3.has(x))).size;

        const pie = raw - (o12 + o13 + o23) + o123;
        const unique = new Set([...S1, ...S2, ...S3]).size;
        const err = Math.abs(pie - unique);
        const dup = raw - unique;

        csvContent += `${fr},${sec},${raw},${pie},${unique},${dup},${err},${err === 0 ? 'PASS' : 'FAIL'}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `PIE_Validation_${currentDataset.filename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  const btnPrintReport = document.getElementById('btn-print-report');
  if (btnPrintReport) {
    btnPrintReport.addEventListener('click', () => {
      window.print();
    });
  }
});
