"use client";

import React, { useState } from "react";

export default function DocsPage() {
  const BASE = typeof window !== "undefined" ? window.location.origin : "https://stream-vault-two-phi.vercel.app";
  const [activeTab, setActiveTab] = useState("embed");
  const [demoType, setDemoType] = useState("movie");
  const [demoId, setDemoId] = useState("272");
  const [demoSeason, setDemoSeason] = useState("1");
  const [demoEpisode, setDemoEpisode] = useState("1");
  const [copied, setCopied] = useState("");

  const demoUrl = demoType === "movie"
    ? `${BASE}/embed/movie/${demoId}`
    : `${BASE}/embed/tv/${demoId}?season=${demoSeason}&episode=${demoEpisode}`;

  const tabs = [
    { id: "embed", label: "Embed Player", desc: "Iframe de 1 línea para tu sitio" },
    { id: "api", label: "API REST", desc: "Endpoints JSON para integraciones" },
    { id: "tv", label: "TV en vivo", desc: "Canales de tele por internet" },
    { id: "playground", label: "Probador", desc: "Armá tu URL y probala" },
  ];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "280px 1fr",
      minHeight: "100vh", background: "#0a0a0f", color: "#c8c8d4",
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      {/* Sidebar */}
      <aside style={{
        borderRight: "1px solid #1a1a24", position: "sticky", top: 0,
        height: "100vh", overflow: "auto", background: "#0d0d14",
        display: "flex", flexDirection: "column"
      }}>
        <div style={{ padding: "28px 24px 20px" }}>
          <div style={{
            fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em",
            marginBottom: 6, display: "flex", alignItems: "center", gap: 10
          }}>
            <span style={{
              background: "#c8c8d4", color: "#0a0a0f",
              width: 36, height: 36, display: "grid", placeItems: "center",
              fontSize: 14, fontWeight: 900
            }}>SV</span>
            StreamVault
          </div>
          <div style={{ fontSize: 12, color: "#5c5c6e", marginTop: 4 }}>
            Documentación técnica · v1.0
          </div>
        </div>

        <nav style={{ flex: 1, padding: "8px 12px" }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "12px 16px", marginBottom: 2, cursor: "pointer",
                background: activeTab === tab.id ? "#14141f" : "transparent",
                border: "none", borderRadius: 0,
                color: activeTab === tab.id ? "#e8e8f0" : "#6b6b7e",
                fontSize: 14, fontWeight: activeTab === tab.id ? 700 : 500,
                transition: "all .15s",
                borderLeft: activeTab === tab.id ? "3px solid #a78bfa" : "3px solid transparent",
              }}
            >
              {tab.label}
              <div style={{ fontSize: 11, color: "#4a4a5a", marginTop: 2, fontWeight: 400 }}>
                {tab.desc}
              </div>
            </button>
          ))}
        </nav>

        <div style={{
          padding: "20px 24px", borderTop: "1px solid #1a1a24",
          fontSize: 11, color: "#4a4a5a", lineHeight: 1.7
        }}>
          <div style={{ fontWeight: 700, color: "#6b6b7e", marginBottom: 8 }}>
            Proveedores activos
          </div>
          {["PelisPedia", "YandiSpoiler", "Gnula", "CineCalidad", "Cuevana", "PelisJuanita"].map(p => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
              <span style={{ color: "#8b5cf6" }}>◆</span> {p}
            </div>
          ))}
        </div>
      </aside>

      {/* Content */}
      <main style={{ padding: "48px 56px 100px" }}>
        {/* Embed Player Tab */}
        {activeTab === "embed" && (
          <div style={{ maxWidth: 780 }}>
            <div style={{ marginBottom: 48 }}>
              <div style={{ fontSize: 11, color: "#8b5cf6", letterSpacing: 3, textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
                Embed Player
              </div>
              <h1 style={{
                fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900,
                lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: 16
              }}>
                Un iframe.<br />
                <span style={{ color: "#8b5cf6" }}>Todo el contenido.</span>
              </h1>
              <p style={{ color: "#6b6b7e", fontSize: 16, lineHeight: 1.7, maxWidth: 560 }}>
                Pegá una línea de HTML en tu sitio y tenés películas, series y TV en vivo
                con reproductor Netflix-style, failover automático y 6 fuentes de contenido
                en español latino.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {[
                {
                  title: "Películas",
                  slug: "movie",
                  tmdb: "272",
                  path: "/embed/movie/:id",
                  params: "id — TMDB ID de la película",
                },
                {
                  title: "Series",
                  slug: "tv",
                  tmdb: "1399",
                  path: "/embed/tv/:id",
                  params: "id — TMDB ID · season — temporada · episode — episodio",
                },
                {
                  title: "TV en vivo",
                  slug: "live",
                  tmdb: "caracol-tv",
                  path: "/embed/live/:slug",
                  params: "slug — identificador del canal",
                },
              ].map(item => {
                const url = item.slug === "live"
                  ? `${BASE}/embed/${item.slug}/${item.tmdb}`
                  : item.slug === "movie"
                    ? `${BASE}/embed/${item.slug}/${item.tmdb}`
                    : `${BASE}/embed/${item.slug}/${item.tmdb}?season=1&episode=1`;

                const code = `<iframe\n  src="${url}"\n  width="100%"\n  height="500"\n  allowfullscreen\n  allow="autoplay; encrypted-media"\n></iframe>`;

                return (
                  <div key={item.title} style={{
                    border: "1px solid #1a1a24", borderLeft: "4px solid #8b5cf6",
                    background: "#0e0e16"
                  }}>
                    <div style={{
                      display: "flex", alignItems: "baseline", gap: 16,
                      padding: "20px 24px 0"
                    }}>
                      <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{item.title}</h3>
                      <code style={{
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                        color: "#8b5cf6"
                      }}>
                        {item.path}
                      </code>
                    </div>
                    <p style={{
                      color: "#6b6b7e", fontSize: 13, padding: "8px 24px 0",
                      fontFamily: "'JetBrains Mono', monospace"
                    }}>
                      {item.params}
                    </p>
                    <div style={{ padding: "16px 24px 24px" }}>
                      <div style={{
                        background: "#06060c", border: "1px solid #161622",
                        position: "relative"
                      }}>
                        <div style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "center", padding: "8px 14px",
                          borderBottom: "1px solid #161622"
                        }}>
                          <span style={{ fontSize: 10, color: "#5c5c6e", textTransform: "uppercase", letterSpacing: 2 }}>
                            HTML
                          </span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(code); setCopied(item.title); setTimeout(() => setCopied(""), 1500); }}
                            style={{
                              background: "none", border: "1px solid #1a1a24",
                              color: copied === item.title ? "#8b5cf6" : "#5c5c6e",
                              padding: "4px 12px", cursor: "pointer", fontSize: 11
                            }}
                          >
                            {copied === item.title ? "Copiado ✓" : "Copiar"}
                          </button>
                        </div>
                        <pre style={{
                          padding: "16px 18px", margin: 0, overflow: "auto",
                          fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                          color: "#a0a0b8", lineHeight: 1.7, background: "#06060c"
                        }}>{code}</pre>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* API Tab */}
        {activeTab === "api" && (
          <div style={{ maxWidth: 780 }}>
            <div style={{ marginBottom: 48 }}>
              <div style={{ fontSize: 11, color: "#8b5cf6", letterSpacing: 3, textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
                API REST
              </div>
              <h1 style={{
                fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900,
                lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: 16
              }}>
                Endpoints<br />
                <span style={{ color: "#8b5cf6" }}>en JSON.</span>
              </h1>
              <p style={{ color: "#6b6b7e", fontSize: 16, lineHeight: 1.7, maxWidth: 560 }}>
                Para integraciones que necesitan los datos sin el player.
                Respuestas limpias con metadatos TMDB y fuentes de streaming.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {[
                {
                  method: "GET",
                  path: "/api/v1/embed-serve",
                  title: "Obtener fuentes de streaming",
                  desc: "Devuelve metadatos TMDB + array de sources con URLs de streaming de todos los proveedores disponibles.",
                  params: [
                    ["type", "string", "movie | tv"],
                    ["id", "integer", "TMDB ID"],
                    ["season", "integer", "N° temporada (tv)"],
                    ["episode", "integer", "N° episodio (tv)"],
                  ],
                  curl: `curl "${BASE}/api/v1/embed-serve?type=movie&id=272"`,
                  response: `{\n  "success": true,\n  "data": {\n    "type": "movie",\n    "title": "Batman Begins",\n    "year": "2005",\n    "sources": [\n      { "url": "https://...m3u8", "playbackType": "hls" },\n      { "url": "https://...mp4", "playbackType": "mp4" },\n      { "url": "https://voe.sx/...", "playbackType": "iframe" }\n    ]\n  }\n}`,
                },
                {
                  method: "GET",
                  path: "/api/v1/tv/all",
                  title: "Canales de TV",
                  desc: "Lista paginada de canales de televisión en vivo con nombre, logo, país y URL del stream.",
                  params: [
                    ["page", "integer", "Página (default 1)"],
                    ["limit", "integer", "Por página (default 20, max 200)"],
                    ["search", "string", "Filtrar por nombre"],
                  ],
                  curl: `curl "${BASE}/api/v1/tv/all?search=caracol&page=1&limit=20"`,
                  response: `{\n  "success": true,\n  "results": [\n    {\n      "name": "Caracol TV",\n      "slug": "caracol-tv",\n      "logo": "https://...png",\n      "country": "Colombia",\n      "url": "https://...m3u8"\n    }\n  ]\n}`,
                },
              ].map(ep => (
                <div key={ep.path} style={{
                  border: "1px solid #1a1a24", borderTop: "4px solid #8b5cf6",
                  background: "#0e0e16"
                }}>
                  <div style={{ padding: "24px 24px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                      <span style={{
                        background: "#8b5cf6", color: "#fff",
                        padding: "2px 10px", fontSize: 11, fontWeight: 800,
                        fontFamily: "'JetBrains Mono', monospace"
                      }}>
                        {ep.method}
                      </span>
                      <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{ep.title}</h3>
                    </div>
                    <code style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
                      color: "#8b5cf6"
                    }}>
                      {ep.path}
                    </code>
                    <p style={{ color: "#6b6b7e", fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>
                      {ep.desc}
                    </p>
                  </div>

                  {/* Params table */}
                  <div style={{ padding: "16px 24px" }}>
                    <div style={{ fontSize: 10, color: "#5c5c6e", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>
                      Parámetros
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ fontSize: 10, color: "#5c5c6e", textTransform: "uppercase" }}>
                          <th style={{ textAlign: "left", padding: "4px 10px", fontWeight: 600 }}>Nombre</th>
                          <th style={{ textAlign: "left", padding: "4px 10px", fontWeight: 600 }}>Tipo</th>
                          <th style={{ textAlign: "left", padding: "4px 10px", fontWeight: 600 }}>Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ep.params.map(([n, t, d]) => (
                          <tr key={n} style={{ fontSize: 13 }}>
                            <td style={{ padding: "8px 10px" }}>
                              <code style={{ color: "#8b5cf6", fontFamily: "'JetBrains Mono', monospace" }}>{n}</code>
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <code style={{ color: "#f59e0b", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{t}</code>
                            </td>
                            <td style={{ padding: "8px 10px", color: "#8a8a9a" }}>{d}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* cURL */}
                  <div style={{ padding: "0 24px 24px" }}>
                    <div style={{ fontSize: 10, color: "#5c5c6e", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>
                      Probar con cURL
                    </div>
                    <div style={{
                      background: "#06060c", border: "1px solid #161622"
                    }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", padding: "8px 14px",
                        borderBottom: "1px solid #161622"
                      }}>
                        <span style={{ fontSize: 10, color: "#5c5c6e", textTransform: "uppercase", letterSpacing: 2 }}>
                          Terminal
                        </span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(ep.curl); setCopied(ep.path); setTimeout(() => setCopied(""), 1500); }}
                          style={{
                            background: "none", border: "1px solid #1a1a24",
                            color: copied === ep.path ? "#8b5cf6" : "#5c5c6e",
                            padding: "4px 12px", cursor: "pointer", fontSize: 11
                          }}
                        >
                          {copied === ep.path ? "Copiado ✓" : "Copiar"}
                        </button>
                      </div>
                      <pre style={{
                        padding: "16px 18px", margin: 0, overflow: "auto",
                        fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                        color: "#a0a0b8", lineHeight: 1.7, background: "#06060c"
                      }}>{ep.curl}</pre>
                    </div>
                  </div>

                  {/* Response preview */}
                  <div style={{ padding: "0 24px 24px" }}>
                    <div style={{ fontSize: 10, color: "#5c5c6e", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>
                      Respuesta
                    </div>
                    <pre style={{
                      background: "#06060c", border: "1px solid #161622",
                      padding: "16px 18px", margin: 0, overflow: "auto",
                      fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                      color: "#8a8a9a", lineHeight: 1.6
                    }}>{ep.response}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TV Tab */}
        {activeTab === "tv" && (
          <div style={{ maxWidth: 780 }}>
            <div style={{ marginBottom: 48 }}>
              <div style={{ fontSize: 11, color: "#8b5cf6", letterSpacing: 3, textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
                TV en vivo
              </div>
              <h1 style={{
                fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900,
                lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: 16
              }}>
                +4600 canales<br />
                <span style={{ color: "#8b5cf6" }}>en tiempo real.</span>
              </h1>
              <p style={{ color: "#6b6b7e", fontSize: 16, lineHeight: 1.7, maxWidth: 560 }}>
                Televisión en vivo de todo el mundo. Streams HLS directos
                sin anuncios ni interrupciones. Compatible con cualquier player.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 40 }}>
              {[
                { v: "+4600", l: "Canales" },
                { v: "100+", l: "Países" },
                { v: "HLS", l: "Protocolo" },
                { v: "0", l: "Anuncios" },
              ].map(s => (
                <div key={s.l} style={{
                  border: "1px solid #1a1a24", background: "#0e0e16",
                  padding: "24px 20px", textAlign: "center"
                }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: "#8b5cf6" }}>{s.v}</div>
                  <div style={{ fontSize: 13, color: "#5c5c6e", marginTop: 4, textTransform: "uppercase", letterSpacing: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {[
                {
                  title: "Buscar canales",
                  code: `${BASE}/api/v1/tv/all?search=espn`,
                  desc: "Busca canales por nombre. Devuelve nombre, logo, país y URL del stream.",
                },
                {
                  title: "Listar todos",
                  code: `${BASE}/api/v1/tv/all?page=1&limit=200`,
                  desc: "Lista paginada completa. Usá page y limit para navegar.",
                },
                {
                  title: "Reproducir",
                  code: `<iframe src="${BASE}/embed/live/caracol-tv"\n  width="100%" height="500"\n  allowfullscreen></iframe>`,
                  desc: "Embed directo con el slug del canal. El player carga el stream HLS automáticamente.",
                },
              ].map(item => (
                <div key={item.title} style={{
                  border: "1px solid #1a1a24", borderLeft: "4px solid #8b5cf6",
                  background: "#0e0e16", padding: "24px"
                }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px" }}>{item.title}</h3>
                  <p style={{ color: "#6b6b7e", fontSize: 13, marginBottom: 14 }}>{item.desc}</p>
                  <pre style={{
                    background: "#06060c", border: "1px solid #161622",
                    padding: "14px 16px", margin: 0, overflow: "auto",
                    fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                    color: "#a0a0b8", lineHeight: 1.6
                  }}>{item.code}</pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Playground Tab */}
        {activeTab === "playground" && (
          <div style={{ maxWidth: 780 }}>
            <div style={{ marginBottom: 48 }}>
              <div style={{ fontSize: 11, color: "#8b5cf6", letterSpacing: 3, textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
                Probador
              </div>
              <h1 style={{
                fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900,
                lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: 16
              }}>
                Armá tu URL<br />
                <span style={{ color: "#8b5cf6" }}>y probala.</span>
              </h1>
            </div>

            <div style={{
              border: "1px solid #1a1a24", background: "#0e0e16",
              padding: "32px"
            }}>
              <div style={{
                display: "grid", gridTemplateColumns: "auto 1fr", gap: "20px 16px",
                alignItems: "center", marginBottom: 28
              }}>
                <label style={{ fontSize: 13, color: "#6b6b7e", fontWeight: 600, textAlign: "right" }}>
                  Tipo
                </label>
                <div style={{ display: "flex", gap: 2 }}>
                  {["movie", "tv"].map(t => (
                    <button key={t} onClick={() => setDemoType(t)} style={{
                      padding: "8px 20px", cursor: "pointer",
                      background: demoType === t ? "#8b5cf6" : "#0a0a0f",
                      color: demoType === t ? "#fff" : "#6b6b7e",
                      border: demoType === t ? "none" : "1px solid #1a1a24",
                      fontWeight: 700, fontSize: 13
                    }}>
                      {t === "movie" ? "Película" : "Serie"}
                    </button>
                  ))}
                </div>

                <label style={{ fontSize: 13, color: "#6b6b7e", fontWeight: 600, textAlign: "right" }}>
                  TMDB ID
                </label>
                <input value={demoId} onChange={e => setDemoId(e.target.value)} style={{
                  background: "#0a0a0f", border: "1px solid #1a1a24",
                  color: "#c8c8d4", padding: "8px 14px", fontSize: 14,
                  fontFamily: "'JetBrains Mono', monospace", width: 160
                }} />

                {demoType === "tv" && (
                  <>
                    <label style={{ fontSize: 13, color: "#6b6b7e", fontWeight: 600, textAlign: "right" }}>
                      Temporada
                    </label>
                    <input value={demoSeason} onChange={e => setDemoSeason(e.target.value)} style={{
                      background: "#0a0a0f", border: "1px solid #1a1a24",
                      color: "#c8c8d4", padding: "8px 14px", fontSize: 14,
                      fontFamily: "'JetBrains Mono', monospace", width: 80
                    }} />

                    <label style={{ fontSize: 13, color: "#6b6b7e", fontWeight: 600, textAlign: "right" }}>
                      Episodio
                    </label>
                    <input value={demoEpisode} onChange={e => setDemoEpisode(e.target.value)} style={{
                      background: "#0a0a0f", border: "1px solid #1a1a24",
                      color: "#c8c8d4", padding: "8px 14px", fontSize: 14,
                      fontFamily: "'JetBrains Mono', monospace", width: 80
                    }} />
                  </>
                )}
              </div>

              <div style={{
                background: "#06060c", border: "1px solid #161622",
                padding: "16px 18px", marginBottom: 16,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
                color: "#8b5cf6", wordBreak: "break-all"
              }}>
                {demoUrl}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <a href={demoUrl} target="_blank" style={{
                  background: "#8b5cf6", color: "#fff", padding: "10px 24px",
                  fontWeight: 700, textDecoration: "none", fontSize: 14, display: "inline-block"
                }}>
                  ▶ Abrir player
                </a>
                <button onClick={() => navigator.clipboard.writeText(demoUrl)} style={{
                  border: "1px solid #1a1a24", color: "#6b6b7e",
                  padding: "10px 24px", fontWeight: 700, background: "none",
                  cursor: "pointer", fontSize: 14
                }}>
                  📋 Copiar URL
                </button>
              </div>

              <div style={{ marginTop: 40 }}>
                <div style={{ fontSize: 10, color: "#5c5c6e", textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>
                  Código iframe
                </div>
                <pre style={{
                  background: "#06060c", border: "1px solid #161622",
                  padding: "16px 18px", margin: 0, overflow: "auto",
                  fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                  color: "#a0a0b8", lineHeight: 1.6
                }}>
{`<iframe\n  src="${demoUrl}"\n  width="100%"\n  height="500"\n  allowfullscreen\n  allow="autoplay; encrypted-media"\n></iframe>`}
                </pre>
              </div>
            </div>

            {/* Live Preview */}
            <div style={{ marginTop: 40 }}>
              <div style={{ fontSize: 10, color: "#5c5c6e", textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>
                Vista previa
              </div>
              <div style={{
                border: "1px solid #1a1a24", background: "#000", aspectRatio: "16/9"
              }}>
                <iframe
                  key={`${demoType}-${demoId}-${demoSeason}-${demoEpisode}`}
                  src={demoUrl}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  allowFullScreen
                  allow="autoplay; encrypted-media; picture-in-picture"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
