# prompt_fidelizacion_ui.md

**Contexto del Proyecto:**
Estoy desarrollando una plataforma SaaS marca blanca llamada NailFlow (Stack: React, TypeScript, TailwindCSS). Actualmente estoy trabajando en la vista del Dashboard, específicamente en la ruta de "Perfil" del administrador.

**Estado Actual de la UI:**
Tengo un contenedor principal con fondo claro y una tarjeta blanca con bordes redondeados (estilo `rounded-3xl` o similar). Dentro de esta vista, tengo un menú de navegación interno tipo "píldora" (tabs) con las opciones actuales: "NEGOCIO", "HORARIOS", "SEGURIDAD". El color de acento para elementos activos es un tono marrón/rosado desaturado.

**Tarea a realizar:**
1. Agrega una nueva pestaña a la navegación de píldora llamada "FIDELIZACIÓN" (con un icono de regalo o medalla, tipo Lucide React).
2. Crea el contenido que se mostrará cuando la pestaña "FIDELIZACIÓN" esté activa. 

**Especificaciones del contenido de la pestaña "FIDELIZACIÓN":**
Debe seguir la misma estructura visual que la sección de horarios: un título principal y una tarjeta contenedora.

* **Título de la sección:** "Programa de Lealtad"
* **Subtítulo (gris claro/muted):** "Configura las recompensas para tus clientes frecuentes."

**Elementos dentro de la tarjeta contenedora:**
* **Header de la tarjeta:** Un Toggle (Switch) alineado a la derecha con el texto a la izquierda: "Activar Programa de Clientes Frecuentes".
* **Contenedor condicional:** Si el Toggle está activo, mostrar un formulario con los siguientes campos (usando el mismo diseño de inputs con bordes redondeados y fondos blancos/grises claros que el resto de la app):
    1.  **Visitas Requeridas:** Un input de tipo número (o un slider elegante) para definir cuántas citas completadas se necesitan. (Label: "Visitas requeridas para recompensa", Placeholder/Default: "5").
    2.  **Tipo de Recompensa:** Un componente Select (dropdown) con dos opciones: "Porcentaje de Descuento" y "Servicio Gratis".
    3.  **Valor del Descuento:** Un input numérico con un icono de porcentaje (`%`) al final. *Regla de UI:* Este campo solo debe renderizarse si el "Tipo de Recompensa" seleccionado es "Porcentaje de Descuento".
* **Botón de Acción:** Un botón al final alineado a la derecha que diga "Guardar Configuración", utilizando el color primario de la app (el marrón/rosado del sidebar).

**Requisitos de Estilos (Tailwind):**
* Mantén un diseño espacioso (`gap-6` o `gap-8` entre los campos del formulario).
* Usa sombras suaves (`shadow-sm`) y bordes sutiles para los inputs.
* Asegúrate de que la tipografía coincida con una paleta neutra y elegante, utilizando tonos oscuros para los labels y grises para las descripciones de apoyo.