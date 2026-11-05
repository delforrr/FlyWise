import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import App from '../../app/app.vue';

describe('App interaction', () => {
  it('lets pointer events pass through the full-screen decorative overlay', () => {
    vi.stubGlobal('useRoute', () => ({ path: '/' }));
    const wrapper = shallowMount(App, {
      global: { stubs: { UApp: { template: '<div><slot /></div>' }, NuxtLayout: true, NuxtPage: true } },
    });
    expect(wrapper.get('[aria-hidden="true"]').classes()).toContain('pointer-events-none');
    wrapper.unmount();
    vi.unstubAllGlobals();
  });
});
