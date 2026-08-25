import { startInlineRename } from './inline-rename';
import { GRID_PRESETS, type GridPreset, type GroveState, type PaneKind } from '../shared/types';

export interface TabsCallbacks {
  onSelectTab: (tabId: string) => void;
  onNewTab: () => void;
  onRenameTab: (tabId: string, name: string) => void;
  onCloseTab: (tabId: string) => void;
  onSetPreset: (tabId: string, preset: GridPreset) => void;
  onNewPane: (tabId: string, kind: PaneKind) => void;
  onOpenSearch: () => void;
}

export const renderTabs = (container: HTMLElement, state: GroveState, callbacks: TabsCallbacks): void => {
  container.innerHTML = '';
  const bar = document.createElement('div');
  bar.className = 'tab-bar';

  state.tabs.forEach((tab) => {
    const el = document.createElement('div');
    el.className = tab.id === state.activeTabId ? 'tab active' : 'tab';
    el.addEventListener('click', () => callbacks.onSelectTab(tab.id));

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tab-name';
    nameSpan.textContent = tab.name;
    nameSpan.addEventListener('dblclick', (event) => {
      event.stopPropagation();
      startInlineRename(nameSpan, tab.name, (name) => callbacks.onRenameTab(tab.id, name));
    });
    el.appendChild(nameSpan);

    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '×';
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      callbacks.onCloseTab(tab.id);
    });
    el.appendChild(close);
    bar.appendChild(el);
  });

  const newTabBtn = document.createElement('button');
  newTabBtn.className = 'tab-new';
  newTabBtn.textContent = '+';
  newTabBtn.title = 'New tab';
  newTabBtn.addEventListener('click', () => callbacks.onNewTab());
  bar.appendChild(newTabBtn);

  const spacer = document.createElement('div');
  spacer.className = 'tab-bar-spacer';
  bar.appendChild(spacer);

  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
  if (activeTab !== undefined) {
    const presetSelect = document.createElement('select');
    presetSelect.className = 'grid-preset';
    GRID_PRESETS.forEach((preset) => {
      const option = document.createElement('option');
      option.value = String(preset);
      option.textContent = `${preset}-up`;
      option.selected = preset === activeTab.gridPreset;
      presetSelect.appendChild(option);
    });
    presetSelect.addEventListener('change', () => {
      callbacks.onSetPreset(activeTab.id, Number(presetSelect.value) as GridPreset);
    });
    bar.appendChild(presetSelect);

    const newPaneBtn = document.createElement('button');
    newPaneBtn.className = 'pane-new';
    newPaneBtn.textContent = '+ session';
    newPaneBtn.title = 'New Claude Code session (⌥-click for a plain shell)';
    newPaneBtn.addEventListener('click', (event) => {
      callbacks.onNewPane(activeTab.id, event.altKey ? 'shell' : 'claude');
    });
    bar.appendChild(newPaneBtn);
  }

  const searchBtn = document.createElement('button');
  searchBtn.className = 'search-btn';
  searchBtn.textContent = '⌘K';
  searchBtn.title = 'Search sessions';
  searchBtn.addEventListener('click', () => callbacks.onOpenSearch());
  bar.appendChild(searchBtn);

  container.appendChild(bar);
};
