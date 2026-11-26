# Emergency Evacuation Planning System — 3D Simulation & Empirical PIE Validation

[![Vercel Deployment Ready](https://img.shields.io/badge/Deployment-Vercel%20Compatible-000000?style=flat&logo=vercel)](https://vercel.com)
[![Three.js](https://img.shields.io/badge/Three.js-r128-black?style=flat&logo=three.js)](https://threejs.org)
[![Dataset DOI](https://img.shields.io/badge/DOI-10.34735%2Fped.2009.6-blue)](https://doi.org/10.34735/ped.2009.6)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An interactive, high-fidelity platform combining **3D emergency evacuation simulation** (educational facility floor plan with cognitive routing ergonomics) and **empirical real-world pedestrian trajectory validation** using benchmark experimental data from **Forschungszentrum Jülich**.

---

## 🌟 Key Capabilities

### 1. Interactive 3D Educational Building Visualization
- **Realistic Campus Architecture**: Converts the 2D architectural blueprint into a detailed 3D facility representing the **JAIN University Tech Wing (Block 4, Level 2)**.
- **5 Detailed Educational Zones**:
  - **Lab A – Computer Vision**: Workstations, dual monitors, server rack towers.
  - **Hall B – Robotics Arena**: Perimeter safety boundary, robotic arm pedestals, demo rings.
  - **Central Corridor C – Spine Hub**: Terrazzo flooring, reception kiosks, planters, emergency directional decals.
  - **Classroom D – AI DevOps**: Student desk clusters, lecturer podium, Kanban projector screen.
  - **Auditorium E – Innovation Center**: Stepped tiered seating rows, curved chairs, lecture stage, presentation screen.
- **4 Emergency Egress Gates**:
  - Exit 1 (North Main Gates)
  - Exit 2 (South Courtyard Exit)
  - Exit 3 (West Emergency Fire Door)
  - Exit 4 (East Garden Gate)
  - All exits feature illuminated green LED exit signs with localized emergency point lighting.
- **Visual Exploration Toggles**:
  - **Wall Transparency**: Switch between solid walls and transparent glass (opacity 0.32) to see inside.
  - **Ceiling / Roof Structure**: Toggle roof slabs and central spine skylights on or off.
- **Camera Presets**: Seamless 1-click camera views (`Perspective`, `Isometric (45°)`, `Top View`).
- **2D / 3D Seamless Toggle**: Switch between the architectural SVG layout and the interactive Three.js 3D facility.

### 2. Animated Emergency Evacuation Simulation
- **Dynamic Hazard Visualization**: Trigger chemical spills, fire, or smoke in any zone with animated procedural 3D particle fire/smoke pillars.
- **Occupant Multi-Agent Walking**: 3D human figures animate with natural walking paces, leg-swing cycles, and directional heading towards safe exits.
- **Hick's Law Routing Cognitive Ergonomics**:
  - **UX-First Route (Glowing Green)**: Prioritizes straight lines of sight and minimal direction changes ($1$ turn) to prevent crowd panic and decision hesitation.
  - **Pure Optimal Route (Glowing Cyan)**: Theoretical shortest path (with multiple turns). Overrides UX-First only when the time speedup exceeds the user-configured **Optimality Threshold** (e.g. 15%).
- **Interactive Evacuation HUD**: Displays live counters for Evacuated People, Remaining Occupants, Elapsed Evacuation Time, and Facility Evacuation Status.
- **Playback Controls**: Start, Pause, Resume, Reset, and playback speed adjustments (`0.5x`, `1.0x`, `2.0x`, `4.0x`).

### 3. Real-World Empirical Dataset Integration
- **Benchmark Source**: Publicly available, peer-reviewed pedestrian trajectory data from **Forschungszentrum Jülich** (Institute for Advanced Simulation, Civil Safety Research).
  - **Research Dataset**: [https://doi.org/10.34735/ped.2009.6](https://doi.org/10.34735/ped.2009.6)
  - **Data Archive**: [https://ped.fz-juelich.de/da/](https://ped.fz-juelich.de/da/)
  - **Study**: Hermes Bottleneck Experiment (Messe Düsseldorf Hall 2, 2009).
- **Recorded Physics & Metadata**:
  - $16\text{ FPS}$ stereo camera tracking (Point Grey Bumblebee XB3).
  - Over $350$ real human participants per run.
  - Coordinates recorded in centimeters ($[cm]$) and converted to international meters ($[m]$).
  - Head $Z$-coordinates ($1.43\text{m}$ to $1.99\text{m}$) reflecting real human heights.
- **File Upload Support**: Accepts original datasets in `.txt`, `.csv`, and `.zip` archives with automatic delimiter detection and format validation.

### 4. Empirical 3D Bottleneck Reconstruction & Playback
- Reconstructs the exact documented geometry of the **Messe Düsseldorf Hall 2** setup:
  - Semicircular holding area ($R \approx 8.6\text{m}$) with color-coded starting radius markings.
  - 2-meter-high barrier board walls forming the bottleneck throat.
  - Documented bottleneck widths ($b = 2.4\text{m}, 3.0\text{m}, 3.6\text{m}, 4.4\text{m}, 5.0\text{m}$).
- Renders every tracked pedestrian as an individual 3D figure positioned at their recorded coordinates.
- Timeline scrubber slider allowing frame-by-frame inspection.

### 5. Empirical Principle of Inclusion–Exclusion (PIE) Validation
- Defines three overlapping physical observation zones in the 3D experimental funnel:
  - **Zone 1 (West Inflow)**: $x \in [-2.8, 0.2]\text{m}, y \in [0.8, 4.2]\text{m}$
  - **Zone 2 (Center Throat)**: $x \in [-1.3, 1.3]\text{m}, y \in [0.0, 3.4]\text{m}$
  - **Zone 3 (East Inflow)**: $x \in [-0.2, 2.8]\text{m}, y \in [0.8, 4.2]\text{m}$
- For every frame, the system computes:
  - Raw sensor sum: $|Z_1| + |Z_2| + |Z_3|$
  - Pairwise overlaps: $|Z_1 \cap Z_2| + |Z_1 \cap Z_3| + |Z_2 \cap Z_3|$
  - Triple intersection: $|Z_1 \cap Z_2 \cap Z_3|$
  - PIE corrected count: $|Z_1 \cup Z_2 \cup Z_3| = \sum |Z_i| - \sum |Z_i \cap Z_j| + |Z_1 \cap Z_2 \cap Z_3|$
  - Ground-truth unique pedestrian IDs: $|\bigcup Z_i|$
- **Strict Verification Guarantee**: Confirms $0.00\%$ error ($\text{Absolute Error} = 0$) across all frames, demonstrating that PIE exactly eliminates multi-sensor duplicate counts without artificial fabrication.

### 6. Exit Flow & Congestion Analytics
- Dynamic measurement of pedestrians crossing the documented exit line ($y = 0$).
- Real-time calculations:
  - Total pedestrians crossed
  - Flow rate $J(t)$ in $\text{pedestrians}/\text{second}$
  - Specific flow rate $J_s = J / b$ in $\text{peds}/(\text{m}\cdot\text{s})$
  - Observed passage speed in $\text{m/s}$
  - Bottleneck throat crowd density in $\text{peds}/\text{m}^2$
  - Congestion classification (Free Flow vs Moderate vs Severe Bottleneck)
- Real-time time-series flow curve using Chart.js.

### 7. Validation Dashboard & Reporting
- Option to export empirical validation records as a CSV spreadsheet.
- One-click formatted printable PDF/HTML report.

---

## 📐 Mathematical Formulation

### 1. Principle of Inclusion–Exclusion (3-Set Formulation)
$$|A \cup B \cup C| = |A| + |B| + |C| - (|A \cap B| + |A \cap C| + |B \cap C|) + |A \cap B \cap C|$$
- **First Term (Level 1)**: Sums raw sensor detections. Individuals in shared doorways are counted twice.
- **Second Term (Level 2)**: Subtracts pairwise intersections to eliminate double-counting.
- **Third Term (Level 3)**: Adds back individuals detected simultaneously by all three sensors who were subtracted once too often.

### 2. Hick's Law Cognitive Decision Time
$$T = b \cdot \log_2(n + 1)$$
where $n$ is the number of decision branching points (turns/junctions) and $b$ is an empirical cognitive coefficient. In high-stress evacuations, excess decision points induce hesitation, group splitting, and counter-flow congestion.

### 3. Route Selection Rule
$$\Delta_{\text{speedup}} = \frac{T_{\text{UX}} - T_{\text{Optimal}}}{T_{\text{UX}}} \times 100\%$$
$$\text{Chosen Route} = \begin{cases} \text{Optimal}, & \text{if } \Delta_{\text{speedup}} > \text{Threshold}\% \\ \text{UX-First}, & \text{otherwise} \end{cases}$$

---

## 🚀 Installation & Running Locally

### Prerequisites
- Node.js (v18 or higher recommended; v26 tested)
- Modern web browser (Chrome, Edge, Firefox, Safari)

### Quick Start
1. Clone or navigate to the repository directory:
   ```bash
   cd emergency-evacuation-system
   ```

2. Start the local server:
   ```bash
   npm start
   # or
   node server.js
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

*(Note: The application has zero external npm dependencies and works completely offline with bundled vendor assets!)*

### Running Automated Verification Tests
To run the automated mathematical and dataset verification test suite:
```bash
npm test
# or
node test.js
```
The test suite verifies:
- Architectural topology (5 zones, 4 exits)
- PIE mathematical exactness across Scenarios 1, 2, and 3
- Hick's Law live threshold route flipping
- Forschungszentrum Jülich dataset parser and centimeter-to-meter coordinate conversion
- Empirical ground-truth PIE equivalence (0 absolute error)
- Error handling on corrupt/empty trajectory inputs

---

## ☁️ Deployment (Vercel)

The repository is pre-configured for instant zero-configuration deployment to **Vercel**:
```bash
vercel --prod
```
The included `vercel.json` and static fallback engine guarantee that the application runs seamlessly either with serverless Node API functions or as a 100% static client-side application.

---

## 🔬 Scientific Limitations & Disclaimers

1. **Empirical Crowd Physics**: The Forschungszentrum Jülich dataset measures physical crowd dynamics, flow rates, and bottleneck passage under controlled laboratory conditions. It empirically proves that the Principle of Inclusion–Exclusion accurately eliminates multi-camera duplicate counts without ground-truth error.
2. **Safety Systems Distinction**: The dataset reflects controlled volunteer experiments and should not be construed as a safety certification for building code compliance, fire toxicology, or real structural emergency certification.

---

## 👥 Academic Context
- **Program**: B.Tech CSE (AI-Driven DevOps)
- **Institution**: JAIN (Deemed-to-be University)
- **Course**: Experiential Learning Project
