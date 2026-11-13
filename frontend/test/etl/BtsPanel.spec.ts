import { mount, flushPromises } from '@vue/test-utils';
import { vi, it, expect } from 'vitest';
import BtsPanel from '../../app/features/bts/components/BtsPanel.vue';

const stubs = {
  UFormField: { template: '<div><slot /></div>' },
  UButton: { template: '<button><slot /></button>' },
  USwitch: true,
  UModal: {
    props: ['open', 'title'],
    template: '<div v-if="open" role="dialog" :aria-label="title"><slot name="body" /></div>',
  },
  UCollapsible: { template: '<div><slot /><slot name="content" /></div>' },
  UInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  USelect: {
    props: ['modelValue', 'items'],
    emits: ['update:modelValue'],
    template: `<select v-model="selected"><option value=""></option><option v-for="item in items" :value="item.value ?? item">{{ item.label ?? item }}</option></select>`,
    computed: {
      selected: {
        get() { return this.$props.modelValue; },
        set(value: string | number) { this.$emit('update:modelValue', value); },
      },
    },
  },
};

it('muestra cobertura publicada y envía el mes explícito sin inventar puntualidad', async () => {
  const request=vi.fn().mockImplementation(async (path:string) => {
    if(path.endsWith('/configuracion'))return {periodo:'2026-08',pausado:true,expresionCron:''};
    if(path.endsWith('/cobertura'))return [{periodo:'2026-07',filas:1234,publicadoEn:'2026-09-01',ejecucionId:'job'}];
    if(path.endsWith('/correspondencias'))return {datos:[],total:0,pagina:1,limite:20};
    return [];
  });
  vi.stubGlobal('useBackendRequest',()=>request);
  const wrapper=mount(BtsPanel, { global: { stubs } });
  await flushPromises();
  expect(wrapper.text()).toContain('2026-07');
  expect(wrapper.text()).toContain('1.234');
  expect(wrapper.text()).toContain('No hay correspondencias pendientes');
  const year = wrapper.get<HTMLSelectElement>('select[placeholder="Seleccioná un año"]');
  const month = wrapper.get<HTMLSelectElement>('select[placeholder="Seleccioná un mes"]');
  expect(month.element.value).toBe('2026-08');
  expect(month.findAll('option').map(option => option.element.value)).not.toContain('2026-09');
  await year.setValue('2025');
  await wrapper.get('form[aria-label="Programar BTS"]').trigger('submit');
  expect(request).not.toHaveBeenCalledWith('/administracion/bts/configuracion', expect.anything());
  await year.setValue('2026');
  await month.setValue('2026-06');
  await wrapper.get('form[aria-label="Programar BTS"]').trigger('submit');
  await flushPromises();
  expect(request).toHaveBeenCalledWith('/administracion/bts/configuracion',expect.objectContaining({method:'PATCH',body:{periodo:'2026-06',pausado:true,expresionCron:''}}));
  wrapper.unmount();
  vi.unstubAllGlobals();
});

it('permite consultar descartes de un intento anterior después de una recuperación', async () => {
  const request = vi.fn().mockImplementation(async (path: string, options?: {query?: {intento?: number}}) => {
    if (path.endsWith('/configuracion')) return { periodo: '2026-08', pausado: false, expresionCron: '' };
    if (path.endsWith('/ejecuciones')) return [{id:'job',periodo:'2026-08',intento:2,iniciadoEn:'2026-11-09T00:00:00Z',estado:'completed',filasProcesadas:31,filasTotales:31,filasDescartadas:0}];
    if (path.endsWith('/correspondencias')) return {datos:[],total:0};
    if (path.endsWith('/descartes') && options?.query?.intento===1) return [{numeroFila:1,motivo:'Identidad sin resolver',muestraOriginal:'{}'}];
    return [];
  });
  vi.stubGlobal('useBackendRequest', () => request);
  const wrapper=mount(BtsPanel, { global: { stubs } });
  try {
    await flushPromises();
    await wrapper.findAll('button').find(button => button.text()==='Ver descartes')!.trigger('click');
    await flushPromises();
    await wrapper.get('select[aria-label="Intento de ingesta"]').setValue('1');
    await flushPromises();
    expect(wrapper.text()).toContain('Identidad sin resolver');
  } finally {wrapper.unmount();vi.unstubAllGlobals();}
});

it('muestra la transición de en cola a en curso y los descartes al fallar', async () => {
  let estado = 'pending';
  const request = vi.fn().mockImplementation(async (path: string) => {
    if (path.endsWith('/configuracion')) return { periodo: '2026-07', pausado: false, expresionCron: '' };
    if (path.endsWith('/correspondencias')) return { datos: [], total: 0 };
    if (path.endsWith('/ejecutar')) return { ejecucionId: 'job' };
    if (path.endsWith('/ejecuciones')) return [{
      id: 'job', periodo: '2026-07', estado, intento: 1,
      filasTotales: 55, filasProcesadas: 0, filasDescartadas: 55,
    }];
    return [];
  });
  vi.stubGlobal('useBackendRequest', () => request);
  vi.useFakeTimers();
  const wrapper = mount(BtsPanel, { global: { stubs: { ...stubs, UProgress: true } } });
  try {
    await flushPromises();
    const importButton = wrapper.findAll('button').find(button => button.text() === 'Cargar mes');
    expect(importButton?.attributes('disabled')).toBeDefined();
    expect(wrapper.get('[role="status"]').text()).toContain('En cola');

    estado = 'running';
    await vi.advanceTimersByTimeAsync(5000);
    expect(wrapper.get('[role="status"]').text()).toContain('En curso');
    expect(wrapper.text()).toMatch(/55 leídas\s*·\s*0 procesadas\s*·\s*55 descartadas/);

    estado = 'failed';
    await vi.advanceTimersByTimeAsync(5000);
    expect(wrapper.get('[role="status"]').text()).toContain('Fallida');
    expect(wrapper.get('a[href="#bts-identities"]').text()).toContain('correspondencias');
    expect(importButton?.attributes('disabled')).toBeUndefined();
  } finally {
    wrapper.unmount();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});


it('carga el mes en un paso y abre la vinculación en un diálogo visible', async () => {
  const request = vi.fn().mockImplementation(async (path: string) => {
    if (path.endsWith('/configuracion')) return { periodo: '2026-07', pausado: true, expresionCron: '' };
    if (path.endsWith('/correspondencias')) return { datos: [{ identificador: '14747', codigo: 'SEA' }], total: 1 };
    if (path.endsWith('/aeropuertos')) return { datos: [{ id: 'airport', nombre: 'Seattle' }] };
    if (path.endsWith('/ejecutar')) return { ejecucionId: 'job' };
    return [];
  });
  vi.stubGlobal('useBackendRequest', () => request);
  const wrapper = mount(BtsPanel, { global: { stubs } });
  try {
    await flushPromises();
    await wrapper.get('form[aria-label="Configurar BTS"]').trigger('submit');
    await flushPromises();
    expect(request).toHaveBeenCalledWith('/administracion/bts/ejecutar', {
      method: 'POST', body: { periodo: '2026-07' },
    });
    await wrapper.findAll('button').find(button => button.text() === 'Vincular')!.trigger('click');
    await flushPromises();
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.attributes('aria-label')).toBe('Vincular SEA');
    expect(dialog.text()).toContain('Seattle');
  } finally {
    wrapper.unmount();
    vi.unstubAllGlobals();
  }
});
