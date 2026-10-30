import { describe, it, expect, vi } from 'vitest';
import { defineComponent, h, reactive } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import EtlDiscardedModal from '../../app/features/etl-monitoring/components/EtlDiscardedModal.vue';
import type { EtlPipeline } from '../../app/features/etl-monitoring/types/etl';

describe('Discarded sample attempt selection', () => {
  it('loads a previous attempt from the selector and displays its samples', async () => {
    let complete!: (rows: unknown[]) => void;
    const fetcher = vi.fn().mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    vi.stubGlobal('$fetch', fetcher);
    const pipeline = reactive<EtlPipeline>({ id: 'pipeline-1', latestJobId: 'job-1', attempt: 2, name: 'Fixture', datasetName: 'countries', description: '', icon: '', status: 'success', progressPercent: 100, processedRows: 0, totalEstimatedRows: 1, discardedRows: 1, lastSyncAt: null, nextScheduledSync: '', scheduleDescription: '', averageSpeedRowsPerSec: 0, discardedSamples: [] });
    const Select = defineComponent({
      props: ['modelValue', 'items'], emits: ['update:modelValue'],
      setup(props, { emit }) {
        return () => h('select', { value: props.modelValue, onChange: (event: Event) => emit('update:modelValue', Number((event.target as HTMLSelectElement).value)) }, (props.items as { label: string; value: string | number }[]).map(item => h('option', { value: item.value }, item.label)));
      },
    });
    const wrapper = mount(EtlDiscardedModal, { props: { isOpen: true, pipeline }, global: { stubs: {
      UModal: { template: '<div><slot name="body"/><slot name="footer"/></div>' },
      USelect: Select, UButton: { template: '<button><slot/></button>' }, UBadge: { template: '<span><slot/></span>' },
    } } });
    try {
      await wrapper.findAll('select')[0]!.setValue('1');
      expect(wrapper.findAll('select')[0]!.attributes()).toHaveProperty('disabled');
      wrapper.findAllComponents(Select)[0]!.vm.$emit('update:modelValue', 2);
      expect(fetcher).toHaveBeenCalledTimes(1);
      complete([{ id: 'sample-1', attempt: 1, rowIndex: 1, rawSample: '{}', field: 'iata', reason: 'First attempt fixture', createdAt: '2026-10-29T00:00:00Z' }]);
      await flushPromises();
      expect(fetcher).toHaveBeenCalledWith('/api/etl/jobs/job-1/samples', expect.objectContaining({ query: { attempt: 1 } }));
      expect(wrapper.text()).toContain('First attempt fixture');
      expect(wrapper.findAll('select')[0]!.element.value).toBe('1');
    } finally { wrapper.unmount(); }
  });
});
