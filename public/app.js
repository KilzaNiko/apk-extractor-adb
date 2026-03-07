/* ─── State ──────────────────────────────────────────────────── */
let state = {
    adbPath: null,
    currentSerial: null,
    currentDeviceInfo: null,
    apps: [],           // [{pkg, name, format, sizeMB, isSplit}]
    filteredApps: [],
    currentFilter: 'user',
    currentPkg: null,
    currentPkgInfo: null,
    batchInfoLoading: false,
};

/* ─── Init ───────────────────────────────────────────────────── */
async function init() {
    // Restore saved theme immediately
    const savedTheme = localStorage.getItem('apk-theme') || 'dark';
    applyTheme(savedTheme);

    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.configured) {
            state.adbPath = data.adbPath;
            showMainApp();
            setupLogsStream();
        } else {
            showSetupOptions();
        }
    } catch {
        showSetupOptions();
    }
}

function showSetupOptions() {
    hide('setup-checking');
    show('setup-options');
}

function showMainApp() {
    document.getElementById('adb-path-label').textContent = state.adbPath;
    document.getElementById('screen-setup').classList.add('hidden');
    document.getElementById('screen-main').classList.remove('hidden');
    loadDevices();
    loadSavedDevicesBadge();
    startDevicePolling();
}

let knownSerials = [];
let pollTimer = null;

function startDevicePolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(pollDevices, 4000);
}

async function pollDevices() {
    try {
        const res = await fetch('/api/devices/poll');
        const data = await res.json();
        if (!res.ok) return;
        const current = (data.serials || []).sort().join('|');
        const known = knownSerials.sort().join('|');
        if (current !== known) {
            knownSerials = data.serials || [];
            loadDevices();
            // If active device was disconnected, clear the panel
            if (state.currentSerial && !knownSerials.includes(state.currentSerial)) {
                state.currentSerial = null;
                hide('panel-device');
                show('panel-welcome');
                toast('Dispositivo desconectado', 'warning');
            }
        }
    } catch { }
}

async function loadSavedDevicesBadge() {
    try {
        const res = await fetch('/api/saved-devices');
        const data = await res.json();
        const badge = document.getElementById('saved-devices-count');
        if (data.devices && data.devices.length > 0) {
            badge.textContent = data.devices.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch { }
}

/* ─── Setup: Manual Path ─────────────────────────────────────── */
function showPathInput() {
    document.getElementById('path-input-section').classList.toggle('hidden');
}

async function saveAdbPath() {
    const p = document.getElementById('adb-path-input').value.trim();
    if (!p) return toast('Ingresa una ruta válida', 'error');
    try {
        const res = await fetch('/api/config/path', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: p }),
        });
        const data = await res.json();
        if (!res.ok) return toast(data.error || 'Ruta inválida', 'error');
        state.adbPath = data.adbPath;
        showMainApp();
    } catch { toast('Error de conexión', 'error'); }
}

/* ─── Setup: Download ADB ────────────────────────────────────── */
function downloadAdb() {
    hide('setup-options');
    show('setup-downloading');
    const log = document.getElementById('download-log');
    const bar = document.getElementById('progress-bar');
    let progress = 10; bar.style.width = progress + '%';

    const evtSource = new EventSource('/api/config/download');
    evtSource.onmessage = (ev) => {
        const { msg, done } = JSON.parse(ev.data);
        log.innerHTML += `<div>${msg}</div>`;
        log.scrollTop = log.scrollHeight;
        progress = Math.min(progress + 30, 95);
        bar.style.width = progress + '%';
        if (done) {
            evtSource.close();
            bar.style.width = '100%';
            if (msg.startsWith('✅')) {
                setTimeout(async () => {
                    const r = await fetch('/api/status');
                    const d = await r.json();
                    if (d.configured) { state.adbPath = d.adbPath; showMainApp(); }
                }, 800);
            }
        }
    };
    evtSource.onerror = () => { evtSource.close(); log.innerHTML += '<div>❌ Error de conexión</div>'; };
}

/* ─── Devices ────────────────────────────────────────────────── */
async function loadDevices() {
    const sidebar = document.getElementById('device-list-sidebar');
    sidebar.innerHTML = `<div class="nav-btn" style="justify-content:center"><div class="spinner"></div></div>`;
    try {
        const res = await fetch('/api/devices');
        const data = await res.json();
        if (!res.ok) return toast(data.error, 'error');
        knownSerials = data.devices.map(d => d.serial);
        if (data.devices.length === 0) {
            sidebar.innerHTML = `<div style="padding:0.5rem 0.75rem;color:var(--text3);font-size:0.8rem">Sin dispositivos</div>`;
            return;
        }
        sidebar.innerHTML = data.devices.map(d => {
            const wifiIcon = d.wireless ? `<svg viewBox="0 0 20 20" fill="currentColor" width="10" style="color:var(--accent);flex-shrink:0"><path fill-rule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.076 13.308-5.076 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.414-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.414zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>` : '';
            const displayName = d.customName || (d.label !== d.serial ? d.label : d.serial);
            const safeId = encodeURIComponent(d.serial);
            const escapedSerial = d.serial.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const sub = (d.customName || d.label !== d.serial)
                ? `<div style="font-size:0.65rem;color:var(--text3);opacity:0.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.label !== d.serial ? d.label : d.serial}</div>`
                : '';
            return `
      <div class="device-item" id="dev-${safeId}" onclick="selectDevice('${escapedSerial}')">
        <div class="device-dot"></div>
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;gap:4px"><div class="device-serial">${displayName}</div>${wifiIcon}</div>
          ${sub}
        </div>
        <button class="btn-rename-device" onclick="event.stopPropagation();renameDevice('${escapedSerial}','${displayName.replace(/'/g, "\\'")}')" title="Renombrar">
          <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
        </button>
      </div>`;
        }).join('');
        // Also refresh saved devices badge
        loadSavedDevicesBadge();
    } catch {
        sidebar.innerHTML = `<div style="padding:0.5rem 0.75rem;color:var(--red);font-size:0.8rem">Error al conectar</div>`;
    }
}

async function renameDevice(serial, currentName) {
    const name = prompt('Nombre para este dispositivo:', currentName || '');
    if (name === null) return; // cancelled
    try {
        if (name.trim() === '') {
            await fetch(`/api/device-names/${encodeURIComponent(serial)}`, { method: 'DELETE' });
            toast('Nombre eliminado', 'success');
        } else {
            await fetch(`/api/device-names/${encodeURIComponent(serial)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() }),
            });
            toast(`Dispositivo renombrado: ${name.trim()}`, 'success');
        }
        loadDevices();
    } catch { toast('Error al renombrar', 'error'); }
}

async function selectDevice(serial) {
    document.querySelectorAll('.device-item').forEach(el => el.classList.remove('selected'));
    const el = document.getElementById('dev-' + encodeURIComponent(serial));
    if (el) el.classList.add('selected');

    state.currentSerial = serial;
    state.currentFilter = 'user';
    state.apps = [];
    state.filteredApps = [];
    updateFilterBtns();
    hide('panel-welcome'); show('panel-device');

    document.getElementById('device-name').textContent = serial;
    document.getElementById('device-meta').textContent = 'Cargando información...';
    document.getElementById('badge-android').textContent = 'Android –';
    document.getElementById('badge-serial').textContent = serial;

    try {
        const res = await fetch(`/api/devices/${encodeURIComponent(serial)}/info`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        state.currentDeviceInfo = d;
        document.getElementById('device-name').textContent = `${d.brand} ${d.model}`;
        document.getElementById('device-meta').textContent = `Serial: ${d.serial} · ${d.device}`;
        document.getElementById('badge-android').textContent = `Android ${d.android}`;
        document.getElementById('badge-serial').textContent = `API ${d.sdk}`;
        if (el) el.querySelector('.device-serial').textContent = `${d.brand} ${d.model}`;
    } catch { toast('No se pudo obtener info del dispositivo', 'error'); }

    loadApps();
}

/* ─── Apps ───────────────────────────────────────────────────── */
async function loadApps() {
    if (!state.currentSerial) return;
    const container = document.getElementById('app-list-container');
    container.innerHTML = `<div class="empty-state sm"><div class="spinner"></div><p>Cargando aplicaciones...</p></div>`;

    try {
        const res = await fetch(`/api/devices/${encodeURIComponent(state.currentSerial)}/apps?type=${state.currentFilter}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Build initial app list with package name only
        state.apps = data.packages.map(pkg => ({
            pkg,
            name: null,       // loaded lazily
            format: '…',      // loaded in batches
            sizeMB: '…',
            isSplit: null,
        }));
        state.filteredApps = [...state.apps];
        renderApps();

        // Start batch info loading in chunks of 20
        loadBatchInfo(data.packages);
    } catch (e) {
        container.innerHTML = `<div class="empty-state sm"><p style="color:var(--red)">Error: ${e.message}</p></div>`;
    }
}

async function loadBatchInfo(packages) {
    state.batchInfoLoading = true;
    const CHUNK = 20;
    const total = packages.length;

    // ── Show popup ──────────────────────────────────────────────
    const popup = document.getElementById('batch-popup');
    const popupTitle = document.getElementById('batch-popup-title');
    const spinner = document.getElementById('batch-popup-spinner');
    const check = document.getElementById('batch-popup-check');

    popup.classList.remove('hidden', 'done');
    spinner.classList.remove('hidden');
    check.classList.add('hidden');
    popupTitle.textContent = 'Cargando datos…';

    let loaded = 0;

    for (let i = 0; i < packages.length; i += CHUNK) {
        const chunk = packages.slice(i, i + CHUNK);
        try {
            const res = await fetch(`/api/devices/${encodeURIComponent(state.currentSerial)}/apps/batch-info`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packages: chunk }),
            });
            if (!res.ok) break;
            const { results } = await res.json();
            // Merge into state
            for (const app of state.apps) {
                if (results[app.pkg]) {
                    app.format = results[app.pkg].format;
                    app.sizeMB = results[app.pkg].sizeMB;
                    app.isSplit = results[app.pkg].isSplit;
                    app.name = results[app.pkg].appName || null;
                }
            }
            // Re-filter and render
            const q = document.getElementById('app-search').value.toLowerCase();
            state.filteredApps = q
                ? state.apps.filter(a => a.pkg.toLowerCase().includes(q) || (a.name && a.name.toLowerCase().includes(q)))
                : [...state.apps];
            renderApps();

            // ── Update popup progress ────────────────────────────
            loaded = Math.min(i + CHUNK, total);

            // Allow browser to repaint so progress is visible
            await new Promise(r => setTimeout(r, 10));
        } catch { break; }
    }

    // ── Done state ───────────────────────────────────────────────
    state.batchInfoLoading = false;
    popupTitle.textContent = '¡Datos cargados!';
    spinner.classList.add('hidden');
    check.classList.remove('hidden');
    popup.classList.add('done');

    // Auto-hide after 3 s
    setTimeout(() => {
        popup.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        popup.style.opacity = '0';
        popup.style.transform = 'translateX(24px)';
        setTimeout(() => {
            popup.classList.add('hidden');
            popup.style.opacity = '';
            popup.style.transform = '';
            popup.style.transition = '';
        }, 400);
    }, 3000);
}

function switchFilter(type) {
    state.currentFilter = type;
    updateFilterBtns();
    document.getElementById('app-search').value = '';
    loadApps();
}

function updateFilterBtns() {
    ['user', 'all', 'system'].forEach(t => {
        document.getElementById('filter-' + t)?.classList.toggle('active', state.currentFilter === t);
    });
}

function filterApps() {
    const q = document.getElementById('app-search').value.toLowerCase();
    state.filteredApps = q
        ? state.apps.filter(a =>
            a.pkg.toLowerCase().includes(q) ||
            (a.name && a.name.toLowerCase().includes(q)))
        : [...state.apps];
    renderApps();
}

function renderApps() {
    const container = document.getElementById('app-list-container');
    if (state.filteredApps.length === 0) {
        container.innerHTML = `<div class="empty-state sm"><p>No se encontraron aplicaciones</p></div>`;
        return;
    }

    const hues = [260, 200, 140, 30, 0, 300, 170, 50];
    container.innerHTML = `
    <div class="apps-count">${state.filteredApps.length} aplicaciones${state.batchInfoLoading ? ' <span class="badge-loading">cargando info…</span>' : ''}</div>
    <div class="apps-grid">
      ${state.filteredApps.map((app, i) => {
        const letter = app.pkg.split('.').pop()[0]?.toUpperCase() || '?';
        const hue = hues[i % hues.length];
        const isSplit = app.isSplit === true;

        // Display name: real name if loaded, else prettify package
        const displayName = app.name
            ? app.name
            : (() => { const s = app.pkg.split('.').pop() || app.pkg; return s.charAt(0).toUpperCase() + s.slice(1).replace(/([A-Z])/g, ' $1').trim(); })();
        const nameLoading = !app.name; // True until batch returns

        const formatBadge = app.format === '…'
            ? `<span class="fmt-badge loading">…</span>`
            : isSplit
                ? `<span class="fmt-badge split">Split APK</span>`
                : app.format === 'N/A'
                    ? `<span class="fmt-badge na">N/A</span>`
                    : `<span class="fmt-badge apk">APK</span>`;
        const sizeLabel = (app.sizeMB && app.sizeMB !== '…') ? `<span class="app-size">${app.sizeMB}</span>` : '';

        return `
          <div class="app-item" onclick="openAppDetail('${app.pkg}')" style="--hue:${hue}">
            <div class="app-icon">${letter}</div>
            <div class="app-info">
              <div class="app-name${nameLoading ? ' app-name--loading' : ''}">${displayName}</div>
              <div class="app-pkg-row">
                <span class="app-pkg">${app.pkg}</span>
                <button class="btn-copy-pkg" onclick="event.stopPropagation();copyPkg(this,'${app.pkg}')" title="Copiar paquete">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                    <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z"/>
                    <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z"/>
                  </svg>
                  <span>Copiar</span>
                </button>
              </div>
              <div class="app-meta">${formatBadge}${sizeLabel}</div>
            </div>
            <svg class="app-chevron" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
          </div>`;
    }).join('')}
    </div>`;
}

async function copyPkg(btn, pkg) {
    try {
        await navigator.clipboard.writeText(pkg);
        const span = btn.querySelector('span');
        span.textContent = '¡Copiado!';
        setTimeout(() => { span.textContent = 'Copiar'; }, 2000);
    } catch {
        toast('No se pudo copiar', 'error');
    }
}

async function copyPackageName() {
    const pkg = state.currentPkg;
    if (!pkg) return;
    try {
        await navigator.clipboard.writeText(pkg);
        const textEl = document.getElementById('copy-pkg-text');
        textEl.textContent = '¡Copiado!';
        setTimeout(() => { textEl.textContent = 'Copiar'; }, 2000);
    } catch {
        toast('No se pudo copiar', 'error');
    }
}

/* ─── App Detail Modal ───────────────────────────────────────── */
async function openAppDetail(pkg) {
    state.currentPkg = pkg;
    state.currentPkgInfo = null;

    document.getElementById('modal-pkg-name').textContent = pkg;
    document.getElementById('modal-meta').textContent = 'Cargando detalles...';
    document.getElementById('modal-info-grid').innerHTML = '';
    hide('modal-split-warning');
    hide('modal-content');
    hide('extract-progress');
    hide('xapk-progress');
    show('modal-loading');
    const extractBtn = document.getElementById('btn-extract');
    extractBtn.disabled = false;
    extractBtn.style.opacity = '1';
    show('modal-actions');

    show('modal-overlay');

    try {
        const res = await fetch(`/api/devices/${encodeURIComponent(state.currentSerial)}/apps/${encodeURIComponent(pkg)}/info`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        state.currentPkgInfo = d;

        document.getElementById('modal-pkg-name').textContent = d.appName !== 'N/A' ? `${d.appName}` : pkg;
        document.getElementById('modal-meta').textContent = `${pkg}`;

        const grid = document.getElementById('modal-info-grid');
        grid.innerHTML =
            infoItem('Versión', d.versionName) +
            infoItem('Build', d.versionCode, true) +
            infoItem('Formato', `<span class="fmt-badge ${d.isSplit ? 'split' : 'apk'} inline">${d.format}</span>`) +
            infoItem('Tamaño', d.sizeMB) +
            infoItem('Instalado', d.firstInstall !== 'N/A' ? d.firstInstall.slice(0, 10) : 'N/A') +
            infoItem('Actualizado', d.lastUpdate !== 'N/A' ? d.lastUpdate.slice(0, 10) : 'N/A') +
            (d.apkPaths.length > 0 ? `<div class="info-item" style="grid-column:1/-1"><div class="info-label">Ruta(s) en dispositivo</div>${d.apkPaths.map(p => `<div class="info-value mono small">${p}</div>`).join('')}</div>` : '');

        hide('modal-loading');
        show('modal-content');

        if (d.isSplit) {
            document.getElementById('modal-split-detail').textContent =
                `Esta app tiene ${d.apkPaths.length} archivos APK (Split APK / XAPK).`;
            show('modal-split-warning');
            // Swap extract for compile button
            extractBtn.disabled = true;
            extractBtn.style.opacity = '0.4';
            extractBtn.title = 'No disponible para Split APKs';
            show('btn-compile-xapk-wrap');
        } else {
            hide('btn-compile-xapk-wrap');
        }

    } catch (e) {
        hide('modal-loading');
        document.getElementById('modal-meta').textContent = 'Error al cargar';
        document.getElementById('modal-info-grid').innerHTML =
            `<div style="color:var(--red);font-size:0.85rem;grid-column:1/-1">Error: ${e.message}</div>`;
        show('modal-content');
    }
}

function infoItem(label, value, mono = false) {
    return `<div class="info-item"><div class="info-label">${label}</div><div class="info-value${mono ? ' mono' : ''}">${value}</div></div>`;
}

function closeModal(e) {
    if (e && e.target !== document.getElementById('modal-overlay')) return;
    hide('modal-overlay');
    state.currentPkg = null;
    state.currentPkgInfo = null;
}

/* ─── Extract APK ────────────────────────────────────────────── */
async function extractApk() {
    if (!state.currentPkg || !state.currentSerial) return;
    const btn = document.getElementById('btn-extract');
    btn.disabled = true;
    hide('modal-actions');
    show('extract-progress');

    try {
        const res = await fetch(
            `/api/devices/${encodeURIComponent(state.currentSerial)}/apps/${encodeURIComponent(state.currentPkg)}/extract`,
            { method: 'POST' }
        );
        if (!res.ok) {
            const err = await res.json();
            if (err.isSplit) { document.getElementById('modal-split-detail').textContent = err.detail; show('modal-split-warning'); }
            hide('extract-progress'); show('modal-actions'); btn.disabled = false;
            toast(err.error || 'Error al extraer', 'error'); return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${state.currentPkg}.apk`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        hide('extract-progress'); show('modal-actions'); btn.disabled = false;
        toast(`APK extraído: ${state.currentPkg}.apk`, 'success');
    } catch {
        hide('extract-progress'); show('modal-actions'); btn.disabled = false;
        toast('Error de conexión', 'error');
    }
}

/* ─── Compile XAPK ───────────────────────────────────────────── */
async function compileXapk() {
    if (!state.currentPkg || !state.currentSerial) return;

    hide('modal-actions');
    show('xapk-progress');
    const logEl = document.getElementById('xapk-log');
    const barEl = document.getElementById('xapk-bar');
    const lblEl = document.getElementById('xapk-label');
    logEl.innerHTML = '';
    barEl.style.width = '0%';

    const addLog = (msg) => { logEl.innerHTML += `<div>${msg}</div>`; logEl.scrollTop = logEl.scrollHeight; };
    const setBar = (p) => { barEl.style.width = p + '%'; lblEl.textContent = `Compilando XAPK... ${p}%`; };

    const evtSource = new EventSource(
        `/api/devices/${encodeURIComponent(state.currentSerial)}/apps/${encodeURIComponent(state.currentPkg)}/compile-xapk`
    );

    evtSource.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.msg) addLog(data.msg);
        if (data.progress !== null && data.progress !== undefined) setBar(data.progress);

        if (data.done) {
            evtSource.close();
            if (data.ok) {
                setBar(100);
                lblEl.textContent = '¡XAPK listo! Descargando...';
                // Trigger download
                const a = document.createElement('a');
                a.href = `/api/devices/${encodeURIComponent(state.currentSerial)}/apps/${encodeURIComponent(state.currentPkg)}/download-xapk`;
                a.download = `${state.currentPkg}.xapk`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                toast(`XAPK compilado: ${state.currentPkg}.xapk`, 'success');
                setTimeout(() => { hide('xapk-progress'); show('modal-actions'); }, 2000);
            } else {
                addLog(`❌ Error: ${data.err}`);
                toast(data.err || 'Error al compilar XAPK', 'error');
                setTimeout(() => { hide('xapk-progress'); show('modal-actions'); }, 3000);
            }
        }
    };

    evtSource.onerror = () => {
        evtSource.close();
        addLog('❌ Error de conexión con el servidor');
        toast('Error de conexión', 'error');
        setTimeout(() => { hide('xapk-progress'); show('modal-actions'); }, 2000);
    };
}

/* ─── Wireless Debugging ─────────────────────────────────────── */
async function openWirelessModal() {
    show('modal-wireless-overlay');

    // Reset fields and results
    document.getElementById('wireless-pair-ip').value = '';
    document.getElementById('wireless-pair-port').value = '';
    document.getElementById('wireless-pair-code').value = '';
    document.getElementById('wireless-connect-ip').value = '';
    document.getElementById('wireless-connect-port').value = '';
    hide('pair-result');
    hide('connect-result');

    // Load PC IP
    try {
        const res = await fetch('/api/network/ip');
        const data = await res.json();
        const ip = data.addresses.length > 0 ? data.addresses[0].address : 'No disponible';
        document.getElementById('wireless-pc-ip').textContent = ip;
    } catch {
        document.getElementById('wireless-pc-ip').textContent = 'Error al obtener IP';
    }
}

/* ─── Saved Devices (Sidebar) ────────────────────────────────── */
function toggleSavedDevices() {
    const container = document.getElementById('saved-devices-sidebar');
    const isVisible = !container.classList.contains('hidden');
    if (isVisible) {
        container.classList.add('hidden');
    } else {
        container.classList.remove('hidden');
        loadSavedDevicesList();
    }
}

async function loadSavedDevicesList() {
    const container = document.getElementById('saved-devices-sidebar');
    const badge = document.getElementById('saved-devices-count');

    try {
        const res = await fetch('/api/saved-devices');
        const data = await res.json();

        if (!data.devices || data.devices.length === 0) {
            badge.classList.add('hidden');
            container.innerHTML = `<div class="saved-devices-empty">No hay dispositivos guardados</div>`;
            return;
        }

        badge.textContent = data.devices.length;
        badge.classList.remove('hidden');

        container.innerHTML = data.devices.map(d => {
            const lastDate = d.lastConnected ? new Date(d.lastConnected).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
            return `
            <div class="saved-device-card" id="saved-dev-${d.id}">
                <div class="saved-device-info">
                    <div class="saved-device-icon">
                        <svg viewBox="0 0 48 48" fill="none">
                            <rect x="10" y="2" width="28" height="44" rx="5" stroke="currentColor" stroke-width="2.5"/>
                            <circle cx="24" cy="40" r="2" fill="currentColor"/>
                        </svg>
                    </div>
                    <div class="saved-device-text">
                        <div class="saved-device-label">${d.label}</div>
                        <div class="saved-device-addr">${d.ip}:${d.port}</div>
                        ${lastDate ? `<div class="saved-device-date">${lastDate}</div>` : ''}
                    </div>
                </div>
                <div class="saved-device-actions">
                    <button class="btn btn-primary btn-sm saved-device-connect" onclick="reconnectSavedDevice('${d.ip}', '${d.port}', '${d.id}')" title="Conectar">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                    <button class="btn btn-sm saved-device-delete" onclick="deleteSavedDevice('${d.id}')" title="Eliminar">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </div>
            </div>`;
        }).join('');
    } catch {
        container.innerHTML = `<div class="saved-devices-empty">Error al cargar</div>`;
        badge.classList.add('hidden');
    }
}

async function reconnectSavedDevice(ip, port, id) {
    const card = document.getElementById('saved-dev-' + id);
    const connectBtn = card?.querySelector('.saved-device-connect');
    const linkIcon = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd"/></svg>';
    if (connectBtn) {
        connectBtn.disabled = true;
        connectBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div>';
    }

    try {
        const res = await fetch('/api/adb/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, port }),
        });
        const data = await res.json();
        if (data.ok) {
            toast(`Conectado a ${ip}:${port}`, 'success');
            loadDevices();
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>';
                setTimeout(() => { connectBtn.innerHTML = linkIcon; }, 2000);
            }
        } else {
            // Connection failed — open reconnect modal
            if (connectBtn) { connectBtn.disabled = false; connectBtn.innerHTML = linkIcon; }
            openReconnectModal(ip, id, card?.querySelector('.saved-device-label')?.textContent || ip);
        }
    } catch {
        if (connectBtn) { connectBtn.disabled = false; connectBtn.innerHTML = linkIcon; }
        openReconnectModal(ip, id, card?.querySelector('.saved-device-label')?.textContent || ip);
    }
}

/* ─── Reconnect Modal ────────────────────────────────────────── */
let reconnectState = { ip: '', deviceId: '' };

function openReconnectModal(ip, deviceId, label) {
    reconnectState = { ip, deviceId };
    document.getElementById('reconnect-device-label').textContent = label;
    document.getElementById('reconnect-pair-ip').value = ip;
    document.getElementById('reconnect-pair-port').value = '';
    document.getElementById('reconnect-pair-code').value = '';
    document.getElementById('reconnect-connect-ip').value = ip;
    document.getElementById('reconnect-connect-port').value = '';
    hide('reconnect-pair-result');
    hide('reconnect-connect-result');
    show('modal-reconnect-overlay');
}

function closeReconnectModal(e) {
    if (e && e.target !== document.getElementById('modal-reconnect-overlay')) return;
    hide('modal-reconnect-overlay');
}

async function reconnectPairDevice() {
    const ip = reconnectState.ip;
    const port = document.getElementById('reconnect-pair-port').value.trim();
    const code = document.getElementById('reconnect-pair-code').value.trim();
    const resultEl = document.getElementById('reconnect-pair-result');
    const btn = document.getElementById('btn-reconnect-pair');

    if (!port || !code) { showResult(resultEl, 'Ingrese el puerto y el código', false); return; }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Emparejando...';

    try {
        const res = await fetch('/api/adb/pair', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, port, code }),
        });
        const data = await res.json();
        if (data.ok) {
            showResult(resultEl, '✓ Emparejado correctamente. Ahora complete el paso 2.', true);
        } else {
            showResult(resultEl, data.output || data.error || 'Error al emparejar', false);
        }
    } catch {
        showResult(resultEl, 'Error de conexión', false);
    }

    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg> Emparejar';
}

async function reconnectConnectDevice() {
    const ip = reconnectState.ip;
    const port = document.getElementById('reconnect-connect-port').value.trim();
    const resultEl = document.getElementById('reconnect-connect-result');
    const btn = document.getElementById('btn-reconnect-connect');

    if (!port) { showResult(resultEl, 'Ingrese el puerto de conexión', false); return; }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Conectando...';

    try {
        const res = await fetch('/api/adb/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, port }),
        });
        const data = await res.json();
        if (data.ok) {
            showResult(resultEl, '✓ Conectado exitosamente', true);
            toast(`Conectado a ${ip}:${port}`, 'success');
            loadDevices();
            loadSavedDevicesList();
            loadSavedDevicesBadge();
            setTimeout(() => closeReconnectModal(), 1500);
        } else {
            showResult(resultEl, data.output || data.error || 'Error al conectar', false);
        }
    } catch {
        showResult(resultEl, 'Error de conexión', false);
    }

    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd"/></svg> Conectar';
}

function showResult(el, msg, ok) {
    el.classList.remove('hidden');
    el.style.color = ok ? 'var(--green)' : 'var(--red)';
    el.textContent = msg;
}

async function deleteSavedDevice(id) {
    try {
        await fetch(`/api/saved-devices/${id}`, { method: 'DELETE' });
        const card = document.getElementById('saved-dev-' + id);
        if (card) {
            card.style.opacity = '0';
            card.style.transform = 'translateX(20px)';
            card.style.transition = '0.3s ease';
            setTimeout(() => {
                card.remove();
                const container = document.getElementById('saved-devices-sidebar');
                const badge = document.getElementById('saved-devices-count');
                if (container && container.querySelectorAll('.saved-device-card').length === 0) {
                    container.innerHTML = `<div class="saved-devices-empty">No hay dispositivos guardados</div>`;
                    badge.classList.add('hidden');
                } else if (badge) {
                    badge.textContent = container.querySelectorAll('.saved-device-card').length;
                }
            }, 300);
        }
        toast('Dispositivo eliminado', 'success');
    } catch {
        toast('Error al eliminar', 'error');
    }
}

function closeWirelessModal(e) {
    if (e && e.target !== document.getElementById('modal-wireless-overlay')) return;
    hide('modal-wireless-overlay');
}

async function pairDevice() {
    const ip = document.getElementById('wireless-pair-ip').value.trim();
    const port = document.getElementById('wireless-pair-port').value.trim();
    const code = document.getElementById('wireless-pair-code').value.trim();

    if (!ip || !port || !code) return toast('Completá todos los campos de emparejamiento', 'error');

    const btn = document.getElementById('btn-pair');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Emparejando...';

    const resultEl = document.getElementById('pair-result');

    try {
        const res = await fetch('/api/adb/pair', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, port, code }),
        });
        const data = await res.json();

        resultEl.classList.remove('hidden', 'success', 'error');
        if (data.ok) {
            resultEl.classList.add('success');
            resultEl.textContent = '✅ Emparejado exitosamente. Ahora conectá en el paso 2.';
            // Auto-fill the connect IP
            document.getElementById('wireless-connect-ip').value = ip;
            toast('Dispositivo emparejado correctamente', 'success');
        } else {
            resultEl.classList.add('error');
            resultEl.textContent = `❌ ${data.output || data.error || 'Error al emparejar'}`;
        }
    } catch {
        resultEl.classList.remove('hidden', 'success', 'error');
        resultEl.classList.add('error');
        resultEl.textContent = '❌ Error de conexión con el servidor';
    }

    btn.disabled = false;
    btn.innerHTML = originalHTML;
    show('pair-result');
}

async function connectWirelessDevice() {
    const ip = document.getElementById('wireless-connect-ip').value.trim();
    const port = document.getElementById('wireless-connect-port').value.trim();

    if (!ip || !port) return toast('Completá la IP y el puerto de conexión', 'error');

    const btn = document.getElementById('btn-connect-wireless');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Conectando...';

    const resultEl = document.getElementById('connect-result');

    try {
        const res = await fetch('/api/adb/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, port }),
        });
        const data = await res.json();

        resultEl.classList.remove('hidden', 'success', 'error');
        if (data.ok) {
            resultEl.classList.add('success');
            resultEl.textContent = `✅ Conectado a ${ip}:${port}`;
            toast('Dispositivo conectado por WiFi', 'success');
            // Refresh device list and close modal
            setTimeout(() => { loadDevices(); closeWirelessModal(); }, 1500);
        } else {
            resultEl.classList.add('error');
            resultEl.textContent = `❌ ${data.output || data.error || 'No se pudo conectar'}`;
        }
    } catch {
        resultEl.classList.remove('hidden', 'success', 'error');
        resultEl.classList.add('error');
        resultEl.textContent = '❌ Error de conexión con el servidor';
    }

    btn.disabled = false;
    btn.innerHTML = originalHTML;
    show('connect-result');
}

/* ─── Utils ──────────────────────────────────────────────────── */
function showConfirm(title, message, onAccept) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;

    const acceptBtn = document.getElementById('confirm-accept-btn');
    // Remove old listeners by cloning
    const newAcceptBtn = acceptBtn.cloneNode(true);
    acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);

    newAcceptBtn.onclick = () => {
        closeConfirmModal();
        if (onAccept) onAccept();
    };
    show('modal-confirm-overlay');
}

function closeConfirmModal() {
    hide('modal-confirm-overlay');
}

function resetConfig() {
    showConfirm('Reconfigurar ADB', '¿Estás seguro? Se borrará la ruta guardada y tendrás que configurarlo de nuevo.', () => {
        fetch('/api/config', { method: 'DELETE' }).catch(() => { }).finally(() => location.reload());
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';
    const iconDark = document.getElementById('theme-icon-dark');
    const iconLight = document.getElementById('theme-icon-light');
    if (iconDark) iconDark.style.display = isDark ? 'flex' : 'none';
    if (iconLight) iconLight.style.display = !isDark ? 'flex' : 'none';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('apk-theme', next);
    applyTheme(next);
}

function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

function toast(msg, type = 'info', duration = 4000) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`; t.textContent = msg; c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(24px)'; t.style.transition = '0.3s'; setTimeout(() => t.remove(), 300); }, duration);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeWirelessModal(); closeConsoleModal(); }
    if (e.key === 'r' && e.ctrlKey) { e.preventDefault(); loadDevices(); }
});

/* ─── Server Console Logs ────────────────────────────────────── */
let logsEvtSource = null;

function setupLogsStream() {
    if (logsEvtSource) return;
    const term = document.getElementById('server-terminal-content');
    logsEvtSource = new EventSource('/api/logs/stream');

    logsEvtSource.onmessage = (ev) => {
        const entry = JSON.parse(ev.data);
        const time = new Date(entry.ts).toLocaleTimeString('en-US', { hour12: false });

        const div = document.createElement('div');
        div.className = 'log-entry';

        const tsSpan = document.createElement('span');
        tsSpan.className = 'log-ts';
        tsSpan.textContent = `[${time}]`;

        const msgSpan = document.createElement('span');
        msgSpan.className = `log-msg ${entry.type === 'error' ? 'error' : ''}`;
        msgSpan.textContent = entry.msg;

        div.appendChild(tsSpan);
        div.appendChild(msgSpan);
        term.appendChild(div);

        // Auto-scroll logic if near bottom
        if (term.scrollHeight - term.scrollTop < term.clientHeight + 100) {
            term.scrollTop = term.scrollHeight;
        }
    };

    logsEvtSource.onerror = () => {
        logsEvtSource.close();
        logsEvtSource = null;
        setTimeout(setupLogsStream, 5000); // Reconnect attempt
    };
}

function openConsoleModal() {
    show('modal-console-overlay');
    const term = document.getElementById('server-terminal-content');
    term.scrollTop = term.scrollHeight;
}

function closeConsoleModal(e) {
    if (e && e.target !== document.getElementById('modal-console-overlay')) return;
    hide('modal-console-overlay');
}

/* ─── Shutdown Server ────────────────────────────────────────── */
function shutdownServer() {
    showConfirm('Apagar Servidor', '¿Estás seguro de que quieres apagar el servidor local? La aplicación se detendrá y esta ventana ya no mostrará datos actualizados.', async () => {
        try {
            await fetch('/api/shutdown', { method: 'POST' });
        } catch { } // It might fail if the server closes before responding

        document.getElementById('screen-main').classList.add('hidden');
        document.getElementById('screen-setup').classList.add('hidden');
        document.getElementById('screen-offline').classList.remove('hidden');

        if (logsEvtSource) logsEvtSource.close();
        if (pollTimer) clearInterval(pollTimer);
    });
}

init();
