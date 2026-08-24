import '@xterm/xterm/css/xterm.css';
import './style.css';
import { renderGrid } from './grid';
import { createPaneView, resizeToFit, type PaneView } from './pane';
import { createPalette } from './palette';
import { renderTabs } from './tabs';
import type { GridPreset, GroveState, PaneKind, PaneState } from '../shared/types';

const root = document.getElementById('root');
if (root === null) throw new Error('missing #root');

const tabsEl = document.createElement('div');
tabsEl.id = 'tabs';
const gridEl = document.createElement('div');
gridEl.id = 'grid-container';
root.appendChild(tabsEl);
root.appendChild(gridEl);

let state: GroveState = { tabs: [], activeTabId: null };
const paneViews = new Map<string, PaneView>();

// Any home-directory placeholder ('' or '~') is resolved to os.homedir() on
// the main-process side — the renderer has no filesystem access to do it.
const HOME_PLACEHOLDER = '~';

const ensurePaneView = (pane: PaneState): PaneView => {
  const existing = paneViews.get(pane.id);
  if (existing !== undefined) {
    existing.pane = pane;
    if (existing.nameEl.textContent !== pane.name) existing.nameEl.textContent = pane.name;
    return existing;
  }
  const view = createPaneView(pane, {
    onRenamePane: (paneId, name) => {
      void window.grove.renamePane(paneId, name).then(refresh);
    },
  });
  paneViews.set(pane.id, view);
  return view;
};

const activeTab = (): GroveState['tabs'][number] | undefined =>
  state.tabs.find((tab) => tab.id === state.activeTabId);

const refresh = async (): Promise<void> => {
  state = await window.grove.getState();
  render();
};

const render = (): void => {
  renderTabs(tabsEl, state, {
    onSelectTab: (tabId) => {
      state = { ...state, activeTabId: tabId };
      render();
    },
    onNewTab: () => {
      void window.grove.createTab(`Tab ${state.tabs.length + 1}`).then(refresh);
    },
    onRenameTab: (tabId, name) => {
      void window.grove.renameTab(tabId, name).then(refresh);
    },
    onCloseTab: (tabId) => {
      void window.grove.closeTab(tabId).then(refresh);
    },
    onSetPreset: (tabId, preset: GridPreset) => {
      void window.grove.setGridPreset(tabId, preset).then(refresh);
    },
    onNewPane: (tabId, kind: PaneKind) => {
      void window.grove.createPane(tabId, HOME_PLACEHOLDER, kind).then(refresh);
    },
    onOpenSearch: () => palette.open(),
  });

  const tab = activeTab();
  if (tab === undefined) {
    gridEl.innerHTML = '<div class="empty-state">No sessions yet — click + session to start one.</div>';
    return;
  }

  tab.panes.forEach(ensurePaneView);
  renderGrid(
    gridEl,
    tab,
    paneViews,
    (columnRatios, rowRatios) => {
      void window.grove.setRatios(tab.id, columnRatios, rowRatios);
    },
    resizeToFit,
  );

  requestAnimationFrame(() => {
    tab.panes.forEach((pane) => {
      const view = paneViews.get(pane.id);
      if (view !== undefined) resizeToFit(view);
    });
  });
};

const palette = createPalette(
  root,
  () => state,
  (tabId, paneId) => {
    state = { ...state, activeTabId: tabId };
    render();
    paneViews.get(paneId)?.term.focus();
  },
);

window.grove.onPtyData((paneId, data) => {
  paneViews.get(paneId)?.term.write(data);
});

window.grove.onPtyExit((paneId) => {
  paneViews.get(paneId)?.term.write('\r\n\x1b[90m[session ended]\x1b[0m\r\n');
});

window.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    palette.open();
  }
});

window.addEventListener('resize', () => {
  const tab = activeTab();
  if (tab === undefined) return;
  tab.panes.forEach((pane) => {
    const view = paneViews.get(pane.id);
    if (view !== undefined) resizeToFit(view);
  });
});

void refresh();
