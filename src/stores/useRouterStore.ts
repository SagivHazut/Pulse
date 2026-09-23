import { create } from 'zustand';

/**
 * A three-line navigator.
 *
 * The game is four screens deep with no URLs, no deep links and no back stack
 * worth persisting — a navigation library would cost more than it earns here.
 * `Future features` (leaderboards, events) can graduate this to React Navigation
 * without touching screen components, which never import this directly except to
 * call `go`.
 */
export type Route = 'splash' | 'home' | 'game' | 'themes' | 'settings' | 'privacy';

type RouterState = {
  route: Route;
  previous: Route;
  go(route: Route): void;
  back(): void;
};

export const useRouterStore = create<RouterState>((set, get) => ({
  route: 'splash',
  previous: 'home',
  go(route) {
    if (route === get().route) return;
    set({ route, previous: get().route });
  },
  back() {
    set({ route: get().previous, previous: 'home' });
  },
}));
