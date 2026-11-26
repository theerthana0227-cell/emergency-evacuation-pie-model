/**
 * ManualDataInput Component
 * Provides editable numerical inputs for:
 * - Room Occupancies (Lab A, Hall B, Corridor C, Classroom D, Auditorium E, and custom zones)
 * - Dynamic addition/removal of observation zones
 * - Individual sensor counts
 * - Pairwise sensor overlaps
 * - Triple & higher-order sensor overlaps
 * - Actual unique pedestrian count
 * - Emergency exit capacities and widths
 * - Room and corridor dimensions
 * - Walking speed, hazard location, origin location, available routes, Hick's law threshold
 * - Complete mathematical validation with error messaging and live PIE breakdown
 * - Fully functional action buttons: Apply Data, Validate Data, Run Simulation, Reset, Clear Data
 */

class ManualDataInput {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.onApply = options.onApply || null;
    this.onRunSimulation = options.onRunSimulation || null;
    this.onReset = options.onReset || null;

    // Default configuration state
    this.state = this.getDefaultState();
    this.init();
  }

  getDefaultState() {
    return {
      zones: [
        { id: "zone_a", name: "Lab A (Computer Vision)", count: 45, capacity: 60, lengthM: 26, widthM: 18 },
        { id: "zone_b", name: "Hall B (Robotics Arena)", count: 40, capacity: 55, lengthM: 26, widthM: 19 },
        { id: "zone_c", name: "Central Corridor C (Spine Hub)", count: 35, capacity: 90, lengthM: 28, widthM: 41 },
        { id: "zone_d", name: "Classroom D (AI DevOps)", count: 30, capacity: 45, lengthM: 26, widthM: 18 },
        { id: "zone_e", name: "Auditorium E (Innovation Center)", count: 50, capacity: 85, lengthM: 26, widthM: 19 }
      ],
      overlaps: [
        { id: "ov_ab", zone_ids: ["zone_a", "zone_b"], name: "Lab A ∩ Hall B", shared_occupancy: 6 },
        { id: "ov_ac", zone_ids: ["zone_a", "zone_c"], name: "Lab A ∩ Corridor C", shared_occupancy: 14 },
        { id: "ov_bc", zone_ids: ["zone_b", "zone_c"], name: "Hall B ∩ Corridor C", shared_occupancy: 12 },
        { id: "ov_dc", zone_ids: ["zone_d", "zone_c"], name: "Classroom D ∩ Corridor C", shared_occupancy: 9 },
        { id: "ov_de", zone_ids: ["zone_d", "zone_e"], name: "Classroom D ∩ Auditorium E", shared_occupancy: 5 },
        { id: "ov_ec", zone_ids: ["zone_e", "zone_c"], name: "Auditorium E ∩ Corridor C", shared_occupancy: 15 },
        { id: "ov_abc", zone_ids: ["zone_a", "zone_b", "zone_c"], name: "Lab A ∩ Hall B ∩ Corridor C (3-Way)", shared_occupancy: 5 },
        { id: "ov_cde", zone_ids: ["zone_c", "zone_d", "zone_e"], name: "Corridor C ∩ Classroom D ∩ Auditorium E (3-Way)", shared_occupancy: 4 }
      ],
      exits: [
        { id: "exit_north", name: "Exit 1 (North Main Gates)", capacity: 25, width: 1.8 },
        { id: "exit_south", name: "Exit 2 (South Courtyard Exit)", capacity: 20, width: 1.2 },
        { id: "exit_west", name: "Exit 3 (West Emergency Fire Door)", capacity: 15, width: 2.4 },
        { id: "exit_east", name: "Exit 4 (East Garden Gate)", capacity: 18, width: 1.2 }
      ],
      walkingSpeed: 1.2,
      originZoneId: "zone_a",
      hazardZoneId: "zone_c",
      availableRoutesCount: 2,
      thresholdPercent: 15,
      groundTruthUniqueCount: 148,
      lastValidation: null
    };
  }

  init() {
    if (!this.container) return;
    this.render();
  }

  render() {
    if (!this.container) return;

    // Validate current state to populate live preview
    const validation = window.apiClient ? window.apiClient.validateManualInputs(this.state) : null;
    this.state.lastValidation = validation;

    const rawSum = this.state.zones.reduce((s, z) => s + (Number(z.count) || 0), 0);

    this.container.innerHTML = `
      <div class="manual-data-wrapper" style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Top Action Header -->
        <div class="manual-header-banner" style="background: rgba(30, 41, 59, 0.7); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 style="margin: 0; font-size: 16px; color: #f8fafc; font-family: var(--font-display); display: flex; align-items: center; gap: 8px;">
              <span>📝</span> Manual Data Input & Zone Architect
            </h3>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-secondary);">
              Configure room populations, dynamic sensor zones, empirical overlaps, exit dimensions, and evacuation parameters.
            </p>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" id="btn-manual-clear">
              🧹 Clear Data
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-manual-reset">
              🔄 Reset to Defaults
            </button>
            <button class="btn btn-primary btn-sm" id="btn-manual-validate">
              🧪 Validate Data
            </button>
            <button class="btn btn-success btn-sm" id="btn-manual-apply" style="background: #10b981; color: #fff; font-weight: 700;">
              💾 Apply Data
            </button>
            <button class="btn btn-sm" id="btn-manual-simulate" style="background: #6366f1; color: #fff; font-weight: 700;">
              ▶ Run Simulation
            </button>
          </div>
        </div>

        <!-- Live Validation Status Alert -->
        ${this.renderValidationBanner(validation)}

        <!-- Main Input Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;" class="manual-grid-2col">
          
          <!-- LEFT COLUMN: Room Occupancies & Observation Zones -->
          <div style="display: flex; flex-direction: column; gap: 20px;">
            
            <!-- Section 1: Facility Occupancies -->
            <div class="panel-card">
              <div class="card-header">
                <h3 class="card-title"><span class="icon">🏢</span> Room Occupancies & Dimensions</h3>
                <span class="badge-tag badge-purple">Raw Sum: <strong id="lbl-manual-raw-sum">${rawSum}</strong></span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: grid; grid-template-columns: 2.2fr 1.2fr 1fr 1fr 40px; gap: 8px; font-size: 11px; font-weight: 700; color: var(--text-muted); padding: 0 4px;">
                  <span>Facility Zone</span>
                  <span>Occupancy</span>
                  <span>Length (m)</span>
                  <span>Width (m)</span>
                  <span></span>
                </div>

                <div id="manual-zones-list" style="display: flex; flex-direction: column; gap: 8px;">
                  ${this.state.zones.map((z, idx) => `
                    <div class="manual-zone-row" style="display: grid; grid-template-columns: 2.2fr 1.2fr 1fr 1fr 40px; gap: 8px; align-items: center; background: rgba(0,0,0,0.25); border: 1px solid var(--border-subtle); padding: 6px 10px; border-radius: var(--radius-sm);">
                      <input type="text" class="input-text-sm zone-name-input" data-index="${idx}" value="${z.name}" placeholder="Zone name" style="font-size: 12px; padding: 4px 6px;" />
                      <input type="number" class="input-num-sm zone-count-input" data-index="${idx}" min="0" max="500" value="${z.count}" style="font-size: 12px; padding: 4px 6px; text-align: center; color: #38bdf8; font-weight: 700;" />
                      <input type="number" class="input-num-sm zone-len-input" data-index="${idx}" min="1" max="100" value="${z.lengthM || 20}" style="font-size: 11px; padding: 4px 6px; text-align: center;" />
                      <input type="number" class="input-num-sm zone-wid-input" data-index="${idx}" min="1" max="100" value="${z.widthM || 15}" style="font-size: 11px; padding: 4px 6px; text-align: center;" />
                      <button class="btn-icon-danger btn-delete-zone" data-index="${idx}" title="Delete Zone" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px;">🗑️</button>
                    </div>
                  `).join('')}
                </div>

                <div style="margin-top: 8px;">
                  <button class="btn btn-secondary btn-sm" id="btn-add-zone" style="font-size: 11px; padding: 5px 10px;">
                    ➕ Add Custom Observation Zone
                  </button>
                </div>
              </div>
            </div>

            <!-- Section 2: Sensor Overlaps (PIE) -->
            <div class="panel-card">
              <div class="card-header">
                <h3 class="card-title"><span class="icon">🔄</span> Sensor Overlaps (Inclusion-Exclusion)</h3>
                <span class="badge-tag badge-cyan">Pairwise & 3-Way</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 10px;">
                <p style="font-size: 11px; color: var(--text-muted); margin: 0 0 6px 0;">
                  Enter shared camera/doorway counts. Pairwise overlaps are subtracted; 3-way overlaps are added back.
                </p>

                <div style="display: grid; grid-template-columns: 2.8fr 1.2fr 40px; gap: 8px; font-size: 11px; font-weight: 700; color: var(--text-muted); padding: 0 4px;">
                  <span>Overlap Regions (Intersection)</span>
                  <span>Shared Count</span>
                  <span></span>
                </div>

                <div id="manual-overlaps-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow-y: auto;">
                  ${this.state.overlaps.map((ov, idx) => `
                    <div class="manual-overlap-row" style="display: grid; grid-template-columns: 2.8fr 1.2fr 40px; gap: 8px; align-items: center; background: rgba(0,0,0,0.25); border: 1px solid var(--border-subtle); padding: 5px 10px; border-radius: var(--radius-sm);">
                      <input type="text" class="input-text-sm overlap-name-input" data-index="${idx}" value="${ov.name}" style="font-size: 11px; padding: 4px 6px;" />
                      <input type="number" class="input-num-sm overlap-count-input" data-index="${idx}" min="0" max="200" value="${ov.shared_occupancy}" style="font-size: 12px; padding: 4px 6px; text-align: center; color: #facc15; font-weight: 700;" />
                      <button class="btn-icon-danger btn-delete-overlap" data-index="${idx}" title="Delete Overlap" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px;">🗑️</button>
                    </div>
                  `).join('')}
                </div>

                <div style="display: flex; gap: 8px; margin-top: 6px;">
                  <button class="btn btn-secondary btn-sm" id="btn-add-overlap-pair" style="font-size: 11px;">
                    ➕ Add Pairwise Overlap
                  </button>
                  <button class="btn btn-secondary btn-sm" id="btn-add-overlap-triple" style="font-size: 11px;">
                    ➕ Add 3-Way Overlap
                  </button>
                </div>
              </div>
            </div>

          </div>

          <!-- RIGHT COLUMN: Exits, Movement Physics, and Mathematical Validation -->
          <div style="display: flex; flex-direction: column; gap: 20px;">
            
            <!-- Section 3: Emergency Exits & Capacities -->
            <div class="panel-card">
              <div class="card-header">
                <h3 class="card-title"><span class="icon">🚪</span> Emergency Exits & Physical Capacities</h3>
                <span class="badge-tag badge-emerald">4 Standard Exits</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: grid; grid-template-columns: 2.5fr 1.2fr 1.2fr; gap: 8px; font-size: 11px; font-weight: 700; color: var(--text-muted); padding: 0 4px;">
                  <span>Emergency Exit</span>
                  <span>Capacity (peds/min)</span>
                  <span>Width (m)</span>
                </div>

                ${this.state.exits.map((ex, idx) => `
                  <div style="display: grid; grid-template-columns: 2.5fr 1.2fr 1.2fr; gap: 8px; align-items: center; background: rgba(0,0,0,0.25); border: 1px solid var(--border-subtle); padding: 6px 10px; border-radius: var(--radius-sm);">
                    <span style="font-size: 12px; font-weight: 600; color: #e2e8f0;">${ex.name}</span>
                    <input type="number" class="input-num-sm exit-cap-input" data-index="${idx}" min="1" max="100" value="${ex.capacity}" style="font-size: 12px; padding: 4px 6px; text-align: center; color: #34d399; font-weight: 700;" />
                    <input type="number" class="input-num-sm exit-wid-input" data-index="${idx}" step="0.1" min="0.5" max="10" value="${ex.width}" style="font-size: 12px; padding: 4px 6px; text-align: center;" />
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Section 4: Movement Dynamics & Simulation Settings -->
            <div class="panel-card">
              <div class="card-header">
                <h3 class="card-title"><span class="icon">⚙️</span> Evacuation Dynamics & Routing Rules</h3>
                <span class="badge-tag">Hick's Law</span>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <!-- Walking Speed -->
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">
                    Walking Speed (m/s):
                  </label>
                  <input type="number" id="input-manual-speed" step="0.1" min="0.2" max="5.0" value="${this.state.walkingSpeed}" class="input-num-sm" style="font-size: 12px; padding: 6px; color: #38bdf8; font-weight: 700;" />
                  <span style="font-size: 10px; color: var(--text-muted);">Standard empirical: 1.20 m/s</span>
                </div>

                <!-- Hick's Law Threshold -->
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">
                    Hick's Law Threshold (%):
                  </label>
                  <input type="number" id="input-manual-threshold" min="1" max="50" value="${this.state.thresholdPercent}" class="input-num-sm" style="font-size: 12px; padding: 6px; color: #a78bfa; font-weight: 700;" />
                  <span style="font-size: 10px; color: var(--text-muted);">Shortcut speedup required</span>
                </div>

                <!-- Origin Zone -->
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">
                    Evacuation Starting Location:
                  </label>
                  <select id="select-manual-origin" style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-light); color: #fff; padding: 6px; border-radius: var(--radius-sm); font-size: 12px;">
                    ${this.state.zones.map(z => `<option value="${z.id}" ${z.id === this.state.originZoneId ? 'selected' : ''}>${z.name}</option>`).join('')}
                  </select>
                </div>

                <!-- Hazard Location -->
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">
                    Hazard Location:
                  </label>
                  <select id="select-manual-hazard" style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-light); color: #fff; padding: 6px; border-radius: var(--radius-sm); font-size: 12px;">
                    ${this.state.zones.map(z => `<option value="${z.id}" ${z.id === this.state.hazardZoneId ? 'selected' : ''}>${z.name}</option>`).join('')}
                  </select>
                </div>

                <!-- Ground Truth Unique Count -->
                <div style="grid-column: span 2; display: flex; flex-direction: column; gap: 4px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.25); padding: 10px; border-radius: var(--radius-sm);">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label style="font-size: 12px; font-weight: 700; color: #c7d2fe;">
                      Actual Unique Pedestrian Count (Ground Truth):
                    </label>
                    <span style="font-size: 11px; color: #a5b4fc;">Optional Validation Benchmark</span>
                  </div>
                  <input type="number" id="input-manual-groundtruth" min="0" max="1000" value="${this.state.groundTruthUniqueCount}" class="input-num-sm" style="font-size: 14px; padding: 6px 10px; color: #34d399; font-weight: 700; background: rgba(0,0,0,0.4);" />
                  <span style="font-size: 10px; color: var(--text-muted);">
                    Used to compute exact mathematical error: Absolute Error = |PIE - GroundTruth|.
                  </span>
                </div>
              </div>
            </div>

            <!-- Section 5: Mathematical Breakdown Card -->
            <div class="panel-card" style="background: rgba(15, 23, 42, 0.85); border-color: rgba(56, 189, 248, 0.25);">
              <div class="card-header">
                <h3 class="card-title" style="color: #38bdf8;"><span class="icon">📐</span> Principle of Inclusion–Exclusion Calculation</h3>
                <span class="badge-tag ${validation?.status === 'PASS' ? 'badge-emerald' : 'badge-danger'}">
                  ${validation?.status || 'PENDING'}
                </span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; text-align: center;">
                  <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: var(--radius-sm);">
                    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Raw Sensor Sum</div>
                    <div style="font-size: 18px; font-weight: 700; color: #f87171;">${validation?.rawSum || rawSum}</div>
                  </div>
                  <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: var(--radius-sm);">
                    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Duplicates Removed</div>
                    <div style="font-size: 18px; font-weight: 700; color: #facc15;">${(validation?.rawSum || 0) - (validation?.pieCorrected || 0)}</div>
                  </div>
                  <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: var(--radius-sm);">
                    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">PIE Unique Count</div>
                    <div style="font-size: 18px; font-weight: 700; color: #34d399;">${validation?.pieCorrected !== undefined ? validation.pieCorrected : '—'}</div>
                  </div>
                </div>

                <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); padding: 10px; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11px; line-height: 1.6; color: #cbd5e1;">
                  <div style="color: #94a3b8; margin-bottom: 4px;"><strong>Expanded Formula:</strong></div>
                  <div>|S| = Σ|S_i| − Σ|S_i ∩ S_j| + Σ|S_i ∩ S_j ∩ S_k|</div>
                  <div style="color: #38bdf8; margin-top: 4px;">= ${validation?.rawSum || 0} − ${validation?.pairwiseSum || 0} + ${validation?.tripleSum || 0} = <strong>${validation?.pieCorrected || 0}</strong></div>
                </div>

                ${validation?.groundTruth !== null ? `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(52, 211, 153, 0.08); border-radius: var(--radius-sm);">
                    <span>Ground Truth Comparison:</span>
                    <span style="font-family: var(--font-mono); font-weight: 700; color: ${validation.absError === 0 ? '#34d399' : '#ef4444'};">
                      Abs Error: ${validation.absError} (${validation.percentError}%) — ${validation.status}
                    </span>
                  </div>
                ` : ''}
              </div>
            </div>

          </div>

        </div>

      </div>
    `;

    this.bindEvents();
  }

  renderValidationBanner(validation) {
    if (!validation) return '';
    if (validation.errors.length > 0) {
      return `
        <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid #ef4444; border-radius: var(--radius-md); padding: 12px 16px; color: #fca5a5; font-size: 12px; display: flex; gap: 10px; align-items: flex-start;">
          <span style="font-size: 18px;">⚠️</span>
          <div>
            <strong>Input Inconsistency Detected:</strong>
            <ul style="margin: 4px 0 0 16px; padding: 0;">
              ${validation.errors.map(err => `<li>${err}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }

    return `
      <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: var(--radius-md); padding: 10px 16px; color: #a7f3d0; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span>✓ Mathematical consistency verified. All sensor overlap bounds satisfied without paradoxes.</span>
        <span style="font-weight: 700; color: #34d399;">PIE POPULATION: ${validation.pieCorrected}</span>
      </div>
    `;
  }

  bindEvents() {
    if (!this.container) return;

    // Zone inputs
    this.container.querySelectorAll('.zone-name-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.state.zones[idx].name = e.target.value;
      });
    });

    this.container.querySelectorAll('.zone-count-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.state.zones[idx].count = Math.max(0, parseInt(e.target.value) || 0);
        this.updateLiveTotals();
      });
    });

    this.container.querySelectorAll('.zone-len-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.state.zones[idx].lengthM = parseFloat(e.target.value) || 20;
      });
    });

    this.container.querySelectorAll('.zone-wid-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.state.zones[idx].widthM = parseFloat(e.target.value) || 15;
      });
    });

    // Delete zone
    this.container.querySelectorAll('.btn-delete-zone').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index);
        if (this.state.zones.length <= 1) {
          alert('At least one zone must be retained.');
          return;
        }
        this.state.zones.splice(idx, 1);
        this.render();
      });
    });

    // Add custom zone
    const btnAddZone = this.container.querySelector('#btn-add-zone');
    if (btnAddZone) {
      btnAddZone.addEventListener('click', () => {
        const num = this.state.zones.length + 1;
        this.state.zones.push({
          id: `zone_custom_${Date.now()}`,
          name: `Observation Zone ${num}`,
          count: 25,
          capacity: 50,
          lengthM: 20,
          widthM: 15
        });
        this.render();
      });
    }

    // Overlap inputs
    this.container.querySelectorAll('.overlap-name-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.state.overlaps[idx].name = e.target.value;
      });
    });

    this.container.querySelectorAll('.overlap-count-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.state.overlaps[idx].shared_occupancy = Math.max(0, parseInt(e.target.value) || 0);
        this.updateLiveTotals();
      });
    });

    this.container.querySelectorAll('.btn-delete-overlap').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.state.overlaps.splice(idx, 1);
        this.render();
      });
    });

    // Add overlap
    const btnAddPair = this.container.querySelector('#btn-add-overlap-pair');
    if (btnAddPair) {
      btnAddPair.addEventListener('click', () => {
        const z1 = this.state.zones[0]?.id || 'zone_a';
        const z2 = this.state.zones[1]?.id || 'zone_b';
        this.state.overlaps.push({
          id: `ov_custom_${Date.now()}`,
          zone_ids: [z1, z2],
          name: `${this.state.zones[0]?.name.split(' ')[0] || 'Zone 1'} ∩ ${this.state.zones[1]?.name.split(' ')[0] || 'Zone 2'}`,
          shared_occupancy: 4
        });
        this.render();
      });
    }

    const btnAddTriple = this.container.querySelector('#btn-add-overlap-triple');
    if (btnAddTriple) {
      btnAddTriple.addEventListener('click', () => {
        const z1 = this.state.zones[0]?.id || 'zone_a';
        const z2 = this.state.zones[1]?.id || 'zone_b';
        const z3 = this.state.zones[2]?.id || 'zone_c';
        this.state.overlaps.push({
          id: `ov_triple_${Date.now()}`,
          zone_ids: [z1, z2, z3],
          name: `3-Way Hub Junction Overlap`,
          shared_occupancy: 2
        });
        this.render();
      });
    }

    // Exit inputs
    this.container.querySelectorAll('.exit-cap-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.state.exits[idx].capacity = parseFloat(e.target.value) || 20;
      });
    });

    this.container.querySelectorAll('.exit-wid-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.state.exits[idx].width = parseFloat(e.target.value) || 1.8;
      });
    });

    // Physics inputs
    const inputSpeed = this.container.querySelector('#input-manual-speed');
    if (inputSpeed) {
      inputSpeed.addEventListener('input', (e) => {
        this.state.walkingSpeed = parseFloat(e.target.value) || 1.2;
      });
    }

    const inputThreshold = this.container.querySelector('#input-manual-threshold');
    if (inputThreshold) {
      inputThreshold.addEventListener('input', (e) => {
        this.state.thresholdPercent = parseInt(e.target.value) || 15;
      });
    }

    const selectOrigin = this.container.querySelector('#select-manual-origin');
    if (selectOrigin) {
      selectOrigin.addEventListener('change', (e) => {
        this.state.originZoneId = e.target.value;
      });
    }

    const selectHazard = this.container.querySelector('#select-manual-hazard');
    if (selectHazard) {
      selectHazard.addEventListener('change', (e) => {
        this.state.hazardZoneId = e.target.value;
      });
    }

    const inputGroundTruth = this.container.querySelector('#input-manual-groundtruth');
    if (inputGroundTruth) {
      inputGroundTruth.addEventListener('input', (e) => {
        this.state.groundTruthUniqueCount = e.target.value !== '' ? parseInt(e.target.value) : null;
        this.updateLiveTotals();
      });
    }

    // Header buttons
    const btnClear = this.container.querySelector('#btn-manual-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.state.zones.forEach(z => z.count = 0);
        this.state.overlaps.forEach(ov => ov.shared_occupancy = 0);
        this.state.groundTruthUniqueCount = 0;
        this.render();
      });
    }

    const btnReset = this.container.querySelector('#btn-manual-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.state = this.getDefaultState();
        this.render();
        if (this.onReset) this.onReset();
      });
    }

    const btnValidate = this.container.querySelector('#btn-manual-validate');
    if (btnValidate) {
      btnValidate.addEventListener('click', () => {
        this.render();
      });
    }

    const btnApply = this.container.querySelector('#btn-manual-apply');
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        if (this.onApply) this.onApply(this.state);
      });
    }

    const btnSimulate = this.container.querySelector('#btn-manual-simulate');
    if (btnSimulate) {
      btnSimulate.addEventListener('click', () => {
        if (this.onRunSimulation) this.onRunSimulation(this.state);
      });
    }
  }

  updateLiveTotals() {
    if (!this.container) return;
    const rawSum = this.state.zones.reduce((s, z) => s + (Number(z.count) || 0), 0);
    const lbl = this.container.querySelector('#lbl-manual-raw-sum');
    if (lbl) lbl.textContent = rawSum;
  }
}

if (typeof window !== 'undefined') {
  window.ManualDataInput = ManualDataInput;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ManualDataInput;
}
