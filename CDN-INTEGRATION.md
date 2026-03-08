# Diabolical CDN — Integration Guide

> Connect any web project to the Diabolical Media Manager CDN for optimized image delivery.

---

## 🌐 CDN Base URL

```
https://cdn.diabolicalservices.tech
```

---

## 1. URL Format

Images are served through this pattern:

```
https://cdn.diabolicalservices.tech/{clientSlug}/{imagePath}
```

| Segment        | Description                                    | Example           |
| -------------- | ---------------------------------------------- | ----------------- |
| `clientSlug`   | Your client's slug (assigned in Media Manager)  | `famux`           |
| `imagePath`    | Path to the image under the client's storage   | `blog/banner.webp`|

### Full example

```
https://cdn.diabolicalservices.tech/famux/blog/banner.webp
```

---

## 2. Dynamic Transformations (Query Parameters)

The CDN can resize, convert, and optimize images on-the-fly. Transformed results are cached after the first request.

| Parameter | Type    | Description                          | Example      |
| --------- | ------- | ------------------------------------ | ------------ |
| `w`       | integer | Resize to this width (px)            | `w=600`      |
| `h`       | integer | Resize to this height (px)           | `h=400`      |
| `format`  | string  | Convert format: `webp`, `avif`, `jpg`, `png` | `format=webp` |
| `q`       | integer | Quality 1-100 (default: 80)          | `q=90`       |

### Examples

```bash
# Resize to 600px wide
https://cdn.diabolicalservices.tech/famux/hero.jpg?w=600

# Convert to WebP at 90% quality
https://cdn.diabolicalservices.tech/famux/hero.jpg?format=webp&q=90

# Resize + format conversion
https://cdn.diabolicalservices.tech/famux/hero.jpg?w=1280&format=avif

# Resize with both dimensions (fit: inside, no upscale)
https://cdn.diabolicalservices.tech/famux/hero.jpg?w=800&h=600
```

---

## 3. Integration Examples

### HTML

```html
<!-- Basic usage -->
<img src="https://cdn.diabolicalservices.tech/famux/blog/banner.webp" alt="Banner" />

<!-- Responsive images with srcset -->
<img
  srcset="
    https://cdn.diabolicalservices.tech/famux/hero.jpg?w=480  480w,
    https://cdn.diabolicalservices.tech/famux/hero.jpg?w=768  768w,
    https://cdn.diabolicalservices.tech/famux/hero.jpg?w=1280 1280w,
    https://cdn.diabolicalservices.tech/famux/hero.jpg?w=1920 1920w
  "
  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1280px"
  src="https://cdn.diabolicalservices.tech/famux/hero.jpg?w=1280"
  alt="Hero image"
/>

<!-- Modern format with fallback -->
<picture>
  <source srcset="https://cdn.diabolicalservices.tech/famux/hero.jpg?format=avif&w=1280" type="image/avif" />
  <source srcset="https://cdn.diabolicalservices.tech/famux/hero.jpg?format=webp&w=1280" type="image/webp" />
  <img src="https://cdn.diabolicalservices.tech/famux/hero.jpg?w=1280" alt="Hero image" />
</picture>
```

### Next.js

```tsx
// next.config.ts — Add CDN as an allowed image domain
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.diabolicalservices.tech",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
```

```tsx
// In a component
import Image from "next/image";

export function HeroImage() {
  return (
    <Image
      src="https://cdn.diabolicalservices.tech/famux/hero.jpg"
      alt="Hero"
      width={1280}
      height={720}
      priority
    />
  );
}
```

### React (Vite / CRA)

```tsx
// Helper function for CDN URLs
const CDN_BASE = "https://cdn.diabolicalservices.tech";

function cdnUrl(clientSlug: string, path: string, opts?: {
  w?: number;
  h?: number;
  format?: "webp" | "avif" | "jpg" | "png";
  q?: number;
}) {
  const url = new URL(`${CDN_BASE}/${clientSlug}/${path}`);
  if (opts?.w) url.searchParams.set("w", String(opts.w));
  if (opts?.h) url.searchParams.set("h", String(opts.h));
  if (opts?.format) url.searchParams.set("format", opts.format);
  if (opts?.q) url.searchParams.set("q", String(opts.q));
  return url.toString();
}

// Usage
<img src={cdnUrl("famux", "hero.jpg", { w: 800, format: "webp" })} alt="Hero" />;
```

### WordPress (PHP)

```php
<?php
// helpers.php
function cdn_url(string $clientSlug, string $path, array $opts = []): string {
    $base = 'https://cdn.diabolicalservices.tech';
    $url  = "{$base}/{$clientSlug}/{$path}";
    $params = [];
    if (!empty($opts['w']))      $params['w']      = $opts['w'];
    if (!empty($opts['h']))      $params['h']      = $opts['h'];
    if (!empty($opts['format'])) $params['format'] = $opts['format'];
    if (!empty($opts['q']))      $params['q']      = $opts['q'];
    return $params ? $url . '?' . http_build_query($params) : $url;
}
?>

<!-- In a template -->
<img src="<?= cdn_url('famux', 'blog/post-1.jpg', ['w' => 800, 'format' => 'webp']) ?>" alt="Post image" />
```

### CSS

```css
.hero {
  background-image: url('https://cdn.diabolicalservices.tech/famux/hero.jpg?w=1920&format=webp&q=85');
  background-size: cover;
  background-position: center;
}

/* Responsive backgrounds */
@media (max-width: 768px) {
  .hero {
    background-image: url('https://cdn.diabolicalservices.tech/famux/hero.jpg?w=768&format=webp&q=80');
  }
}
```

### JavaScript (fetch)

```javascript
// Fetching an image as a blob (e.g. for canvas manipulation)
const response = await fetch(
  "https://cdn.diabolicalservices.tech/famux/hero.jpg?w=600&format=webp"
);
const blob = await response.blob();
const objectUrl = URL.createObjectURL(blob);
```

---

## 4. CORS

The CDN has CORS fully enabled — it accepts requests from **any origin** (`*`).

| Header                              | Value                                         |
| ----------------------------------- | --------------------------------------------- |
| `Access-Control-Allow-Origin`       | `*`                                           |
| `Access-Control-Allow-Methods`      | `GET, HEAD, OPTIONS`                          |
| `Access-Control-Expose-Headers`     | `Content-Length, Content-Type, X-CDN, X-Cache` |
| Preflight cache (`Access-Control-Max-Age`) | `86400` (24 hours)                     |

This means you can:
- Use images in `<canvas>` without tainting
- Fetch images via `fetch()` / `XMLHttpRequest`
- Use images in Web Workers
- Embed from any domain without restrictions

---

## 5. Cache Behavior

| Scenario          | Cache-Control Header              | Notes                        |
| ----------------- | --------------------------------- | ---------------------------- |
| Direct serve      | `public, max-age=31536000` (1yr)  | No transformation needed     |
| Transformed (hit) | `public, max-age=31536000` (1yr)  | Served from server-side cache |
| Transformed (miss)| `public, max-age=31536000` (1yr)  | Generated, then cached       |

**Custom headers returned:**

| Header    | Values         | Description                         |
| --------- | -------------- | ----------------------------------- |
| `X-CDN`   | `diabolical-media-manager` | Identifies CDN source      |
| `X-Cache` | `HIT` or `MISS` | Whether the result came from cache |

---

## 6. Supported Formats

| Input               | Output (via `?format=`) |
| ------------------- | ----------------------- |
| JPEG, PNG, WebP, AVIF, GIF, TIFF, SVG | `webp`, `avif`, `jpg`, `jpeg`, `png`, `tiff` |

---

## 7. Uploading Images

Images are managed through the **Media Manager Admin Panel**:

```
https://media.diabolicalservices.tech
```

To upload images for a client:
1. Log in to the admin panel
2. Navigate to the client → project
3. Upload images via the Upload Manager
4. Images are automatically optimized and available on the CDN

### API Upload (programmatic)

```bash
curl -X POST https://api.diabolicalservices.tech/api/images/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/image.jpg" \
  -F "clientId=1" \
  -F "projectId=1"
```

---

## 8. Quick Start Checklist

- [ ] Ensure your client exists in the Media Manager
- [ ] Upload your images via the admin panel or API
- [ ] Note your `clientSlug` (e.g., `famux`)
- [ ] Use the CDN URL pattern in your project:
  ```
  https://cdn.diabolicalservices.tech/{clientSlug}/{imagePath}
  ```
- [ ] (Optional) Add query params for dynamic optimizations

---

## 9. Troubleshooting

| Issue                  | Solution                                                  |
| ---------------------- | --------------------------------------------------------- |
| 404 Not Found          | Verify the client slug and image path are correct         |
| CORS error             | Should not happen — if it does, check browser extensions  |
| Slow first load        | First request generates the transformation; subsequent requests are cached |
| Image not updating     | The CDN caches aggressively; upload with a new filename or clear the cache |

---

## 10. Architecture Overview

```
Your App (any domain)
    │
    │  GET https://cdn.diabolicalservices.tech/famux/hero.jpg?w=800&format=webp
    │
    ▼
┌─────────────────────────────────┐
│  Traefik (HTTPS + Let's Encrypt)│
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  CDN Server (Express + Sharp)   │
│  Port 4002                      │
│                                 │
│  1. Check server-side cache     │
│  2. If miss → read original     │
│  3. Apply transformations       │
│  4. Cache result                │
│  5. Serve with CORS headers     │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  /storage/clients/{clientSlug}  │
│  /storage/cache/                │
└─────────────────────────────────┘
```

---

*Last updated: March 7, 2026*
