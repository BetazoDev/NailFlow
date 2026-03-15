# Plan de Acción: Próximos Pasos Post-Code Review

Este documento detalla las tareas necesarias para llevar el proyecto **NailFlow** a un estado listo para producción, priorizando la seguridad y la estabilidad.

## Fase 1: Seguridad y Cumplimiento (Inmediato)
> [!IMPORTANT]
> Estas tareas son bloqueantes para el despliegue.

- [x] **Corregir Vulnerabilidad IDOR**:
    - Modificar los endpoints de `/appointments/:id` para incluir `AND tenant_id = $2` en las consultas SQL.
    - Asegurar que el `tenantId` se obtenga siempre del middleware de autenticación/resolución.
- [x] **Cumplimiento PCI-DSS (Pasarela de Pago)**:
    - **Eliminar** los campos de entrada de tarjeta manuales en `PaymentStep.tsx`.
    - Integrar el SDK oficial de **Mercado Pago** (Brick o Pro) para que los datos de pago se procesen en los servidores del proveedor, no en el estado de React.
- [x] **Protección de Credenciales**:
    - Mover los tokens del CDN (`dmm_...`) a variables de entorno del servidor.
    - Implementar un endpoint en el backend que actúe como proxy para la subida de imágenes o genere URLs firmadas.

## Fase 2: Refactorización de Arquitectura (Deuda Técnica)
- [ ] **Modularización del Backend**:
    - Dividir `apps/api/src/index.ts` en carpetas:
        - `/routes`: Definición de rutas Express.
        - `/controllers`: Lógica de manejo de peticiones.
        - `/middlewares`: Resolución de tenant, validación y auth.
        - `/services`: Lógica de negocio (interacción con DB y MP).
- [ ] **Tipado de Datos (TypeScript)**:
    - Reemplazar los `@ts-ignore` del objeto `Request`.
    - Definir interfaces de respuesta consistentes para todos los endpoints.
    - Sincronizar los tipos entre `apps/api` y `apps/web`.

## Fase 3: Rendimiento y Validación
- [ ] **Caché de Resolución de Tenant**:
    - Implementar `lru-cache` en el middleware de resolución de dominios para evitar consultas redundantes a la DB en cada request.
- [ ] **Validación de Esquemas (Zod)**:
    - Agregar validación en el servidor para todos los cuerpos de petición (`POST`/`PUT`).
    - Sanitizar strings para prevenir posibles ataques de inyección básica en el dashboard.
- [ ] **Optimización de Consultas**:
    - Revisar índices en la base de datos PostgreSQL, especialmente para `tenant_id` y `datetime_start`.

## Fase 4: Experiencia de Usuario y Cleanup
- [ ] **Unificación de Constantes**:
    - Crear un archivo de constantes compartido para los estados de cita (`confirmed`, `pending`, `cancelled`).
- [ ] **Feedback de Error Mejorado**:
    - Refinar los mensajes de error en el frontend para que sean más descriptivos y amigables para el usuario final.
- [ ] **Pruebas E2E**:
    - Realizar un ciclo completo de reserva desde la selección de servicio hasta la redirección de pago para asegurar que no hay regresiones tras la refactorización.

---
**Responsable:** Staff Software Engineer / Tech Lead
**Estado del Proyecto:** 🟠 En Revisión Crítica
