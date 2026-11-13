<script setup lang="ts">
type Config = { periodo: string; pausado: boolean; expresionCron: string };
type Coverage = { periodo: string; filas: number; publicadoEn: string; ejecucionId: string; descartadas?: number };
type Pending = { identificador: string; codigo: string };
type Job = { id: string; periodo: string | null; iniciadoEn: string | null; intento: number; estado: string; filasTotales: number; filasProcesadas: number; filasDescartadas: number; mensajeError: string | null };
const request = useBackendRequest();
const config = reactive<Config>({ periodo: '', pausado: true, expresionCron: '' });
const mesGuardado = ref('');
const primerPeriodo = '1987-10';
// shortcut: el último mes publicado se actualiza manualmente hasta integrar la disponibilidad de BTS.
const ultimoPeriodo = '2026-08';
const primerAnio = Number(primerPeriodo.slice(0, 4));
const ultimoAnio = Number(ultimoPeriodo.slice(0, 4));
const anios = Array.from({ length: ultimoAnio - primerAnio + 1 }, (_, index) => String(ultimoAnio - index));
const anio = ref('');
const formatoMes = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' });
const meses = computed(() =>
  Array.from({ length: 12 }, (_, index) => {
    const value = `${anio.value}-${String(index + 1).padStart(2, '0')}`;
    const mes = formatoMes.format(Date.UTC(2000, index));
    return { value, label: mes.charAt(0).toUpperCase() + mes.slice(1) };
  }).filter(({ value }) => value >= primerPeriodo && value <= ultimoPeriodo),
);
const periodoValido = computed(() => meses.value.some(({ value }) => value === config.periodo));
function elegirAnio(value: string) {
  anio.value = value;
  config.periodo = '';
}
function aplicarConfiguracionGuardada() {
  anio.value = config.periodo.slice(0, 4) || String(ultimoAnio);
  mesGuardado.value = config.periodo;
}

const coverage = ref<Coverage[]>([]);
const jobs = ref<Job[]>([]);
const enviando = ref(false);
const ejecucionSeguida = ref('');
const activa = (job: Job) => job.estado === 'pending' || job.estado === 'running';
const ejecucionVisible = computed(() =>
  jobs.value.find(job => job.id === ejecucionSeguida.value) ??
  jobs.value.find(activa) ??
  jobs.value.find(job => job.periodo === mesGuardado.value),
);
const mesEnCurso = (periodo: string | null) =>
  jobs.value.some(job => job.periodo === periodo && activa(job));
const pending = ref<Pending[]>([]);
const total = ref(0);
const pagina = ref(1);
const tipo = ref<'aeropuertos' | 'operadores'>('aeropuertos');
const busy = ref(false);
const loading = ref(true);
const error = ref('');
const notice = ref('');
const selected = ref<Pending | null>(null);
const busqueda = ref('');
const candidates = ref<{ id: string; nombre: string }[]>([]);
const entidadId = ref('');
const samples = ref<{numeroFila: number; motivo: string; muestraOriginal: string}[]>([]);
const detalleJob = ref<Job | null>(null);
const intentoDetalle = ref(1);
const number = (value: number) => value.toLocaleString('es-AR');
const estados: Record<string, string> = {pending:'En cola',running:'En curso',completed:'Completada',failed:'Fallida'};
async function loadPending() {
  const response = await request<{datos:Pending[];total:number}>('/administracion/bts/correspondencias', {query:{tipo:tipo.value,pagina:pagina.value}});
  pending.value = response.datos; total.value = response.total;
}
async function refresh() {
  [coverage.value,jobs.value] = await Promise.all([
    request<Coverage[]>('/administracion/bts/cobertura'), request<Job[]>('/administracion/bts/ejecuciones'),
  ]);
  await loadPending();
}
async function perform(work:()=>Promise<void>, automatico = false) {
  busy.value = true;
  if (!automatico) { error.value='';notice.value=''; }
  try { await work(); }
  catch { error.value='No se pudo completar la operación. Revisá el estado de BTS y volvé a intentar.'; }
  finally { busy.value=false; }
}
async function save() {
  if (!periodoValido.value) return;
  await perform(async()=>{
    await request('/administracion/bts/configuracion',{method:'PATCH',body:{...config}});
    aplicarConfiguracionGuardada();
    notice.value='Configuración guardada. La programación usa UTC y el mes seleccionado.';
  });
}
async function run(job?: Job) {
  const periodo = job?.periodo ?? config.periodo;
  if (busy.value || loading.value || mesEnCurso(periodo) || (!job && !periodoValido.value)) return;

  enviando.value = true;
  await perform(async () => {
    const path = job
      ? `/administracion/bts/ejecuciones/${job.id}/reintentar`
      : '/administracion/bts/ejecutar';
    const { ejecucionId } = await request<{ ejecucionId: string }>(path, {
      method: 'POST',
      body: job ? undefined : { periodo },
    });
    ejecucionSeguida.value = ejecucionId;
    jobs.value.unshift({
      id: ejecucionId, periodo, estado: 'pending', iniciadoEn: null, intento: 0,
      filasTotales: 0, filasProcesadas: 0, filasDescartadas: 0, mensajeError: null,
    });
    await refresh();
  });
  enviando.value = false;
}
async function abrirCorrespondencia(row: Pending) {
  selected.value = row;
  candidates.value = [];
  busqueda.value = row.codigo;
  entidadId.value = '';
  if (row.codigo) await search();
}
async function search() {
  await perform(async()=>{
    const resource=tipo.value==='operadores'?'aerolineas':'aeropuertos';
    const result=await request<{datos:{id:string;nombre:string}[]}>(`/administracion/${resource}`,{query:{busqueda:busqueda.value}});
    candidates.value=result.datos;entidadId.value='';
  });
}
async function resolve() {
  if(!selected.value || !entidadId.value)return;
  await perform(async()=>{
    await request('/administracion/bts/correspondencias',{method:'PATCH',body:{tipo:tipo.value,identificador:selected.value!.identificador,entidadId:entidadId.value}});
    selected.value=null;pagina.value=1;await loadPending();notice.value='Correspondencia guardada. Reintentá el mes para incorporar las operaciones.';
  });
}
async function loadSamples() {
  if (!detalleJob.value) return;
  const id = detalleJob.value.id;
  await perform(async()=>{
    samples.value=[];
    samples.value=await request(`/administracion/bts/ejecuciones/${id}/descartes`,{query:{intento:intentoDetalle.value}});
  });
}
async function details(job:Job) {
  detalleJob.value=job;
  intentoDetalle.value=job.intento;
  await loadSamples();
}
watch(tipo,()=>{pagina.value=1;selected.value=null;void perform(loadPending);});
async function init() {
  await perform(async()=>{Object.assign(config,await request<Config>('/administracion/bts/configuracion'));aplicarConfiguracionGuardada();await refresh();});
  loading.value=false;
}
void init();
let timer:ReturnType<typeof setInterval>|undefined;
onMounted(()=>{timer=setInterval(()=>{if(!busy.value && jobs.value.some(activa))void perform(refresh, true);},5000);});
onUnmounted(()=>clearInterval(timer));
</script>

<template>
  <section class="space-y-6" :aria-busy="busy || loading">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">Carga de OTP</h1>
        <p class="mt-1 text-sm text-text-muted">Importá vuelos de BTS para calcular la puntualidad por ruta.</p>
      </div>

    </header>
    <div v-if="enviando || ejecucionVisible" class="space-y-2 rounded-lg border border-border-subtle bg-surface-card p-4">
      <p role="status" class="font-medium">
        <template v-if="enviando">Enviando solicitud de importación…</template>
        <template v-else-if="ejecucionVisible">
          {{ ejecucionVisible.periodo }} · {{ ejecucionVisible.estado === 'completed' && ejecucionVisible.filasDescartadas ? 'Publicación parcial' : estados[ejecucionVisible.estado] ?? ejecucionVisible.estado }}
        </template>
      </p>
      <template v-if="ejecucionVisible && !enviando">
        <UProgress v-if="activa(ejecucionVisible)" aria-label="Progreso de importación BTS" />
        <p class="text-sm text-text-muted">
          {{ number(ejecucionVisible.filasTotales) }} leídas ·
          {{ number(ejecucionVisible.filasProcesadas) }} procesadas ·
          {{ number(ejecucionVisible.filasDescartadas) }} descartadas
        </p>
        <p v-if="ejecucionVisible.estado === 'pending'" class="text-sm text-text-muted">Esperando un worker.</p>
        <p v-else-if="ejecucionVisible.estado === 'running'" class="text-sm text-text-muted">Los conteos se actualizan automáticamente cada 5 segundos.</p>
        <template v-else-if="ejecucionVisible.estado === 'failed'">
          <p class="text-sm text-error">{{ ejecucionVisible.mensajeError ?? 'La importación falló.' }}</p>

        </template>
        <a v-if="!activa(ejecucionVisible) && ejecucionVisible.filasDescartadas" href="#bts-identities" class="text-sm underline">Revisar correspondencias pendientes</a>
      </template>
    </div>
    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
    <p v-if="notice" role="status" class="text-sm">{{ notice }}</p>
    <p v-if="loading" role="status">Cargando BTS…</p>
    <form aria-label="Configurar BTS" class="rounded-lg bg-surface-card p-4 sm:p-5 space-y-4" @submit.prevent="run()">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Año" required>
          <USelect :model-value="anio || undefined" :items="anios" class="w-full" :disabled="busy || loading" placeholder="Seleccioná un año" @update:model-value="elegirAnio" />
        </UFormField>
        <UFormField label="Mes observado" required>
          <USelect v-model="config.periodo" :items="meses" class="w-full" :disabled="busy || loading || !anio" placeholder="Seleccioná un mes" />
        </UFormField>
      </div>
      <UButton type="submit" icon="i-lucide-download" class="min-h-11 w-full justify-center sm:w-auto"
        :loading="enviando" :disabled="busy || loading || !periodoValido || mesEnCurso(config.periodo)">
        Cargar mes
      </UButton>
    </form>
    <UCollapsible>
      <UButton variant="ghost" color="neutral" trailing-icon="i-lucide-chevron-down" class="min-h-11">Programar cargas</UButton>
      <template #content>
        <form aria-label="Programar BTS" class="mt-2 space-y-4 rounded-lg border border-border-subtle p-4" @submit.prevent="save">
          <UFormField label="Programación mensual UTC" help="Ingresá una expresión cron mensual. Dejala vacía para desactivar la programación.">
            <UInput v-model="config.expresionCron" class="w-full" placeholder="0 4 15 * *" :disabled="busy" />
          </UFormField>
          <USwitch v-model="config.pausado" label="Programación pausada" :disabled="busy" />
          <UButton type="submit" color="neutral" variant="outline" :disabled="busy || loading || !periodoValido">Guardar programación</UButton>
        </form>
      </template>
    </UCollapsible>
    <section aria-labelledby="bts-coverage">
      <h2 id="bts-coverage" class="text-lg font-semibold">Cobertura publicada</h2>
      <p v-if="!coverage.length" class="text-sm text-text-muted py-4">Todavía no hay un mes BTS completo publicado.</p>
      <ul v-else class="divide-y divide-border-subtle">
        <li v-for="row in coverage" :key="row.periodo" class="flex flex-wrap justify-between gap-2 py-3"><span>{{ row.periodo }} · <span class="tabular-nums">{{ number(row.filas) }}</span> operaciones<span v-if="row.descartadas"> · Parcial · {{ number(row.descartadas) }} sin vínculo</span></span><span class="text-sm text-text-muted">Publicado {{ row.publicadoEn }}</span></li>
      </ul>
    </section>
    <section aria-labelledby="bts-jobs">
      <div class="flex justify-between gap-4"><h2 id="bts-jobs" class="text-lg font-semibold">Últimas ejecuciones</h2><UButton color="neutral" variant="outline" :disabled="busy" @click="perform(refresh)">Actualizar</UButton></div>
      <p v-if="!jobs.length" class="text-sm text-text-muted py-4">Aún no se ejecutó ninguna carga.</p>
      <ul class="divide-y divide-border-subtle">
        <li v-for="job in jobs" :key="job.id" class="py-3 space-y-1">
          <div class="flex flex-wrap justify-between gap-2"><div><p><strong>{{ job.periodo ?? 'Mes sin registrar' }}</strong> · {{ estados[job.estado] ?? job.estado }}<span v-if="job.intento"> · Intento {{ job.intento }}</span></p><p class="text-sm text-text-muted"><span class="tabular-nums">{{ number(job.filasProcesadas) }} / {{ number(job.filasTotales) }}</span> procesadas · {{ number(job.filasDescartadas) }} descartadas<span v-if="job.iniciadoEn"> · {{ job.iniciadoEn.replace('T',' ').replace('Z','') }} UTC</span></p></div><div class="flex gap-3"><UButton v-if="job.intento" color="neutral" variant="ghost" :disabled="busy" @click="details(job)">Ver descartes</UButton><UButton v-if="(job.estado==='failed' || (job.estado==='completed' && job.filasDescartadas)) && job.periodo" color="neutral" variant="ghost" :disabled="busy || mesEnCurso(job.periodo)" @click="run(job)">Reintentar</UButton></div></div>
          <p v-if="job.mensajeError" class="text-sm text-error">{{ job.mensajeError }}</p>
        </li>
      </ul>
      <div v-if="detalleJob" class="space-y-2 border-t border-border-subtle pt-3">
        <h3 class="font-semibold">Descartes · {{ detalleJob.periodo }}</h3>
        <UFormField label="Intento de ingesta">
          <USelect v-model="intentoDetalle" aria-label="Intento de ingesta" :items="Array.from({ length: detalleJob.intento }, (_, index) => index + 1)" :disabled="busy" @update:model-value="loadSamples" />
        </UFormField>
        <p v-if="!samples.length && !busy" class="text-sm text-text-muted">Sin muestras de descarte para este intento.</p>
        <ul v-else aria-label="Descartes de la ejecución" class="space-y-2 text-sm"><li v-for="sample in samples" :key="sample.numeroFila"><strong>Fila {{ sample.numeroFila }}: {{ sample.motivo }}</strong><pre class="whitespace-pre-wrap break-all text-xs text-text-muted">{{ sample.muestraOriginal }}</pre></li></ul>
      </div>
    </section>
    <section aria-labelledby="bts-identities" class="space-y-3">
      <h2 id="bts-identities" class="scroll-mt-32 text-lg font-semibold">Correspondencias pendientes <span class="text-text-muted tabular-nums">({{ total }})</span></h2>
      <UFormField label="Tipo" class="max-w-sm">
        <USelect v-model="tipo" class="w-full" :items="[{label:'Aeropuertos BTS',value:'aeropuertos'},{label:'Operadores DOT',value:'operadores'}]" :disabled="busy" />
      </UFormField>
      <p v-if="!pending.length" class="text-sm text-text-muted">No hay correspondencias pendientes.</p>
      <ul class="divide-y divide-border-subtle"><li v-for="row in pending" :key="row.identificador" class="flex items-center justify-between gap-4 py-2"><span>{{ row.codigo || 'Sin código' }} · ID BTS {{ row.identificador }}</span><UButton color="neutral" variant="ghost" :disabled="busy" @click="abrirCorrespondencia(row)">Vincular</UButton></li></ul>
      <div v-if="total>20" class="flex gap-4 items-center"><UButton color="neutral" variant="outline" :disabled="busy || pagina===1" @click="pagina--;perform(loadPending)">Anterior</UButton><span>Página {{ pagina }}</span><UButton color="neutral" variant="outline" :disabled="busy || pagina*20>=total" @click="pagina++;perform(loadPending)">Siguiente</UButton></div>
      <UModal :open="!!selected" :title="selected ? `Vincular ${selected.codigo || selected.identificador}` : 'Vincular identidad BTS'"
        :description="selected ? `ID BTS ${selected.identificador}. Elegí la entidad correspondiente en FlyWise.` : undefined"
        :dismissible="!busy" :close="!busy" @update:open="open => { if (!open) selected = null; }">
        <template #body>
          <form v-if="selected" class="space-y-4" @submit.prevent="resolve">
              <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
            <p v-else-if="!busy && !candidates.length" class="text-sm text-text-muted">Sin coincidencias. Probá con otro código o con el nombre.</p>
            <UFormField label="Buscar en el catálogo">
              <UInput v-model="busqueda" class="w-full" :disabled="busy" @keydown.enter.prevent="search" />
            </UFormField>
            <UButton type="button" color="neutral" variant="outline" :loading="busy" :disabled="!busqueda.trim()" @click="search">Buscar</UButton>
            <UFormField label="Entidad FlyWise">
              <USelect v-model="entidadId" :items="candidates" label-key="nombre" value-key="id" placeholder="Seleccioná una entidad" class="w-full" :disabled="busy || !candidates.length" />
            </UFormField>
            <div class="flex flex-wrap justify-end gap-2">
              <UButton type="button" color="neutral" variant="ghost" :disabled="busy" @click="selected = null">Cancelar</UButton>
              <UButton type="submit" :disabled="busy || !entidadId">Confirmar vínculo</UButton>
            </div>
          </form>
        </template>
      </UModal>
    </section>
  </section>
</template>
