import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';
import type { IPty } from 'node-pty';
import { detachPane, resizePane, spawnPane, writeToPane } from './pty';
import { loadState, saveState } from './store';
import { buildKillArgs, commandFor, createTmuxRunner, sessionName, tmuxConfigContents } from './tmux';
import { CHANNELS } from '../shared/ipc';
import { gridDimensions, type GridPreset, type GroveState, type PaneKind, type PaneState, type TabState } from '../shared/types';

if (started) {
  app.quit();
}

const WINDOW_WIDTH = 1400;
const WINDOW_HEIGHT = 900;
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

const STATE_PATH = path.join(app.getPath('userData'), 'state.json');
const TMUX_CONFIG_PATH = path.join(app.getPath('userData'), 'tmux.conf');
const tmuxRunner = createTmuxRunner();

let state: GroveState = { tabs: [], activeTabId: null };
const liveProcs = new Map<string, IPty>();
let activeWindow: BrowserWindow | null = null;
let isQuitting = false;

const persist = (): void => {
  void saveState(STATE_PATH, state);
};

const newTab = (name: string): TabState => ({
  id: randomUUID(),
  name,
  gridPreset: 1,
  columnRatios: [1],
  rowRatios: [1],
  panes: [],
});

const findTab = (tabId: string): TabState | undefined => state.tabs.find((tab) => tab.id === tabId);

// The renderer has no filesystem access to resolve a default cwd itself, so
// it sends the '~' placeholder and this is the one place that expands it.
// Grove exists to run Claude Code sessions against the chin project, so new
// sessions default there rather than $HOME.
const DEFAULT_CWD = path.join(os.homedir(), 'chin');
const resolveCwd = (cwd: string): string => (cwd === '' || cwd === '~' ? DEFAULT_CWD : cwd);

// A GUI-launched app (Finder, /Applications, LaunchServices) inherits
// launchd's minimal PATH, not the interactive shell's — so a Homebrew-installed
// `tmux` at /opt/homebrew/bin is invisible here even though it works fine when
// Grove is started from a terminal. Replace process.env.PATH once, up front,
// with what a real login shell resolves, so every later tmux/pty spawn finds it.
const fixPathFromLoginShell = (): void => {
  try {
    const shell = process.env.SHELL ?? '/bin/zsh';
    const output = execFileSync(shell, ['-lic', 'echo -n "$PATH"'], { encoding: 'utf8' });
    // Some shell setups print a startup banner (e.g. macOS's session-restore
    // notice) to stdout before running our command — that text comes first,
    // so the PATH itself is reliably the last line of output.
    const lines = output.trim().split('\n');
    const loginPath = lines[lines.length - 1];
    if (loginPath.trim() !== '') process.env.PATH = loginPath;
  } catch {
    // Best effort — if the login shell can't be probed, fall back to launchd's PATH.
  }
};

// A pty's data/exit events are async and can still be in flight the instant
// its window is torn down (on quit, or when the user closes it) — sending on
// a destroyed webContents throws "Object has been destroyed", so every send
// checks isDestroyed() first rather than trusting the activeWindow reference.
const sendToActiveWindow = (channel: string, payload: unknown): void => {
  if (activeWindow === null || activeWindow.isDestroyed() || activeWindow.webContents.isDestroyed()) return;
  activeWindow.webContents.send(channel, payload);
};

const attachPane = (pane: PaneState): void => {
  const proc = spawnPane({
    tmuxName: pane.tmuxName,
    cwd: pane.cwd,
    command: commandFor(pane.kind),
    cols: DEFAULT_COLS,
    rows: DEFAULT_ROWS,
    configPath: TMUX_CONFIG_PATH,
    onData: (data) => {
      sendToActiveWindow(CHANNELS.ptyData, { paneId: pane.id, data });
    },
    onExit: (exitCode) => {
      liveProcs.delete(pane.id);
      sendToActiveWindow(CHANNELS.ptyExit, { paneId: pane.id, exitCode });
    },
  });
  liveProcs.set(pane.id, proc);
};

const spawnAllPersistedPanes = (): void => {
  for (const tab of state.tabs) {
    for (const pane of tab.panes) {
      attachPane(pane);
    }
  }
};

// Grove no longer reattaches sessions across launches — every quit or tab
// close kills the underlying tmux sessions outright, so there is nothing
// left to reattach to next time.
const killAllPanes = async (panes: readonly PaneState[]): Promise<void> => {
  for (const pane of panes) {
    const proc = liveProcs.get(pane.id);
    if (proc !== undefined) {
      detachPane(proc);
      liveProcs.delete(pane.id);
    }
    await tmuxRunner.run(buildKillArgs(pane.tmuxName));
  }
};

const resetAllTabs = async (): Promise<void> => {
  await killAllPanes(state.tabs.flatMap((tab) => tab.panes));
  state = { tabs: [], activeTabId: null };
  persist();
};

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  activeWindow = mainWindow;
  mainWindow.on('closed', () => {
    if (activeWindow === mainWindow) activeWindow = null;
  });

  // macOS's window-all-closed leaves the app running in the background by
  // default — the traffic-light close button here should actually quit, not
  // just hide the window, so intercept it and confirm before app.quit().
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Quit', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: 'Quit Grove?',
      detail: 'All sessions will be closed.',
    });
    if (choice === 0) {
      void resetAllTabs().then(() => {
        isQuitting = true;
        app.quit();
      });
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

ipcMain.handle(CHANNELS.getState, (): GroveState => state);

ipcMain.handle(
  CHANNELS.createPane,
  (_event, request: { tabId: string; cwd: string; kind: PaneKind }): PaneState | null => {
    const tab = findTab(request.tabId);
    if (tab === undefined) return null;
    const { columns, rows } = gridDimensions(tab.gridPreset);
    const capacity = columns * rows;
    if (tab.panes.length >= capacity) return null;
    const id = randomUUID();
    const pane: PaneState = {
      id,
      tmuxName: sessionName(id),
      name: request.kind === 'claude' ? 'claude' : 'shell',
      cwd: resolveCwd(request.cwd),
      kind: request.kind,
      slot: tab.panes.length,
    };
    tab.panes.push(pane);
    attachPane(pane);
    persist();
    return pane;
  },
);

ipcMain.handle(CHANNELS.killPane, async (_event, paneId: string): Promise<void> => {
  for (const tab of state.tabs) {
    const index = tab.panes.findIndex((pane) => pane.id === paneId);
    if (index === -1) continue;
    const [pane] = tab.panes.splice(index, 1);
    const proc = liveProcs.get(paneId);
    if (proc !== undefined) {
      detachPane(proc);
      liveProcs.delete(paneId);
    }
    await tmuxRunner.run(buildKillArgs(pane.tmuxName));
    persist();
    return;
  }
});

ipcMain.handle(CHANNELS.renamePane, (_event, request: { paneId: string; name: string }): void => {
  for (const tab of state.tabs) {
    const pane = tab.panes.find((candidate) => candidate.id === request.paneId);
    if (pane !== undefined) {
      pane.name = request.name;
      persist();
      return;
    }
  }
});

ipcMain.handle(CHANNELS.createTab, (_event, name: string): TabState => {
  const tab = newTab(name);
  state.tabs.push(tab);
  state.activeTabId = tab.id;
  persist();
  return tab;
});

ipcMain.handle(CHANNELS.closeTab, async (_event, tabId: string): Promise<void> => {
  const tab = findTab(tabId);
  if (tab === undefined) return;
  await killAllPanes(tab.panes);
  state.tabs = state.tabs.filter((candidate) => candidate.id !== tabId);
  // Closing the last tab resets Grove to one fresh, empty tab rather than
  // leaving the window with nothing in it.
  if (state.tabs.length === 0) {
    state.tabs.push(newTab('Tab 1'));
  }
  if (state.activeTabId === tabId) {
    state.activeTabId = state.tabs[0].id;
  }
  persist();
});

ipcMain.handle(CHANNELS.renameTab, (_event, request: { tabId: string; name: string }): void => {
  const tab = findTab(request.tabId);
  if (tab !== undefined) {
    tab.name = request.name;
    persist();
  }
});

ipcMain.handle(CHANNELS.setGridPreset, (_event, request: { tabId: string; preset: GridPreset }): void => {
  const tab = findTab(request.tabId);
  if (tab === undefined) return;
  tab.gridPreset = request.preset;
  const { columns, rows } = gridDimensions(request.preset);
  tab.columnRatios = Array(columns).fill(1 / columns) as number[];
  tab.rowRatios = Array(rows).fill(1 / rows) as number[];
  persist();
});

ipcMain.handle(
  CHANNELS.setRatios,
  (_event, request: { tabId: string; columnRatios: number[]; rowRatios: number[] }): void => {
    const tab = findTab(request.tabId);
    if (tab === undefined) return;
    tab.columnRatios = request.columnRatios;
    tab.rowRatios = request.rowRatios;
    persist();
  },
);

ipcMain.on(CHANNELS.ptyInput, (_event, message: { paneId: string; data: string }) => {
  const proc = liveProcs.get(message.paneId);
  if (proc !== undefined) writeToPane(proc, message.data);
});

ipcMain.on(CHANNELS.ptyResize, (_event, message: { paneId: string; cols: number; rows: number }) => {
  const proc = liveProcs.get(message.paneId);
  if (proc !== undefined) resizePane(proc, message.cols, message.rows);
});

app.on('ready', async () => {
  fixPathFromLoginShell();
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(TMUX_CONFIG_PATH, tmuxConfigContents);
  state = await loadState(STATE_PATH);
  createWindow();
  spawnAllPersistedPanes();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
