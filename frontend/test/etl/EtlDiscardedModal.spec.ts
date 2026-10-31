import { describe, it, expect, vi } from 'vitest';
import { defineComponent, h, reactive } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import EtlDiscardedModal from '../../app/features/etl-monitoring/components/EtlDiscardedModal.vue';
import type { ProcesoEtl } from '../../app/features/etl-monitoring/types/etl';

describe('Discarded sample intento selection', () => {
  it('loads a previous intento from the selector and displays its samples', async () => {
    let complete!: (rows: unknown[]) => void;
    const fetcher = vi.fn().mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    vi.stubGlobal('$fetch', fetcher);
    const proceso = reactive<ProcesoEtl>({ id: 'proceso-1', latestJobId: 'job-1', intento: 2, name: 'Fixture', nombreConjunto: 'paises', descripcion: '', icon: '', estado: 'success', progressPercent: 100, filasProcesadas: 0, totalEstimatedRows: 1, filasDescartadas: 1, lastSyncAt: null, nextScheduledSync: '', scheduleDescription: '', averageSpeedRowsPerSec: 0, muestrasDescartadas: [] });
    const Select = defineComponent({
      props: ['modelValue', 'items'], emits: ['update:modelValue'],
      setup(props, { emit }) {
        return () => h('select', { value: props.modelValue, onChange: (event: Event) => emit('update:modelValue', Number((event.target as HTMLSelectElement).value)) }, (props.items as { label: string; value: string | number }[]).map(item => h('option', { value: item.value }, item.label)));
      },
    });
    const wrapper = mount(EtlDiscardedModal, { props: { isOpen: true, proceso }, global: { stubs: {
      UModal: { template: '<div><slot name="body"/><slot name="footer"/></div>' },
      USelect: Select, UButton: { template: '<button><slot/></button>' }, UBadge: { template: '<span><slot/></span>' },
    } } });
    try {
      await wrapper.findAll('select')[0]!.setValue('1');
      expect(wrapper.findAll('select')[0]!.attributes()).toHaveProperty('disabled');
      wrapper.findAllComponents(Select)[0]!.vm.$emit('update:modelValue', 2);
      expect(fetcher).toHaveBeenCalledTimes(1);
      complete([{ id: 'sample-1', intento: 1, numeroFila: 1, muestraOriginal: '{}', campo: 'iata', motivo: 'First intento fixture', creadoEn: '2026-10-29T00:00:00Z' }]);
      await flushPromises();
      expect(fetcher).toHaveBeenCalledWith('/api/etl/ejecuciones/job-1/muestras', expect.objectContaining({ query: { intento: 1 } }));
      expect(wrapper.text()).toContain('First intento fixture');
      expect(wrapper.findAll('select')[0]!.element.value).toBe('1');
    } finally { wrapper.unmount(); }
  });
});
