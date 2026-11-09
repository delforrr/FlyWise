import ExcelJS from 'exceljs';
import { validateWorkbookArchive } from './workbook-archive.js';
import type { EurocontrolProduct } from './indicadores.dto.js';
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
        ? new Date(Date.UTC(1899, 11, 30) + input * 86400000)
        : new Date(String(input));
  if (
    !Number.isFinite(result.getTime()) ||
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
        ((key === 'ARR_PUN' || key === 'DEP_PUN' || key === 'OPE_SCH') &&
          n > 1))
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
export async function readEurocontrolWorkbook(
  path: string,
  producto: EurocontrolProduct,
  onBatch: (rows: IndicadorNativo[]) => Promise<void>,
) {
  const drawings = await validateWorkbookArchive(path);
  // shortcut: official XLSX metadata precedes data sheets; reject other ZIP layouts until another producer is supported.
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(path, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    styles: 'cache',
    hyperlinks: 'ignore',
  });
  const metadata: string[][] = [];
  const notices = [...drawings];
  const seen = new Set<string>();
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
    const dataSheet =
      producto === 'network'
        ? name === 'Data'
        : name === 'COUNTRY' || name === 'AIRPORT';
    let headers: string[] = [];
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
        if (
          (producto === 'network' &&
            (!headers.includes('UNIT_CODE') ||
              !headers.includes('DATE') ||
              !headers.includes('ARR_PUN_DY'))) ||
          (producto === 'stakeholder' &&
            (!headers.includes('LAST_DATA_DAY') ||
              !headers.includes('DY_ARR_PUN') ||
              !headers.includes(
                name === 'COUNTRY' ? 'DY_COUNTRY' : 'DY_APT_CODE',
              )))
        )
          throw new Error(`Cabecera EUROCONTROL desconocida: ${name}`);
        continue;
      }
      if (cells.every((cell) => cell === null)) continue;
      const fields = Object.fromEntries(
        headers.map((header, i) => [header, cells[i] ?? null]),
      );
      const day = date(
        fields[producto === 'network' ? 'DATE' : 'LAST_DATA_DAY'],
      );
      for (const period of producto === 'network'
        ? ['DY', 'WK']
        : ['DY', 'WK', 'Y2D']) {
        const entity =
          producto === 'network'
            ? String(fields.UNIT_CODE ?? '')
            : String(
                fields[
                  `${period}_${name === 'COUNTRY' ? 'COUNTRY' : 'APT_CODE'}`
                ] ?? '',
              );
        if (!entity.trim()) throw new Error('Entidad EUROCONTROL ausente');
        const values: Record<string, number | null> = {};
        for (const [key, raw] of Object.entries(fields)) {
          const metric =
            producto === 'network'
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
        if (Object.values(values).every((v) => v === null)) continue;
        if (producto === 'stakeholder')
          values.RANK = typeof fields.RANK === 'number' ? fields.RANK : null;
        await append(
          record(
            producto === 'network' ? 'NETWORK' : name,
            entity,
            producto === 'network'
              ? entity
              : String(
                  fields[
                    `${period}_${name === 'COUNTRY' ? 'COUNTRY' : 'APT_NAME'}`
                  ] ?? entity,
                ),
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
    (producto === 'network'
      ? !seen.has('Data')
      : !seen.has('COUNTRY') || !seen.has('AIRPORT'))
  )
    throw new Error(
      'Workbook EUROCONTROL incompleto: datos, metodología o atribución ausentes',
    );
  return { total, metadata, aviso: notices.join('\n\n') };
}
