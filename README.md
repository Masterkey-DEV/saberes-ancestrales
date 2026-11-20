# Saberes del Pacífico

Archivo vivo de saberes ancestrales del Pacífico colombiano. Un sitio en español para compartir memorias, oficios y conocimientos de Chocó, Valle del Cauca, Cauca y Nariño.

> **Prototipo editorial.** Los textos de curaduría y las frases del manifiesto son contenido creado para el sitio, no testimonios de comunidades reales. Antes de una publicación pública, cada contenido debe validarse con sus protagonistas y contar con acuerdos de uso claros.

## Stack

- [Astro](https://astro.build) 7 con TypeScript.
- [Bun](https://bun.sh) como gestor de paquetes y runtime de producción.
- `@astrojs/node` en modo `standalone` para servir el sitio y procesar el formulario.
- Fuentes locales con Fontsource: Fraunces y Manrope.
- Sin base de datos, sin analítica y sin cookies de seguimiento.

## Comandos

| Comando | Acción |
| --- | --- |
| `bun install` | Instala las dependencias. |
| `bun run dev` | Inicia el servidor de desarrollo en `http://localhost:4321`. |
| `bun run check` | Ejecuta el chequeo de tipos y plantillas de Astro. |
| `bun run build` | Genera el sitio de producción en `dist/`. |
| `bun run start` | Sirve el build con el entrypoint standalone de Node. |
| `bun run preview` | Previsualiza el build con el servidor de Astro. |

Para desarrollar con el servidor en segundo plano:

```sh
astro dev --background
astro dev status
astro dev logs
astro dev stop
```

## Estructura

```text
/
├── data/saberes/            # Aportes recibidos (se crea al primer envío)
├── public/                  # Favicon, imagen social y archivos estáticos
├── src/
│   ├── assets/images/       # Fotografías locales optimizadas por Astro
│   ├── components/          # Header, footer, sellos, iconos, mapa
│   ├── layouts/             # BaseLayout con metadatos y scripts globales
│   ├── pages/
│   │   ├── index.astro      # Portada
│   │   ├── compartir.astro  # Formulario de aportes
│   │   ├── creditos.astro   # Créditos, licencias y notas
│   │   └── api/saberes.ts   # Endpoint POST del formulario
│   └── styles/global.css    # Tokens, tipografía y base visual
├── astro.config.mjs
└── package.json
```

## Formulario y almacenamiento

El formulario de `/compartir` envía `multipart/form-data` a `POST /api/saberes`. El endpoint valida los campos, el honeypot y los archivos antes de guardar el aporte.

Cada envío se guarda en:

```text
data/saberes/<uuid>/
├── saber.json
└── <archivos adjuntos>
```

El registro incluye el identificador, el código de referencia (`SP-AAAA-XXXXXX`), el estado `pendiente-de-revision`, los datos de la persona, el saber, los consentimientos y los metadatos de los archivos. El correo y los adjuntos son privados y no se publican automáticamente.

### Límites

- Máximo 8 archivos por envío.
- Máximo 10 MB por archivo.
- Máximo 40 MB en total.
- Extensiones permitidas: `jpg`, `jpeg`, `png`, `webp`, `gif`, `pdf`, `mp3`, `wav`, `ogg`, `m4a`, `mp4`, `mov`, `webm`.
- El cuerpo de la petición está limitado a 45 MB en `astro.config.mjs`.

### Variables de entorno

| Variable | Uso |
| --- | --- |
| `SABERES_DATA_DIR` | Cambia la carpeta donde se guardan los aportes. Por defecto es `data/saberes` dentro del directorio de trabajo. |
| `HOST` | Interfaz de escucha del servidor standalone. |
| `PORT` | Puerto del servidor standalone. |

Ejemplo para producción:

```sh
SABERES_DATA_DIR=/var/lib/saberes bun run start
```

## Créditos

Las fotografías provienen de Wikimedia Commons y Flickr y se usan bajo licencias Creative Commons con atribución. Los detalles, enlaces a las licencias y notas de transparencia están en `/creditos`.

## Antes de publicar

Este proyecto no incluye autenticación, moderación, base de datos ni copias de seguridad. Para llevarlo a producción se necesita, como mínimo:

- Un proceso de revisión y consentimiento comunitario.
- Almacenamiento persistente y respaldos para `data/saberes`.
- Moderación y un canal para retirar o corregir aportes.
- Protección contra spam y límites de tasa en el endpoint.
- Revisión legal de los acuerdos de uso y de la protección de datos personales.
- Validación de los textos editoriales con las comunidades.
# saberes-ancestrales
# saberes-ancestrales
