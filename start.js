const { spawn, execSync } = require('child_process');

const PYTHON = 'C:\\Users\\Lenovo\\.workbuddy\\binaries\\python\\versions\\3.13.12\\python.exe';
const NODE = 'C:\\Users\\Lenovo\\.workbuddy\\binaries\\node\\versions\\22.22.2-2\\node.exe';
const HISTMAP = 'D:\\AI WorkSpace\\WorkBuddy\\HistMap';
const ADMIN = 'D:\\AI WorkSpace\\WorkBuddy\\HistMap\\admin';

const PORT_MAP = 8080;
const PORT_ADMIN = 3001;

console.log('========================================');
console.log('  HistMap Launcher');
console.log('========================================\n');

// ---- Kill any process occupying a port before starting ----
function killPort(port) {
  try {
    const out = execSync('netstat -ano', { shell: 'cmd.exe', encoding: 'utf-8' });
    const pids = new Set();
    out.split('\n').forEach(function (line) {
      if (line.indexOf('LISTENING') === -1) return;
      var cols = line.trim().split(/\s+/);
      if (cols.length < 5) return;
      // cols: [Proto, LocalAddr, RemoteAddr, State, PID]
      var m = cols[1].match(/:(\d+)$/);   // exact local port match
      if (m && parseInt(m[1], 10) === port) pids.add(cols[4]);
    });
    pids.forEach(function (pid) {
      if (pid && pid !== '0' && parseInt(pid, 10) !== process.pid) {
        try {
          execSync('taskkill /PID ' + pid + ' /F', { shell: 'cmd.exe', stdio: 'ignore' });
          console.log('  Killed stale PID ' + pid + ' on port ' + port);
        } catch (e) { /* already gone */ }
      }
    });
  } catch (e) { /* netstat failed, skip */ }
}

console.log('Cleaning up stale processes...');
killPort(PORT_MAP);
killPort(PORT_ADMIN);
console.log('');

// ---- Spawn a service with auto-restart ----
var mapProc = null;
var adminProc = null;
var shuttingDown = false;

function spawnMap() {
  mapProc = spawn(PYTHON, ['-m', 'http.server', String(PORT_MAP)], {
    cwd: HISTMAP, shell: false, stdio: 'ignore'
  });
  console.log('[Map]   http://localhost:' + PORT_MAP + '  (PID: ' + mapProc.pid + ')');

  mapProc.on('exit', function (code) {
    if (shuttingDown) return;
    console.log('[Map]   Process exited (code ' + code + '), restarting in 1s...');
    setTimeout(function () { killPort(PORT_MAP); spawnMap(); }, 1000);
  });
}

function spawnAdmin() {
  adminProc = spawn(NODE, ['server.js'], {
    cwd: ADMIN, shell: false, stdio: 'ignore'
  });
  console.log('[Admin] http://localhost:' + PORT_ADMIN + '  (PID: ' + adminProc.pid + ')');

  adminProc.on('exit', function (code) {
    if (shuttingDown) return;
    console.log('[Admin] Process exited (code ' + code + '), restarting in 1s...');
    setTimeout(function () { killPort(PORT_ADMIN); spawnAdmin(); }, 1000);
  });
}

spawnMap();
spawnAdmin();

// ---- Open browser after 2s ----
setTimeout(function () {
  spawn('cmd', ['/c', 'start', 'http://localhost:' + PORT_MAP], { shell: true, stdio: 'ignore' });
  spawn('cmd', ['/c', 'start', 'http://localhost:' + PORT_ADMIN], { shell: true, stdio: 'ignore' });
  console.log('\nBrowser opened.');
  console.log('\n========================================');
  console.log('  Press Ctrl+C to stop all services.');
  console.log('  Services auto-restart on crash.');
  console.log('========================================\n');
}, 2000);

// ---- Cleanup ----
function killAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nStopping all services...');
  [
    [mapProc, PORT_MAP],
    [adminProc, PORT_ADMIN]
  ].forEach(function (pair) {
    if (pair[0]) {
      try { process.kill(pair[0].pid); } catch (e) {}
      spawn('taskkill', ['/pid', pair[0].pid, '/f', '/t'], { shell: true, stdio: 'ignore' });
    }
    killPort(pair[1]);
  });
  process.exit(0);
}

process.on('SIGINT', killAll);
process.on('SIGBREAK', killAll);
process.on('SIGHUP', killAll);
process.on('exit', function () {
  try { if (mapProc) process.kill(mapProc.pid); } catch (e) {}
  try { if (adminProc) process.kill(adminProc.pid); } catch (e) {}
});
