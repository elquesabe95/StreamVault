# Streamix

> API de streaming multi-proveedor con reproductor embed estilo Netflix. Películas, series y TV en vivo en español latino.

## Características

- **6 proveedores de streaming** — PelisPedia, YandiSpoiler, Gnula, CineCalidad, Cuevana, PelisJuanita
- **Resolución inteligente** — JWT, P.A.C.K.E.R., base64, streams HLS/MP4 directos
- **Reproductor embed** — iframe con controles Netflix, failover automático entre servidores
- **TV en vivo** — +4600 canales de TeleOnline + Animux
- **Sin API key** — consumo libre, sin registro

## Deploy en Vercel

1. Hacé fork de este repo
2. Importalo en [vercel.com](https://vercel.com)
3. Listo — deploy automático

```env
# Opcional: TMDB API Key para metadata (funciona sin ella con datos limitados)
TMDB_API_KEY=tu_key
```

## Endpoints

| Endpoint | Uso |
|---|---|
| `GET /embed/movie/{tmdb_id}` | Player embed para película |
| `GET /embed/tv/{tmdb_id}?season=&episode=` | Player embed para serie |
| `GET /embed/live/{slug}` | Player embed para TV en vivo |
| `GET /api/v1/embed-serve?type=movie&id={tmdb_id}` | API JSON de fuentes de streaming |
| `GET /api/v1/embed-serve?type=tv&id={tmdb_id}&season=&episode=` | API JSON de fuentes para serie |
| `GET /api/v1/tv/all` | Lista de canales de TV |
| `GET /api/v1/tv/all?search=espn` | Buscar canales de TV |

## Embed en tu sitio

```html
<!-- Película -->
<iframe src="https://stream-vault-two-phi.vercel.app/embed/movie/272"
  width="100%" height="500" allowfullscreen
  allow="autoplay; encrypted-media"></iframe>

<!-- Serie -->
<iframe src="https://stream-vault-two-phi.vercel.app/embed/tv/1399?season=1&episode=1"
  width="100%" height="500" allowfullscreen
  allow="autoplay; encrypted-media"></iframe>

<!-- TV en vivo -->
<iframe src="https://stream-vault-two-phi.vercel.app/embed/live/caracol-tv"
  width="100%" height="500" allowfullscreen
  allow="autoplay; encrypted-media"></iframe>
```

## Proveedores de contenido

| # | Proveedor | Tipo | Estado |
|---|---|---|---|
| 1 | PelisPedia | Películas + Series | ✅ |
| 2 | YandiSpoiler | Películas + Series | ✅ |
| 3 | Gnula | Películas + Series | ✅ |
| 4 | CineCalidad | Películas + Series | ⚠️ |
| 5 | Cuevana | Películas + Series | ⚠️ |
| 6 | PelisJuanita | Películas | ⚠️ |

## Stack

- **Framework**: Next.js 16 (App Router)
- **Runtime**: Vercel Serverless
- **Proxy**: Cloudflare Worker + multi-proxy fallback
- **Player**: HLS.js + iframe nativo con failover
- **Estilos**: Tailwind CSS + Lucide Icons
- **TV**: IPTV.org + Animux + TeleOnline

## Licencia

Uso educativo. El contenido se obtiene de fuentes públicas.
