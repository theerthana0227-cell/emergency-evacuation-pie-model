/**
 * PedestrianDatasetParser
 * Robust parser for empirical pedestrian trajectory datasets from Forschungszentrum Jülich.
 * Supports:
 * - Space, tab, and comma-delimited TXT/CSV files
 * - ZIP archives containing trajectory files (via JSZip)
 * - Fields: ID, Frame, X, Y, Z
 * - Coordinate conversion: Jülich records coordinates in centimeters [cm]; converts to meters [m]
 * - Metadata integration: 16 FPS recording frequency, Messe Düsseldorf Hall 2 bottleneck geometry
 * - Ground truth analysis: unique IDs, frame index, velocity, density, flow rate
 */

class PedestrianDatasetParser {
  constructor() {
    this.fps = 16; // Standard Jülich Hermes 2009 experiment recording frequency
  }

  /**
   * Parse raw text string into structured trajectory records
   */
  parseText(textContent, filename = 'dataset.txt') {
    if (!textContent || typeof textContent !== 'string') {
      throw new Error('Invalid or empty trajectory file content.');
    }

    const lines = textContent.split(/\r?\n/);
    const records = [];
    const uniqueIds = new Set();
    const framesMap = new Map(); // frame -> array of { id, x, y, z, vx, vy, speed }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let minFrame = Infinity, maxFrame = -Infinity;

    // Detect if coordinates are in cm (> 20 usually indicates cm for human bounds in this hall)
    let isCentimeterUnits = false;
    let sampleChecked = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;

      const parts = line.split(/[,\s\t]+/).map(p => parseFloat(p));
      if (parts.length >= 4 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2]) && !isNaN(parts[3])) {
        sampleChecked++;
        if (Math.abs(parts[2]) > 25 || Math.abs(parts[3]) > 25) {
          isCentimeterUnits = true;
          break;
        }
        if (sampleChecked > 200) break;
      }
    }

    const unitScale = isCentimeterUnits ? 0.01 : 1.0; // cm to meters

    // Trajectory history per pedestrian for velocity calculation: pedId -> prevPoint
    const prevPositions = new Map();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;

      const parts = line.split(/[,\s\t]+/).map(p => parseFloat(p));
      if (parts.length < 4 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2]) || isNaN(parts[3])) {
        continue;
      }

      const id = Math.round(parts[0]);
      const frame = Math.round(parts[1]);
      const x = parts[2] * unitScale; // in meters
      const y = parts[3] * unitScale; // in meters
      const z = (parts.length >= 5 && !isNaN(parts[4])) ? parts[4] * unitScale : 1.7; // default head height in meters

      uniqueIds.add(id);

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      if (frame < minFrame) minFrame = frame;
      if (frame > maxFrame) maxFrame = frame;

      // Velocity calculation
      let speed = 0;
      let vx = 0;
      let vy = 0;

      if (prevPositions.has(id)) {
        const prev = prevPositions.get(id);
        const dt = (frame - prev.frame) / this.fps;
        if (dt > 0 && dt <= 0.5) {
          vx = (x - prev.x) / dt;
          vy = (y - prev.y) / dt;
          speed = Math.sqrt(vx * vx + vy * vy);
        }
      }
      prevPositions.set(id, { frame, x, y, z });

      const item = { id, frame, x, y, z, vx, vy, speed };
      records.push(item);

      if (!framesMap.has(frame)) {
        framesMap.set(frame, []);
      }
      framesMap.get(frame).push(item);
    }

    if (records.length === 0) {
      throw new Error('No valid pedestrian records found. Ensure format is: ID Frame X Y [Z].');
    }

    // Determine bottleneck width from filename if standard Jülich run
    let bottleneckWidth = 2.4;
    if (filename.includes('240')) bottleneckWidth = 2.4;
    else if (filename.includes('300')) bottleneckWidth = 3.0;
    else if (filename.includes('360')) bottleneckWidth = 3.6;
    else if (filename.includes('440')) bottleneckWidth = 4.4;
    else if (filename.includes('500')) bottleneckWidth = 5.0;

    const sortedFrames = Array.from(framesMap.keys()).sort((a, b) => a - b);
    const durationSeconds = (maxFrame - minFrame) / this.fps;

    return {
      filename,
      recordsCount: records.length,
      uniquePedestriansCount: uniqueIds.size,
      uniquePedestriansList: Array.from(uniqueIds).sort((a, b) => a - b),
      frames: sortedFrames,
      framesMap: framesMap,
      minFrame,
      maxFrame,
      durationSeconds,
      fps: this.fps,
      coordinateUnits: isCentimeterUnits ? 'centimeters (converted to meters)' : 'meters',
      bottleneckWidth,
      bounds: {
        minX, maxX,
        minY, maxY,
        minZ, maxZ,
        width: maxX - minX,
        height: maxY - minY
      },
      source: {
        institution: 'Forschungszentrum Jülich (Civil Safety Research)',
        experiment: 'Hermes Bottleneck Experiment (Düsseldorf 2009)',
        doi: '10.34735/ped.2009.6',
        archiveUrl: 'https://ped.fz-juelich.de/da/'
      }
    };
  }

  /**
   * Parse a File object (CSV, TXT, or ZIP)
   */
  async parseFile(file) {
    if (!file) throw new Error('No file provided.');

    const name = file.name.toLowerCase();

    if (name.endsWith('.zip')) {
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library is required to unpack ZIP archives.');
      }
      const zip = await JSZip.loadAsync(file);
      // Find first .txt or .csv inside zip
      let trajectoryFile = null;
      let targetName = '';
      for (const [filename, fileObj] of Object.entries(zip.files)) {
        if (!fileObj.dir && (filename.toLowerCase().endsWith('.txt') || filename.toLowerCase().endsWith('.csv'))) {
          trajectoryFile = fileObj;
          targetName = filename;
          break;
        }
      }

      if (!trajectoryFile) {
        throw new Error('ZIP archive does not contain any .txt or .csv trajectory files.');
      }

      const text = await trajectoryFile.async('string');
      return this.parseText(text, targetName);
    } else {
      // Direct text or csv file
      const text = await file.text();
      return this.parseText(text, file.name);
    }
  }
}

if (typeof window !== 'undefined') {
  window.PedestrianDatasetParser = PedestrianDatasetParser;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PedestrianDatasetParser;
}
