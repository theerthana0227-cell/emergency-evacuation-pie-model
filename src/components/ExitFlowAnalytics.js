/**
 * ExitFlowAnalytics Component
 * Computes and graphs empirical pedestrian flow, velocity, crowd density,
 * and exit crossing rates from recorded Forschungszentrum Jülich trajectories.
 */

class ExitFlowAnalytics {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.chart = null;
    this.flowHistory = [];
  }

  initChart() {
    const canvas = document.getElementById('exit-flow-chart-canvas');
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Exit Flow Rate J(t) (peds/sec)',
            data: [],
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointRadius: 0
          },
          {
            label: 'Specific Flow Js (peds/m·s)',
            data: [],
            borderColor: '#10b981',
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            title: { display: true, text: 'Elapsed Time (s)', color: '#64748b', font: { size: 10 } },
            ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 9 } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y: {
            title: { display: true, text: 'Flow Rate', color: '#64748b', font: { size: 10 } },
            ticks: { color: '#64748b', font: { size: 9 } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            beginAtZero: true
          }
        },
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { size: 10 }, boxWidth: 12 }
          }
        }
      }
    });
  }

  render(dataset, currentStats) {
    if (!this.container) return;

    if (!dataset) {
      this.container.innerHTML = `
        <div class="panel-card">
          <div class="card-header">
            <h3 class="card-title"><span class="icon">📊</span> Exit Flow & Congestion Analytics</h3>
            <span class="badge-tag">Awaiting Dataset</span>
          </div>
          <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
            <p>Load an experimental dataset to measure real pedestrian exit flow rate, crowd density, and speed.</p>
          </div>
        </div>
      `;
      return;
    }

    const b = dataset.bottleneckWidth || 2.4;
    const totalPeds = dataset.uniquePedestriansCount || 0;
    const duration = dataset.durationSeconds || 1;
    const avgOverallFlow = (totalPeds / duration).toFixed(2);
    const specificFlow = (avgOverallFlow / b).toFixed(2);

    const currentSpeed = currentStats ? currentStats.avgSpeed.toFixed(2) : '0.00';
    const currentCrossed = currentStats ? currentStats.totalCrossed : 0;
    const currentActive = currentStats ? currentStats.activePedestriansCount : 0;

    // Density estimate in the 4m x b bottleneck throat
    const throatArea = (4.0 * b).toFixed(1);
    const currentDensity = (currentActive / (4.0 * b)).toFixed(2);

    // Congestion Level
    let congestionBadge = '<span class="badge-tag badge-emerald">Free Flow</span>';
    if (currentDensity > 2.5) {
      congestionBadge = '<span class="badge-tag badge-rose" style="background: rgba(239,68,68,0.2); color: #f87171;">Severe Bottleneck</span>';
    } else if (currentDensity > 1.2) {
      congestionBadge = '<span class="badge-tag badge-purple">Moderate Congestion</span>';
    }

    // Check if container already has the chart canvas
    if (!document.getElementById('exit-flow-chart-canvas')) {
      this.container.innerHTML = `
        <div class="panel-card">
          <div class="card-header">
            <h3 class="card-title"><span class="icon">📊</span> Exit Flow & Congestion Analytics</h3>
            <div style="display: flex; gap: 6px; align-items: center;">
              ${congestionBadge}
            </div>
          </div>

          <!-- Quick Metrics Row -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;">
            <div class="metric-stat-box">
              <div class="metric-value" style="font-size: 16px; color: #38bdf8;">${b.toFixed(1)} m</div>
              <div class="metric-title" style="font-size: 9px;">Bottleneck Width</div>
            </div>
            <div class="metric-stat-box">
              <div class="metric-value" style="font-size: 16px; color: #34d399;" id="stat-crossed-val">${currentCrossed}</div>
              <div class="metric-title" style="font-size: 9px;">Crossed Exit</div>
            </div>
            <div class="metric-stat-box">
              <div class="metric-value" style="font-size: 16px; color: #facc15;" id="stat-speed-val">${currentSpeed} m/s</div>
              <div class="metric-title" style="font-size: 9px;">Avg Speed</div>
            </div>
            <div class="metric-stat-box">
              <div class="metric-value" style="font-size: 16px; color: #c084fc;" id="stat-density-val">${currentDensity} /m²</div>
              <div class="metric-title" style="font-size: 9px;">Crowd Density</div>
            </div>
          </div>

          <!-- Flow Chart -->
          <div style="height: 160px; position: relative; margin-bottom: 10px;">
            <canvas id="exit-flow-chart-canvas"></canvas>
          </div>

          <!-- Summary Stats -->
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-secondary); background: rgba(0,0,0,0.25); padding: 8px 10px; border-radius: var(--radius-sm); font-family: var(--font-mono);">
            <span>Overall Flow J: <strong>${avgOverallFlow} peds/s</strong></span>
            <span>Specific Flow Js: <strong>${specificFlow} peds/(m·s)</strong></span>
            <span>Duration: <strong>${duration.toFixed(1)}s</strong></span>
          </div>

          <!-- Scientific Distinction Notice -->
          <div style="margin-top: 10px; font-size: 10px; color: #64748b; line-height: 1.4; border-top: 1px solid var(--border-subtle); padding-top: 8px;">
            ℹ️ <strong>Experimental Measurement:</strong> Flow and velocity are measured directly from overhead camera tracking. This validates crowd physics and exit capacity equations, but does not simulate fire toxicity or psychological panic decisions.
          </div>
        </div>
      `;
      this.initChart();
      this.buildCompleteFlowSeries(dataset);
    } else {
      // Update quick stats without rebuilding canvas
      const elCrossed = document.getElementById('stat-crossed-val');
      const elSpeed = document.getElementById('stat-speed-val');
      const elDensity = document.getElementById('stat-density-val');
      if (elCrossed) elCrossed.textContent = currentCrossed;
      if (elSpeed) elSpeed.textContent = `${currentSpeed} m/s`;
      if (elDensity) elDensity.textContent = `${currentDensity} /m²`;
    }
  }

  // Pre-calculate time-series of exit flow across all frames
  buildCompleteFlowSeries(dataset) {
    if (!this.chart || !dataset || !dataset.frames) return;

    const windowFrames = dataset.fps * 2; // 2 second rolling window
    const labels = [];
    const flowData = [];
    const specificFlowData = [];
    const b = dataset.bottleneckWidth || 2.4;

    // Detect crossings per frame
    const crossedAtFrame = new Map(); // pedId -> first crossing frame
    dataset.frames.forEach(fr => {
      const recs = dataset.framesMap.get(fr) || [];
      recs.forEach(r => {
        if (r.y <= 0 && !crossedAtFrame.has(r.id)) {
          crossedAtFrame.set(r.id, fr);
        }
      });
    });

    const step = Math.max(1, Math.floor(dataset.frames.length / 50));
    for (let i = 0; i < dataset.frames.length; i += step) {
      const fr = dataset.frames[i];
      const timeSec = ((fr - dataset.minFrame) / dataset.fps).toFixed(1);
      labels.push(timeSec);

      // Count crossings in window [fr - windowFrames, fr]
      let countInWindow = 0;
      crossedAtFrame.forEach(crossingFrame => {
        if (crossingFrame >= fr - windowFrames && crossingFrame <= fr) {
          countInWindow++;
        }
      });

      const flow = countInWindow / (windowFrames / dataset.fps);
      flowData.push(flow.toFixed(2));
      specificFlowData.push((flow / b).toFixed(2));
    }

    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = flowData;
    this.chart.data.datasets[1].data = specificFlowData;
    this.chart.update();
  }
}

window.ExitFlowAnalytics = ExitFlowAnalytics;
