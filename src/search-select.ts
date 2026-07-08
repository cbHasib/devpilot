'use strict';

const readline = require('readline');

const clack = require('@clack/prompts');

const { paint, style, visibleLength } = require('./ui');

async function selectOption(options) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return clack.select(options);
  }

  return searchableSelect(options);
}

function searchableSelect({ message, options, visibleLimit }) {
  return new Promise((resolve) => {
    const input = process.stdin;
    const output = process.stdout;
    const state = {
      selected: 0,
      query: '',
      searching: false,
      visibleLimit,
      renderedLines: 0
    };

    readline.emitKeypressEvents(input);

    const wasRaw = input.isRaw;
    const wasPaused = typeof input.isPaused === 'function' ? input.isPaused() : false;
    let cleaned = false;

    input.setRawMode(true);
    input.resume();
    output.write('\x1b[?25l');

    const cleanup = (value) => {
      if (cleaned) {
        return;
      }

      cleaned = true;
      clearPrompt(output, state.renderedLines);
      output.write('\x1b[?25h');
      input.off('keypress', onKeypress);
      input.setRawMode(Boolean(wasRaw));

      if (wasPaused) {
        input.pause();
      }

      resolve(value);
    };

    const onKeypress = (chunk, key: any = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup(null);
        return;
      }

      if (key.name === 'return') {
        const filtered = filteredOptions(options, state.query);
        cleanup(filtered[state.selected] ? filtered[state.selected].value : null);
        return;
      }

      if (key.name === 'escape') {
        if (state.searching || state.query) {
          state.searching = false;
          state.query = '';
          state.selected = 0;
          render(output, state, message, options);
          return;
        }

        cleanup(null);
        return;
      }

      if (!state.searching) {
        const shortcut = matchingShortcut(options, chunk, key);

        if (shortcut) {
          cleanup(shortcut.value);
          return;
        }
      }

      if (key.name === 'down') {
        moveSelection(state, options, 1);
        render(output, state, message, options);
        return;
      }

      if (key.name === 'up') {
        moveSelection(state, options, -1);
        render(output, state, message, options);
        return;
      }

      if (key.name === 'backspace' && state.searching) {
        state.query = state.query.slice(0, -1);
        state.selected = 0;
        render(output, state, message, options);
        return;
      }

      if (chunk === '/') {
        state.searching = true;
        state.query = '';
        state.selected = 0;
        render(output, state, message, options);
        return;
      }

      if (state.searching && chunk && chunk >= ' ' && chunk !== '\x7f') {
        state.query += chunk;
        state.selected = 0;
        render(output, state, message, options);
      }
    };

    input.on('keypress', onKeypress);
    render(output, state, message, options);
  });
}

function render(output, state, message, options) {
  clearPrompt(output, state.renderedLines);

  const filtered = filteredOptions(options, state.query);
  const lines = [
    `  ${paint('?', 'accent')} ${style(message, 'white', 'bold')}`,
    searchLine(state, options)
  ];

  if (filtered.length === 0) {
    lines.push(`    ${paint('No matches', 'dim')}`);
  } else {
    const visible = visibleOptions(filtered, state.selected, optionLimit(filtered.length, state.visibleLimit));
    const firstIndex = visible[0] ? visible[0].index : 0;

    if (firstIndex > 0) {
      lines.push(`    ${paint(`↑ ${firstIndex} more`, 'dim')}`);
    }

    visible.forEach((option) => {
      const index = option.index;
      const marker = index === state.selected ? paint('>', 'accent') : ' ';
      const shortcut = option.shortcut ? `${paint(String(option.shortcut).toUpperCase(), 'cyan')} ${paint('·', 'gray')} ` : '';
      const label = index === state.selected ? style(option.label, 'white', 'bold') : option.label;
      const hint = option.hint ? ` ${paint(option.hint, 'dim')}` : '';

      lines.push(`  ${marker} ${shortcut}${label}${hint}`);
    });

    const remaining = filtered.length - firstIndex - visible.length;

    if (remaining > 0) {
      lines.push(`    ${paint(`↓ ${remaining} more`, 'dim')}`);
    }
  }

  output.write(`${lines.join('\n')}\n`);
  state.renderedLines = lines.reduce((count, lineValue) => count + Math.max(1, Math.ceil(visibleLength(lineValue) / terminalWidth())), 0);
}

function searchLine(state, options) {
  if (state.searching) {
    return `  ${paint('/', 'accent')} ${state.query || paint('type to search', 'dim')}`;
  }

  const shortcuts = shortcutHelp(options);
  const shortcutText = shortcuts ? `, ${shortcuts}` : '';

  return `    ${paint(`Press / to search${shortcutText}, Enter to choose, Esc to cancel`, 'dim')}`;
}

function filteredOptions(options, query) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return options;
  }

  return options.filter((option) => {
    const text = `${option.label || ''} ${option.hint || ''}`.toLowerCase();
    return text.includes(normalized);
  });
}

function visibleOptions(options, selected, limit) {
  const start = Math.max(0, Math.min(selected - Math.floor(limit / 2), options.length - limit));

  return options.slice(start, start + limit).map((option, index) => ({
    ...option,
    index: start + index
  }));
}

function optionLimit(total, requested) {
  if (total <= 0) {
    return 0;
  }

  const explicit = Number.isInteger(requested) && requested > 0 ? requested : null;
  const availableRows = Math.max(8, Math.min(16, terminalHeight() - 7));

  return Math.max(1, Math.min(total, explicit || availableRows));
}

function matchingShortcut(options, chunk, key: any = {}) {
  if (key.ctrl || key.meta) {
    return null;
  }

  const value = shortcutKey(chunk, key);

  if (!value) {
    return null;
  }

  return options.find((option) => String(option.shortcut || '').toLowerCase() === value) || null;
}

function shortcutKey(chunk, key: any = {}) {
  if (key.name && key.name.length === 1) {
    return key.name.toLowerCase();
  }

  if (chunk && chunk.length === 1 && chunk >= ' ') {
    return chunk.toLowerCase();
  }

  return null;
}

function shortcutHelp(options) {
  const shortcuts = options
    .filter((option) => option.shortcut)
    .map((option) => `${String(option.shortcut).toUpperCase()} ${option.shortcutLabel || option.label}`);

  return shortcuts.join(', ');
}

function moveSelection(state, options, direction) {
  const filtered = filteredOptions(options, state.query);

  if (filtered.length === 0) {
    state.selected = 0;
    return;
  }

  state.selected = (state.selected + direction + filtered.length) % filtered.length;
}

function clearPrompt(output, lines) {
  if (!lines) {
    return;
  }

  readline.moveCursor(output, 0, -lines);
  readline.clearScreenDown(output);
}

function terminalWidth() {
  return Math.max(20, process.stdout.columns || 80);
}

function terminalHeight() {
  return Math.max(12, process.stdout.rows || 24);
}

module.exports = { selectOption };
