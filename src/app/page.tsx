"use client";

export default function Home() {
  const BASE = "https://stream-vault-two-phi.vercel.app";

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#050508;--surface:#0a0a0f;--border:#1c1c24;--text:#e8e8ec;--muted:#5a5a6e;--accent:#a3e635;--accent2:#65a30d}
        html{scroll-behavior:smooth}
        body{background:var(--bg);color:var(--text);font-family:'Inter',system-ui,-apple-system,sans-serif;min-height:100vh}
        .wrapper{max-width:800px;margin:0 auto;padding:0 24px}

        header{position:sticky;top:0;z-index:100;background:var(--bg);border-bottom:1px solid var(--border)}
        .header-inner{max-width:800px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;justify-content:space-between}
        .logo{font-size:18px;font-weight:800;text-decoration:none;color:var(--text);letter-spacing:-0.5px}
        .logo-dot{color:var(--accent)}
        nav{display:flex;gap:24px}
        nav a{font-size:13px;color:var(--muted);text-decoration:none;font-weight:500;transition:color .15s}
        nav a:hover{color:var(--text)}

        .hero{padding:80px 0 60px;text-align:center}
        .hero-tag{font-size:11px;color:var(--accent);letter-spacing:2px;text-transform:uppercase;font-weight:700;display:inline-block;border:1px solid var(--border);padding:5px 14px;margin-bottom:32px}
        .hero h1{font-size:clamp(2rem,5vw,3.5rem);font-weight:900;line-height:1.1;letter-spacing:-0.04em;margin-bottom:20px}
        .hero hl .hl{color:var(--accent)}
        .hero p{font-size:16px;color:var(--muted);max-width:480px;margin:0 auto 32px;line-height:1.7}
        .hero-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
        .btn{display:inline-flex;align-items:center;gap:8px;padding:10px 24px;font-size:14px;font-weight:700;text-decoration:none;transition:all .15s;cursor:pointer;border:none}
        .btn-fill{background:var(--accent);color:var(--bg)}
        .btn-fill:hover{background:var(--accent2)}
        .btn-outline{border:1px solid var(--border);color:var(--text);background:none}
        .btn-outline:hover{border-color:var(--accent)}
        .btn-sm{padding:6px 14px;font-size:12px}

        .stat-row{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--border);margin-top:60px}
        .stat-item{padding:20px 16px;text-align:center;border-right:1px solid var(--border);background:var(--surface)}
        .stat-item:last-child{border-right:none}
        .stat-val{font-size:24px;font-weight:900;margin-bottom:4px}
        .stat-lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px}

        section{padding:80px 0}
        .sec-tag{font-size:10px;color:var(--accent);letter-spacing:3px;text-transform:uppercase;font-weight:700;margin-bottom:12px}
        .sec-title{font-size:28px;font-weight:900;letter-spacing:-0.03em;margin-bottom:10px}
        .sec-desc{font-size:14px;color:var(--muted);margin-bottom:36px;line-height:1.6}

        .ep-list{display:flex;flex-direction:column;gap:2px}
        .ep-item{border:1px solid var(--border);background:var(--surface);transition:border-color .15s}
        .ep-item:hover{border-color:#2a2a36}
        .ep-top{display:flex;align-items:center;gap:12px;padding:18px 20px}
        .ep-method{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;padding:3px 8px;color:var(--accent);border:1px solid var(--accent);opacity:.7}
        .ep-path{font-family:'JetBrains Mono',monospace;font-size:13px;flex:1}
        .ep-badge{font-family:'JetBrains Mono',monospace;font-size:10px;padding:3px 10px;border:1px solid var(--border);color:var(--muted)}
        .ep-body{padding:0 20px 20px}
        .ep-desc{font-size:13px;color:var(--muted);margin-bottom:14px;line-height:1.5}

        table{width:100%;border-collapse:collapse;margin-bottom:14px}
        th{text-align:left;padding:5px 10px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:600;border-bottom:1px solid var(--border)}
        td{padding:7px 10px;font-size:12px;border-bottom:1px solid rgba(255,255,255,.03)}
        td:first-child{font-family:'JetBrains Mono',monospace;color:var(--accent);font-size:11px}
        td:nth-child(2){font-family:'JetBrains Mono',monospace;color:#d97706;font-size:10px}

        .code-box{background:#020204;border:1px solid #16161e;overflow:hidden;margin-top:4px}
        .code-head{display:flex;justify-content:space-between;padding:6px 12px;border-bottom:1px solid #16161e}
        .code-head span{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:2px}
        .code-head button{background:none;border:1px solid var(--border);color:var(--muted);padding:2px 10px;cursor:pointer;font-size:10px;font-family:'JetBrains Mono',monospace}
        .code-head button:hover{color:var(--accent);border-color:var(--accent)}
        pre{padding:14px 16px;margin:0;font-size:11px;font-family:'JetBrains Mono',monospace;color:#9898a8;line-height:1.6;overflow:auto;white-space:pre-wrap}

        .demo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
        .card{border:1px solid var(--border);background:var(--surface);transition:border-color .15s;overflow:hidden}
        .card:hover{border-color:#2a2a36}
        .card-img{width:100%;aspect-ratio:2/3;background:#0a0a0f;position:relative;overflow:hidden;cursor:pointer}
        .card-img img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
        .card:hover .card-img img{transform:scale(1.05)}
        .card-play{position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.4);opacity:0;transition:opacity .2s}
        .card:hover .card-play{opacity:1}
        .card-body{padding:14px}
        .card-title{font-size:14px;font-weight:700;margin-bottom:4px}
        .card-sub{font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:10px}
        .card-url{font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:10px;word-break:break-all}
        .card-url em{color:var(--accent);font-style:normal}
        .card-links{display:flex;gap:8px}

        .url-builder{border:1px solid var(--border);background:var(--surface);padding:24px;margin-top:36px}
        .url-builder-grid{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px}
        .field{display:flex;flex-direction:column;gap:4px}
        .field label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:600}
        .field input,.field select{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:8px 12px;font-size:13px;font-family:'JetBrains Mono',monospace}
        .field select{cursor:pointer}

        .schema-box{border:1px solid var(--border);background:var(--surface)}
        .schema-row{display:grid;grid-template-columns:140px 1fr 1fr;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,.03);font-size:12px;align-items:center}
        .schema-row:last-child{border-bottom:none}
        .schema-row.head{background:rgba(255,255,255,.02);font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:600}
        .schema-name{font-weight:600}
        .schema-path{font-family:'JetBrains Mono',monospace;color:var(--accent);font-size:11px}
        .schema-ex{font-family:'JetBrains Mono',monospace;color:var(--muted);font-size:10px;word-break:break-all}

        footer{border-top:1px solid var(--border);padding:32px 0;text-align:center;font-size:12px;color:var(--muted)}

        @media(max-width:600px){
          .stat-row{grid-template-columns:1fr 1fr}
          .stat-item:nth-child(2){border-right:none}
          nav{display:none}
          .schema-row{grid-template-columns:1fr 1fr}
          .schema-row .schema-ex{display:none}
        }
      `}</style>

      <header>
        <div className="header-inner">
          <a className="logo" href="#"><span className="logo-dot">●</span> Streamix</a>
          <nav>
            <a href="#endpoints">API</a>
            <a href="#demo">Demo</a>
            <a href="#builder">Builder</a>
          </nav>
        </div>
      </header>

      <div className="wrapper">
        <div className="hero">
          <div className="hero-tag">v1.0 · 11 proveedores · películas, series, anime · español latino</div>
          <h1>Streaming<br /><span style={{color:"var(--accent)"}}>en una línea.</span></h1>
          <p>Integrá películas, series, anime y TV en vivo con un iframe. Reproductor Netflix-style, failover automático, sin API key.</p>
          <div className="hero-actions">
            <a href="#endpoints" className="btn btn-fill">Ver API</a>
            <a href="/docs" className="btn btn-outline">Documentación</a>
          </div>
          <div className="stat-row">
            <div className="stat-item"><div className="stat-val" style={{color:"var(--accent)"}}>11</div><div className="stat-lbl">Proveedores</div></div>
            <div className="stat-item"><div className="stat-val">iframe</div><div className="stat-lbl">Embed</div></div>
            <div className="stat-item"><div className="stat-val" style={{color:"var(--accent)"}}>+4600</div><div className="stat-lbl">Canales TV</div></div>
            <div className="stat-item"><div className="stat-val">0</div><div className="stat-lbl">API Key</div></div>
          </div>
        </div>

        <section id="endpoints">
          <div className="sec-tag">Endpoints</div>
          <div className="sec-title">API de streaming</div>
          <div className="sec-desc">Dos formas de consumir: iframe embed (HTML) o API JSON (REST).</div>

          <div className="ep-list">
            {[
              {
                method:"iframe", path:"/embed/movie/:id",
                badge:"🎬 Película",
                desc:"Reproductor embed para películas con TMDB ID.",
                params:[["id","integer","TMDB ID de la película"]],
                code:`<iframe src="${BASE}/embed/movie/272"\n  width="100%" height="500"\n  allowfullscreen\n  allow="autoplay; encrypted-media"></iframe>`
              },
              {
                method:"iframe", path:"/embed/tv/:id",
                badge:"📺 Serie / Anime",
                desc:"Reproductor embed para series y anime. Requiere season y episode.",
                params:[["id","integer","TMDB ID"],["season","integer","Temporada"],["episode","integer","Episodio"]],
                code:`<iframe src="${BASE}/embed/tv/1399?season=1&episode=1"\n  width="100%" height="500"\n  allowfullscreen\n  allow="autoplay; encrypted-media"></iframe>`
              },
              {
                method:"GET", path:"/api/v1/embed-serve",
                badge:"🔌 API JSON",
                desc:"Devuelve metadatos TMDB + fuentes de streaming de todos los proveedores (películas, series, anime). Respuesta JSON.",
                params:[["type","string","movie | tv"],["id","integer","TMDB ID"],["season","integer","(tv)"],["episode","integer","(tv)"]],
                code:`curl "${BASE}/api/v1/embed-serve?type=movie&id=272"\n\n// Respuesta:\n{\n  "success": true,\n  "data": {\n    "title": "Batman Begins",\n    "year": "2005",\n    "sources": [\n      { "url": "...m3u8", "playbackType": "hls" },\n      { "url": "...mp4", "playbackType": "mp4" }\n    ]\n  }\n}`
              },
              {
                method:"iframe", path:"/embed/live/:slug",
                badge:"📡 TV en vivo",
                desc:"Player embed para canales de TV en vivo. Streams HLS directos.",
                params:[["slug","string","Slug del canal"]],
                code:`<iframe src="${BASE}/embed/live/caracol-tv"\n  width="100%" height="500"\n  allowfullscreen\n  allow="autoplay; encrypted-media"></iframe>`
              },
              {
                method:"GET", path:"/api/v1/tv/all",
                badge:"📋 Canales",
                desc:"Lista paginada de canales de TV. Buscá por nombre con ?search=.",
                params:[["search","string","Filtrar por nombre"],["page","integer","Página"],["limit","integer","Por página"]],
                code:`curl "${BASE}/api/v1/tv/all?search=caracol&limit=10"\n\n// Respuesta:\n{\n  "success": true,\n  "results": [\n    {\n      "name": "Caracol TV",\n      "slug": "caracol-tv",\n      "country": "Colombia",\n      "url": "...m3u8"\n    }\n  ]\n}`
              },
            ].map((ep,i) => (
              <div className="ep-item" key={i}>
                <div className="ep-top">
                  <span className="ep-method">{ep.method}</span>
                  <span className="ep-path">{ep.path}</span>
                  <span className="ep-badge">{ep.badge}</span>
                </div>
                <div className="ep-body">
                  <div className="ep-desc">{ep.desc}</div>
                  {ep.params.length > 0 && (
                    <table>
                      <thead><tr><th>Param</th><th>Tipo</th><th>Desc</th></tr></thead>
                      <tbody>
                        {ep.params.map(([n,t,d]) => (
                          <tr key={n}><td>{n}</td><td>{t}</td><td style={{fontSize:11}}>{d}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="code-box">
                    <div className="code-head">
                      <span>{ep.method === "GET" ? "cURL" : "HTML"}</span>
                      <button onClick={(e) => { navigator.clipboard.writeText(ep.code.replace(/<[^>]*>/g,'')); const b=e.currentTarget; b.textContent='Copiado'; setTimeout(()=>b.textContent='Copiar',1200); }}>Copiar</button>
                    </div>
                    <pre>{ep.code}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="demo">
          <div className="sec-tag">Demo</div>
          <div className="sec-title">Probá en vivo</div>
          <div className="sec-desc">Clickeá una película o serie para ver el player en acción.</div>

          <div className="demo-grid">
            {[
              { type:"movie", id:272, title:"Batman Begins", sub:"2005 · Película", poster:"https://image.tmdb.org/t/p/w500/6yMWU1vWkOBbNRIwOxhetd2aHhO.jpg" },
              { type:"tv", id:1399, s:1, e:1, title:"Game of Thrones", sub:"2011 · T1E1", poster:"https://image.tmdb.org/t/p/w500/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg" },
              { type:"tv", id:37854, s:1, e:1, title:"One Piece", sub:"⛩️ Anime · T1E1", poster:"https://image.tmdb.org/t/p/w500/2uGjavvyQkTK26u2KGW6z2yDg9o.jpg" },
            ].map((item,i) => {
              const url = item.type === "movie"
                ? `${BASE}/embed/movie/${item.id}`
                : `${BASE}/embed/tv/${item.id}?season=${item.s}&episode=${item.e}`;
              return (
                <div className="card" key={i}>
                  <div className="card-img" onClick={() => window.open(url, "_blank")}>
                    <img src={item.poster} alt={item.title} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <div className="card-play">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="white"><polygon points="6 2 20 12 6 22"/></svg>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="card-title">{item.title}</div>
                    <div className="card-sub">{item.sub}</div>
                    <div className="card-url">
                      <em>{item.type === "movie" ? `/embed/movie/${item.id}` : `/embed/tv/${item.id}`}</em>
                    </div>
                    <div className="card-links">
                      <a className="btn btn-fill btn-sm" href={url} target="_blank">▶ Abrir</a>
                      <button className="btn btn-outline btn-sm" onClick={() => navigator.clipboard.writeText(url)}>📋</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="builder">
          <div className="sec-tag">Builder</div>
          <div className="sec-title">Armá tu URL</div>
          <div className="url-builder">
            <div className="url-builder-grid">
              <div className="field">
                <label>Tipo</label>
                <select id="gen-type" defaultValue="movie">
                  <option value="movie">Película</option>
                  <option value="tv">Serie</option>
                </select>
              </div>
              <div className="field">
                <label>TMDB ID</label>
                <input id="gen-id" type="number" defaultValue="272" />
              </div>
              <div id="gen-tv" style={{display:"none",gap:12}}>
                <div className="field"><label>Temp</label><input id="gen-s" type="number" defaultValue="1" /></div>
                <div className="field"><label>Ep</label><input id="gen-e" type="number" defaultValue="1" /></div>
              </div>
            </div>
            <div className="code-box">
              <div className="code-head">
                <span>URL</span>
                <button id="gen-copy" onClick={() => { const u = document.getElementById("gen-output")?.textContent; if(u){ navigator.clipboard.writeText(u); const b=document.getElementById("gen-copy"); if(b){b.textContent='Copiado';setTimeout(()=>b.textContent='Copiar',1200);} } }}>Copiar</button>
              </div>
              <pre id="gen-output" style={{color:"var(--accent)"}}>{BASE}/embed/movie/272</pre>
            </div>
            <div style={{marginTop:10}}>
              <a id="gen-link" href={`${BASE}/embed/movie/272`} target="_blank" className="btn btn-fill btn-sm">▶ Probar</a>
            </div>
          </div>
        </section>

        <section>
          <div className="sec-tag">Schema</div>
          <div className="sec-title">URLs de referencia</div>
          <div className="schema-box" style={{marginTop:16}}>
            <div className="schema-row head"><div>Tipo</div><div>Patrón</div><div>Ejemplo</div></div>
            <div className="schema-row"><div className="schema-name">Película</div><div className="schema-path">/embed/movie/:id</div><div className="schema-ex">{BASE}/embed/movie/272</div></div>
            <div className="schema-row"><div className="schema-name">Serie / Anime</div><div className="schema-path">/embed/tv/:id</div><div className="schema-ex">{BASE}/embed/tv/1399?season=1&episode=1</div></div>
            <div className="schema-row"><div className="schema-name">TV en vivo</div><div className="schema-path">/embed/live/:slug</div><div className="schema-ex">{BASE}/embed/live/caracol-tv</div></div>
            <div className="schema-row"><div className="schema-name">API JSON</div><div className="schema-path">/api/v1/embed-serve</div><div className="schema-ex">{BASE}/api/v1/embed-serve?type=movie&id=272</div></div>
            <div className="schema-row"><div className="schema-name">Canales</div><div className="schema-path">/api/v1/tv/all</div><div className="schema-ex">{BASE}/api/v1/tv/all?search=espn</div></div>
            <div className="schema-row"><div className="schema-name">Docs</div><div className="schema-path">/docs</div><div className="schema-ex">{BASE}/docs</div></div>
          </div>
        </section>

        <footer>
          Streamix · 11 proveedores · Películas, series, anime · TV en vivo · Sin API key
        </footer>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        (function(){
          var t=document.getElementById('gen-type'),tv=document.getElementById('gen-tv'),
              o=document.getElementById('gen-output'),l=document.getElementById('gen-link'),
              id=document.getElementById('gen-id'),s=document.getElementById('gen-s'),
              e=document.getElementById('gen-e'),B='${BASE}';
          function u(){
            tv.style.display=t.value==='tv'?'flex':'none';
            var url=t.value==='movie'
              ?B+'/embed/movie/'+(id.value||'272')
              :B+'/embed/tv/'+(id.value||'1399')+'?season='+(s.value||1)+'&episode='+(e.value||1);
            o.textContent=url;l.href=url;
          }
          t.onchange=u;id.oninput=u;s.oninput=u;e.oninput=u;
        })();
      `}} />
    </>
  );
}
