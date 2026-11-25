/**
 * RealDataPiePanel Component
 * Displays real-time Principle of Inclusion–Exclusion validation calculated
 * directly from the empirical pedestrian trajectories dataset.
 */

class RealDataPiePanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(stats) {
    if (!this.container) return;

    if (!stats || !stats.pie) {
      this.container.innerHTML = `
        <div class="panel-card">
          <div class="card-header">
            <h3 class="card-title"><span class="icon">📐</span> Empirical PIE Validation</h3>
            <span class="badge-tag badge-purple">Real Data Ground Truth</span>
          </div>
          <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
            <p>Upload or select a Forschungszentrum Jülich pedestrian dataset to run real-time Inclusion–Exclusion validation across overlapping observation zones.</p>
          </div>
        </div>
      `;
      return;
    }

    const { pie, frameNumber, elapsedSeconds, activePedestriansCount } = stats;
    const {
      zone1Count, zone2Count, zone3Count,
      rawCount,
      overlap12, overlap13, overlap23,
      overlap123,
      totalSubtracted, totalAddedBack,
      pieCount, actualUniqueCount,
      absError, isVerifiedExact
    } = pie;

    const duplicateCount = rawCount - actualUniqueCount;
    const errorPct = rawCount > 0 ? ((duplicateCount / rawCount) * 100).toFixed(1) : '0.0';

    this.container.innerHTML = `
      <div class="panel-card">
        <div class="card-header">
          <h3 class="card-title"><span class="icon">📐</span> Empirical PIE Validation Engine</h3>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${isVerifiedExact ? `
              <span class="badge-tag badge-emerald" style="font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                ✓ PASS (100% Match)
              </span>
            ` : `
              <span class="badge-tag" style="background: rgba(239,68,68,0.2); color: #f87171;">FAIL</span>
            `}
          </div>
        </div>

        <!-- Frame Info Bar -->
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-bottom: 12px; font-family: var(--font-mono); background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: var(--radius-sm);">
          <span>Frame: <strong>#${frameNumber}</strong></span>
          <span>Time: <strong>${elapsedSeconds.toFixed(2)}s</strong></span>
          <span>Active in View: <strong>${activePedestriansCount} peds</strong></span>
        </div>

        <!-- Metric Stat Cards -->
        <div class="pie-metrics-row">
          <div class="metric-stat-box naive">
            <div class="metric-value">${rawCount}</div>
            <div class="metric-title">Raw Sensor Sum</div>
            <span class="metric-badge badge-overcount">With Duplicates</span>
          </div>

          <div class="metric-stat-box pie">
            <div class="metric-value">${pieCount}</div>
            <div class="metric-title">PIE Corrected</div>
            <span class="metric-badge badge-exact">Formula Result</span>
          </div>

          <div class="metric-stat-box savings">
            <div class="metric-value" style="color: #34d399;">${actualUniqueCount}</div>
            <div class="metric-title">Actual Unique IDs</div>
            <span class="metric-badge badge-emerald">Ground Truth</span>
          </div>
        </div>

        <!-- Verification Accuracy Banner -->
        <div style="background: ${isVerifiedExact ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'}; border: 1px solid ${isVerifiedExact ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}; border-radius: var(--radius-md); padding: 10px 12px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
          <div>
            <span style="font-weight: 700; color: ${isVerifiedExact ? '#34d399' : '#f87171'};">
              ${isVerifiedExact ? '✓ Mathematical Equivalence Confirmed' : '⚠ Discrepancy Detected'}
            </span>
            <div style="color: var(--text-secondary); font-size: 11px; margin-top: 2px;">
              Absolute Error: <strong>${absError}</strong> | Duplicates Removed: <strong>${duplicateCount} (${errorPct}%)</strong>
            </div>
          </div>
          <div style="font-family: var(--font-mono); font-weight: 800; font-size: 14px; color: ${isVerifiedExact ? '#34d399' : '#f87171'};">
            ${isVerifiedExact ? '0.00% ERROR' : 'ERROR'}
          </div>
        </div>

        <!-- Dynamic Venn Diagram -->
        <div class="venn-container">
          ${this.generateVennSvg(zone1Count, zone2Count, zone3Count, overlap12, overlap13, overlap23, overlap123)}
        </div>

        <!-- Mathematical Trace Breakdown -->
        <div class="formula-box" style="margin-top: 12px;">
          <div class="formula-label">
            <span>PIE Equation Expansion (3 Real Sensor Zones)</span>
            <span style="color: #38bdf8; font-family: var(--font-mono); font-size: 10px;">|Z₁ ∪ Z₂ ∪ Z₃|</span>
          </div>
          <div class="formula-expression" style="font-size: 11px; line-height: 1.6;">
            (|Z₁| + |Z₂| + |Z₃|) − (|Z₁ ∩ Z₂| + |Z₁ ∩ Z₃| + |Z₂ ∩ Z₃|) + |Z₁ ∩ Z₂ ∩ Z₃|
          </div>
          <div style="margin-top: 6px; font-family: var(--font-mono); font-size: 11px; color: #94a3b8;">
            = (${zone1Count} + ${zone2Count} + ${zone3Count}) − (${overlap12} + ${overlap13} + ${overlap23}) + ${overlap123}
          </div>
          <div style="margin-top: 4px; font-family: var(--font-mono); font-size: 12px; color: #34d399; font-weight: 700;">
            = ${rawCount} − ${totalSubtracted} + ${totalAddedBack} = <strong>${pieCount} Unique Pedestrians</strong>
          </div>
        </div>

        <!-- Data Provenance Disclaimer -->
        <div style="margin-top: 10px; background: rgba(0,0,0,0.2); border: 1px dashed rgba(255,255,255,0.15); border-radius: var(--radius-sm); padding: 8px 10px; font-size: 10px; color: #94a3b8; line-height: 1.4;">
          <strong>Dataset Provenance:</strong> Evaluated in real-time from Forschungszentrum Jülich pedestrian trajectories (DOI: 10.34735/ped.2009.6). All zone occupancies, duplicate counts, and intersections are calculated from recorded empirical records without artificial fabrication.
        </div>
      </div>
    `;
  }

  generateVennSvg(z1, z2, z3, o12, o13, o23, o123) {
    return `
      <svg class="venn-svg" viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="vennZ1" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.1"/>
          </radialGradient>
          <radialGradient id="vennZ3" cx="60%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.1"/>
          </radialGradient>
          <radialGradient id="vennZ2" cx="50%" cy="70%" r="60%">
            <stop offset="0%" stop-color="#a855f7" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="#a855f7" stop-opacity="0.1"/>
          </radialGradient>
        </defs>

        <!-- Circle 1: Sensor 1 (West) -->
        <circle cx="85" cy="70" r="48" fill="url(#vennZ1)" stroke="#38bdf8" stroke-width="1.5" />
        <text x="48" y="52" fill="#7dd3fc" font-family="Inter" font-size="9" font-weight="700">Zone 1 (${z1})</text>

        <!-- Circle 3: Sensor 3 (East) -->
        <circle cx="155" cy="70" r="48" fill="url(#vennZ3)" stroke="#10b981" stroke-width="1.5" />
        <text x="160" y="52" fill="#6ee7b7" font-family="Inter" font-size="9" font-weight="700">Zone 3 (${z3})</text>

        <!-- Circle 2: Sensor 2 (Center Throat) -->
        <circle cx="120" cy="100" r="46" fill="url(#vennZ2)" stroke="#a855f7" stroke-width="1.5" />
        <text x="120" y="145" fill="#d8b4fe" font-family="Inter" font-size="9" font-weight="700" text-anchor="middle">Zone 2 (${z2})</text>

        <!-- Pairwise Intersections -->
        <text x="120" y="52" fill="#f8fafc" font-family="JetBrains Mono" font-size="8" font-weight="700" text-anchor="middle">1∩3 (${o13})</text>
        <text x="80" y="98" fill="#f8fafc" font-family="JetBrains Mono" font-size="8" font-weight="700" text-anchor="middle">1∩2 (${o12})</text>
        <text x="160" y="98" fill="#f8fafc" font-family="JetBrains Mono" font-size="8" font-weight="700" text-anchor="middle">2∩3 (${o23})</text>

        <!-- Triple Intersection -->
        <circle cx="120" cy="80" r="7" fill="#facc15" stroke="#ffffff" stroke-width="1" />
        <text x="120" y="73" fill="#fef08a" font-family="JetBrains Mono" font-size="7.5" font-weight="800" text-anchor="middle">1∩2∩3 (${o123})</text>
      </svg>
    `;
  }
}

window.RealDataPiePanel = RealDataPiePanel;
