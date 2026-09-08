export interface TestScenario {
  id: string;
  title: string;
  description: string;
  originIata: string | null;
  destinationIata: string | null;
  badgeText: string;
  badgeColor?: "success" | "warning" | "error" | "info" | "primary" | "neutral";
}

export const TEST_SCENARIOS: TestScenario[] = [
  {
    id: "hub-eze",
    title: "🇦🇷 Hub Buenos Aires (EZE)",
    description: "Múltiples rutas conectadas: domésticas, regionales y transatlánticas desde Ezeiza.",
    originIata: "EZE",
    destinationIata: null,
    badgeText: "15 rutas",
    badgeColor: "primary",
  },
  {
    id: "hub-mad",
    title: "🇪🇸 Hub Madrid-Barajas (MAD)",
    description: "Red europea y vuelos intercontinentales saliendo de España.",
    originIata: "MAD",
    destinationIata: null,
    badgeText: "10 rutas",
    badgeColor: "info",
  },
  {
    id: "eze-mia-comparison",
    title: "✈️ Comparativa EZE ➔ MIA",
    description: "Ruta directa con aerolíneas en competencia y opciones con escala (vía GRU / BOG).",
    originIata: "EZE",
    destinationIata: "MIA",
    badgeText: "Multiopción",
    badgeColor: "warning",
  },
  {
    id: "eze-mad-high-otp",
    title: "🟢 Ruta Confiable: EZE ➔ MAD",
    description: "Excelente puntualidad promedio (91.2% OTP-15) con Iberia y Aerolíneas Argentinas.",
    originIata: "EZE",
    destinationIata: "MAD",
    badgeText: "OTP > 90%",
    badgeColor: "success",
  },
  {
    id: "critical-delays",
    title: "🔴 Ruta Crítica: EZE ➔ JFK",
    description: "Alta probabilidad de retrasos (OTP 54.8%) y demoras promedio superiores a 45 min.",
    originIata: "EZE",
    destinationIata: "JFK",
    badgeText: "Crítico",
    badgeColor: "error",
  },
  {
    id: "global-view",
    title: "🌍 Red Global de Rutas",
    description: "Visualización completa de todas las rutas mundiales del dataset sin filtros.",
    originIata: null,
    destinationIata: null,
    badgeText: "Todas",
    badgeColor: "primary",
  },
];
