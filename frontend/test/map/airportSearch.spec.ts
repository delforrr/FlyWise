import { defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import { useCatalog } from '~/shared/composables/useCatalog';
import AirportSelectInput from '~/features/route-audit/components/search/AirportSelectInput.vue';

const request = vi.hoisted(() => vi.fn());
vi.mock('~/shared/composables/useBackendRequest', () => ({ useBackendRequest: () => request }));

const menu = defineComponent({
  props: ['items', 'searchTerm', 'open', 'modelValue'],
  emits: ['update:searchTerm', 'update:modelValue', 'update:open'],
  template: '<div />',
});

afterEach(() => { vi.useRealTimers(); request.mockReset(); });

it.each(['hero', 'drawer', 'hud'] as const)('debounces lookup in %s mode without fetching the catalog', async mode => {
  vi.useFakeTimers();
  request.mockResolvedValue([]);
  const wrapper = mount(AirportSelectInput, { props: { mode }, global: { components: { UInputMenu: menu } } });
  const input = wrapper.findComponent(menu);
  input.vm.$emit('update:open', true);
  expect(request).not.toHaveBeenCalled();
  input.vm.$emit('update:searchTerm', 'E');
  await nextTick();
  await vi.advanceTimersByTimeAsync(250);
  expect(request).not.toHaveBeenCalled();
  input.vm.$emit('update:searchTerm', 'EZ');
  await nextTick();
  await vi.advanceTimersByTimeAsync(200);
  input.vm.$emit('update:searchTerm', ' eze ');
  await nextTick();
  await vi.advanceTimersByTimeAsync(249);
  expect(request).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(request).toHaveBeenCalledExactlyOnceWith('/aeropuertos/buscar', {
    query: { q: 'eze', limit: 20 }, signal: expect.any(AbortSignal),
  });
  wrapper.unmount();
});

it('descarta respuestas tardías y conserva la etiqueta al montar otro selector', async () => {
  vi.useFakeTimers();
  let resolveFirst!: (value: unknown) => void;
  const airport = { id: 'eze', iata: 'EZE', nombre: 'Ministro Pistarini', nombrePais: 'Argentina' };
  request.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
  request.mockResolvedValueOnce([airport]);
  const global = { components: { UInputMenu: menu }, stubs: { UIcon: true } };
  const wrapper = mount(AirportSelectInput, { props: { mode: 'hero' }, global });
  const input = wrapper.findComponent(menu);
  input.vm.$emit('update:open', true);

  input.vm.$emit('update:searchTerm', 'Buenos Aires');
  await nextTick();
  await vi.advanceTimersByTimeAsync(250);
  input.vm.$emit('update:searchTerm', 'EZE');
  await nextTick();
  await vi.advanceTimersByTimeAsync(250);
  resolveFirst([{ id: 'old', nombre: 'Anterior' }]);
  await nextTick();
  expect(request.mock.calls[0]?.[1].signal.aborted).toBe(true);
  expect(input.props('items')).toEqual([expect.objectContaining({ id: 'eze' })]);

  input.vm.$emit('update:modelValue', { id: 'eze' });
  expect(wrapper.emitted('update:modelValue')).toEqual([['eze']]);
  request.mockResolvedValueOnce([]);
  await useCatalog().loadAirports();
  const hud = mount(AirportSelectInput, { props: { mode: 'hud', modelValue: 'eze' }, global });
  expect(hud.findComponent(menu).props('modelValue')).toEqual(
    expect.objectContaining({ id: 'eze', label: expect.stringContaining('EZE') }),
  );
  hud.unmount();
  wrapper.unmount();
});
