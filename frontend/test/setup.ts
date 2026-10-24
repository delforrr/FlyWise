import { vi, beforeEach } from 'vitest';
import * as vue from 'vue';

// Jest-compatible global bridge for test suites:
// Expose `jest` as an alias to `vi` so tests using `jest.fn()`, `jest.spyOn()`, `jest.clearAllMocks()`
// run seamlessly with 100% Jest API compatibility.
if (typeof (globalThis as any).jest === 'undefined') {
  (globalThis as any).jest = vi;
}

// Expose Vue auto-imports on globalThis for Nuxt composables executed outside Nuxt context
for (const [key, value] of Object.entries(vue)) {
  if (typeof (globalThis as any)[key] === 'undefined') {
    (globalThis as any)[key] = value;
  }
}

// Lifecycle hooks protection when running standalone composables in tests
(globalThis as any).onMounted = (fn: () => any) => {
  if (vue.getCurrentInstance()) {
    vue.onMounted(fn);
  }
};

(globalThis as any).onUnmounted = (fn: () => any) => {
  if (vue.getCurrentInstance()) {
    vue.onUnmounted(fn);
  }
};

// Nuxt mock composable stubs for unit test execution in happy-dom
const stateStore = new Map<string, any>();
(globalThis as any).__clearStateStore = () => stateStore.clear();

beforeEach(() => {
  stateStore.clear();
});

if (typeof (globalThis as any).useState === 'undefined') {
  (globalThis as any).useState = (key: string, init?: () => any) => {
    if (!stateStore.has(key)) {
      stateStore.set(key, vue.ref(init ? init() : undefined));
    }
    return stateStore.get(key);
  };
}

if (typeof (globalThis as any).navigateTo === 'undefined') {
  (globalThis as any).navigateTo = vi.fn().mockResolvedValue(true);
}

if (typeof (globalThis as any).useToast === 'undefined') {
  (globalThis as any).useToast = () => ({
    add: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  });
}

if (typeof (globalThis as any).useColorMode === 'undefined') {
  (globalThis as any).useColorMode = () => vue.ref('dark');
}

if (typeof (globalThis as any).defineShortcuts === 'undefined') {
  (globalThis as any).defineShortcuts = vi.fn();
}

let nuxtApp = {};
beforeEach(() => { nuxtApp = {}; });
vi.stubGlobal('useNuxtApp', () => nuxtApp);
// HTTP boundary for composables outside Nuxt; suites can replace $fetch per scenario.
vi.stubGlobal('useCookie', () => vue.ref<string | null>(null));
vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]));
