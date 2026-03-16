# Plan de Acción: Próximos Pasos para NailFlow

Este documento detalla las tareas técnicas necesarias para alinear la implementación actual de **NailFlow** con las especificaciones técnicas y reglas de negocio originales.

## Estado General: ✅ Implementado — Pendiente de Deploy

---

## 1. Corrección de Arquitectura Multi-Tenant (Prioridad: Crítica) ✅ Completado
Actualmente, el frontend tiene harcodeado el dominio `demo.diabolicalservices.tech`, lo que impide que nuevos salones funcionen correctamente.

- [x] **Resolución Dinámica:** Modificado `apps/web/src/app/page.tsx` para obtener el dominio desde los headers de la solicitud (`host`).
- [x] **Staff Booking:** Modificado `apps/web/src/app/book/[staffSlug]/page.tsx` para usar `headers().get('host')`.
- [x] **Middleware Sync:** El `middleware.ts` ya reescribe `/[domain]` correctamente para dominios custom.

## 2. Ajuste de Reglas de Negocio (Prioridad: Alta) ✅ Completado
Existen discrepancias entre los valores calculados en el código y lo definido en el archivo de requerimientos.

- [x] **Cálculo de Seña Variable:** Eliminado el `40%` harcodeado en `SummaryStep.tsx`, `PaymentStep.tsx` y `admin/page.tsx`. Se usa `service.required_advance` desde la base de datos.
- [x] **Ventana de Reserva:** Cambiado el buffer de disponibilidad en el backend de 3 horas a **7 días** (Sección 4 / Regla 81).
- [x] **Validación de Teléfono:** Implementada validación E.164 en el endpoint `/api/bookings`.

## 3. Optimización del Flujo de Imágenes (Prioridad: Alta) ✅ Completado
El manejo actual de imágenes de referencia permite desperdicio de recursos antes del pago.

- [x] **Reordenamiento de Pasos:** El paso "Inspiración" ahora ocurre **después** del pago: `personal → service → datetime → summary → payment → inspiration → confirmation`.
- [x] **Límite de Carga:** Implementado el límite estricto de **máximo 3 imágenes** por cita.
- [x] **Upload Post-Pago:** `ImageUploadStep` ahora recibe el `appointmentId` confirmado y llama `api.updateAppointmentImages()` para vincular las fotos a la reserva real.
- [x] **Automatización de Limpieza:** Cron job diario (02:00 UTC) implementado en el backend usando `node-cron`. Borra imágenes de citas con más de 14 días de antigüedad.

## 4. Integraciones y Automatizaciones (Prioridad: Media) ✅ Completado
Faltan los puentes de comunicación con sistemas externos.

- [x] **Webhook de n8n:** Añadida función `triggerN8nWebhook()` en el backend. Se dispara en dos eventos:
  - `booking.initiated` — cuando se crea la preferencia de pago
  - `booking.paid` — cuando MercadoPago confirma el pago
- [ ] **Variable de entorno:** Configurar `N8N_WEBHOOK_URL` en el panel de Dokploy para activarlo.
- [ ] **Notificaciones Admin:** Tarea pendiente de mayor alcance (email/push requiere integración adicional).

## 5. Auditoría de Seguridad y Estabilidad (Prioridad: Baja) ✅ Completado
- [x] **Manejo de Secretos:** Los tokens de CDN ahora se leen desde variables de entorno (`NEXT_PUBLIC_CDN_DEMO_TOKEN`, `NEXT_PUBLIC_CDN_CLIENTS_TOKEN`). Valores hardcodeados usados solo como fallback de desarrollo.
- [x] **Env Local actualizado:** `apps/web/.env.local` documentado con todas las variables necesarias.
- [ ] **Logs de Error:** Mejora pendiente menor; el proxy ya devuelve mensajes descriptivos.

---

## Pasos Finales Requeridos

1. **Hacer commit y deploy** de todos los cambios.
2. **Configurar `N8N_WEBHOOK_URL`** en Dokploy (variable de entorno en `nailflow-api`) para activar los recordatorios automáticos de WhatsApp.
3. **Verificar** el flujo completo de reserva en `https://demo.diabolicalservices.tech` después del deploy.
