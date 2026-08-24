import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import type { PaneState } from '../shared/types';

// Decoded from `defaults export com.apple.Terminal -` — the "Pro" profile's
// BackgroundColor/TextColor/CursorColor/SelectionColor NSColor archives, plus
// macOS Terminal.app's default (unoverridden) 16-color ANSI palette.
const ANSI_PALETTE = [
  '#000000',
  '#990000',
  '#00A600',
  '#999900',
  '#0000B2',
  '#B200B2',
  '#00A6B2',
  '#BFBFBF',
  '#666666',
  '#E50000',
  '#00D900',
  '#E5E500',
  '#0000FF',
  '#E500E5',
  '#00E5E5',
  '#E5E5E5',
] as const;

export interface PaneCallbacks {
  onRenamePane: (paneId: string, name: string) => void;
}

export interface PaneView {
  el: HTMLElement;
  nameEl: HTMLElement;
  term: Terminal;
  fit: FitAddon;
  pane: PaneState;
}

export const createPaneView = (pane: PaneState, callbacks: PaneCallbacks): PaneView => {
  const el = document.createElement('div');
  el.className = 'pane';
  el.dataset.paneId = pane.id;

  const header = document.createElement('div');
  header.className = 'pane-header';
  const nameEl = document.createElement('span');
  nameEl.className = 'pane-name';
  nameEl.textContent = pane.name;
  header.appendChild(nameEl);
  header.addEventListener('dblclick', () => {
    const name = window.prompt('Rename session', nameEl.textContent ?? '');
    if (name !== null && name.trim() !== '') callbacks.onRenamePane(pane.id, name.trim());
  });
  el.appendChild(header);

  const termEl = document.createElement('div');
  termEl.className = 'pane-term';
  el.appendChild(termEl);

  const term = new Terminal({
    fontFamily: 'Monaco, Menlo, monospace',
    fontSize: 10,
    cursorBlink: false,
    cursorStyle: 'block',
    theme: {
      background: '#000000',
      foreground: '#F2F2F2',
      cursor: '#4D4D4D',
      selectionBackground: '#414141',
      black: ANSI_PALETTE[0],
      red: ANSI_PALETTE[1],
      green: ANSI_PALETTE[2],
      yellow: ANSI_PALETTE[3],
      blue: ANSI_PALETTE[4],
      magenta: ANSI_PALETTE[5],
      cyan: ANSI_PALETTE[6],
      white: ANSI_PALETTE[7],
      brightBlack: ANSI_PALETTE[8],
      brightRed: ANSI_PALETTE[9],
      brightGreen: ANSI_PALETTE[10],
      brightYellow: ANSI_PALETTE[11],
      brightBlue: ANSI_PALETTE[12],
      brightMagenta: ANSI_PALETTE[13],
      brightCyan: ANSI_PALETTE[14],
      brightWhite: ANSI_PALETTE[15],
    },
  });

  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(termEl);
  term.onData((data) => window.grove.sendInput(pane.id, data));

  return { el, nameEl, term, fit, pane };
};

export const resizeToFit = (view: PaneView): void => {
  view.fit.fit();
  window.grove.resizePane(view.pane.id, view.term.cols, view.term.rows);
};
