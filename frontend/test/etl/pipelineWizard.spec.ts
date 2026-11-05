import { defineComponent } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, expect, it, vi } from 'vitest';
import Wizard from '~/features/etl-monitoring/components/EtlPipelineWizardModal.vue';
import type { ProcesoEtl } from '~/features/etl-monitoring/types/etl';

const request = vi.hoisted(() => vi.fn());
vi.mock('~/shared/composables/useBackendRequest', () => ({ useBackendRequest: () => request }));

const pipeline = (id: string, nombre: string) => ({
  id, nombre, nombreConjunto: 'Aeropuertos', descripcion: '', icon: 'i-lucide-database',
  entidadDestino: 'aeropuertos',
  conexion: {
    tipoFuente: 'http_stream', metodoHttp: 'GET', formatoDatos: 'csv',
    urlEndpoint: 'https://example.com/airports.csv', separadorCsv: ';', csvConCabecera: false,
    headers: [{ key: 'Authorization', referenciaCredencial: 'API_TOKEN' }],
  },
  mapeoEsquema: [
    { columnaOrigen: 'id', campoDestino: 'idOpenflights' },
    { columnaOrigen: 'ident', campoDestino: 'icao' },
    { columnaOrigen: 'name', campoDestino: 'nombre' },
    { columnaOrigen: 'latitude_deg', campoDestino: 'latitud' },
    { columnaOrigen: 'longitude_deg', campoDestino: 'longitud' },
  ],
  configuracionProgramacion: { expresionCron: '', tamanoLote: 3000, tiempoLimiteSegundos: 150, maximoReintentos: 1 },
}) as ProcesoEtl;

function openWizard() {
  return mount(Wizard, {
    props: { isOpen: true, pipelineToEdit: pipeline('a', 'Listado A') },
    global: {
      components: {
        UModal: defineComponent({ template: '<div><slot name="body" /><slot name="footer" /></div>' }),
        UButton: defineComponent({ template: '<button type="button"><slot /></button>' }),
        UInput: defineComponent({ props: ['modelValue'], template: '<input :value="modelValue">' }),
      },
      stubs: { UIcon: true, USelect: true, UTextarea: true, USwitch: true, UBadge: true, UCheckbox: true, UFieldGroup: true, EtlEndpointProbeCard: true, EtlSchemaMapper: true },
    },
  });
}

beforeEach(() => { request.mockReset(); });

it('usa el detalle más reciente y descarta una respuesta anterior', async () => {
  let resolveFirst!: (value: ProcesoEtl) => void;
  const latest = pipeline('b', 'Detalle B');
  request.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
  request.mockResolvedValueOnce(latest);
  const wrapper = openWizard();
  expect(request).toHaveBeenCalledWith('/etl/procesos/a', { signal: expect.any(AbortSignal) });
  await wrapper.setProps({ pipelineToEdit: pipeline('b', 'Listado B') });
  await flushPromises();
  resolveFirst(pipeline('a', 'Detalle A'));
  await flushPromises();
  expect((wrapper.get('#etl-nombre').element as HTMLInputElement).value).toBe('Detalle B');
  expect(wrapper.get('#etl-urlEndpoint').attributes('value')).toBe(latest.conexion!.urlEndpoint);
  wrapper.unmount();
});

it('muestra el error de detalle y bloquea el formulario', async () => {
  request.mockRejectedValueOnce(new Error('Sin acceso'));
  const wrapper = openWizard();
  await flushPromises();
  expect(wrapper.get('[role=alert]').text()).toContain('Sin acceso');
  expect(wrapper.find('#etl-nombre').exists()).toBe(false);
  expect(wrapper.text()).not.toContain('Guardar Cambios');
  wrapper.unmount();
});

it('guarda el detalle cargado sin cambiar configuración ni referencias de credenciales', async () => {
  const detail = pipeline('a', 'Detalle A');
  request.mockResolvedValueOnce(detail);
  const wrapper = openWizard();
  await flushPromises();
  const schedule = wrapper.findAll('button').find(button => button.text().includes('Paso 4'));
  await schedule!.trigger('click');
  const save = wrapper.findAll('button').find(button => button.text() === 'Guardar Cambios');
  await save!.trigger('click');
  expect(wrapper.emitted('save')).toEqual([[expect.objectContaining({
    nombre: detail.nombre,
    descripcion: detail.descripcion,
    entidadDestino: detail.entidadDestino,
    conexion: detail.conexion,
    mapeoEsquema: detail.mapeoEsquema,
    configuracionProgramacion: detail.configuracionProgramacion,
  })]]);
  wrapper.unmount();
});
