import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import AdminLayout from '~/layouts/admin.vue';
import type { User } from '~/services/authService';

vi.mock('~/features/etl-monitoring/composables/useEtlMonitoring', () => ({
  useEtlMonitoring: () => ({}),
}));

describe('Identidad en la cabecera administrativa', () => {
  const user = ref<User | null>(null);

  beforeEach(() => {
    user.value = null;
    vi.stubGlobal('useAuth', () => ({ user, logout: vi.fn() }));
    vi.stubGlobal('useRoute', () => ({ path: '/admin' }));
  });

  function mountLayout() {
    return shallowMount(AdminLayout, {
      global: {
        mocks: { $route: { path: '/admin' } },
        stubs: {
          NuxtLink: true, USeparator: true, UBadge: true,
          UButton: true, ThemeToggle: true,
          UAvatar: { props: ['alt'], template: '<span role="img" :aria-label="alt" />' },
        },
      },
    });
  }

  it('muestra el identificador del usuario y actualiza el avatar al restaurar la sesión', async () => {
    const wrapper = mountLayout();
    expect(wrapper.find('[role="img"]').exists()).toBe(false);

    user.value = { id: '1', email: 'maria.perez@flywise.aero', role: 'ADMIN' };
    await nextTick();

    expect(wrapper.text()).toContain('maria.perez');
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('maria.perez');
    expect(wrapper.text()).not.toContain('Operador ETL');

    user.value = null;
    await nextTick();
    expect(wrapper.find('[role="img"]').exists()).toBe(false);
  });
});
