import type { CountryLocale } from '../composables/useCountryLocale';

const displayNames: Partial<Record<CountryLocale, Intl.DisplayNames | null>> = {};

export function countryName(original: string, iso: string | null | undefined, locale: CountryLocale): string {
  if (!iso || !/^[A-Z]{2}$/.test(iso) || iso === 'ZZ') return original;
  try {
    if (displayNames[locale] === undefined) {
      displayNames[locale] = typeof Intl.DisplayNames === 'function'
        ? new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }) : null;
    }
    return displayNames[locale]?.of(iso) || original;
  } catch {
    return original;
  }
}
