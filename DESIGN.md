# FlyWise — Aeronautical Intelligence System
## Design System Specification (Simplified)

```yaml
name: Aeronautical Intelligence System
colors:
  # Base & Surfaces (Cockpit Dark Mode)
  background: '#070b14'        # Fondo base profundo / espacio
  surface: '#0f1418'           # Paneles HUD principales y tarjetas
  surface-elevated: '#171c20'  # Modales, tooltips, flyouts
  surface-card: '#1b2024'      # Tarjetas secundarias y contenedores anidados
  border: '#252b2e'            # Bordes sutiles y divisores
  border-highlight: '#3e484f'  # Bordes activos o hover

  # Tipografía y Contraste
  text-primary: '#dee3e8'      # Texto principal, títulos y métricas clave
  text-muted: '#87929a'        # Subtítulos, labels y metadatos
  text-dim: '#59656e'          # Placeholders e indicadores secundarios

  # Marca e Interacción (Aero HUD)
  primary: '#38bdf8'           # Aero Cyan: Botones de acción, rutas activas, focus
  primary-glow: '#7bd0ff'      # Resplandor de radar y glow de interacción
  secondary: '#3b82f6'         # Electric Cobalt: Gradientes de ruta, acentos secundarios

  # Semántica de Confiabilidad de Vuelo (OTP-15)
  otp-good: '#10b981'          # Alta puntualidad (> 85%) - Emerald Green
  otp-warning: '#f59e0b'       # Puntualidad moderada / riesgo de demora (60-85%) - Amber Gold
  otp-critical: '#ef4444'      # Demora crítica / cancelaciones (< 60%) - Crimson Coral

typography:
  display:
    fontFamily: Geist, sans-serif
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.03em
  headline:
    fontFamily: Geist, sans-serif
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body:
    fontFamily: Inter, sans-serif
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  data-mono:
    fontFamily: JetBrains Mono, monospace
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-caps:
    fontFamily: JetBrains Mono, monospace
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.08em
    textTransform: uppercase

rounded:
  sm: 0.375rem   # 6px - tags, micro-badges
  md: 0.5rem     # 8px - botones secundarios, inputs
  lg: 0.75rem    # 12px - botones principales, selectores
  xl: 1rem       # 16px - paneles HUD, tarjetas flotantes
  full: 9999px   # Pills de estado OTP-15

spacing:
  base-unit: 4px
  panel-padding: 16px
  card-padding: 12px
  gutter: 12px
```

---

## 🎨 Principios Visuales & Estilo

### 1. Estética "Mission Control"
- **Dark-Mode First:** Fondo oscuro profundo (`#070b14` y `#0f1418`) para maximizar el contraste de las capas de telemetría geoespacial y arcos WebGL.
- **Glassmorphism Refractivo:** Paneles flotantes translúcidos con `backdrop-blur-xl`, fondo `rgba(15, 20, 24, 0.85)` y borde tenue de 1px (`rgba(37, 43, 46, 0.8)`).
- **Alineación de Datos:** Uso estricto de fuente monospaciada (`JetBrains Mono`) para códigos de aeropuerto IATA/ICAO, números de vuelo, coordenadas, porcentajes OTP y marcas de tiempo.

### 2. Semántica de Puntualidad (OTP-15)
Las rutas en el mapa Deck.gl y los badges de aerolíneas usan una codificación cromática fija:
- 🟢 **Verde Esmeralda (`#10b981`):** Puntualidad excelente ($\ge 85\%$).
- 🟡 **Ámbar Dorado (`#f59e0b`):** Puntualidad media / riesgo de demora ($60\% - 85\%$).
- 🔴 **Carmesí Coral (`#ef4444`):** Puntualidad deficiente / alta tasa de cancelaciones ($< 60\%$).

### 3. Componentes HUD Clave
- **HUD Panel:** Contenedor base de tarjetas y dashboards con borde superior reflectivo sutil.
- **Pill Badges OTP:** Fondos con 15-20% de opacidad y texto al 100% en el color semántico correspondiente.
- **Botones de Acción:** Gradiente interactivo de `Electric Cobalt` a `Aero Cyan` con feedback táctil (`active:scale-95`).
- **Inputs Cockpit:** Fondo oscuro profundo (`#070b14` / `#0a0f12`), borde sutil y anillo de foco en `Aero Cyan` con resplandor suave.
