<script setup lang="ts">
type Config = { periodo: string; pausado: boolean; expresionCron: string };
type Coverage = { periodo: string; filas: number; publicadoEn: string; ejecucionId: string };
type Pending = { identificador: string; codigo: string };
type Job = { id: string; periodo: string | null; iniciadoEn: string | null; intento: number; estado: string; filasTotales: number; filasProcesadas: number; filasDescartadas: number; mensajeError: string | null };
const request = useBackendRequest();
const config = reactive<Config>({ periodo: '', pausado: true, expresionCron: '' });
const coverage = ref<Coverage[]>([]);
const jobs = ref<Job[]>([]);
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
async function perform(work:()=>Promise<void>) {
  busy.value = true; error.value='';notice.value='';
  try { await work(); }
  catch { error.value='No se pudo completar la operación. Revisá el estado de BTS y volvé a intentar.'; }
  finally { busy.value=false; }
}
async function save() {
  await perform(async()=>{
    await request('/administracion/bts/configuracion',{method:'PATCH',body:{...config}});
    notice.value='Configuración guardada. La programación usa UTC y el mes seleccionado.';
  });
}
async function run(id?:string) {
  await perform(async()=>{
    await request(id?`/administracion/bts/ejecuciones/${id}/reintentar`:'/administracion/bts/ejecutar',{method:'POST'});
    await refresh();notice.value='Ejecución encolada. La cobertura anterior se conserva hasta completar el mes.';
  });
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
  await perform(async()=>{Object.assign(config,await request<Config>('/administracion/bts/configuracion'));await refresh();});
  loading.value=false;
}
void init();
let timer:ReturnType<typeof setInterval>|undefined;
onMounted(()=>{timer=setInterval(()=>{if(!busy.value && jobs.value.some(job=>['pending','running'].includes(job.estado)))void perform(refresh);},5000);});
onUnmounted(()=>clearInterval(timer));
</script>

<template>
  <section class="space-y-6" :aria-busy="busy || loading">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <h1 class="text-2xl font-semibold">BTS mensual</h1>
      <UButton color="neutral" icon="i-lucide-download" :disabled="busy || config.pausado || !config.periodo" @click="run()">Importar mes guardado</UButton>
    </header>
    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
    <p v-if="notice" role="status" class="text-sm">{{ notice }}</p>
    <p v-if="loading" role="status">Cargando BTS…</p>
    <form aria-label="Configurar BTS" class="rounded-lg bg-surface-card p-4 sm:p-5 space-y-4" @submit.prevent="save">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Mes observado"><UInput class="w-full" v-model="config.periodo" type="month" required :disabled="busy" /></UFormField>
        <UFormField label="Programación mensual UTC" hint="Opcional" help="Dejalo vacío para ejecutar manualmente."><UInput class="w-full" v-model="config.expresionCron" placeholder="0 4 15 * *" :disabled="busy" /></UFormField>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <USwitch v-model="config.pausado" label="Pausado" :disabled="busy" />
        <UButton type="submit" color="neutral" variant="outline" :disabled="busy">Guardar configuración</UButton>
      </div>
    </form>
    <section aria-labelledby="bts-coverage">
      <h2 id="bts-coverage" class="text-lg font-semibold">Cobertura publicada</h2>
      <p v-if="!coverage.length" class="text-sm text-text-muted py-4">Todavía no hay un mes BTS completo publicado.</p>
      <ul v-else class="divide-y divide-border-subtle">
        <li v-for="row in coverage" :key="row.periodo" class="flex flex-wrap justify-between gap-2 py-3"><span>{{ row.periodo }} · <span class="tabular-nums">{{ number(row.filas) }}</span> operaciones</span><span class="text-sm text-text-muted">Publicado {{ row.publicadoEn }}</span></li>
      </ul>
    </section>
    <section aria-labelledby="bts-jobs">
      <div class="flex justify-between gap-4"><h2 id="bts-jobs" class="text-lg font-semibold">Últimas ejecuciones</h2><UButton color="neutral" variant="outline" :disabled="busy" @click="perform(refresh)">Actualizar</UButton></div>
      <p v-if="!jobs.length" class="text-sm text-text-muted py-4">Aún no se ejecutó ninguna carga.</p>
      <ul class="divide-y divide-border-subtle">
        <li v-for="job in jobs" :key="job.id" class="py-3 space-y-1">
          <div class="flex flex-wrap justify-between gap-2"><div><p><strong>{{ job.periodo ?? 'Mes sin registrar' }}</strong> · {{ estados[job.estado] ?? job.estado }}<span v-if="job.intento"> · Intento {{ job.intento }}</span></p><p class="text-sm text-text-muted"><span class="tabular-nums">{{ number(job.filasProcesadas) }} / {{ number(job.filasTotales) }}</span> procesadas · {{ number(job.filasDescartadas) }} descartadas<span v-if="job.iniciadoEn"> · {{ job.iniciadoEn.replace('T',' ').replace('Z','') }} UTC</span></p></div><div class="flex gap-3"><UButton v-if="job.intento" color="neutral" variant="ghost" :disabled="busy" @click="details(job)">Ver descartes</UButton><UButton v-if="job.estado==='failed' && job.periodo" color="neutral" variant="ghost" :disabled="busy || config.pausado" @click="run(job.id)">Reintentar</UButton></div></div>
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
      <h2 id="bts-identities" class="text-lg font-semibold">Correspondencias pendientes <span class="text-text-muted tabular-nums">({{ total }})</span></h2>
      <UFormField label="Tipo" class="max-w-sm">
        <USelect v-model="tipo" class="w-full" :items="[{label:'Aeropuertos BTS',value:'aeropuertos'},{label:'Operadores DOT',value:'operadores'}]" :disabled="busy" />
      </UFormField>
      <p v-if="!pending.length" class="text-sm text-text-muted">No hay correspondencias pendientes.</p>
      <ul class="divide-y divide-border-subtle"><li v-for="row in pending" :key="row.identificador" class="flex items-center justify-between gap-4 py-2"><span>{{ row.codigo || 'Sin código' }} · ID BTS {{ row.identificador }}</span><UButton color="neutral" variant="ghost" :disabled="busy" @click="selected=row;candidates=[];busqueda=row.codigo;entidadId=''">Vincular</UButton></li></ul>
      <div v-if="total>20" class="flex gap-4 items-center"><UButton color="neutral" variant="outline" :disabled="busy || pagina===1" @click="pagina--;perform(loadPending)">Anterior</UButton><span>Página {{ pagina }}</span><UButton color="neutral" variant="outline" :disabled="busy || pagina*20>=total" @click="pagina++;perform(loadPending)">Siguiente</UButton></div>
      <form v-if="selected" class="border border-border-subtle p-4 rounded-md space-y-3" @submit.prevent="resolve">
        <h3>Vincular ID BTS {{ selected.identificador }} ({{ selected.codigo }})</h3>
        <div class="flex flex-wrap gap-3 items-end"><UFormField label="Buscar entidad FlyWise"><UInput v-model="busqueda" class="w-full" /></UFormField><UButton type="button" color="neutral" variant="outline" :disabled="busy || !busqueda.trim()" @click="search">Buscar</UButton></div>
        <UFormField label="Entidad"><USelect v-model="entidadId" :items="candidates" label-key="nombre" value-key="id" placeholder="Seleccioná una entidad" class="w-full" /></UFormField>
        <div class="flex gap-3"><UButton type="submit" color="neutral" :disabled="busy || !entidadId">Confirmar correspondencia</UButton><UButton type="button" color="neutral" variant="outline" @click="selected=null">Cancelar</UButton></div>
      </form>
    </section>
  </section>
</template>
