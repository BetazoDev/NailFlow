# Guía de Uso: API Keys para Content Delivery Network (CDN)

Diabolical Media Manager incluye un sistema de API Keys que te permite proteger y restringir el acceso a los archivos de tus proyectos. Con estos tokens, solo las peticiones autorizadas pueden servir imágenes desde el CDN.

## Generar una API Key

1. Dirígete al panel de control de **Diabolical Media Manager**.
2. Ve a la sección **Projects**.
3. Haz clic en el icono de **Llave (Key)** junto al proyecto para el que necesitas acceso.
4. Escribe un nombre descriptivo para identificar dónde usarás esta llave (ej. "Website Plugin", "App Móvil").
5. Haz clic en **Generate New Key**.
6. Se generará un token único (ej. `dmm_abCdEfGhIjKlMnOpQrStUvWx`). **Cópialo** mediante el icono correspondiente.

> **Importante:** La API Key está vinculada específicamente al cliente y/o proyecto elegido. Esto significa que si intentas acceder a imágenes de un cliente distinto con esa llave, el acceso será denegado.

---

## Usar tu API Key

Una vez generada la llave, debes incluirla en las peticiones que hagas al CDN para que este valide tu autorización. Hay dos métodos soportados para pasar la API Key:

### Método 1: Por Cabecera HTTP (Recomendado)

Si estás solicitando imágenes a través de código (`fetch`, `axios`, etc.), la mejor forma es enviar el token en la cabecera `x-api-key`. Este método es más seguro porque la llave no queda expuesta en la URL (lo que es preferible para registros y cachés).

**Ejemplo usando Fetch en JavaScript:**
```javascript
const url = 'https://cdn.diabolicalservices.tech/mi-cliente/mi-proyecto/imagen.webp';

fetch(url, {
  method: 'GET',
  headers: {
    'x-api-key': 'dmm_TU_API_KEY_AQUI'
  }
})
  .then(response => {
    if (!response.ok) throw new Error('Acceso no autorizado o imagen no encontrada');
    return response.blob();
  })
  .then(blob => {
    // Convertir el blob a una URL para mostrar en una etiqueta <img>
    const imageUrl = URL.createObjectURL(blob);
    document.getElementById('my-image').src = imageUrl;
  })
  .catch(error => console.error(error));
```

### Método 2: Por Parámetro en la URL (Query Parameter)

Si estás incrustando las imágenes directamente en etiquetas HTML (`<img>`) en páginas de clientes (u otras integraciones donde no puedes alterar las cabeceras), puedes pasar la variable `api_key` o `token` en la URL.

**Ejemplo en HTML:**
```html
<!-- Se agrega el parámetro api_key al final de la URL -->
<img src="https://cdn.diabolicalservices.tech/mi-cliente/mi-proyecto/banner.webp?api_key=dmm_TU_API_KEY_AQUI&w=800" alt="Banner" />
```

**Ejemplo en un componente de React/Next.js:**
```jsx
export default function Banner({ imagePath }) {
  const apiKey = "dmm_TU_API_KEY_AQUI"; // Idealmente proveniente de variables de entorno
  
  // Construir la URL completa
  const cdnUrl = `https://cdn.diabolicalservices.tech/mi-cliente/${imagePath}?api_key=${apiKey}&format=webp&w=1200`;

  return (
    <img 
      src={cdnUrl} 
      alt="Banner Optimizado"
      loading="lazy"
    />
  );
}
```

---

## Subir Imágenes mediante API Key

Además de servir imágenes desde el CDN, puedes utilizar tu API Key para **subir nuevas imágenes** directamente desde otro proyecto de forma programática. La API detectará automáticamente el cliente y proyecto asignados a tu llave.

**Ejemplo de subida de archivos (Node.js con `axios` y `form-data`):**

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function uploadImage() {
  const form = new FormData();
  form.append('images', fs.createReadStream('./mi-imagen.jpg'));
  
  // No necesitas especificar client_id ni project_id, la API los deduce de tu llave.
  // form.append('domain_id', 'mi-dominio-opcional-id'); 

  try {
    const response = await axios.post('https://api.diabolicalservices.tech/api/images/upload', form, {
      headers: {
        ...form.getHeaders(),
        'x-api-key': 'dmm_TU_API_KEY_AQUI', // Identificación y Autorización
      },
    });

    console.log('Imagen subida exitosamente:', response.data.uploaded);
  } catch (error) {
    console.error('Error al subir imagen:', error.response ? error.response.data : error.message);
  }
}

uploadImage();
```

---

## Respuestas y Códigos de Error

El servidor CDN devolverá los siguientes códigos HTTP dependiendo del estado de la autenticación:

- **200 OK**: Se ha validado la llave y la imagen se proporcionará correctamente. (Puede ser un `304 Not Modified` si ya la tenías cacheada).
- **401 Unauthorized**: No se envió ninguna API Key en la petición, ya sea mediante la cabecera `x-api-key` ni como parámetro `api_key`.
- **403 Forbidden**: La API Key proporcionada es incorrecta o no tiene los permisos suficientes para acceder a la ruta solicitada.
- **404 Not Found**: La información de validación fue correcta, pero la imagen solicitada (o en sus versiones de caché) no pudo ser encontrada.

## Revocación de API Keys

Si sospechas que tu llave ha sido comprometida o ya no la necesitas:
1. Vuelve al panel de control > **Projects** > Icono de **Llave (Key)**.
2. Encuentra tu API Key en la lista de *Active Keys*.
3. Haz clic en el botón de **Revoke** (Revocar). La llave perderá acceso al CDN inmediatamente.

> Nota: Las imágenes cacheadas a nivel del navegador del usuario final pueden persistir hasta que expire el `Cache-Control` o recargue forzadamente.
