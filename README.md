# StreamVault — Embed Player con Estilo Netflix

API de streaming para peliculas, series y anime con reproductor embed estilo Netflix. 

Incluye: skip intro, auto-play siguiente episodio, sistema de anuncios personalizados, selector de servidores.

## Deploy en Render.com

1. **Fork/Clona** este repositorio
2. Crea un nuevo **Web Service** en [render.com](https://render.com)
3. Configura las variables de entorno:
   ```
   TMDB_API_KEY=tu_api_key_de_tmdb
   ```
4. Build Command: `npm run build`
5. Start Command: `npm start`

Obten tu API key gratuita en: https://www.themoviedb.org/settings/api

## API Endpoints

| Endpoint | Descripcion |
|----------|-------------|
| `GET /api/v1/search?query=X&type=multi` | Buscar peliculas, series, anime |
| `GET /api/v1/trending?type=all&window=week` | Trending |
| `GET /api/v1/discover?type=tv&genre=16` | Descubrir anime |
| `GET /api/v1/movie/{id}` | Detalles de pelicula |
| `GET /api/v1/tv/{id}?season=1` | Detalles de serie con episodios |
| `GET /api/v1/embed/movie/{id}` | URLs de streaming para pelicula |
| `GET /api/v1/embed/tv/{id}/{s}/{e}` | URLs de streaming para episodio |
| `GET /api/v1/player?type=tv&id={id}&season={s}&episode={e}` | Datos completos del player |
| `GET /api/v1/tv-channels` | Lista de paises con canales de TV |
| `GET /api/v1/tv-channels/{pais}` | Canales de un pais |

## Reproductor Embed (Netflix Style)

El player esta en `/player` y se puede embeber como iframe en tu sitio:

### Para Series/Anime:
```html
<iframe 
  src="https://tu-app.onrender.com/player?type=tv&id=37854&season=1&episode=1"
  style="width:100%;aspect-ratio:16/9;border:none;"
  allowfullscreen
  allow="autoplay; encrypted-media; fullscreen"
/>
```

### Para Peliculas:
```html
<iframe 
  src="https://tu-app.onrender.com/player?type=movie&id=550"
  style="width:100%;aspect-ratio:16/9;border:none;"
  allowfullscreen
  allow="autoplay; encrypted-media; fullscreen"
/>
```

### Funcionalidades del Player:

- **Pre-roll Ads**: Anuncio personalizado de 5 segundos antes del contenido
  - Se puede omitir a los 3 segundos
  - Configurable via env vars

- **Saltar Intro**: Boton "Saltar Intro" aparece a los 20 segundos
  - Se oculta automaticamente a los 80 segundos
  - Estilo Netflix (rojo, animacion slide-in)

- **Auto-Next Episodio**: Cuando un episodio esta por terminar
  - Banner con cuenta regresiva circular de 15 segundos
  - Reproduce automaticamente el siguiente episodio
  - Detecta si es ultimo episodio / ultima temporada
  - Muestra "Has completado la serie" al final

- **Selector de Servidores**: Dropdown con 7+ fuentes de streaming
  - VidSrc, VidSrc CC, VidSrc ICU, 2Embed, AutoMovie, etc.
  - Cambio instantaneo sin recargar

- **Panel de Episodios**: Lista lateral con todas las temporadas
  - Tabs de temporadas
  - Thumbnails, titulos, duraciones
  - Episodio actual resaltado

- **Controles**: Se ocultan automaticamente a los 3.5 segundos
  - Barra superior: titulo, episodio, selector de fuente, fullscreen
  - Barra inferior: prev/next, episodio actual, volumen, duracion

## Anuncios Personalizados

Por defecto se muestran anuncios de StreamVault y TVeo. Para configurar los tuyos:

```env
CUSTOM_ADS=[{"id":"mi-anuncio","title":"Visita Mi Sitio","description":"El mejor streaming","clickUrl":"https://misitio.com","duration":5,"active":true,"priority":1}]
```

Para desactivar anuncios:
```env
ADS_ENABLED=false
```

## Fuentes de Streaming

El player usa multiples fuentes de embed gratuitas basadas en IDs de TMDB:

| Fuente | Peliculas | Series | Prioridad |
|--------|-----------|--------|-----------|
| VidSrc | ✅ | ✅ | 1 (Recomendado) |
| VidSrc CC | ✅ | ✅ | 2 |
| VidSrc ICU | ✅ | ✅ | 3 |
| 2Embed | ✅ | ✅ | 4 |
| AutoMovie | ✅ | ✅ | 5 |
| MultiEmbed | ✅ | ❌ | 6 |
| MoviesAPI | ✅ | ❌ | 7 |

## Ejemplos de Uso

```javascript
// Buscar anime
fetch('/api/v1/search?query=naruto&type=tv')
  .then(r => r.json())
  .then(d => console.log(d.results));

// Obtener detalles de serie
fetch('/api/v1/tv/37854?season=1')
  .then(r => r.json())
  .then(d => console.log(d.data));

// URLs de streaming para episodio
fetch('/api/v1/embed/tv/37854/1/1')
  .then(r => r.json())
  .then(d => console.log(d.data.sources));

// Datos completos del player (incluye nextEpisode, episodes, seasons)
fetch('/api/v1/player?type=tv&id=37854&season=1&episode=1')
  .then(r => r.json())
  .then(d => console.log(d.data));
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS 4
- **API**: TMDB (The Movie Database)
- **UI**: shadcn/ui + Lucide Icons
- **Estado**: React Hooks + useReducer

## Nota Importante

Los reproductores embed (VidSrc, etc.) son servicios de terceros. Los anuncios que muestren estos servicios NO pueden ser eliminados tecnicamente (son iframes cross-origin). Sin embargo, StreamVault agrega **tus propios anuncios pre-roll** antes del contenido, permitiendote monetizar.

## Licencia

Este proyecto es solo para fines educativos. El contenido se obtiene de fuentes publicas.
