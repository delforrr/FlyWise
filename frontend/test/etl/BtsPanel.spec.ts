import { mount, flushPromises } from '@vue/test-utils';
import { vi, it, expect } from 'vitest';
import BtsPanel from '../../app/features/bts/components/BtsPanel.vue';

it('muestra cobertura publicada y envía el mes explícito sin inventar puntualidad', async () => {
  const request=vi.fn().mockImplementation(async (path:string) => {
    if(path.endsWith('/configuracion'))return {periodo:'2026-08',pausado:true,expresionCron:''};
    if(path.endsWith('/cobertura'))return [{periodo:'2026-07',filas:1234,publicadoEn:'2026-09-01',ejecucionId:'job'}];
    if(path.endsWith('/correspondencias'))return {datos:[],total:0,pagina:1,limite:20};
    return [];
  });
  vi.stubGlobal('useBackendRequest',()=>request);
  const wrapper=mount(BtsPanel);
  await flushPromises();
  expect(wrapper.text()).toContain('2026-07');
  expect(wrapper.text()).toContain('1.234');
  expect(wrapper.text()).toContain('No hay correspondencias pendientes');
  await wrapper.get('input[type="month"]').setValue('2026-06');
  await wrapper.get('form').trigger('submit');
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
  const wrapper=mount(BtsPanel);
  try {
    await flushPromises();
    await wrapper.findAll('button').find(button => button.text()==='Ver descartes')!.trigger('click');
    await flushPromises();
    await wrapper.get('select[aria-label="Intento de ingesta"]').setValue('1');
    await flushPromises();
    expect(wrapper.text()).toContain('Identidad sin resolver');
  } finally {wrapper.unmount();vi.unstubAllGlobals();}
});
