import type { CountryLocale } from '~/shared/composables/useCountryLocale';

const nameKey = /^name(?:(?:_|:)[a-z]+)?$/;

function hasName(value: unknown): boolean {
  if (typeof value === 'string') return /\{name(?:(?:_|:)[a-z]+)?\}/.test(value);
  if (!Array.isArray(value) || value[0] === 'literal') return false;
  return (value[0] === 'get' && typeof value[1] === 'string' && nameKey.test(value[1])) || value.some(hasName);
}

export function localizeMapLabel(value: unknown, locale: CountryLocale): unknown {
  const preferName = (fallback: unknown) => ['case', ...[`name:${locale}`, `name_${locale}`, 'name'].flatMap(key =>
    [['all', ['has', key], ['!=', ['get', key], '']], ['get', key]]), fallback];
  if (typeof value === 'string' && hasName(value)) {
    const parts = value.split(/(\{[^}]+\})/).filter(Boolean).map(part => {
      if (!part.startsWith('{')) return part;
      const key = part.slice(1, -1);
      return nameKey.test(key) ? preferName(['get', key]) : ['to-string', ['get', key]];
    });
    return parts.length === 1 ? parts[0] : ['concat', ...parts];
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && 'stops' in value && Array.isArray(value.stops)) {
    const stops = value.stops as [number, unknown][];
    if (!stops.length) return value;
    return ['step', ['zoom'], localizeMapLabel(stops[0]![1], locale),
      ...stops.slice(1).flatMap(([zoom, label]) => [zoom, localizeMapLabel(label, locale)])];
  }
  if (!Array.isArray(value)) return value;
  if (value[0] === 'step' && Array.isArray(value[1]) && value[1][0] === 'zoom') {
    return value.map((part, index) => index >= 2 && index % 2 === 0 ? localizeMapLabel(part, locale) : part);
  }
  if (value[0] === 'format') {
    return value.map((part, index) => index % 2 === 1 ? localizeMapLabel(part, locale) : part);
  }
  return hasName(value) ? preferName(value) : value;
}
