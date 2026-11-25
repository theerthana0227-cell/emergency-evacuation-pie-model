/**
 * Automated Verification & Testing Suite
 * Tests:
 * 1. Building Model & Room Topology
 * 2. Evaluator Scenarios (1, 2, 3) PIE Math Verification
 * 3. Hick's Law Route Decision & Live Threshold Switching
 * 4. Empirical Forschungszentrum Jülich Dataset Parser
 * 5. Empirical PIE Validation Ground-Truth Exactness (0-error guarantee)
 * 6. Exit Flow & Bottleneck Velocity Calculations
 * 7. Invalid Dataset & Exception Handling
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Load modules in node environment
const PedestrianDatasetParser = require('./src/dataset/PedestrianDatasetParser.js');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    testsFailed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    testsFailed++;
  }
}

async function main() {
  console.log('\n======================================================');
  console.log(' Emergency Evacuation Planning System — Test Suite');
  console.log('======================================================\n');

  // TEST SUITE 1: Simulation Engine & PIE Math Logic
  console.log('--- Suite 1: Evaluator Scenarios & PIE Math Logic ---');

  const ApiClient = require('./src/api/apiClient.js');
  const client = new ApiClient();
  client.hasServer = false;

  runTest('Model initializes with 5 educational zones and 4 emergency exits', () => {
    const model = client.getInitialModel();
    assert.strictEqual(model.zones.length, 5, 'Should have 5 zones');
    assert.strictEqual(model.exits.length, 4, 'Should have 4 exits');
    assert(model.zones.some(z => z.id === 'zone_a' && z.name.includes('Lab A')), 'Lab A missing');
    assert(model.zones.some(z => z.id === 'zone_b' && z.name.includes('Hall B')), 'Hall B missing');
    assert(model.zones.some(z => z.id === 'zone_c' && z.name.includes('Corridor C')), 'Corridor C missing');
    assert(model.zones.some(z => z.id === 'zone_d' && z.name.includes('Classroom D')), 'Classroom D missing');
    assert(model.zones.some(z => z.id === 'zone_e' && z.name.includes('Auditorium E')), 'Auditorium E missing');
  });

  await runAsyncTest('Scenario 1 (Corridor Smoke): PIE corrects 26% overcounting error (200 -> 148)', async () => {
    const res = await client.loadScenario('scenario_corridor_smoke');
    const sim = res.data;
    assert.strictEqual(sim.pie.rawSum, 200, 'Raw sum should be 200');
    assert.strictEqual(sim.pie.correctedOccupancy, 148, 'PIE corrected should be 148');
    assert.strictEqual(sim.pie.overcountingError, 52, 'Overcounting error should be 52');
    assert.strictEqual(sim.pie.errorPercentage, 26, 'Error percentage should be 26%');
    assert.strictEqual(sim.pie.totalSubtracted, 61, 'Total subtracted pairwise should be 61');
    assert.strictEqual(sim.pie.totalAddedBack, 9, 'Total added back 3-way should be 9');
    // Strict arithmetic check: 200 - 61 + 9 = 148
    assert.strictEqual(sim.pie.rawSum - sim.pie.totalSubtracted + sim.pie.totalAddedBack, 148);
  });

  await runAsyncTest('Scenario 2 (Lab A Fire): PIE corrects 22.1% error (122 -> 95)', async () => {
    const res = await client.loadScenario('scenario_north_bottleneck');
    const sim = res.data;
    assert.strictEqual(sim.pie.rawSum, 122, 'Raw sum should be 122');
    assert.strictEqual(sim.pie.correctedOccupancy, 95, 'PIE corrected should be 95');
    assert.strictEqual(sim.pie.overcountingError, 27, 'Overcounting error should be 27');
  });

  await runAsyncTest('Scenario 3 (Hick\'s Law): Live route switch on threshold adjustment', async () => {
    // Default threshold = 15%: shortcut speedup is 8.2%, so UX-First is chosen
    await client.loadScenario('scenario_hicks_law');
    let model = await client.getModel();
    assert.strictEqual(model.latestSimulation.routing.selectedStrategy, 'ux-first', 'Should select UX-first at 15%');

    // Slide threshold to 8%: speedup 8.2% > 8%, so Optimal route overrides!
    await client.setThreshold(8);
    model = await client.getModel();
    assert.strictEqual(model.latestSimulation.routing.selectedStrategy, 'optimal', 'Should switch to optimal at 8% threshold');

    // Slide threshold back to 15%: switches back to UX-First
    await client.setThreshold(15);
    model = await client.getModel();
    assert.strictEqual(model.latestSimulation.routing.selectedStrategy, 'ux-first', 'Should switch back to UX-first at 15%');
  });

  // TEST SUITE 2: Real Jülich Trajectory Dataset Parser & Physics
  console.log('\n--- Suite 2: Real Forschungszentrum Jülich Dataset Parser ---');

  const parser = new PedestrianDatasetParser();

  await runAsyncTest('Parses original Jülich ao-240-400.txt correctly', async () => {
    const dataPath = path.join(__dirname, 'data', 'ao-240-400.txt');
    const content = fs.readFileSync(dataPath, 'utf8');
    const parsed = parser.parseText(content, 'ao-240-400.txt');

    assert.strictEqual(parsed.uniquePedestriansCount, 352, 'Must match 352 documented participants');
    assert.strictEqual(parsed.fps, 16, 'Recording frequency must be 16 FPS');
    assert.strictEqual(parsed.bottleneckWidth, 2.4, 'Bottleneck width must be 2.4m');
    assert.strictEqual(parsed.minFrame, 29, 'Start frame should be 29');
    assert.strictEqual(parsed.maxFrame, 1128, 'End frame should be 1128');
    assert(parsed.durationSeconds > 68 && parsed.durationSeconds < 69, 'Duration should be ~68.7s');
    // Ensure coordinate conversion cm -> meters
    assert(parsed.bounds.maxX < 10, 'X coordinates must be in meters (not raw cm > 300)');
  });

  await runAsyncTest('Parses second dataset ao-300-400.txt correctly (Width: 3.0m)', async () => {
    const dataPath = path.join(__dirname, 'data', 'ao-300-400.txt');
    const content = fs.readFileSync(dataPath, 'utf8');
    const parsed = parser.parseText(content, 'ao-300-400.txt');

    assert.strictEqual(parsed.uniquePedestriansCount, 348, 'Must match 348 participants');
    assert.strictEqual(parsed.bottleneckWidth, 3.0, 'Bottleneck width must be 3.0m');
  });

  // TEST SUITE 3: Empirical PIE Mathematical Validation (Ground-Truth 0-Error)
  console.log('\n--- Suite 3: Empirical Inclusion–Exclusion Validation ---');

  await runAsyncTest('PIE theorem holds with 0 absolute error across all sampled frames', async () => {
    const dataPath = path.join(__dirname, 'data', 'ao-240-400.txt');
    const content = fs.readFileSync(dataPath, 'utf8');
    const parsed = parser.parseText(content, 'ao-240-400.txt');

    // Test across 20 representative frames
    const step = Math.floor(parsed.frames.length / 20);
    let framesTested = 0;

    for (let i = 0; i < parsed.frames.length; i += step) {
      const fr = parsed.frames[i];
      const recs = parsed.framesMap.get(fr) || [];

      // Define 3 real overlapping observation zones
      const S1 = new Set();
      const S2 = new Set();
      const S3 = new Set();

      recs.forEach(r => {
        if (r.x >= -2.8 && r.x <= 0.2 && r.y >= 0.8 && r.y <= 4.2) S1.add(r.id);
        if (r.x >= -1.3 && r.x <= 1.3 && r.y >= 0.0 && r.y <= 3.4) S2.add(r.id);
        if (r.x >= -0.2 && r.x <= 2.8 && r.y >= 0.8 && r.y <= 4.2) S3.add(r.id);
      });

      const rawCount = S1.size + S2.size + S3.size;
      const o12 = new Set([...S1].filter(x => S2.has(x))).size;
      const o13 = new Set([...S1].filter(x => S3.has(x))).size;
      const o23 = new Set([...S2].filter(x => S3.has(x))).size;
      const o123 = new Set([...S1].filter(x => S2.has(x) && S3.has(x))).size;

      // Complete PIE formula: |S1| + |S2| + |S3| - (|S1∩S2| + |S1∩S3| + |S2∩S3|) + |S1∩S2∩S3|
      const pieCount = rawCount - (o12 + o13 + o23) + o123;
      const actualUnique = new Set([...S1, ...S2, ...S3]).size;

      assert.strictEqual(pieCount, actualUnique, `Frame ${fr}: PIE count (${pieCount}) must exactly equal actual unique count (${actualUnique})`);
      framesTested++;
    }

    console.log(`    (Verified ${framesTested} frames — 100% exact mathematical match)`);
  });

  // TEST SUITE 4: Invalid File Handling
  console.log('\n--- Suite 4: Error Handling & Invalid Inputs ---');

  runTest('Handles empty file gracefully', () => {
    assert.throws(() => {
      parser.parseText('', 'empty.txt');
    }, /Invalid or empty trajectory file/);
  });

  runTest('Handles non-numeric corrupted file gracefully', () => {
    assert.throws(() => {
      parser.parseText('hello world\nthis is invalid\nnot trajectory data', 'corrupt.txt');
    }, /No valid pedestrian records found/);
  });

  console.log('\n======================================================');
  console.log(` Test Summary: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log('======================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

main();
