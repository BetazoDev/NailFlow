# Reporte de Auditoría Frontend y Arquitectura de Componentes — NailFlow

## 1. Resumen de Salud del Repositorio
La arquitectura actual del frontend se encuentra en una etapa de "Prototipo Avanzado". Aunque visualmente es impactante y utiliza un sistema de tokens en `globals.css`, la construcción técnica presenta riesgos de escalabilidad significativos. El repositorio sufre de una **centralización excesiva de estado** en componentes masivos ("God Components") y una **ausencia de abstracción de UI**, lo que resultará en una deuda técnica costosa a medida que se agreguen más salones o funcionalidades de administración. No es escalable en su estructura actual, pero es altamente refactorizable.

---

## 2. Hallazgos Críticos en Arquitectura y Separación (Prioridad Alta)

### A. Componente Divino (God Component): `BookingWizard.tsx`
- **Archivo:** `apps/web/src/components/booking/BookingWizard.tsx`
- **Problema detectado:** Este componente gestiona **todo** el estado del formulario de reserva (nombre, tel, email, servicios, fechas, archivos, etc.). Viola el Principio de Responsabilidad Única (SRP). Si el flujo de reserva crece (ej. agregar selección de extras), el archivo se volverá inmanejable. Además, genera "Prop Drilling" excesivo hacia los componentes hijos.
- **Sugerencia de Refactorización:**
Extraer la lógica de estado a un **BookingContext** o un Custom Hook especializado (`useBookingForm`).
```tsx
// src/features/booking/context/BookingContext.tsx
export const BookingProvider = ({ children }) => {
  const [state, dispatch] = useReducer(bookingReducer, initialBookingState);
  // ... lógica de navegación y validación
  return <BookingContext.Provider value={{ state, dispatch }}>{children}</BookingContext.Provider>;
}
```

### B. Falta de Directorio de Features
- **Archivo:** `apps/web/src/components/`
- **Problema detectado:** La estructura es plana bajo `components/booking`. Esto mezcla componentes de presentación (Dumb) con lógica de negocio (Smart).
- **Sugerencia de Refactorización:** Adoptar una estructura basada en "Features" para encapsular todo lo relacionado con la reserva.
```text
src/
  features/
    booking/
      components/ (Step-specific components)
      hooks/      (useBookingAvailability, usePayment)
      services/   (Lógica de API de reserva)
      types/      (Interfaces exclusivas de booking)
  components/
    ui/           (Botones, Inputs, Cards genéricos)
```

---

## 3. Reutilización de Código y DRY (Prioridad Media)

### A. Ausencia de un Sistema de Componentes (Atomic Design / UI Lib)
- **Problema:** Los botones, inputs y headers de sección se están re-implementando con Tailwind en cada archivo (`PersonalDataStep`, `PaymentStep`, `SummaryStep`).
- **Archivo:** `PersonalDataStep.tsx` y `SummaryStep.tsx`.
- **Efecto:** Si el diseño del botón principal cambia (ej. el gradiente de `var(--pink)` a `var(--coral)`), hay que editar más de 6 archivos.
- **Sugerencia:** Crear una carpeta `src/components/ui` con componentes base.
```tsx
// src/components/ui/Button.tsx
export const Button = ({ variant = 'primary', ...props }) => {
  const styles = variant === 'primary' ? 'btn-gradient' : '...';
  return <button className={styles} {...props} />;
}
```

---

## 4. Fidelidad Visual y CSS (Prioridad Media)

### A. Lógica de Estilo Hardcoded vs. Tokens
- **Archivo:** `BookingWidget.tsx` (líneas 176-177).
- **Problema:** Uso de valores de color y spacing literales en `style={{ ... }}` o clases de Tailwind que no usan tokens. Ejemplo: `width: i === currentIndex ? '2rem' : '0.5rem'`. 
- **Sugerencia:** Mover estas constantes a un archivo de configuración de diseño o usar la configuración de Tailwind v4 para extender los espaciados.

### B. Lógica de Formateo Repetida
- **Archivo:** `SummaryStep.tsx`.
- **Problema:** La función `formatFullDate` está definida dentro del componente.
- **Sugerencia:** Mover a `src/lib/utils/date-formatter.ts`.

---

## 5. Mantenibilidad y Tipado (Prioridad Baja)

### A. Uso de `any` en Payload
- **Archivo:** `BookingWizard.tsx:78`.
- **Problema:** `const data: any = { ... }`. Esto rompe la seguridad de tipos justo en la construcción del objeto más importante del sistema.
- **Sugerencia:** Definir un tipo `Partial<BookingData>` y construir el objeto de forma segura.

---

## Conclusión de la Auditoría Frontend
**Estado:** 🟡 **Requiere Refactorización Preventiva.**
El código actual es funcional para un MVP, pero la falta de componentes UI compartidos y la gestión centralizada de estado en `BookingWizard` impedirá que el equipo pueda mantener el ritmo de desarrollo en 3 meses. La prioridad #1 debe ser la creación de un `BookingContext` y la extracción de componentes UI base.
