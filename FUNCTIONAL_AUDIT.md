# Reporte de Auditoría Funcional vs. Especificaciones — NailFlow

## 1. Veredicto de Funcionalidad
El sistema **falla parcialmente** en implementar las reglas de negocio críticas necesarias para una operación real. Aunque el flujo visual de reserva es impecable y la integración básica con la base de datos funciona, existen brechas graves en la lógica de cobros (webhooks no funcionales) y en el motor de disponibilidad (hardcoded y sin control de solapamiento). Actualmente, el producto es un prototipo visual conectado a una base de datos, pero no es apto para transacciones reales sin completar los circuitos de pago y agenda.

---

## 2. Requerimientos Faltantes o Simulados (Prioridad Crítica)

### A. Confirmación Automática de Pagos (Webhook de Mercado Pago)
- **Requerimiento:** El sistema debe confirmar la cita automáticamente una vez que el cliente paga la seña.
- **Estado actual en código:** El endpoint `/api/webhooks/mercadopago` es un cascarón vacío (`sendStatus(200)`). No busca el pago en Mercado Pago ni actualiza la tabla `appointments` a `status = 'confirmed'`.
- **Acción requerida:** Implementar la lógica del webhook para validar la firma de MP, consultar el estado del pago mediante el SDK y realizar el UPDATE en la base de datos.

### B. Métodos de Pago "Falsos Positivos" (Stripe, PayPal, Apple Pay)
- **Requerimiento:** Soporte para múltiples pasarelas de pago.
- **Estado actual en código:** El frontend ofrece Stripe, PayPal, etc., pero el backend (`apps/api/src/index.ts`) solo tiene lógica para `mercado` y `prueba`. Cualquier otro método creará una cita "confirmada" sin haber cobrado nada.
- **Acción requerida:** Implementar las integraciones de backend para cada pasarela o deshabilitar visualmente las opciones no soportadas hasta su desarrollo.

### C. Gestión de Agenda Real (Staff Schedules)
- **Requerimiento:** La disponibilidad debe basarse en el horario configurado del profesional (`weekly_schedule`).
- **Estado actual en código:** El endpoint `/availability` tiene un horario harcodeado de 9:00 a 21:00 (líneas 319-321 de `index.ts`). Ignora completamente la columna `weekly_schedule` de la tabla `staff`.
- **Acción requerida:** Modificar la consulta de disponibilidad para cruzarla con el horario del profesional seleccionado.

---

## 3. Fallos en Lógica de Negocio (Bugs Funcionales)

### A. Error de Solapamiento en Agenda (Conflict Check)
- **Archivo/Función:** `apps/api/src/index.ts` -> `GET /availability`
- **Comportamiento Esperado:** Si un servicio dura 2 horas, el sistema debe bloquear TODOS los slots que esa duración ocupa.
- **Problema Detectado:** El código solo verifica si el slot de *inicio* está ocupado. Permite reservar una cita a las 10:00 aunque haya otra cita de las 10:30 a las 11:30.
- **Solución Propuesta:**
```typescript
// Implementar lógica de intersección de rangos
// WHERE (new_start < existing_end) AND (new_end > existing_start)
```

### B. Zona Horaria "Brittle" (Frágil)
- **Archivo/Función:** `apps/api/src/index.ts` -> `GET /availability`
- **Comportamiento Esperado:** La disponibilidad debe ajustarse a la zona horaria del salón.
- **Problema Detectado:** Mezcla de `new Date()` (que usa la hora del servidor) con strings de `America/Mexico_City`. Si el servidor se despliega en una región diferente (ej. AWS US-East), el buffer de 3 horas (línea 313) será incorrecto.
- **Solución Propuesta:** Usar `luxon` o `date-fns-tz` para manejar todas las comparaciones de tiempo de forma determinista en la zona horaria del tenant.

---

## Conclusión de la Auditoría Funcional
**Estado:** 🔴 **No apto para producción.**
La prioridad absoluta antes de lanzar debe ser la implementación del **Webhook de Pagos** y la **Lógica de Bloqueo de Rango** en la disponibilidad. Sin esto, el negocio sufrirá de citas no pagadas confirmadas y overbooking constante.
