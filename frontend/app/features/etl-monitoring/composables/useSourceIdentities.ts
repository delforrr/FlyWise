import { computed, ref } from 'vue';
import { useBackendRequest } from '~/shared/composables/useBackendRequest';

export interface PendingIdentity { fuente: string; identificador: string; observacion: { nombre?: string; iata?: string; icao?: string } }
interface AirportOption { id: string; nombre: string; iata: string | null; icao: string | null }

export function useSourceIdentities() {
  const request = useBackendRequest();
  const identities = ref<PendingIdentity[]>([]);
  const airports = ref<AirportOption[]>([]);
  const loading = ref(false), error = ref('');
  const pagina = ref(1);
  async function load() {
    loading.value = true;
    error.value = '';
    try { identities.value = await request<PendingIdentity[]>('/administracion/fuentes/identidades', { query: { pagina: pagina.value, limite: 20 } }); }
    catch { error.value = 'No se pudieron consultar las correspondencias pendientes.'; }
    finally { loading.value = false; }
  }
  async function changePage(delta: number) { pagina.value = Math.max(1, pagina.value + delta); await load(); }
  let searchVersion = 0;
  async function search(q: string) {
    const version = ++searchVersion;
    if (q.trim().length < 2) { airports.value = []; return; }
    try { const rows = await request<AirportOption[]>('/aeropuertos/buscar', { query: { q, limit: 20 } }); if (version === searchVersion) airports.value = rows; }
    catch { if (version === searchVersion) error.value = 'No se pudieron buscar aeropuertos.'; }
  }
  async function resolve(identity: PendingIdentity, aeropuertoId: string) {
    await request(`/administracion/fuentes/identidades/${encodeURIComponent(identity.fuente)}/${encodeURIComponent(identity.identificador)}`, { method: 'PATCH', body: { aeropuertoId } });
    await load();
  }
  return { identities, options: computed(() => airports.value.map(a => ({ label: `${a.iata ?? a.icao ?? 'Sin código'} · ${a.nombre}`, value: a.id }))), loading, error, pagina, changePage, load, search, resolve };
}
