const express = require('express');
const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 3000;
const CONFIG_FILE = path.join(__dirname, 'config.txt');
const DEVICES_FILE = path.join(__dirname, 'devices.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAdbPath() {
  if (fs.existsSync(CONFIG_FILE)) {
    const saved = fs.readFileSync(CONFIG_FILE, 'utf8').trim();
    if (saved && fs.existsSync(saved)) return saved;
  }
  try {
    const found = execSync('where adb', { encoding: 'utf8' }).trim().split('\n')[0].trim();
    if (found) { saveAdbPath(found); return found; }
  } catch { }
  const def = 'C:\\platform-tools\\adb.exe';
  if (fs.existsSync(def)) { saveAdbPath(def); return def; }
  return null;
}

function saveAdbPath(p) {
  fs.writeFileSync(CONFIG_FILE, p.trim(), 'utf8');
}

function loadSavedDevices() {
  try {
    if (fs.existsSync(DEVICES_FILE)) {
      return JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
    }
  } catch { }
  return [];
}

function writeSavedDevices(devices) {
  fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2), 'utf8');
}

function runAdb(args, serial = null, timeout = 15000) {
  const adb = getAdbPath();
  if (!adb) throw new Error('ADB no configurado');
  const serialFlag = serial ? `-s ${serial}` : '';
  const cmd = `"${adb}" ${serialFlag} ${args}`;
  return execSync(cmd, { encoding: 'utf8', timeout });
}

function tryRunAdb(args, serial = null, fallback = '') {
  try { return runAdb(args, serial); } catch { return fallback; }
}

// ─── API: Status / Config ──────────────────────────────────────────────────────

app.get('/api/status', (req, res) => {
  const adb = getAdbPath();
  res.json({ configured: !!adb, adbPath: adb || null });
});

app.delete('/api/config', (req, res) => {
  try { if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE); } catch { }
  res.json({ ok: true });
});

app.post('/api/config/path', (req, res) => {
  const { path: adbPath } = req.body;
  if (!adbPath || !fs.existsSync(adbPath)) {
    return res.status(400).json({ error: 'Ruta inválida o no existe' });
  }
  saveAdbPath(adbPath);
  res.json({ ok: true, adbPath });
});

app.get('/api/config/download', (req, res) => {
  const zipUrl = 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip';
  const zipPath = path.join(os.tmpdir(), 'platform-tools.zip');
  const destDir = 'C:\\';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (msg, done = false) => res.write(`data: ${JSON.stringify({ msg, done })}\n\n`);

  send('Descargando Android Platform Tools...');
  const dlCmd = `powershell -Command "Invoke-WebRequest -Uri '${zipUrl}' -OutFile '${zipPath}' -UseBasicParsing"`;

  exec(dlCmd, (err) => {
    if (err) { send('❌ Error al descargar: ' + err.message, true); return; }
    send('Descarga completa. Extrayendo...');
    if (fs.existsSync('C:\\platform-tools')) {
      try { execSync('rmdir /s /q "C:\\platform-tools"', { shell: true }); } catch { }
    }
    const extractCmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`;
    exec(extractCmd, (err2) => {
      if (err2 || !fs.existsSync('C:\\platform-tools\\adb.exe')) {
        send('❌ Error al extraer. Intenta manualmente.', true); return;
      }
      saveAdbPath('C:\\platform-tools\\adb.exe');
      try { fs.unlinkSync(zipPath); } catch { }
      send('✅ ADB instalado en C:\\platform-tools', true);
    });
  });
});

// ─── API: Devices ──────────────────────────────────────────────────────────────

app.get('/api/devices', (req, res) => {
  try {
    const out = runAdb('devices');
    const lines = out.split('\n').slice(1);
    const devices = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts[1] === 'device') devices.push({ serial: parts[0], status: parts[1] });
    }
    res.json({ devices });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/devices/:serial/info', (req, res) => {
  const { serial } = req.params;
  try {
    const prop = (key) => { try { return runAdb(`shell getprop ${key}`, serial).trim(); } catch { return 'N/A'; } };
    res.json({
      serial,
      brand: prop('ro.product.manufacturer'),
      model: prop('ro.product.model'),
      android: prop('ro.build.version.release'),
      sdk: prop('ro.build.version.sdk'),
      device: prop('ro.product.device'),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── API: Apps ────────────────────────────────────────────────────────────────

// Returns bare package list (fast)
app.get('/api/devices/:serial/apps', (req, res) => {
  const { serial } = req.params;
  const { type = 'user' } = req.query;
  const flag = type === 'user' ? '-3' : type === 'system' ? '-s' : '';
  try {
    const out = runAdb(`shell pm list packages ${flag}`, serial, 30000);
    const packages = out.split('\n')
      .map(l => l.trim().replace(/^package:/, ''))
      .filter(Boolean)
      .sort();
    res.json({ packages, total: packages.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Returns enriched info for ONE package (name, format, size, paths)
app.get('/api/devices/:serial/apps/:package/info', (req, res) => {
  const { serial, package: pkg } = req.params;
  try {
    const dump = tryRunAdb(`shell dumpsys package ${pkg}`, serial);

    const extract = (pattern) => { const m = dump.match(pattern); return m ? m[1].trim() : 'N/A'; };
    const versionName = extract(/versionName=([^\s\n]+)/);
    const versionCode = extract(/versionCode=(\d+)/);
    const firstInstall = extract(/firstInstallTime=([^\n]+)/);
    const lastUpdate = extract(/lastUpdateTime=([^\n]+)/);
    const installer = extract(/installerPackageName=([^\s\n]+)/);

    // Try to get human-readable label via aapt/aapt2 (fallback to pkg name)
    // Note: aapt is not always available, so we try pm dump instead
    let appName = 'N/A';
    const labelMatch = dump.match(/label="([^"]+)"/);
    if (labelMatch) appName = labelMatch[1];

    // APK path(s)
    const pathOut = tryRunAdb(`shell pm path ${pkg}`, serial);
    const paths = pathOut.split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean);

    const isSplit = paths.length > 1;
    const format = paths.length === 0 ? 'N/A' : isSplit ? 'Split APK' : 'APK';

    // Size: sum of individual APK sizes from the device
    let totalSizeBytes = 0;
    for (const p of paths) {
      try {
        const szOut = runAdb(`shell stat -c "%s" "${p}"`, serial, 5000).trim();
        const sz = parseInt(szOut, 10);
        if (!isNaN(sz)) totalSizeBytes += sz;
      } catch { }
    }
    const sizeMB = totalSizeBytes > 0 ? (totalSizeBytes / 1048576).toFixed(1) + ' MB' : 'N/A';
    const sizeBytes = totalSizeBytes;

    res.json({ pkg, appName, versionName, versionCode, firstInstall, lastUpdate, installer, apkPaths: paths, isSplit, format, sizeMB, sizeBytes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Batch lightweight info for app list (format + size per package)
app.post('/api/devices/:serial/apps/batch-info', (req, res) => {
  const { serial } = req.params;
  const { packages } = req.body; // array of pkg strings
  if (!Array.isArray(packages)) return res.status(400).json({ error: 'packages must be array' });

  const results = {};
  for (const pkg of packages) {
    try {
      const pathOut = tryRunAdb(`shell pm path ${pkg}`, serial);
      const paths = pathOut.split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean);
      const isSplit = paths.length > 1;
      const format = paths.length === 0 ? 'N/A' : isSplit ? 'Split APK' : 'APK';

      let totalSize = 0;
      for (const p of paths) {
        try {
          const sz = parseInt(runAdb(`shell stat -c "%s" "${p}"`, serial, 5000).trim(), 10);
          if (!isNaN(sz)) totalSize += sz;
        } catch { }
      }
      const sizeMB = totalSize > 0 ? (totalSize / 1048576).toFixed(1) + ' MB' : 'N/A';

      // App name: try nonLocalizedLabel from dumpsys
      let appName = null;
      try {
        const dump = tryRunAdb(`shell dumpsys package ${pkg}`, serial);
        const m = dump.match(/nonLocalizedLabel=([^\s\n\r]+)/);
        if (m && m[1] && m[1] !== 'null') appName = m[1].replace(/"/g, '');
        if (!appName) { const lm = dump.match(/label="([^"]+)"/); if (lm) appName = lm[1]; }
      } catch { }
      if (!appName) {
        const seg = pkg.split('.').pop() || pkg;
        appName = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/([A-Z])/g, ' $1').trim();
      }

      results[pkg] = { format, isSplit, sizeMB, appName };
    } catch {
      const seg = pkg.split('.').pop() || pkg;
      results[pkg] = {
        format: 'N/A', isSplit: false, sizeMB: 'N/A',
        appName: seg.charAt(0).toUpperCase() + seg.slice(1)
      };
    }
  }
  res.json({ results });
});

// ─── API: Extract APK ─────────────────────────────────────────────────────────

app.post('/api/devices/:serial/apps/:package/extract', (req, res) => {
  const { serial, package: pkg } = req.params;
  try {
    const pathOut = tryRunAdb(`shell pm path ${pkg}`, serial);
    const paths = pathOut.split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean);

    if (paths.length === 0) return res.status(400).json({ error: 'No se pudo obtener la ruta del APK.' });
    if (paths.length > 1) {
      return res.status(400).json({
        error: 'Split APK / XAPK detectado',
        detail: `Esta app tiene ${paths.length} archivos APK separados y no puede exportarse como un único .apk.`,
        paths, isSplit: true
      });
    }

    const devicePath = paths[0];
    const outDir = path.join(os.tmpdir(), 'apk-extractor');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `${pkg}.apk`);

    runAdb(`pull "${devicePath}" "${outFile}"`, serial, 60000);

    if (!fs.existsSync(outFile)) {
      return res.status(500).json({ error: 'La extracción falló. El APK podría estar protegido.' });
    }

    const stat = fs.statSync(outFile);
    res.setHeader('Content-Disposition', `attachment; filename="${pkg}.apk"`);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Length', stat.size);
    const stream = fs.createReadStream(outFile);
    stream.pipe(res);
    stream.on('close', () => { try { fs.unlinkSync(outFile); } catch { } });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── API: Compile XAPK ────────────────────────────────────────────────────────

app.get('/api/devices/:serial/apps/:package/compile-xapk', (req, res) => {
  const { serial, package: pkg } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (msg, progress = null) => res.write(`data: ${JSON.stringify({ msg, progress })}\n\n`);
  const done = (ok, xapkPath = null, err = null) => {
    res.write(`data: ${JSON.stringify({ done: true, ok, xapkPath, err })}\n\n`);
    res.end();
  };

  send('Obteniendo rutas del APK en el dispositivo...', 5);

  let paths;
  try {
    const pathOut = runAdb(`shell pm path ${pkg}`, serial);
    paths = pathOut.split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean);
  } catch (e) { done(false, null, 'No se pudo obtener la ruta: ' + e.message); return; }

  if (paths.length < 2) {
    done(false, null, 'Esta app no es un Split APK. Usa "Extraer APK" en su lugar.');
    return;
  }

  send(`Encontrados ${paths.length} archivos APK. Extrayendo...`, 10);

  // Create temp working dir
  const tmpDir = path.join(os.tmpdir(), `xapk_${pkg}_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  // Pull each APK
  let pulled = 0;
  for (const p of paths) {
    const fname = path.basename(p).replace(/\r/g, '');
    const localPath = path.join(tmpDir, fname || `split_${pulled}.apk`);
    try {
      runAdb(`pull "${p.trim()}" "${localPath}"`, serial, 120000);
      pulled++;
      send(`Extraído ${pulled}/${paths.length}: ${fname}`, 10 + Math.floor((pulled / paths.length) * 50));
    } catch (e) {
      send(`⚠ Error extrayendo ${fname}: ${e.message}`);
    }
  }

  if (pulled === 0) { done(false, null, 'No se pudo extraer ningún APK del dispositivo.'); return; }

  send('Obteniendo información del paquete...', 65);

  // Get package info for manifest
  const dump = tryRunAdb(`shell dumpsys package ${pkg}`, serial);
  const extr = (re) => { const m = dump.match(re); return m ? m[1].trim() : '1'; };
  const versionName = extr(/versionName=([^\s\n]+)/) || '1.0';
  const versionCode = extr(/versionCode=(\d+)/) || '1';
  const minSdk = extr(/minSdk=(\d+)/) || '21';

  send('Creando manifest.json...', 70);

  // Build split_apks list from pulled files
  const pulledFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.apk'));
  const splitApks = pulledFiles.map(f => ({ file: f, id: f.replace('.apk', '') }));

  const manifest = {
    xapk_version: 2,
    package_name: pkg,
    name: pkg,
    version_code: versionCode,
    version_name: versionName,
    min_sdk_version: minSdk,
    target_sdk_version: '34',
    split_apks: splitApks,
    expansions: []
  };
  fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  send('Empaquetando XAPK...', 80);

  const xapkPath = path.join(os.tmpdir(), `${pkg}.xapk`);
  const zipPath = xapkPath + '.zip';

  const zipCmd = `powershell -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${zipPath}' -Force"`;
  exec(zipCmd, (err) => {
    if (err || !fs.existsSync(zipPath)) {
      // Cleanup
      try { fs.rmSync(tmpDir, { recursive: true }); } catch { }
      done(false, null, 'Error al comprimir el XAPK: ' + (err?.message || 'desconocido'));
      return;
    }

    // Rename .zip -> .xapk
    try { if (fs.existsSync(xapkPath)) fs.unlinkSync(xapkPath); } catch { }
    fs.renameSync(zipPath, xapkPath);

    // Cleanup temp dir
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { }

    send('XAPK listo. Descargando...', 95);

    // Stream the XAPK to client
    const stat = fs.statSync(xapkPath);
    // Signal client to expect file
    res.write(`data: ${JSON.stringify({ done: true, ok: true, fileReady: true, size: stat.size })}\n\n`);
    res.end();
  });
});

// Serve compiled XAPK for download
app.get('/api/devices/:serial/apps/:package/download-xapk', (req, res) => {
  const { package: pkg } = req.params;
  const xapkPath = path.join(os.tmpdir(), `${pkg}.xapk`);
  if (!fs.existsSync(xapkPath)) {
    return res.status(404).json({ error: 'XAPK no encontrado. Vuelve a compilar.' });
  }
  const stat = fs.statSync(xapkPath);
  res.setHeader('Content-Disposition', `attachment; filename="${pkg}.xapk"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  const stream = fs.createReadStream(xapkPath);
  stream.pipe(res);
  stream.on('close', () => { try { fs.unlinkSync(xapkPath); } catch { } });
});

// ─── API: Network Info ────────────────────────────────────────────────────────

app.get('/api/network/ip', (req, res) => {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ name, address: iface.address });
      }
    }
  }
  res.json({ addresses });
});

// ─── API: ADB Wireless Pairing ───────────────────────────────────────────────

app.post('/api/adb/pair', (req, res) => {
  const { ip, port, code } = req.body;
  if (!ip || !port || !code) return res.status(400).json({ error: 'Faltan campos requeridos' });
  try {
    const result = runAdb(`pair ${ip}:${port} ${code}`, null, 30000);
    const success = result.toLowerCase().includes('success');
    res.json({ ok: success, output: result.trim() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/adb/connect', (req, res) => {
  const { ip, port, label } = req.body;
  if (!ip || !port) return res.status(400).json({ error: 'Faltan campos requeridos' });
  try {
    const result = runAdb(`connect ${ip}:${port}`, null, 15000);
    const success = result.toLowerCase().includes('connected');
    if (success) {
      // Auto-save device on successful connection
      const devices = loadSavedDevices();
      const existing = devices.find(d => d.ip === ip);
      if (existing) {
        existing.port = port;
        existing.lastConnected = new Date().toISOString();
        if (label) existing.label = label;
      } else {
        // Try to get device brand/model for label
        let autoLabel = label || `${ip}:${port}`;
        try {
          const serial = `${ip}:${port}`;
          const brand = runAdb('shell getprop ro.product.manufacturer', serial, 5000).trim();
          const model = runAdb('shell getprop ro.product.model', serial, 5000).trim();
          if (brand && model && brand !== 'N/A') autoLabel = `${brand} ${model}`;
        } catch { }
        devices.push({
          id: Date.now().toString(),
          label: autoLabel,
          ip,
          port,
          lastConnected: new Date().toISOString(),
        });
      }
      writeSavedDevices(devices);
    }
    res.json({ ok: success, output: result.trim() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── API: Saved Devices ──────────────────────────────────────────────────────

app.get('/api/saved-devices', (req, res) => {
  res.json({ devices: loadSavedDevices() });
});

app.post('/api/saved-devices', (req, res) => {
  const { label, ip, port } = req.body;
  if (!ip || !port) return res.status(400).json({ error: 'IP y puerto son requeridos' });
  const devices = loadSavedDevices();
  const existing = devices.find(d => d.ip === ip && d.port === port);
  if (existing) {
    if (label) existing.label = label;
    existing.lastConnected = new Date().toISOString();
  } else {
    devices.push({
      id: Date.now().toString(),
      label: label || `${ip}:${port}`,
      ip,
      port,
      lastConnected: new Date().toISOString(),
    });
  }
  writeSavedDevices(devices);
  res.json({ ok: true });
});

app.delete('/api/saved-devices/:id', (req, res) => {
  const { id } = req.params;
  let devices = loadSavedDevices();
  devices = devices.filter(d => d.id !== id);
  writeSavedDevices(devices);
  res.json({ ok: true });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  APK Extractor corriendo en http://localhost:${PORT}\n`);
});
