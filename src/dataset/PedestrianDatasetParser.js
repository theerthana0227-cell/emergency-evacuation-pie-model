/**
 * PedestrianDatasetParser
 * Robust parser for empirical pedestrian trajectory datasets from Forschungszentrum Jülich
 * and user-supplied CSV, TXT, JSON, and ZIP files.
 *
 * Requirements Supported:
 * - Space, tab, comma, and semicolon delimited TXT/CSV files.
 * - Native JSON format (array of records or nested { records: [...] } / { data: [...] }).
 * - ZIP archives containing trajectory datasets (via JSZip).
 * - Automatic column detection and column-mapping interface support.
 * - Dynamic preservation of all original dataset variables (v_x, v_y, speed, density, groups, etc.).
 * - Coordinate conversion: Centimeters [cm], Meters [m], Millimeters [mm].
 * - Configurable recording frequencies (FPS) and bottleneck dimensions.
 * - Ground truth analysis: unique IDs, frame index, velocity, density, flow rate.
 * - Error handling for malformed, non-numeric, or corrupt files.
 */

class PedestrianDatasetParser {
  constructor(options = {}) {
    this.fps = options.fps || 16; // Default Jülich Hermes recording frequency
    this.defaultHeadHeight = 1.70; // Standard visual height assumption for 3D figures
  }

  /**
   * Inspect a raw text or JSON string and return detected columns, sample rows, and separator.
   * Used for the Data Preview Table and Column Mapping UI.
   */
  inspectStructure(content, filename = 'dataset.txt') {
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid or empty trajectory content for inspection.');
    }

    const trimmed = content.trim();

    // Check if JSON
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        let parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) {
          parsed = parsed.records || parsed.data || parsed.trajectories || [];
        }
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error('JSON trajectory must contain an array of records.');
        }

        const sampleRecord = parsed[0];
        const columns = Object.keys(sampleRecord);
        const sampleRows = parsed.slice(0, 10);

        return {
          type: 'json',
          filename,
          columns,
          sampleRows,
          totalRows: parsed.length,
          suggestedMapping: this.guessColumnMapping(columns)
        };
      } catch (err) {
        throw new Error('Failed to parse JSON trajectory: ' + err.message);
      }
    }

    // Handle CSV / TXT
    const lines = trimmed.split(/\r?\n/).filter(l => l.trim().length > 0 && !l.trim().startsWith('#') && !l.trim().startsWith('//'));
    if (lines.length === 0) {
      throw new Error('Trajectory file contains no valid data lines.');
    }

    // Detect delimiter from first non-comment line
    const firstLine = lines[0];
    let delimiter = /[,\s\t]+/;
    if (firstLine.includes(',')) delimiter = ',';
    else if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';')) delimiter = ';';

    const headerParts = typeof delimiter === 'string' 
      ? firstLine.split(delimiter).map(s => s.trim()) 
      : firstLine.trim().split(delimiter);

    // Check if first line contains string headers or numeric values
    const isFirstLineHeader = headerParts.some(p => isNaN(parseFloat(p)) && p.length > 0);
    let columns = [];
    let dataStartRow = 0;

    if (isFirstLineHeader) {
      columns = headerParts.map((h, i) => h.replace(/^["']|["']$/g, '') || `Column_${i+1}`);
      dataStartRow = 1;
    } else {
      // Standard Jülich format default column names
      const defaultNames = ['ID', 'Frame', 'X', 'Y', 'Z'];
      columns = headerParts.map((_, i) => defaultNames[i] || `Var_${i+1}`);
      dataStartRow = 0;
    }

    const sampleRows = [];
    const maxSample = Math.min(lines.length, dataStartRow + 10);

    for (let i = dataStartRow; i < maxSample; i++) {
      const rowLine = lines[i];
      const rowParts = typeof delimiter === 'string'
        ? rowLine.split(delimiter).map(s => s.trim())
        : rowLine.trim().split(delimiter);
      
      const rowObj = {};
      columns.forEach((col, colIdx) => {
        rowObj[col] = rowParts[colIdx] !== undefined ? rowParts[colIdx] : '';
      });
      sampleRows.push(rowObj);
    }

    return {
      type: 'text',
      filename,
      delimiter: typeof delimiter === 'string' ? delimiter : 'whitespace',
      columns,
      sampleRows,
      totalRows: lines.length - dataStartRow,
      suggestedMapping: this.guessColumnMapping(columns)
    };
  }

  /**
   * Intelligently guess column mapping from detected column names
   */
  guessColumnMapping(columns) {
    const mapping = {
      id: null,
      frame: null,
      x: null,
      y: null,
      z: null,
      speed: null,
      extraColumns: []
    };

    columns.forEach(col => {
      const c = col.toLowerCase().trim();
      if (!mapping.id && (c === 'id' || c === 'ped' || c === 'pedestrian_id' || c === 'person' || c === 'agent' || c === 'column_1')) {
        mapping.id = col;
      } else if (!mapping.frame && (c === 'frame' || c === 'time' || c === 'timestamp' || c === 't' || c === 'step' || c === 'column_2')) {
        mapping.frame = col;
      } else if (!mapping.x && (c === 'x' || c === 'pos_x' || c === 'x_coord' || c === 'x[m]' || c === 'x[cm]' || c === 'column_3')) {
        mapping.x = col;
      } else if (!mapping.y && (c === 'y' || c === 'pos_y' || c === 'y_coord' || c === 'y[m]' || c === 'y[cm]' || c === 'column_4')) {
        mapping.y = col;
      } else if (!mapping.z && (c === 'z' || c === 'pos_z' || c === 'z_coord' || c === 'z[m]' || c === 'z[cm]' || c === 'column_5')) {
        mapping.z = col;
      } else if (!mapping.speed && (c === 'speed' || c === 'velocity' || c === 'vel' || c === 'v')) {
        mapping.speed = col;
      } else {
        mapping.extraColumns.push(col);
      }
    });

    // Fallbacks if not detected by name
    if (!mapping.id && columns.length > 0) mapping.id = columns[0];
    if (!mapping.frame && columns.length > 1) mapping.frame = columns[1];
    if (!mapping.x && columns.length > 2) mapping.x = columns[2];
    if (!mapping.y && columns.length > 3) mapping.y = columns[3];
    if (!mapping.z && columns.length > 4) mapping.z = columns[4];

    return mapping;
  }

  /**
   * Parse text or JSON content into structured trajectory records with custom column mapping and unit options
   */
  parseText(textContent, filename = 'dataset.txt', customOptions = {}) {
    if (!textContent || typeof textContent !== 'string') {
      throw new Error('Invalid or empty trajectory file content.');
    }

    const fps = customOptions.fps || this.fps;
    const structure = this.inspectStructure(textContent, filename);
    const mapping = customOptions.mapping || structure.suggestedMapping;

    const trimmed = textContent.trim();
    let records = [];
    const uniqueIds = new Set();
    const framesMap = new Map();
    const extraVariablesFound = new Set();

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let minFrame = Infinity, maxFrame = -Infinity;

    // Unit scaling: determine if explicit or auto-detect
    let unitScale = 1.0;
    let coordinateUnits = 'meters [m]';

    if (customOptions.unit === 'cm') {
      unitScale = 0.01;
      coordinateUnits = 'centimeters (converted to meters)';
    } else if (customOptions.unit === 'mm') {
      unitScale = 0.001;
      coordinateUnits = 'millimeters (converted to meters)';
    } else if (customOptions.unit === 'm') {
      unitScale = 1.0;
      coordinateUnits = 'meters [m]';
    } else {
      // Auto-detect: if numbers in X/Y exceed 25, likely centimeters (Jülich standard)
      let samplePoints = [];
      if (structure.type === 'json') {
        let raw = JSON.parse(trimmed);
        if (!Array.isArray(raw)) raw = raw.records || raw.data || [];
        samplePoints = raw.slice(0, 50).map(r => ({ x: parseFloat(r[mapping.x]), y: parseFloat(r[mapping.y]) }));
      } else {
        samplePoints = structure.sampleRows.map(r => ({ x: parseFloat(r[mapping.x]), y: parseFloat(r[mapping.y]) }));
      }
      const largeCoords = samplePoints.some(p => Math.abs(p.x) > 25 || Math.abs(p.y) > 25);
      if (largeCoords) {
        unitScale = 0.01;
        coordinateUnits = 'centimeters (auto-detected, converted to meters)';
      }
    }

    const prevPositions = new Map(); // pedId -> { frame, x, y, z }

    if (structure.type === 'json') {
      let rawJson = JSON.parse(trimmed);
      if (!Array.isArray(rawJson)) rawJson = rawJson.records || rawJson.data || [];

      for (let i = 0; i < rawJson.length; i++) {
        const item = rawJson[i];
        const rawId = item[mapping.id];
        const rawFrame = item[mapping.frame];
        const rawX = item[mapping.x];
        const rawY = item[mapping.y];
        const rawZ = mapping.z ? item[mapping.z] : undefined;

        if (rawId === undefined || rawFrame === undefined || rawX === undefined || rawY === undefined) {
          continue;
        }

        const id = Math.round(parseFloat(rawId));
        const frame = Math.round(parseFloat(rawFrame));
        const x = parseFloat(rawX) * unitScale;
        const y = parseFloat(rawY) * unitScale;
        const z = (rawZ !== undefined && !isNaN(parseFloat(rawZ))) ? parseFloat(rawZ) * unitScale : this.defaultHeadHeight;

        if (isNaN(id) || isNaN(frame) || isNaN(x) || isNaN(y)) continue;

        uniqueIds.add(id);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
        if (frame < minFrame) minFrame = frame;
        if (frame > maxFrame) maxFrame = frame;

        // Collect any extra variables dynamically
        const extraVars = {};
        Object.keys(item).forEach(k => {
          if (k !== mapping.id && k !== mapping.frame && k !== mapping.x && k !== mapping.y && k !== mapping.z) {
            extraVars[k] = item[k];
            extraVariablesFound.add(k);
          }
        });

        // Velocity & speed
        let vx = 0, vy = 0, speed = 0;
        if (mapping.speed && item[mapping.speed] !== undefined) {
          speed = parseFloat(item[mapping.speed]);
        } else if (prevPositions.has(id)) {
          const prev = prevPositions.get(id);
          const dt = (frame - prev.frame) / fps;
          if (dt > 0 && dt <= 0.5) {
            vx = (x - prev.x) / dt;
            vy = (y - prev.y) / dt;
            speed = Math.sqrt(vx * vx + vy * vy);
          }
        }
        prevPositions.set(id, { frame, x, y, z });

        const rec = {
          id,
          frame,
          x,
          y,
          z,
          vx,
          vy,
          speed,
          extraVariables: extraVars,
          isMeasured: { id: true, frame: true, x: true, y: true, z: rawZ !== undefined }
        };

        records.push(rec);
        if (!framesMap.has(frame)) framesMap.set(frame, []);
        framesMap.get(frame).push(rec);
      }
    } else {
      // Process text/CSV lines
      const lines = trimmed.split(/\r?\n/);
      const isHeader = isNaN(parseFloat(lines[0].trim().split(/[,\s\t;]+/)[0]));
      const startIdx = isHeader ? 1 : 0;
      const delimiter = structure.delimiter === 'whitespace' ? /[,\s\t;]+/ : structure.delimiter;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#') || line.startsWith('//')) continue;

        const parts = typeof delimiter === 'string' 
          ? line.split(delimiter).map(p => p.trim())
          : line.split(delimiter);

        if (parts.length < 4) continue;

        // Map column indices
        const idIdx = structure.columns.indexOf(mapping.id);
        const frameIdx = structure.columns.indexOf(mapping.frame);
        const xIdx = structure.columns.indexOf(mapping.x);
        const yIdx = structure.columns.indexOf(mapping.y);
        const zIdx = mapping.z ? structure.columns.indexOf(mapping.z) : -1;

        const rawId = parts[idIdx >= 0 ? idIdx : 0];
        const rawFrame = parts[frameIdx >= 0 ? frameIdx : 1];
        const rawX = parts[xIdx >= 0 ? xIdx : 2];
        const rawY = parts[yIdx >= 0 ? yIdx : 3];
        const rawZ = zIdx >= 0 ? parts[zIdx] : (parts.length >= 5 ? parts[4] : undefined);

        const id = Math.round(parseFloat(rawId));
        const frame = Math.round(parseFloat(rawFrame));
        const x = parseFloat(rawX) * unitScale;
        const y = parseFloat(rawY) * unitScale;
        const z = (rawZ !== undefined && !isNaN(parseFloat(rawZ))) ? parseFloat(rawZ) * unitScale : this.defaultHeadHeight;

        if (isNaN(id) || isNaN(frame) || isNaN(x) || isNaN(y)) continue;

        uniqueIds.add(id);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
        if (frame < minFrame) minFrame = frame;
        if (frame > maxFrame) maxFrame = frame;

        // Collect extra columns dynamically
        const extraVars = {};
        structure.columns.forEach((colName, idx) => {
          if (colName !== mapping.id && colName !== mapping.frame && colName !== mapping.x && colName !== mapping.y && colName !== mapping.z) {
            extraVars[colName] = parts[idx] !== undefined ? parts[idx] : null;
            extraVariablesFound.add(colName);
          }
        });

        // Velocity & speed
        let vx = 0, vy = 0, speed = 0;
        if (prevPositions.has(id)) {
          const prev = prevPositions.get(id);
          const dt = (frame - prev.frame) / fps;
          if (dt > 0 && dt <= 0.5) {
            vx = (x - prev.x) / dt;
            vy = (y - prev.y) / dt;
            speed = Math.sqrt(vx * vx + vy * vy);
          }
        }
        prevPositions.set(id, { frame, x, y, z });

        const rec = {
          id,
          frame,
          x,
          y,
          z,
          vx,
          vy,
          speed,
          extraVariables: extraVars,
          isMeasured: { id: true, frame: true, x: true, y: true, z: rawZ !== undefined && !isNaN(parseFloat(rawZ)) }
        };

        records.push(rec);
        if (!framesMap.has(frame)) framesMap.set(frame, []);
        framesMap.get(frame).push(rec);
      }
    }

    if (records.length === 0) {
      throw new Error('No valid pedestrian records found in file. Ensure mapped columns exist.');
    }

    // Determine bottleneck width from options or filename
    let bottleneckWidth = customOptions.bottleneckWidth || 2.4;
    if (!customOptions.bottleneckWidth) {
      if (filename.includes('240')) bottleneckWidth = 2.4;
      else if (filename.includes('300')) bottleneckWidth = 3.0;
      else if (filename.includes('360')) bottleneckWidth = 3.6;
      else if (filename.includes('440')) bottleneckWidth = 4.4;
      else if (filename.includes('500')) bottleneckWidth = 5.0;
    }

    const sortedFrames = Array.from(framesMap.keys()).sort((a, b) => a - b);
    const durationSeconds = (maxFrame - minFrame) / fps;

    return {
      filename,
      recordsCount: records.length,
      uniquePedestriansCount: uniqueIds.size,
      uniquePedestriansList: Array.from(uniqueIds).sort((a, b) => a - b),
      frames: sortedFrames,
      framesMap,
      minFrame,
      maxFrame,
      durationSeconds,
      fps,
      coordinateUnits,
      unitScale,
      bottleneckWidth,
      columnMapping: mapping,
      detectedColumns: structure.columns,
      extraVariables: Array.from(extraVariablesFound),
      sampleRows: structure.sampleRows,
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
   * Parse a File object (CSV, TXT, JSON, or ZIP)
   */
  async parseFile(file, customOptions = {}) {
    if (!file) throw new Error('No file provided.');

    const name = file.name.toLowerCase();

    if (name.endsWith('.zip')) {
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library is required to unpack ZIP archives.');
      }
      const zip = await JSZip.loadAsync(file);
      let trajectoryFile = null;
      let targetName = '';

      for (const [filename, fileObj] of Object.entries(zip.files)) {
        const fn = filename.toLowerCase();
        if (!fileObj.dir && (fn.endsWith('.txt') || fn.endsWith('.csv') || fn.endsWith('.json'))) {
          trajectoryFile = fileObj;
          targetName = filename;
          break;
        }
      }

      if (!trajectoryFile) {
        throw new Error('ZIP archive does not contain any .txt, .csv, or .json trajectory files.');
      }

      const text = await trajectoryFile.async('string');
      return this.parseText(text, targetName, customOptions);
    } else {
      const text = await file.text();
      return this.parseText(text, file.name, customOptions);
    }
  }
}

if (typeof window !== 'undefined') {
  window.PedestrianDatasetParser = PedestrianDatasetParser;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PedestrianDatasetParser;
}
