import { OPENFLIGHTS_COLUMNS, type CatalogDataset } from '../catalog.js';

// OpenFlights has no header: field order is part of its published contract.
export function readOpenFlightsRow(
  dataset: CatalogDataset,
  row: Record<string, string>,
): Record<string, unknown> {
  const columns = OPENFLIGHTS_COLUMNS[dataset];
  if (Object.keys(row).length !== columns.length)
    throw new Error('columns: cantidad incorrecta');
  return Object.fromEntries(
    columns.map((field, index) => [field, row[String(index)]]),
  );
}
