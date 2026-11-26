/**
 * ColumnMappingPanel Component
 * Provides an interactive column-mapping interface, data preview table,
 * measurement unit conversion, and dynamic support for extra dataset variables.
 */

class ColumnMappingPanel {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.onConfirm = options.onConfirm || null;
    this.onCancel = options.onCancel || null;
    this.currentStructure = null;
    this.rawContent = null;
  }

  show(structure, rawContent) {
    this.currentStructure = structure;
    this.rawContent = rawContent;
    if (!this.container) return;

    this.container.style.display = 'block';
    this.render();
  }

  hide() {
    if (this.container) {
      this.container.style.display = 'none';
      this.container.innerHTML = '';
    }
  }

  render() {
    if (!this.container || !this.currentStructure) return;

    const s = this.currentStructure;
    const mapping = s.suggestedMapping;

    this.container.innerHTML = `
      <div class="modal-overlay active" style="z-index: 9999;">
        <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
          <button class="modal-close" id="btn-close-mapping">&times;</button>
          
          <div style="margin-bottom: 16px;">
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px;">
              <span class="badge-tag badge-purple">Dataset Ingestion & Schema Mapper</span>
              <span class="badge-tag badge-cyan">${s.type.toUpperCase()} Format</span>
            </div>
            <h2 style="font-family: var(--font-display); font-size: 20px; color: #f8fafc; margin: 0;">
              📂 Column Mapping & Dataset Preview
            </h2>
            <p style="color: var(--text-secondary); font-size: 12px; margin-top: 4px;">
              File: <strong style="color: #38bdf8;">${s.filename}</strong> (${s.totalRows} detected rows). Map dataset variables or confirm auto-detected columns.
            </p>
          </div>

          <!-- Section 1: Column Mapping Selectors -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
            <h3 style="font-size: 13px; color: #94a3b8; text-transform: uppercase; margin: 0 0 12px 0; letter-spacing: 0.05em;">
              1. Map Essential Trajectory Fields
            </h3>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
              
              <!-- Pedestrian ID -->
              <div>
                <label style="display: block; font-size: 11px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px;">
                  Pedestrian ID: <span class="badge-tag" style="font-size: 9px; padding: 1px 4px; background: rgba(56, 189, 248, 0.2); color: #38bdf8;">MEASURED</span>
                </label>
                <select id="map-select-id" style="width: 100%; background: #0f172a; border: 1px solid var(--border-light); color: #fff; padding: 6px 8px; border-radius: var(--radius-sm); font-size: 12px;">
                  ${s.columns.map(c => `<option value="${c}" ${c === mapping.id ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </div>

              <!-- Frame / Timestamp -->
              <div>
                <label style="display: block; font-size: 11px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px;">
                  Frame / Timestamp: <span class="badge-tag" style="font-size: 9px; padding: 1px 4px; background: rgba(56, 189, 248, 0.2); color: #38bdf8;">MEASURED</span>
                </label>
                <select id="map-select-frame" style="width: 100%; background: #0f172a; border: 1px solid var(--border-light); color: #fff; padding: 6px 8px; border-radius: var(--radius-sm); font-size: 12px;">
                  ${s.columns.map(c => `<option value="${c}" ${c === mapping.frame ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </div>

              <!-- X Coordinate -->
              <div>
                <label style="display: block; font-size: 11px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px;">
                  X Coordinate: <span class="badge-tag" style="font-size: 9px; padding: 1px 4px; background: rgba(56, 189, 248, 0.2); color: #38bdf8;">MEASURED</span>
                </label>
                <select id="map-select-x" style="width: 100%; background: #0f172a; border: 1px solid var(--border-light); color: #fff; padding: 6px 8px; border-radius: var(--radius-sm); font-size: 12px;">
                  ${s.columns.map(c => `<option value="${c}" ${c === mapping.x ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </div>

              <!-- Y Coordinate -->
              <div>
                <label style="display: block; font-size: 11px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px;">
                  Y Coordinate: <span class="badge-tag" style="font-size: 9px; padding: 1px 4px; background: rgba(56, 189, 248, 0.2); color: #38bdf8;">MEASURED</span>
                </label>
                <select id="map-select-y" style="width: 100%; background: #0f172a; border: 1px solid var(--border-light); color: #fff; padding: 6px 8px; border-radius: var(--radius-sm); font-size: 12px;">
                  ${s.columns.map(c => `<option value="${c}" ${c === mapping.y ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </div>

              <!-- Z Coordinate -->
              <div>
                <label style="display: block; font-size: 11px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px;">
                  Z Coordinate (Height):
                </label>
                <select id="map-select-z" style="width: 100%; background: #0f172a; border: 1px solid var(--border-light); color: #fff; padding: 6px 8px; border-radius: var(--radius-sm); font-size: 12px;">
                  <option value="__none__">Not Available (Default 1.70m 3D Height)</option>
                  ${s.columns.map(c => `<option value="${c}" ${c === mapping.z ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </div>

            </div>
          </div>

          <!-- Section 2: Units & Experimental Parameters -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
            <h3 style="font-size: 13px; color: #94a3b8; text-transform: uppercase; margin: 0 0 12px 0; letter-spacing: 0.05em;">
              2. Unit Scaling & Experimental Geometry
            </h3>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
              <!-- Coordinate Units -->
              <div>
                <label style="display: block; font-size: 11px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px;">
                  Coordinate Units:
                </label>
                <select id="map-select-unit" style="width: 100%; background: #0f172a; border: 1px solid var(--border-light); color: #fff; padding: 6px 8px; border-radius: var(--radius-sm); font-size: 12px;">
                  <option value="auto">Auto-Detect (cm if > 25, else meters)</option>
                  <option value="cm">Centimeters [cm] (x0.01 to meters)</option>
                  <option value="m">Meters [m] (Direct 1:1)</option>
                  <option value="mm">Millimeters [mm] (x0.001 to meters)</option>
                </select>
              </div>

              <!-- Recording Frequency -->
              <div>
                <label style="display: block; font-size: 11px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px;">
                  Recording Frequency (FPS):
                </label>
                <input type="number" id="map-input-fps" min="1" max="120" value="16" style="width: 100%; background: #0f172a; border: 1px solid var(--border-light); color: #38bdf8; font-weight: 700; padding: 6px 8px; border-radius: var(--radius-sm); font-size: 12px;" />
                <span style="font-size: 10px; color: var(--text-muted);">FZ Jülich Hermes: 16 FPS</span>
              </div>

              <!-- Bottleneck Width -->
              <div>
                <label style="display: block; font-size: 11px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px;">
                  Bottleneck / Exit Width (m):
                </label>
                <input type="number" id="map-input-width" step="0.1" min="0.5" max="10" value="2.4" style="width: 100%; background: #0f172a; border: 1px solid var(--border-light); color: #34d399; font-weight: 700; padding: 6px 8px; border-radius: var(--radius-sm); font-size: 12px;" />
                <span style="font-size: 10px; color: var(--text-muted);">Corridor constraint boundary</span>
              </div>
            </div>
          </div>

          <!-- Section 3: Extra Dynamic Variables -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <h3 style="font-size: 13px; color: #94a3b8; text-transform: uppercase; margin: 0; letter-spacing: 0.05em;">
                3. Additional Detected Variables
              </h3>
              <span class="badge-tag badge-emerald" style="font-size: 10px;">Preserved in Record Model</span>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${s.columns.map(c => `
                <span class="badge-tag" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); font-size: 11px; padding: 4px 8px;">
                  📊 ${c}
                </span>
              `).join('')}
            </div>
          </div>

          <!-- Section 4: Data Preview Table -->
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 13px; color: #94a3b8; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 0.05em;">
              4. Dataset Preview (First ${s.sampleRows.length} Rows)
            </h3>
            <div style="max-height: 220px; overflow-x: auto; overflow-y: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
              <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 11px;">
                <thead>
                  <tr style="background: rgba(30, 41, 59, 0.9); border-bottom: 1px solid var(--border-subtle);">
                    <th style="padding: 6px 10px; text-align: left; color: #94a3b8; font-weight: 700;">#</th>
                    ${s.columns.map(c => `<th style="padding: 6px 10px; text-align: left; color: #38bdf8; font-weight: 700;">${c}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${s.sampleRows.map((row, rIdx) => `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); background: ${rIdx % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent'};">
                      <td style="padding: 5px 10px; color: var(--text-muted);">${rIdx + 1}</td>
                      ${s.columns.map(c => `<td style="padding: 5px 10px; color: #e2e8f0;">${row[c] !== undefined ? row[c] : '—'}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn btn-secondary btn-sm" id="btn-cancel-mapping">
              Cancel
            </button>
            <button class="btn btn-primary btn-sm" id="btn-confirm-mapping" style="background: #10b981; color: #fff; font-weight: 700; padding: 8px 16px;">
              ✓ Confirm Mapping & Ingest Dataset
            </button>
          </div>

        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    if (!this.container) return;

    const btnClose = this.container.querySelector('#btn-close-mapping');
    const btnCancel = this.container.querySelector('#btn-cancel-mapping');
    const btnConfirm = this.container.querySelector('#btn-confirm-mapping');

    const handleClose = () => {
      this.hide();
      if (this.onCancel) this.onCancel();
    };

    if (btnClose) btnClose.addEventListener('click', handleClose);
    if (btnCancel) btnCancel.addEventListener('click', handleClose);

    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => {
        const selId = this.container.querySelector('#map-select-id')?.value;
        const selFrame = this.container.querySelector('#map-select-frame')?.value;
        const selX = this.container.querySelector('#map-select-x')?.value;
        const selY = this.container.querySelector('#map-select-y')?.value;
        const selZ = this.container.querySelector('#map-select-z')?.value;
        const selUnit = this.container.querySelector('#map-select-unit')?.value;
        const fps = parseInt(this.container.querySelector('#map-input-fps')?.value) || 16;
        const bottleneckWidth = parseFloat(this.container.querySelector('#map-input-width')?.value) || 2.4;

        const mapping = {
          id: selId,
          frame: selFrame,
          x: selX,
          y: selY,
          z: selZ !== '__none__' ? selZ : null
        };

        const options = {
          mapping,
          unit: selUnit !== 'auto' ? selUnit : null,
          fps,
          bottleneckWidth
        };

        this.hide();
        if (this.onConfirm) {
          this.onConfirm(this.rawContent, this.currentStructure.filename, options);
        }
      });
    }
  }
}

if (typeof window !== 'undefined') {
  window.ColumnMappingPanel = ColumnMappingPanel;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ColumnMappingPanel;
}
