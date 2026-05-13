"use client";

import React from "react";

export default function DocsPage() {
  const BASE = process.env.NEXT_PUBLIC_URL || "https://stream-vault-two-phi.vercel.app";

  return (
    <div style={{
      background: "#080b10", color: "#dce8f5", fontFamily: "system-ui, sans-serif",
      minHeight: "100vh", padding: "40px 20px 80px"
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            border: "1px solid rgba(0,229,255,.25)", borderRadius: 20,
            padding: "6px 16px", fontSize: 13, color: "#00e5ff",
            marginBottom: 24, letterSpacing: 2, textTransform: "uppercase"
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ffb3", boxShadow: "0 0 8px #00ffb3" }} />
            Embed Player API v1.0
          </div>
          <h1 style={{
            fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 800,
            lineHeight: 1.1, marginBottom: 16, letterSpacing: -1
          }}>
            Reproduce cualquier<br />
            <span style={{ background: "linear-gradient(90deg, #00e5ff, #7b2ff7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              contenido al instante
            </span>
          </h1>
          <p style={{ color: "#5a6f8a", fontSize: 17, maxWidth: 500, margin: "0 auto 32px" }}>
            Integrá el player de StreamVault en tu sitio con una sola línea.
            Películas, series, anime y canales TV — sin registro, sin API key.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#endpoints" style={{
              background: "linear-gradient(135deg,#00e5ff,#7b2ff7)", color: "#fff",
              padding: "12px 24px", borderRadius: 8, fontWeight: 700, textDecoration: "none"
            }}>Ver Endpoints</a>
            <a href="#demo" style={{
              border: "1px solid #1c2535", color: "#dce8f5",
              padding: "12px 24px", borderRadius: 8, fontWeight: 700, textDecoration: "none"
            }}>Ver Demo</a>
          </div>
          <div style={{
            display: "flex", marginTop: 48, border: "1px solid #1c2535", borderRadius: 10, overflow: "hidden"
          }}>
            {[
              { v: "Películas, Series, TV", l: "Tipos de contenido", c: "#00e5ff" },
              { v: "iframe", l: "Método de embed", c: "#7b2ff7" },
              { v: "Latino", l: "Idioma principal", c: "#00ffb3" },
            ].map(s => (
              <div key={s.l} style={{
                flex: 1, padding: "20px 16px", textAlign: "center",
                borderRight: "1px solid #1c2535", background: "#0e1420"
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 12, color: "#5a6f8a", marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Endpoints */}
        <div id="endpoints" style={{ marginBottom: 60 }}>
          <div style={{ fontSize: 12, color: "#00e5ff", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>// Referencia</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32 }}>Endpoints del Player</h2>

          {[
            {
              method: "GET", path: `/embed/movie/{tmdb_id}`,
              type: "🎬 Película", typeColor: "#00e5ff",
              desc: "Carga el player embed para una película usando su ID de TMDB.",
              params: [{ name: "tmdb_id", type: "integer", desc: "ID numérico de la película en TMDB", req: true }],
              example: `<iframe src="${BASE}/embed/movie/272" width="100%" height="500" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe>`,
            },
            {
              method: "GET", path: `/embed/tv/{tmdb_id}?season={s}&episode={e}`,
              type: "📺 Series", typeColor: "#7b2ff7",
              desc: "Carga el player embed para un episodio de serie.",
              params: [
                { name: "tmdb_id", type: "integer", desc: "ID de la serie en TMDB", req: true },
                { name: "season", type: "integer", desc: "Número de temporada", req: true },
                { name: "episode", type: "integer", desc: "Número de episodio", req: true },
              ],
              example: `<iframe src="${BASE}/embed/tv/1399?season=1&episode=1" width="100%" height="500" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe>`,
            },
            {
              method: "GET", path: `/api/v1/tv/all?page=1&limit=200`,
              type: "📡 Canales TV", typeColor: "#ff9c3b",
              desc: "Lista todos los canales de TV disponibles con nombre, logo y URL del stream.",
              params: [
                { name: "page", type: "integer", desc: "Página (default 1)", req: false },
                { name: "limit", type: "integer", desc: "Resultados por página (default 20)", req: false },
              ],
              example: `fetch("${BASE}/api/v1/tv/all?page=1&limit=200")\n  .then(r => r.json())\n  .then(data => console.log(data.results));`,
            },
            {
              method: "GET", path: `/api/v1/tv/all?search={query}`,
              type: "🔍 Buscar TV", typeColor: "#00ffb3",
              desc: "Busca canales en vivo consultando múltiples fuentes.",
              params: [{ name: "query", type: "string", desc: "Término de búsqueda", req: true }],
              example: `fetch("${BASE}/api/v1/tv/all?search=caracol")\n  .then(r => r.json())\n  .then(data => console.log(data.results));`,
            },
          ].map((ep, i) => (
            <div key={i} style={{
              background: "#0e1420", border: "1px solid #1c2535",
              borderRadius: 10, marginBottom: 16, overflow: "hidden"
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                padding: "16px 20px", borderBottom: "1px solid #1c2535"
              }}>
                <span style={{
                  background: "rgba(0,255,179,.12)", color: "#00ffb3",
                  border: "1px solid rgba(0,255,179,.25)", padding: "4px 10px",
                  borderRadius: 5, fontSize: 12, fontWeight: 700, fontFamily: "monospace"
                }}>{ep.method}</span>
                <code style={{
                  fontFamily: "monospace", fontSize: 15, flex: 1, color: "#dce8f5"
                }}><span style={{ color: "#00e5ff" }}>{BASE}</span>{ep.path}</code>
                <span style={{
                  background: "rgba(0,229,255,.1)", color: ep.typeColor,
                  border: `1px solid rgba(0,229,255,.2)`, padding: "3px 10px",
                  borderRadius: 20, fontSize: 12, fontWeight: 700
                }}>{ep.type}</span>
              </div>
              <div style={{ padding: "0 20px 20px" }}>
                <p style={{ color: "#5a6f8a", fontSize: 14, margin: "16px 0" }}>{ep.desc}</p>

                {ep.params.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, color: "#5a6f8a", textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 8, fontFamily: "monospace" }}>
                      Parámetros
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                      <thead>
                        <tr style={{ background: "rgba(255,255,255,.03)", color: "#5a6f8a", fontSize: 12 }}>
                          <th style={{ textAlign: "left", padding: "8px 12px" }}>Nombre</th>
                          <th style={{ textAlign: "left", padding: "8px 12px" }}>Tipo</th>
                          <th style={{ textAlign: "left", padding: "8px 12px" }}>Req.</th>
                          <th style={{ textAlign: "left", padding: "8px 12px" }}>Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ep.params.map(p => (
                          <tr key={p.name} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                            <td style={{ padding: "10px 12px" }}>
                              <code style={{ color: "#00e5ff", fontFamily: "monospace" }}>{p.name}</code>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <code style={{ color: "#ff9c3b", fontFamily: "monospace", fontSize: 13 }}>{p.type}</code>
                            </td>
                            <td style={{ padding: "10px 12px", color: p.req ? "#ff4f6a" : "#5a6f8a", fontFamily: "monospace", fontSize: 12 }}>
                              {p.req ? "requerido" : "opcional"}
                            </td>
                            <td style={{ padding: "10px 12px", color: "#5a6f8a" }}>{p.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                <div style={{
                  background: "#060910", border: "1px solid #1c2535",
                  borderRadius: 8, marginTop: 16, overflow: "hidden"
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "8px 14px", borderBottom: "1px solid #1c2535",
                    background: "rgba(255,255,255,.02)"
                  }}>
                    <span style={{ fontSize: 12, color: "#5a6f8a", fontFamily: "monospace" }}>EJEMPLO</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(ep.example)}
                      style={{
                        background: "none", border: "1px solid #1c2535", borderRadius: 5,
                        color: "#5a6f8a", fontSize: 12, cursor: "pointer", padding: "3px 9px", fontFamily: "monospace"
                      }}
                    >Copiar</button>
                  </div>
                  <pre style={{
                    padding: "16px 18px", overflow: "auto", fontSize: 13,
                    fontFamily: "monospace", color: "#8da8c8", lineHeight: 1.6, margin: 0
                  }}>{ep.example}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Demo */}
        <div id="demo" style={{ marginBottom: 60 }}>
          <div style={{ fontSize: 12, color: "#00e5ff", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>// Live Demo</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32 }}>Probá la API</h2>

          <div style={{
            background: "#0e1420", border: "1px solid #1c2535", borderRadius: 10, padding: 24
          }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#5a6f8a", marginBottom: 4 }}>Tipo</label>
                <select id="demo-type" defaultValue="movie" style={{
                  background: "#060910", border: "1px solid #1c2535", color: "#dce8f5",
                  padding: "10px 14px", borderRadius: 8, fontSize: 14, fontFamily: "monospace"
                }}>
                  <option value="movie">🎬 Película</option>
                  <option value="tv">📺 Serie</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#5a6f8a", marginBottom: 4 }}>TMDB ID</label>
                <input id="demo-id" type="number" placeholder="272" defaultValue="272" style={{
                  background: "#060910", border: "1px solid #1c2535", color: "#dce8f5",
                  padding: "10px 14px", borderRadius: 8, fontSize: 14, width: 140, fontFamily: "monospace"
                }} />
              </div>
              <div id="demo-tv-params" style={{ display: "none", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#5a6f8a", marginBottom: 4 }}>Season</label>
                  <input id="demo-season" type="number" defaultValue="1" style={{
                    background: "#060910", border: "1px solid #1c2535", color: "#dce8f5",
                    padding: "10px 14px", borderRadius: 8, fontSize: 14, width: 80, fontFamily: "monospace"
                  }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#5a6f8a", marginBottom: 4 }}>Episode</label>
                  <input id="demo-episode" type="number" defaultValue="1" style={{
                    background: "#060910", border: "1px solid #1c2535", color: "#dce8f5",
                    padding: "10px 14px", borderRadius: 8, fontSize: 14, width: 80, fontFamily: "monospace"
                  }} />
                </div>
              </div>
            </div>
            <div style={{
              background: "#060910", border: "1px solid #1c2535", borderRadius: 8, padding: "12px 16px",
              fontFamily: "monospace", fontSize: 14, color: "#00e5ff", marginBottom: 12, wordBreak: "break-all"
            }} id="demo-url">{BASE}/embed/movie/272</div>
            <div style={{ display: "flex", gap: 10 }}>
              <a id="demo-link" href={`${BASE}/embed/movie/272`} target="_blank" style={{
                background: "linear-gradient(135deg,#00e5ff,#7b2ff7)", color: "#fff",
                padding: "10px 20px", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: 14
              }}>▶ Probar</a>
              <button onClick={() => navigator.clipboard.writeText(document.getElementById("demo-url")?.textContent || "")} style={{
                border: "1px solid #1c2535", color: "#5a6f8a",
                padding: "10px 20px", borderRadius: 8, fontWeight: 700, background: "none", cursor: "pointer", fontSize: 14
              }}>📋 Copiar URL</button>
            </div>
          </div>
        </div>

        {/* Schema */}
        <div style={{ marginBottom: 60 }}>
          <div style={{ fontSize: 12, color: "#00e5ff", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>// Estructura</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32 }}>Formatos de Embed</h2>
          <div style={{
            background: "#060910", border: "1px solid #1c2535", borderRadius: 10, overflow: "hidden", fontSize: 14
          }}>
            {[
              ["🎬 Película", `/embed/movie/{id}`, `${BASE}/embed/movie/272`],
              ["📺 Serie", `/embed/tv/{id}?season={s}&episode={e}`, `${BASE}/embed/tv/1399?season=1&episode=1`],
              ["📡 Canales", `/api/v1/tv/all`, `${BASE}/api/v1/tv/all?page=1&limit=20`],
              ["🔍 Buscar TV", `/api/v1/tv/all?search=`, `${BASE}/api/v1/tv/all?search=espn`],
            ].map((row, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "180px 1fr 1fr",
                padding: "10px 16px", borderBottom: i < 3 ? "1px solid rgba(255,255,255,.04)" : "none"
              }}>
                <span style={{ color: "#dce8f5", fontWeight: 600 }}>{row[0]}</span>
                <code style={{ color: "#ff9c3b", fontFamily: "monospace" }}>{row[1]}</code>
                <code style={{ color: "#5a6f8a", fontFamily: "monospace", fontSize: 13 }}>{row[2]}</code>
              </div>
            ))}
          </div>
        </div>

        <footer style={{ textAlign: "center", color: "#5a6f8a", fontSize: 14, paddingTop: 40, borderTop: "1px solid #1c2535" }}>
          <strong style={{ color: "#dce8f5" }}>StreamVault</strong> · API v1.0 · Contenido en español latino · Sin API key requerida
        </footer>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        const sel = document.getElementById('demo-type');
        const tvParams = document.getElementById('demo-tv-params');
        const url = document.getElementById('demo-url');
        const link = document.getElementById('demo-link');
        const id = document.getElementById('demo-id');
        const season = document.getElementById('demo-season');
        const episode = document.getElementById('demo-episode');
        function update() {
          const type = sel.value;
          tvParams.style.display = type === 'tv' ? 'flex' : 'none';
          if (type === 'movie') {
            url.textContent = '${BASE}/embed/movie/' + (id.value || '272');
            link.href = '${BASE}/embed/movie/' + (id.value || '272');
          } else {
            url.textContent = '${BASE}/embed/tv/' + (id.value || '1399') + '?season=' + (season.value||1) + '&episode=' + (episode.value||1);
            link.href = '${BASE}/embed/tv/' + (id.value || '1399') + '?season=' + (season.value||1) + '&episode=' + (episode.value||1);
          }
        }
        sel.onchange = update;
        id.oninput = update;
        season.oninput = update;
        episode.oninput = update;
      `}} />
    </div>
  );
}
