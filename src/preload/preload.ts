import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '../shared/ipc';
import type { GridPreset, GroveState, PaneKind, PaneState, TabState } from '../shared/types';

const api = {
  getState: (): Promise<GroveState> => ipcRenderer.invoke(CHANNELS.getState),

  createPane: (tabId: string, cwd: string, kind: PaneKind): Promise<PaneState | null> =>
    ipcRenderer.invoke(CHANNELS.createPane, { tabId, cwd, kind }),
  killPane: (paneId: string): Promise<void> => ipcRenderer.invoke(CHANNELS.killPane, paneId),
  renamePane: (paneId: string, name: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.renamePane, { paneId, name }),

  createTab: (name: string): Promise<TabState> => ipcRenderer.invoke(CHANNELS.createTab, name),
  closeTab: (tabId: string): Promise<void> => ipcRenderer.invoke(CHANNELS.closeTab, tabId),
  renameTab: (tabId: string, name: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.renameTab, { tabId, name }),
  setGridPreset: (tabId: string, preset: GridPreset): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.setGridPreset, { tabId, preset }),
  setRatios: (tabId: string, columnRatios: number[], rowRatios: number[]): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.setRatios, { tabId, columnRatios, rowRatios }),

  sendInput: (paneId: string, data: string): void => {
    ipcRenderer.send(CHANNELS.ptyInput, { paneId, data });
  },
  resizePane: (paneId: string, cols: number, rows: number): void => {
    ipcRenderer.send(CHANNELS.ptyResize, { paneId, cols, rows });
  },
  onPtyData: (callback: (paneId: string, data: string) => void): void => {
    ipcRenderer.on(CHANNELS.ptyData, (_event, payload: { paneId: string; data: string }) =>
      callback(payload.paneId, payload.data),
    );
  },
  onPtyExit: (callback: (paneId: string, exitCode: number) => void): void => {
    ipcRenderer.on(CHANNELS.ptyExit, (_event, payload: { paneId: string; exitCode: number }) =>
      callback(payload.paneId, payload.exitCode),
    );
  },
};

export type GroveBridge = typeof api;

contextBridge.exposeInMainWorld('grove', api);
