# Reglas de Documentación Técnica y Diagramación (Doc Writer)

Reglas para la redacción de especificaciones, diagramas y comentarios de código.

---

## 1. Diagramas Mermaid

- **Tipos Permitidos:** `flowchart TD / LR`, `sequenceDiagram`, `erDiagram`, `classDiagram`, `stateDiagram-v2`.
- **Sintaxis Segura:**
  - Encerrar siempre entre comillas los nodos con caracteres especiales o paréntesis: `node["Etiqueta (Info Extra)"]`.
  - No utilizar tags HTML crudos en los labels de Mermaid.

---

## 2. Documentación de Código (TSDoc / Swagger)

- **Controladores NestJS:** Todos los endpoints deben tener anotaciones `@ApiTags`, `@ApiOperation` y decoradores de respuesta `@ApiResponse({ status: 200, ... })`.
- **Servicios Críticos:** Funciones matemáticas y geoespaciales (como cálculo de distancias ortodrómicas haversine y fórmulas OTP-15) deben incluir bloques TSDoc con `@param`, `@returns` y ejemplo de uso.

---

## 3. Sincronización de Especificaciones

- Cada cambio en modelos de base de datos o endpoints debe reflejarse en `gemini.md` y en el documento de especificación formal de requisitos `.agents/srs.md`.
