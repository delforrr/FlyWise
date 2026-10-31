import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, defineComponent } from 'vue';
import GlobalMapFilters from '../../app/features/flight-map/components/GlobalMapFilters.vue';
import { useGlobalMap } from '../../app/features/flight-map/composables/useGlobalMap';

const modal = defineComponent({ props: ['open'], template: '<div v-if="open"><slot name="body"/><slot name="footer"/></div>' });
const button = defineComponent({ props: ['label', 'disabled'], template: '<button :disabled="disabled">{{ label }}</button>' });
const menu = defineComponent({ name: 'CountryPicker', props: ['modelValue', 'items'], emits: ['update:modelValue'], template: '<div />' });
const campo = defineComponent({ template: '<div><slot /></div>' });
function render() {
  vi.stubGlobal('useGlobalMap', useGlobalMap);
  return mount(GlobalMapFilters, { global: { stubs: { UModal: modal, UFormField: campo, USelectMenu: menu, UButton: button, UIcon: true } } });
}

describe('Global map filter draft', () => {
  it('cancels without applying and restores applied settings when reopened', async () => {
    const state = useGlobalMap(); state.isOpen.value = true;
    const wrapper = render();
    await wrapper.get('input[name="map-limit"][value="10"]').setValue();
    await wrapper.findAll('button').find(b => b.text() === 'Cancelar')!.trigger('click');
    expect(state.filter.value.limit).toBe(50); expect(wrapper.emitted('apply')).toBeUndefined();
    state.isOpen.value = true; await nextTick();
    expect((wrapper.get('input[name="map-limit"][value="50"]').element as HTMLInputElement).checked).toBe(true);
    wrapper.unmount();
  });
  it('requires different paises and emits only the activa mode fields', async () => {
    const state = useGlobalMap(); state.isOpen.value = true;
    const wrapper = render();
    await wrapper.get('input[name="map-zone"][value="paises"]').setValue();
    const apply = () => wrapper.findAll('button').find(b => b.text() === 'Aplicar filtros')!;
    expect(apply().attributes('disabled')).toBeDefined();
    wrapper.findAllComponents(menu)[0]!.vm.$emit('update:modelValue', 'ar');
    wrapper.findAllComponents(menu)[1]!.vm.$emit('update:modelValue', 'ar'); await nextTick();
    expect(apply().attributes('disabled')).toBeDefined();
    wrapper.findAllComponents(menu)[1]!.vm.$emit('update:modelValue', 'es'); await nextTick();
    await apply().trigger('click');
    expect(wrapper.emitted('apply')?.[0]).toEqual([{ mode: 'paises', limit: 50, paisOrigenId: 'ar', paisDestinoId: 'es' }]);
    await wrapper.get('input[name="map-zone"][value="global"]').setValue(); await apply().trigger('click');
    expect(wrapper.emitted('apply')?.[1]).toEqual([{ mode: 'global', limit: 50 }]);
    wrapper.unmount();
  });
  it('applies the selected numeric limit and guides an incomplete domestic search', async () => {
    const state = useGlobalMap(); state.isOpen.value = true;
    const wrapper = render();
    await wrapper.get('input[name="map-zone"][value="domestic"]').setValue();
    const apply = wrapper.findAll('button').find(b => b.text() === 'Aplicar filtros')!;
    expect(apply.attributes('disabled')).toBeDefined();
    expect(wrapper.get('[role="status"]').text()).toContain('Selecciona un país');
    wrapper.findComponent(menu).vm.$emit('update:modelValue', 'ar');
    await wrapper.get('input[name="map-limit"][value="20"]').setValue();
    expect(wrapper.get('#map-limit-help').text()).toContain('Hasta 20 conexiones');
    await apply.trigger('click');
    expect(wrapper.emitted('apply')?.[0]).toEqual([{ mode: 'domestic', limit: 20, paisOrigenId: 'ar' }]);
    wrapper.unmount();
  });
  it('requires distinct continents before applying', async () => {
    const state = useGlobalMap(); state.isOpen.value = true;
    const wrapper = render();
    await wrapper.get('input[name="map-zone"][value="continents"]').setValue();
    const apply = wrapper.findAll('button').find(b => b.text() === 'Aplicar filtros')!;
    const pickers = wrapper.findAllComponents(menu);
    pickers[0]!.vm.$emit('update:modelValue', 'SA');
    pickers[1]!.vm.$emit('update:modelValue', 'SA'); await nextTick();
    expect(apply.attributes('disabled')).toBeDefined();
    pickers[1]!.vm.$emit('update:modelValue', 'EU'); await nextTick();
    await apply.trigger('click');
    expect(wrapper.emitted('apply')?.[0]).toEqual([{ mode: 'continents', limit: 50, continenteOrigen: 'SA', continenteDestino: 'EU' }]);
    wrapper.unmount();
  });
});
