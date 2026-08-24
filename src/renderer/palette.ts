import type { GroveState, PaneState, TabState } from '../shared/types';

export interface SearchResult {
  tab: TabState;
  pane: PaneState;
}

const buildIndex = (state: GroveState): SearchResult[] =>
  state.tabs.flatMap((tab) => tab.panes.map((pane) => ({ tab, pane })));

const matches = (result: SearchResult, query: string): boolean => {
  const haystack = `${result.pane.name} ${result.pane.cwd} ${result.tab.name}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
};

export const search = (state: GroveState, query: string): SearchResult[] => {
  const index = buildIndex(state);
  return query.trim() === '' ? index : index.filter((result) => matches(result, query));
};

export interface Palette {
  open: () => void;
  close: () => void;
}

export const createPalette = (
  root: HTMLElement,
  getState: () => GroveState,
  onJump: (tabId: string, paneId: string) => void,
): Palette => {
  const overlay = document.createElement('div');
  overlay.className = 'palette-overlay hidden';

  const box = document.createElement('div');
  box.className = 'palette-box';

  const input = document.createElement('input');
  input.className = 'palette-input';
  input.placeholder = 'Jump to a session…';

  const list = document.createElement('div');
  list.className = 'palette-list';

  box.appendChild(input);
  box.appendChild(list);
  overlay.appendChild(box);
  root.appendChild(overlay);

  const close = (): void => overlay.classList.add('hidden');

  const renderList = (): void => {
    list.innerHTML = '';
    search(getState(), input.value).forEach((result) => {
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.textContent = `${result.pane.name} — ${result.tab.name} — ${result.pane.cwd}`;
      item.addEventListener('click', () => {
        onJump(result.tab.id, result.pane.id);
        close();
      });
      list.appendChild(item);
    });
  };

  input.addEventListener('input', renderList);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  const open = (): void => {
    overlay.classList.remove('hidden');
    input.value = '';
    renderList();
    input.focus();
  };

  return { open, close };
};
