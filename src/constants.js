'use strict';

const CONFIG_FILE = '.devpilot.json';
const STATE_DIR = '.devpilot';
const ALIAS_MARKER = 'DevPilot generated alias';

// Palette used to give each service a distinct terminal tab color when the
// service does not define its own `color`. Cycled through by service index.
const TAB_COLORS = [
  '#2563eb',
  '#16a34a',
  '#db2777',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#dc2626',
  '#4b5563'
];

module.exports = { CONFIG_FILE, STATE_DIR, ALIAS_MARKER, TAB_COLORS };
