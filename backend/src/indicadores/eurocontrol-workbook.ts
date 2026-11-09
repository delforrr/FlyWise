import ExcelJS from 'exceljs';
import { withWorkbookArchive } from './workbook-archive.js';
import type { EurocontrolProduct } from './indicadores.dto.js';

const DAY_MS = 86_400_000;
const RATIOS = ['ARR_PUN', 'DEP_PUN', 'OPE_SCH'];
const NETWORK_COUNTS = [
  'ARR',
  'DEP',
  'ARR_PUNCTUAL_FLIGHTS',
  'DEP_PUNCTUAL_FLIGHTS',
  'ARR_SCHED_FLIGHTS',
  'DEP_SCHED_FLIGHTS',
  'MISSING_SCHED_FLIGHTS',
  'DEP_NO_OVERFLIGHTS',
];
const STAKEHOLDER_COUNTS = [
  'ARR_PUNCTUAL',
  'DEP_PUNCTUAL',
  'ARR_SCHED',
  'DEP_SCHED',
  'MISSING_SCHED_FLIGHTS',
  'DEP_NO_OVERFLIGHTS',
];
type Period = 'DY' | 'WK' | 'Y2D';

function requiredMetrics(network: boolean, period: Period) {
  if (network) return period === 'DY' ? [...RATIOS, ...NETWORK_COUNTS] : RATIOS;
  const volume = period === 'DY' ? ['ARR', 'DEP'] : ['AVG_ARR', 'AVG_DEP'];
  return [...RATIOS, ...volume, ...STAKEHOLDER_COUNTS];
}

export interface IndicadorNativo {
  ambito: string;
  entidad: string;
  nombre: string;
  granularidad: string;
  desde: string;
  hasta: string;
  valores: Record<string, number | null>;
}
function value(cell: ExcelJS.CellValue): string | number | Date | null {
  if (cell == null) return null;
  if (
    typeof cell === 'string' ||
    typeof cell === 'number' ||
    cell instanceof Date
  )
    return cell;
  if (typeof cell === 'object' && 'result' in cell)
    return value(cell.result ?? null);
  if (typeof cell === 'object' && 'richText' in cell)
    return cell.richText.map((part) => part.text).join('');
  if (typeof cell === 'object' && 'error' in cell) return null;
  throw new Error(
    'Tipo de celda EUROCONTROL desconocido: ' + JSON.stringify(cell),
  );
}
function date(input: ReturnType<typeof value>): Date {
  const result =
    input instanceof Date
      ? input
      : typeof input === 'number'
        ? new Date(Date.UTC(1899, 11, 30) + input * DAY_MS)
        : new Date(String(input));
  if (
    !Number.isFinite(result.getTime()) ||
    result.getTime() % DAY_MS !== 0 ||
    result.getUTCFullYear() < 2000 ||
    result.getUTCFullYear() > 2100
  )
    throw new Error('Fecha EUROCONTROL inválida');
  return result;
}
function record(
  ambito: string,
  entidad: string,
  nombre: string,
  granularidad: string,
  day: Date,
  valores: Record<string, number | null>,
): IndicadorNativo {
  const start = new Date(day);
  if (granularidad === 'WK') start.setUTCDate(start.getUTCDate() - 6);
  if (granularidad === 'Y2D') {
    start.setUTCMonth(0, 1);
  }
  for (const [key, n] of Object.entries(valores)) {
    if (
      n !== null &&
      (!Number.isFinite(n) ||
        n < 0 ||
        (RATIOS.includes(key) && n > 1) ||
        (!RATIOS.includes(key) &&
          !key.startsWith('AVG_') &&
          !Number.isInteger(n)))
    )
      throw new Error(`Indicador EUROCONTROL inválido: ${key}`);
  }
  return {
    ambito,
    entidad,
    nombre,
    granularidad,
    desde: start.toISOString().slice(0, 10),
    hasta: day.toISOString().slice(0, 10),
    valores,
  };
}
export function readEurocontrolWorkbook(
  path: string,
  producto: EurocontrolProduct,
  onBatch: (rows: IndicadorNativo[]) => Promise<void>,
) {
  return withWorkbookArchive(path, (verifiedPath, notices) =>
    readVerifiedWorkbook(verifiedPath, producto, notices, onBatch),
  );
}

async function readVerifiedWorkbook(
  path: string,
  producto: EurocontrolProduct,
  notices: string[],
  onBatch: (rows: IndicadorNativo[]) => Promise<void>,
) {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(path, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    styles: 'cache',
    hyperlinks: 'ignore',
  });
  const metadata: string[][] = [];
  const seen = new Set<string>();
  const network = producto === 'network';
  const periods: Period[] = network ? ['DY', 'WK'] : ['DY', 'WK', 'Y2D'];
  const required = periods.map((period) => requiredMetrics(network, period));
  let stakeholderDay: number | undefined;
  let batch: IndicadorNativo[] = [],
    total = 0;
  const append = async (row: IndicadorNativo) => {
    batch.push(row);
    total++;
    if (batch.length === 1000) {
      await onBatch(batch);
      batch = [];
    }
  };
  for await (const sheet of reader) {
    const name =
      'name' in sheet && typeof sheet.name === 'string' ? sheet.name : '';
    const dataSheet = network
      ? name === 'Data'
      : name === 'COUNTRY' || name === 'AIRPORT';
    let headers: string[] = [];
    let rows = 0;
    let previousDay: number | undefined;
    for await (const row of sheet) {
      if (row.number > 1000000 || row.cellCount > 100)
        throw new Error('Límite de filas/columnas XLSX');
      const cells = Array.from({ length: row.cellCount }, (_, i) =>
        value(row.getCell(i + 1).value),
      );
      if (!dataSheet) {
        const text = cells
          .map((cell) => (cell == null ? '' : String(cell)))
          .filter(Boolean);
        if (name === 'Metadata' && text.length) {
          if (metadata.length >= 200)
            throw new Error('Metadata demasiado grande');
          metadata.push(text);
        }
        if (
          name === 'Copyright notice and disclaimer' &&
          text.some((t) => t.trim())
        )
          notices.push(text.join('\n'));
        continue;
      }
      if (!headers.length) {
        headers = cells.map((c) => String(c ?? '').trim());
        const base = network
          ? ['UNIT_CODE', 'DATE']
          : ['RANK', 'LAST_DATA_DAY'];
        const identities =
          name === 'COUNTRY' ? ['COUNTRY'] : ['APT_CODE', 'APT_NAME'];
        const expected = periods.flatMap((period, index) =>
          network
            ? required[index].map((key) => `${key}_${period}`)
            : [...identities, ...required[index]].map(
                (key) => `${period}_${key}`,
              ),
        );
        if (
          new Set(headers).size !== headers.length ||
          ![...base, ...expected].every((header) => headers.includes(header))
        )
          throw new Error(`Cabecera EUROCONTROL desconocida: ${name}`);
        continue;
      }
      if (cells.every((cell) => cell === null)) continue;
      const fields = Object.fromEntries(
        headers.map((header, i) => [header, cells[i] ?? null]),
      );
      const day = date(fields[network ? 'DATE' : 'LAST_DATA_DAY']);
      if (
        network &&
        previousDay !== undefined &&
        day.getTime() !== previousDay + DAY_MS
      )
        throw new Error(
          'Fecha no consecutiva en la cobertura de red EUROCONTROL',
        );
      if (
        !network &&
        stakeholderDay !== undefined &&
        day.getTime() !== stakeholderDay
      )
        throw new Error(
          'Fecha de cierre inconsistente en los rankings EUROCONTROL',
        );
      if (!network) stakeholderDay = day.getTime();
      previousDay = day.getTime();
      rows++;
      for (const [index, period] of periods.entries()) {
        const entity = network
          ? fields.UNIT_CODE
          : fields[`${period}_${name === 'COUNTRY' ? 'COUNTRY' : 'APT_CODE'}`];
        const label =
          network || name === 'COUNTRY' ? entity : fields[`${period}_APT_NAME`];
        if (
          typeof entity !== 'string' ||
          !entity.trim() ||
          typeof label !== 'string' ||
          !label.trim()
        )
          throw new Error('Entidad EUROCONTROL ausente');
        const values: Record<string, number | null> = {};
        for (const [key, raw] of Object.entries(fields)) {
          const metric = network
            ? key.endsWith(`_${period}`)
              ? key.slice(0, -period.length - 1)
              : null
            : key.startsWith(`${period}_`)
              ? key.slice(period.length + 1)
              : null;
          if (!metric || ['COUNTRY', 'APT_CODE', 'APT_NAME'].includes(metric))
            continue;
          if (raw !== null && typeof raw !== 'number')
            throw new Error(`Valor EUROCONTROL no numérico: ${key}`);
          values[metric] = raw;
        }
        const block = required[index].map((key) => values[key]);
        if (
          network &&
          period === 'WK' &&
          rows <= 6 &&
          block.every((value) => value === null)
        )
          continue;
        if (block.some((value) => value == null))
          throw new Error(`Bloque incompleto EUROCONTROL: ${name} ${period}`);
        if (!network) {
          if (
            typeof fields.RANK !== 'number' ||
            !Number.isInteger(fields.RANK) ||
            fields.RANK < 1
          )
            throw new Error('Puesto de ranking EUROCONTROL inválido');
          values.RANK = fields.RANK;
        }
        await append(
          record(
            network ? 'NETWORK' : name,
            entity,
            label,
            period,
            day,
            values,
          ),
        );
        seen.add(name);
      }
    }
  }
  if (batch.length) await onBatch(batch);
  if (
    !total ||
    !metadata.length ||
    !notices.length ||
    (network ? !seen.has('Data') : !seen.has('COUNTRY') || !seen.has('AIRPORT'))
  )
    throw new Error(
      'Workbook EUROCONTROL incompleto: datos, metodología o atribución ausentes',
    );
  return { total, metadata, aviso: notices.join('\n\n') };
}
