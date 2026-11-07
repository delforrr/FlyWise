import { computed } from 'vue';
import { countryName } from '../utils/countryNames';

export type CountryLocale = 'es' | 'en';

export function useCountryLocale() {
  const cookie = useCookie<string>('flywise_locale', {
    default: () => 'es', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365,
  });
  const state = useState<CountryLocale>('country_locale', () => cookie.value === 'en' ? 'en' : 'es');
  const locale = computed({
    get: () => state.value,
    set: (value: CountryLocale) => { state.value = value === 'en' ? 'en' : 'es'; cookie.value = state.value; },
  });
  return { locale, countryName: (original: string, iso?: string | null) => countryName(original, iso, locale.value) };
}
