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

function searchableSelect({ message, options }) {
  return new Promise((resolve) => {
    const input = process.stdin;
    const output = process.stdout;
    const state = {
      selected: 0,
      query: '',
      searching: false,
      renderedLines: 0
    };

    readline.emitKeypressEvents(input);

    const wasRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    output.write('\x1b[?25l');

    const cleanup = (value) => {
      clearPrompt(output, state.renderedLines);
      output.write('\x1b[?25h');
      input.setRawMode(wasRaw);
      input.off('keypress', onKeypress);
      resolve(value);
    };

    const onKeypress = (chunk, key = {}) => {
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
    searchLine(state)
  ];

  if (filtered.length === 0) {
    lines.push(`    ${paint('No matches', 'dim')}`);
  } else {
    visibleOptions(filtered, state.selected).forEach((option, visibleIndex) => {
      const index = option.index;
      const marker = index === state.selected ? paint('>', 'accent') : ' ';
      const label = index === state.selected ? style(option.label, 'white', 'bold') : option.label;
      const hint = option.hint ? ` ${paint(option.hint, 'dim')}` : '';

      lines.push(`  ${marker} ${label}${hint}`);

      if (visibleIndex === 0 && option.index > 0) {
        lines.splice(lines.length - 1, 0, `    ${paint('...', 'dim')}`);
      }
    });

    if (state.selected < filtered.length - 8) {
      lines.push(`    ${paint('...', 'dim')}`);
    }
  }

  output.write(`${lines.join('\n')}\n`);
  state.renderedLines = lines.reduce((count, lineValue) => count + Math.max(1, Math.ceil(visibleLength(lineValue) / terminalWidth())), 0);
}

function searchLine(state) {
  if (state.searching) {
    return `  ${paint('/', 'accent')} ${state.query || paint('type to search', 'dim')}`;
  }

  return `    ${paint('Press / to search, Enter to choose, Esc to cancel', 'dim')}`;
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

function visibleOptions(options, selected) {
  const start = Math.max(0, Math.min(selected - 3, options.length - 8));
  return options.slice(start, start + 8).map((option, index) => ({
    ...option,
    index: start + index
  }));
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

module.exports = { selectOption };
