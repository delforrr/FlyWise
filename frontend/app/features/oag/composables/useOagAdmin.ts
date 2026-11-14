import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { EtlJobRecord } from '~/features/etl-monitoring/types/etl';
import { useBackendRequest } from '~/shared/composables/useBackendRequest';
import { mapCatalogAirport, useCatalog, type CatalogAirport } from '~/shared/composables/useCatalog';

type Config = {
  pausado: boolean;
  origenId?: string;
  destinoId?: string;
  periodo: string;
  coberturaMinimaPct: number;
};
type Job = EtlJobRecord & {
  origenId: string | null;
  destinoId: string | null;
  origenCodigo?: string;
  destinoCodigo?: string;
  periodo: string | null;
};

const base = '/administracion/oag';
const enCurso = (job: Job) => job.estado === 'pending' || job.estado === 'running';

export function useOagAdmin() {
  const request = useBackendRequest({ notificarError: false });
  const { aeropuertos, rememberAirport } = useCatalog();
  const config = ref<Config>({ pausado: true, periodo: '', coberturaMinimaPct: 90 });
  const guardada = ref<Config | null>(null);
  const jobs = ref<Job[]>([]);
  const busy = ref(false);
  const error = ref('');
  const notice = ref('');
  const valid = computed(() => {
    const { origenId, destinoId, periodo, coberturaMinimaPct } = config.value;
    return Boolean(origenId && destinoId && origenId !== destinoId
      && /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)
      && Number.isInteger(coberturaMinimaPct) && coberturaMinimaPct >= 1 && coberturaMinimaPct <= 100);
  });
  const canRun = computed(() => {
    if (!valid.value || !guardada.value || config.value.pausado) return false;
    const actual = config.value;
    const anterior = guardada.value;
    return actual.origenId === anterior.origenId && actual.destinoId === anterior.destinoId
      && actual.periodo === anterior.periodo && actual.pausado === anterior.pausado
      && actual.coberturaMinimaPct === anterior.coberturaMinimaPct
      && !jobs.value.some(job => enCurso(job) && job.origenId === actual.origenId
        && job.destinoId === actual.destinoId && job.periodo === actual.periodo);
  });

  function airportName(id: string | null) {
    return aeropuertos.value.find(aeropuerto => aeropuerto.id === id)?.iata ?? id ?? '—';
  }

  async function rememberAirports(ids: Array<string | null | undefined>) {
    const missing = [...new Set(ids)].filter(
      (id): id is string => Boolean(id) && !aeropuertos.value.some(airport => airport.id === id),
    );
    await Promise.allSettled(missing.map(async (id) => {
      const airport = await request<Omit<CatalogAirport, 'cantidadRutas'>>(`/administracion/aeropuertos/${id}`);
      rememberAirport(mapCatalogAirport({ ...airport, cantidadRutas: 0 }));
    }));
  }

  async function refreshJobs() {
    jobs.value = await request<Job[]>(`${base}/ejecuciones`);
  }

  async function perform(work: () => Promise<void>, fallback: string) {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
      await work();
    } catch {
      error.value = fallback;
    } finally {
      busy.value = false;
    }
  }

  function refresh() {
    return perform(async () => {
      if (!guardada.value) {
        const loaded = await request<Config>(`${base}/configuracion`);
        await rememberAirports([loaded.origenId, loaded.destinoId]);
        config.value = { ...loaded, origenId: loaded.origenId || undefined, destinoId: loaded.destinoId || undefined };
        guardada.value = { ...config.value };
      }
      await refreshJobs();
    }, 'No se pudo cargar el estado de OAG.');
  }

  function save() {
    if (!valid.value || !guardada.value) return;
    notice.value = '';
    return perform(async () => {
      const saved = await request<Config>(`${base}/configuracion`, { method: 'PATCH', body: config.value });
      config.value = saved;
      guardada.value = { ...saved };
      notice.value = 'Configuración de OAG guardada.';
    }, 'No se pudo guardar la configuración de OAG.');
  }

  function run() {
    if (!canRun.value) return;
    notice.value = '';
    return perform(async () => {
      await request(`${base}/ejecutar`, { method: 'POST', body: {} });
      notice.value = 'Se solicitó la ejecución de OAG.';
      await refreshJobs().catch(() => { error.value = 'No se pudo actualizar el historial de OAG.'; });
    }, 'No se pudo iniciar la ejecución de OAG.');
  }

  let timer: ReturnType<typeof setInterval>;
  onMounted(() => {
    void refresh();
    timer = setInterval(() => {
      if (jobs.value.some(enCurso)) void perform(refreshJobs, 'No se pudo actualizar el historial de OAG.');
    }, 5000);
  });
  onUnmounted(() => clearInterval(timer));

  return { config, guardada, jobs, busy, error, notice, valid, canRun, airportName, refresh, save, run };
}
