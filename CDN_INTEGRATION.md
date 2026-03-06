# Guía de Integración del CDN Diabolical

Esta guía detalla cómo conectar y utilizar el sistema de CDN de Diabolical Media Manager en tus aplicaciones externas.

## 🚀 Información Base

*   **Endpoint del CDN**: `https://cdn.diabolicalservices.tech`
*   **Endpoint de API (Subida)**: `https://api.diabolicalservices.tech/api/images/upload`
*   **Estado**: Producción
*   **Capacidades**: Entrega rápida de activos, transformación de imágenes al vuelo y caché inteligente.

## 🛠️ Estructura de URLs (Lectura)

Las imágenes se sirven utilizando el "slug" del cliente seguido del nombre del archivo:

`{CDN_URL}/{client-slug}/{image-filename}`

### Ejemplo Real (NailsSalon):
*   **URL**: `https://cdn.diabolicalservices.tech/nailssalon/mi-imagen.jpg`

---

## 📤 Subida de Archivos (Upload)

Para subir archivos al CDN, debes realizar una petición `POST` a la API utilizando el formato `multipart/form-data`.

### Parámetros de la Petición:

| Campo | Tipo | Valor / Descripción |
| :--- | :--- | :--- |
| `images` | File | El archivo de imagen (soporta múltiples archivos). |
| `client_id` | String | **ID de NailsSalon**: `c6d224a2-1ebc-480a-8ccc-dcaf06258f01` |
| `project_id` | String | **ID de Demo**: `a4ebae0c-6ce2-482a-8774-e1a9aee72c79` |

### Ejemplo con cURL:
```bash
curl -X POST https://api.diabolicalservices.tech/api/images/upload \
  -H "Authorization: Bearer <TU_TOKEN>" \
  -F "images=@/ruta/a/tu/archivo.jpg" \
  -F "client_id=c6d224a2-1ebc-480a-8ccc-dcaf06258f01" \
  -F "project_id=a4ebae0c-6ce2-482a-8774-e1a9aee72c79"
```

---

## 🎨 Transformación de Imágenes (On-the-fly)

El CDN soporta manipulación dinámica de imágenes mediante parámetros de consulta.

| Parámetro | Descripción | Valores Ejemplo |
| :--- | :--- | :--- |
| `w` | **Ancho (Width)** en píxeles | `w=800` |
| `h` | **Alto (Height)** en píxeles | `h=450` |
| `format` | **Formato** de salida | `webp`, `avif`, `jpg`, `png` |
| `q` | **Calidad** (0-100) | `q=80` |

### Ejemplos de uso (NailsSalon):
*   **Redimensionar a 400px (WebP)**: `.../nailssalon/logo.png?w=400&format=webp`
*   **Miniatura 150x150**: `.../nailssalon/avatar.jpg?w=150&h=150&q=60`

---

## 💻 Ejemplos de Implementación

### 1. HTML / Vanilla JS
```html
<img 
  src="https://cdn.diabolicalservices.tech/nailssalon/banner.jpg?w=800&format=webp" 
  alt="Nails Salon Banner"
  loading="lazy"
>
```

### 2. React / Next.js
```tsx
const CDN_URL = "https://cdn.diabolicalservices.tech";
const CLIENT_SLUG = "nailssalon";

export function OptimizedImage({ filename, width, alt }) {
  const imageUrl = `${CDN_URL}/${CLIENT_SLUG}/${filename}?w=${width}&format=avif`;
  return <img src={imageUrl} alt={alt} />;
}
```

---

## ⚡ Mejores Prácticas

1.  **Usa WebP/AVIF**: Reduce el peso de las imágenes hasta en un 80% con `format=webp`.
2.  **Lazy Loading**: Usa `loading="lazy"` para mejorar la velocidad inicial.
3.  **Cache**: La primera generación tarda unos milisegundos más, pero las siguientes son instantáneas gracias a la caché interna.

---

## 🔒 Seguridad
Las imágenes son públicas una vez subidas si se conoce el slug y el nombre del archivo. Las subidas requieren un **Token JWT** válido con permisos de `admin` o `editor`.

---
*Diabolical Services © 2026 - Sistema Interno de Gestión de Medios*
