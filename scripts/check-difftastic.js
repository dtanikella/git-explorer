/**
 * Check that difftastic >= the minimum version is on PATH.
 * Exits 0 either way (warning, not hard failure).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const requirement = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'lib', 'diff', 'difft-requirement.json'), 'utf8'),
);
const minVer = requirement.minVersion;
const installCmds = requirement.install.join(' or ');

const difftPath = process.env.DIFFT_PATH || 'difft';

try {
  const out = execFileSync(difftPath, ['--version'], { encoding: 'utf8' });
  // Output format: "Difftastic X.Y.Z"
  const match = out.trim().match(/Difftastic\s+(\d+\.\d+\.\d+)/);
  if (!match) {
    console.warn(
      `difftastic >= ${minVer} not found on PATH. Install with: ${installCmds}`,
    );
    process.exit(0);
  }
  const ver = match[1];
  const ok = compareVersions(ver, minVer) >= 0;
  if (!ok) {
    console.warn(
      `difftastic >= ${minVer} not found on PATH. Install with: ${installCmds}`,
    );
  }
} catch {
  console.warn(
    `difftastic >= ${minVer} not found on PATH. Install with: ${installCmds}`,
  );
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}