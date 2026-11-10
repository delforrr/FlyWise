import { useBackendRequest } from '~/shared/composables/useBackendRequest';
import type { FlightRoute, RouteMetric } from '~/types/route';

interface Filtro {
  periodo: string;
  aerolineaId: string;
}
interface Opciones {
  periodoInicial: string | null;
  periodos: string[];
  aerolineas: { id: string; nombre: string; iata: string | null }[];
}

const claveRuta = ({ origenId, destinoId }: Pick<FlightRoute, 'origenId' | 'destinoId'>) =>
  `${origenId}/${destinoId}`;
const claveFiltro = ({ periodo, aerolineaId }: Filtro) => `${periodo}/${aerolineaId}`;

export function useRouteMetricOverlay() {
  const filtro = useState<Filtro>('mapa-metricas-filtro', () => ({ periodo: '', aerolineaId: '' }));
  const opciones = useState<Opciones | null>('mapa-metricas-opciones', () => null);
  const resultado = useState<{ clave: string; porRuta: Record<string, RouteMetric> } | null>(
    'mapa-metricas-resultados', () => null,
  );
  function conMetricas(ruta: FlightRoute): FlightRoute {
    if (ruta.flightType === 'connecting' || resultado.value?.clave !== claveFiltro(filtro.value)) return ruta;
    const metricas = resultado.value.porRuta[claveRuta(ruta)];
    return metricas ? { ...ruta, metricas, averageOtp15: metricas.otp15 } : ruta;
  }
  return { filtro, resultado, opciones, conMetricas };
}

export function useRouteMetrics() {
  const request = useBackendRequest({ notificarError: false });
  const { filtro, resultado, opciones } = useRouteMetricOverlay();
  const cargandoOpciones = useState('mapa-metricas-cargando-opciones', () => false);
  const errorOpciones = useState('mapa-metricas-error-opciones', () => false);
  const cargando = useState('mapa-metricas-cargando', () => false);
  const error = useState('mapa-metricas-error', () => false);
  const secuencia = useState('mapa-metricas-secuencia', () => 0);
  const reconsulta = useState('mapa-metricas-reconsulta', () => 0);

  async function cargarOpciones(actualizar = false) {
    if (cargandoOpciones.value || (opciones.value && !actualizar)) return;
    cargandoOpciones.value = true;
    errorOpciones.value = false;
    try {
      const datos = await request<Opciones>('/metricas/mapa/opciones');
      opciones.value = datos;
      const { periodo, aerolineaId } = filtro.value;
      filtro.value = {
        periodo: datos.periodos.includes(periodo) ? periodo : datos.periodoInicial ?? '',
        aerolineaId: datos.aerolineas.some(({ id }) => id === aerolineaId) ? aerolineaId : '',
      };
    } catch {
      errorOpciones.value = true;
    } finally {
      cargandoOpciones.value = false;
    }
  }

  async function cargar(rutas: FlightRoute[]) {
    const id = ++secuencia.value;
    const { periodo, aerolineaId } = filtro.value;
    const pares = [...new Map(
      rutas.filter((ruta) => ruta.flightType !== 'connecting').map(({ origenId, destinoId }) => {
        const par = { origenId, destinoId };
        return [claveRuta(par), par] as const;
      }),
    ).values()];
    error.value = false;
    if (!periodo || !pares.length) {
      resultado.value = null;
      cargando.value = false;
      return;
    }
    const clave = claveFiltro({ periodo, aerolineaId });
    const vigente = () => id === secuencia.value && clave === claveFiltro(filtro.value);
    cargando.value = true;
    try {
      const datos = await request<RouteMetric[]>('/metricas/mapa', {
        method: 'POST',
        body: { periodo, ...(aerolineaId ? { aerolineaId } : {}), pares },
      });
      if (vigente()) {
        resultado.value = { clave, porRuta: Object.fromEntries(datos.map((fila) => [claveRuta(fila), fila])) };
      }
    } catch {
      if (vigente()) error.value = true;
    } finally {
      if (vigente()) cargando.value = false;
    }
  }

  async function actualizar() {
    const anterior = claveFiltro(filtro.value);
    await cargarOpciones(true);
    if (anterior === claveFiltro(filtro.value)) reconsulta.value++;
  }

  return { filtro, opciones, cargandoOpciones, errorOpciones, cargando, error, reconsulta, cargarOpciones, cargar, actualizar };
}
