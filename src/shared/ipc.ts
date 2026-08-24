import type { GroveState, PaneKind } from './types';

export const CHANNELS = {
  createPane: 'grove:create-pane',
  killPane: 'grove:kill-pane',
  renamePane: 'grove:rename-pane',
  createTab: 'grove:create-tab',
  closeTab: 'grove:close-tab',
  renameTab: 'grove:rename-tab',
  setGridPreset: 'grove:set-grid-preset',
  setRatios: 'grove:set-ratios',
  getState: 'grove:get-state',
  ptyData: 'grove:pty-data',
  ptyInput: 'grove:pty-input',
  ptyResize: 'grove:pty-resize',
  ptyExit: 'grove:pty-exit',
} as const;

export interface CreatePaneRequest {
  tabId: string;
  cwd: string;
  kind: PaneKind;
}

export interface PtyInputMessage {
  paneId: string;
  data: string;
}

export interface PtyResizeMessage {
  paneId: string;
  cols: number;
  rows: number;
}

export interface PtyDataMessage {
  paneId: string;
  data: string;
}

export interface PtyExitMessage {
  paneId: string;
  exitCode: number;
}

export type { GroveState };
