"use client";

export default function Home() {
  const BASE = "https://streamvault-vj0p.onrender.com";

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#0a0a0a;--surface:#141414;--surface2:#1a1a1a;--border:#2a2a2a;--accent:#e50914;--accent2:#b81d24;--text:#f5f5f5;--muted:#737373;--green:#46d369;--red:#e50914;--orange:#f5a623;--radius:8px}
        html{scroll-behavior:smooth}
        body{background:var(--bg);color:var(--text);font-family:'Inter',system-ui,-apple-system,sans-serif;min-height:100vh;overflow-x:hidden}
        body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse at 30% 0%,rgba(229,9,20,.04),transparent 60%),radial-gradient(ellipse at 70% 100%,rgba(229,9,20,.02),transparent 50%);pointer-events:none;z-index:0}
        .bg-glow{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0}
        .glow-1{width:600px;height:600px;background:rgba(229,9,20,.05);top:-200px;left:-200px}
        .glow-2{width:500px;height:500px;background:rgba(229,9,20,.03);bottom:-150px;right:-150px}
        .wrapper{position:relative;z-index:1;max-width:1100px;margin:0 auto;padding:0 28px}
        header{border-bottom:1px solid var(--border);padding:22px 0;position:sticky;top:0;background:rgba(8,11,16,.88);backdrop-filter:blur(20px);z-index:100}
        .header-inner{max-width:1100px;margin:0 auto;padding:0 28px;display:flex;align-items:center;justify-content:space-between}
        .logo{display:flex;align-items:center;gap:12px;font-size:1.3rem;font-weight:800;letter-spacing:-0.5px;text-decoration:none;color:var(--text);font-family:'Syne',sans-serif}
        .logo-mark{width:36px;height:36px;background:var(--accent);border-radius:4px;display:grid;place-items:center;font-size:.75rem;font-weight:700;color:#fff}
        .badge{display:inline-flex;align-items:center;gap:6px;font-family:monospace;font-size:.7rem;padding:4px 10px;border-radius:20px;border:1px solid var(--border);color:var(--muted)}
        .badge-dot{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        nav{display:flex;gap:28px}
        nav a{font-size:.85rem;color:var(--muted);text-decoration:none;transition:color .2s}
        nav a:hover{color:var(--accent)}
        .hero{padding:90px 0 70px;text-align:center;animation:fadeUp .7s both}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
        .hero-tag{display:inline-flex;align-items:center;gap:8px;font-family:monospace;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);border:1px solid rgba(229,9,20,.3);border-radius:4px;padding:5px 14px;margin-bottom:28px}
        .hero h1{font-size:clamp(2.4rem,6vw,4.2rem);font-weight:800;line-height:1.05;letter-spacing:-2px;margin-bottom:22px}
        .hero h1 span{color:var(--accent)}
        .hero p{font-size:1.05rem;color:var(--muted);max-width:560px;margin:0 auto 40px;line-height:1.7}
        .cta-row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
        .btn{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:8px;font-family:'Syne',sans-serif;font-size:.9rem;font-weight:700;cursor:pointer;text-decoration:none;transition:all .2s;border:none}
        .btn-primary{background:var(--accent);color:#fff;box-shadow:0 0 24px rgba(229,9,20,.3)}
        .btn-primary:hover{transform:translateY(-2px);box-shadow:0 0 40px rgba(229,9,20,.5)}
        .btn-ghost{background:transparent;color:var(--text);border:1px solid var(--border)}
        .btn-ghost:hover{border-color:var(--accent);color:var(--accent);transform:translateY(-2px)}
        .stats-row{display:flex;gap:0;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin:60px 0 0;animation:fadeUp .9s .1s both}
        .stat{flex:1;padding:24px 20px;text-align:center;border-right:1px solid var(--border);background:var(--surface)}
        .stat:last-child{border-right:none}
        .stat-val{font-size:1.8rem;font-weight:800;letter-spacing:-1px}
        section{padding:80px 0}
        .section-label{font-family:monospace;font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:var(--accent);margin-bottom:12px}
        .section-title{font-size:2rem;font-weight:800;letter-spacing:-1px;margin-bottom:40px}
        .endpoints{display:flex;flex-direction:column;gap:18px}
        .ep-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;transition:border-color .2s,box-shadow .2s;animation:fadeUp .7s both}
        .ep-card:nth-child(2){animation-delay:.1s}.ep-card:nth-child(3){animation-delay:.2s}.ep-card:nth-child(4){animation-delay:.3s}
        .ep-card:hover{border-color:rgba(229,9,20,.3);box-shadow:0 0 32px rgba(229,9,20,.06)}
        .ep-header{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:18px 22px}
        .method{font-family:monospace;font-size:.7rem;font-weight:700;padding:4px 10px;border-radius:5px;letter-spacing:.08em}
        .get{background:rgba(0,255,179,.12);color:var(--green);border:1px solid rgba(0,255,179,.25)}
        .ep-path{font-family:monospace;font-size:.88rem;flex:1;color:var(--text);word-break:break-all}
        .ep-path em{color:var(--accent);font-style:normal}
        .ep-type-badge{font-family:monospace;font-size:.65rem;padding:3px 9px;border-radius:20px;font-weight:700;letter-spacing:.05em}
        .movie{background:rgba(229,9,20,.1);color:var(--accent);border:1px solid rgba(229,9,20,.2)}
        .series{background:rgba(229,9,20,.1);color:#e87d7d;border:1px solid rgba(229,9,20,.2)}
        .tv{background:rgba(245,166,35,.1);color:var(--orange);border:1px solid rgba(245,166,35,.2)}
        .ep-desc{padding:0 22px 22px;color:var(--muted);font-size:.88rem;line-height:1.6}
        .ep-body{padding:0 22px 22px;border-top:1px solid var(--border)}
        .params-title{font-size:.75rem;font-family:monospace;color:var(--muted);margin:18px 0 10px;letter-spacing:.08em;text-transform:uppercase}
        .params-table{width:100%;border-collapse:collapse;font-size:.82rem}
        .params-table th{text-align:left;padding:8px 12px;background:rgba(255,255,255,.03);color:var(--muted);font-family:monospace;font-size:.7rem;font-weight:400;border-bottom:1px solid var(--border)}
        .params-table td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:top}
        .params-table tr:last-child td{border-bottom:none}
        .param-name{font-family:monospace;color:var(--accent);font-size:.8rem}
        .param-type{font-family:monospace;color:var(--orange);font-size:.75rem}
        .param-req{font-family:monospace;font-size:.7rem}
        .req{color:var(--red)}.opt{color:var(--muted)}
        .code-block{background:#060910;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-top:14px;font-size:.8rem}
        .code-top{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.02)}
        .code-lang{font-family:monospace;font-size:.65rem;color:var(--muted)}
        .copy-btn{font-family:monospace;font-size:.65rem;color:var(--muted);background:none;border:1px solid var(--border);border-radius:5px;padding:3px 9px;cursor:pointer;transition:all .2s}
        .copy-btn:hover{color:var(--accent);border-color:var(--accent)}
        .copy-btn.copied{color:var(--green);border-color:var(--green)}
        pre{padding:16px 18px;overflow-x:auto;line-height:1.65;font-family:'Space Mono',Courier,monospace;color:#8da8c8;margin:0;white-space:pre-wrap}
        .kw{color:#a97bf7}.str{color:var(--green)}.cm{color:#3d5268;font-style:italic}.fn{color:var(--accent)}.num{color:var(--orange)}
        .demo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
        .demo-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;animation:fadeUp .7s both;transition:border-color .25s,box-shadow .25s,transform .25s}
        .demo-card:nth-child(2){animation-delay:.1s}.demo-card:nth-child(3){animation-delay:.2s}
        .demo-card:hover{border-color:rgba(0,229,255,.35);box-shadow:0 8px 40px rgba(0,229,255,.08);transform:translateY(-3px)}
        .demo-thumb{width:100%;aspect-ratio:16/9;position:relative;background:#07090f;overflow:hidden;cursor:pointer}
        .demo-thumb .poster{width:100%;height:100%;object-fit:cover;transition:transform .4s,filter .4s;display:block}
        .demo-card:hover .demo-thumb .poster{transform:scale(1.04);filter:brightness(.7)}
        .demo-thumb .overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(8,11,16,.85) 0%,transparent 60%);transition:opacity .3s}
        .play-btn{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:56px;height:56px;border-radius:50%;background:rgba(0,229,255,.18);border:2px solid rgba(0,229,255,.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;transition:all .25s;z-index:2}
        .play-btn svg{width:20px;height:20px;fill:var(--accent);margin-left:3px}
        .demo-card:hover .play-btn{transform:translate(-50%,-50%) scale(1.12);background:rgba(0,229,255,.28);box-shadow:0 0 32px rgba(0,229,255,.4)}
        .demo-info{padding:16px 18px}
        .demo-badge-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
        .demo-title{font-size:.95rem;font-weight:700;margin-bottom:4px}
        .demo-sub{font-size:.78rem;color:var(--muted);margin-bottom:14px;font-family:monospace}
        .demo-url{font-family:monospace;font-size:.68rem;color:var(--muted);word-break:break-all;margin-bottom:14px}
        .demo-url span{color:var(--accent)}
        .demo-actions{display:flex;gap:8px;flex-wrap:wrap}
        .try-btn{display:inline-flex;align-items:center;gap:6px;font-family:monospace;font-size:.72rem;color:var(--accent);background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.2);border-radius:6px;padding:6px 12px;cursor:pointer;text-decoration:none;transition:all .2s}
        .try-btn:hover{background:rgba(0,229,255,.15)}
        .try-btn.ghost{color:var(--muted);background:transparent;border-color:var(--border)}
        .try-btn.ghost:hover{color:var(--text);border-color:var(--muted)}
        .schema-box{background:#060910;border:1px solid var(--border);border-radius:8px;overflow:hidden}
        .schema-row{display:grid;grid-template-columns:200px 160px 1fr;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.04);font-size:.82rem}
        .schema-row:last-child{border-bottom:none}
        .schema-row.header{background:rgba(255,255,255,.03);color:var(--muted);font-family:monospace;font-size:.7rem;text-transform:uppercase;letter-spacing:.08em}
        .field-name{font-family:monospace;color:var(--text)}.field-type{font-family:monospace;color:var(--orange)}.field-desc{color:var(--muted)}
        footer{border-top:1px solid var(--border);padding:40px 0;text-align:center;color:var(--muted);font-size:.82rem}
        footer strong{color:var(--text)}
        .url-builder{padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-top:28px}
        @media(max-width:700px){.stats-row{flex-direction:column}.stat{border-right:none;border-bottom:1px solid var(--border)}.stat:last-child{border-bottom:none}nav{display:none}.schema-row{grid-template-columns:1fr 1fr}.schema-row .field-desc{display:none}}
      `}</style>

      <div className="bg-glow glow-1" />
      <div className="bg-glow glow-2" />

      <header>
        <div className="header-inner">
          <a className="logo" href="#">
            <div className="logo-mark">SV</div>
            StreamVault
          </a>
          <nav>
            <a href="#endpoints">Endpoints</a>
            <a href="#demo">Demo</a>
            <a href="#schema">Schema</a>
          </nav>
          <div className="badge">
            <span className="badge-dot" />
            API v1.0 · Online
          </div>
        </div>
      </header>

      <div className="wrapper">
        <div className="hero">
          <div className="hero-tag">
            <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="currentColor" /></svg>
            Embed Player API — Español Latino
          </div>
          <h1>Reproduce cualquier<br /><span>contenido al instante</span></h1>
          <p>Integrá el player de StreamVault en tu sitio con una sola línea. Películas, series, anime y canales TV — contenido en español latino, sin configuración compleja.</p>
          <div className="cta-row">
            <a href="#endpoints" className="btn btn-primary">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
              Ver Endpoints
            </a>
            <a href="#demo" className="btn btn-ghost">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Ver Demo
            </a>
          </div>
          <div className="stats-row">
            <div className="stat"><div className="stat-val" style={{color:"var(--accent)"}}>Películas, Series, TV</div><div className="stat-lbl" style={{fontFamily:"monospace"}}>Tipos de contenido</div></div>
            <div className="stat"><div className="stat-val" style={{color:"#e50914"}}>iframe</div><div className="stat-lbl" style={{fontFamily:"monospace"}}>Método de embed</div></div>
            <div className="stat"><div className="stat-val" style={{color:"var(--green)"}}>100%</div><div className="stat-lbl" style={{fontFamily:"monospace"}}>Sin autenticación</div></div>
          </div>
        </div>

        <section id="endpoints">
          <div className="section-label">// Referencia</div>
          <div className="section-title">Endpoints del Player</div>
          <div className="endpoints">

            {/* MOVIE */}
            <EndpointCard
              method="GET"
              path="/embed/movie/{tmdb_id}"
              badge="🎬 Movie"
              badgeClass="movie"
              desc="Carga el player embed para una película usando su ID de TMDB. Contenido en español latino."
              params={[{name:"tmdb_id",type:"integer",req:true,desc:"ID numérico de la película en TMDB"}]}
              code={`<!-- Embed de película: TMDB ID 272 -->
&lt;iframe
  src="${BASE}/embed/movie/272"
  width="100%"
  height="500"
  frameborder="0"
  allowfullscreen
  allow="autoplay; encrypted-media; fullscreen"
&gt;&lt;/iframe&gt;`}
            />

            {/* SERIES */}
            <EndpointCard
              method="GET"
              path="/embed/tv/{tmdb_id}?season={s}&episode={e}"
              badge="📺 Series"
              badgeClass="series"
              desc="Carga el player embed para un episodio de serie."
              params={[
                {name:"tmdb_id",type:"integer",req:true,desc:"ID de la serie en TMDB"},
                {name:"season",type:"integer",req:true,desc:"Número de temporada (empieza en 1)"},
                {name:"episode",type:"integer",req:true,desc:"Número de episodio"},
              ]}
              code={`<!-- Serie: TMDB 1399 | T1 E1 -->
&lt;iframe
  src="${BASE}/embed/tv/1399?season=1&episode=1"
  width="100%"
  height="500"
  frameborder="0"
  allowfullscreen
  allow="autoplay; encrypted-media; fullscreen"
&gt;&lt;/iframe&gt;`}
            />

            {/* TV CHANNELS */}
            <EndpointCard
              method="GET"
              path="/api/v1/tv/all?page=1&limit=200"
              badge="📡 TV Channels"
              badgeClass="tv"
              desc="Lista todos los canales de TV disponibles. Devuelve array JSON con nombre, logo, categoría, país y URL del stream."
              params={[
                {name:"page",type:"integer",req:false,desc:"Número de página (default 1)"},
                {name:"limit",type:"integer",req:false,desc:"Resultados por página (default 20, max 200)"},
              ]}
              code={`fetch("${BASE}/api/v1/tv/all?page=1&limit=200")
  .then(r => r.json())
  .then(data => console.log(data.results));
// [{name, logo, country, category, url}, ...]`}
            />

            {/* LIVE TV EMBED */}
            <EndpointCard
              method="GET"
              path="/embed/live/{slug}"
              badge="📺 Live TV"
              badgeClass="series"
              desc="Player embed directo para canales de TV en vivo. Resuelve automáticamente el stream desde múltiples fuentes."
              params={[{name:"slug",type:"string",req:true,desc:"Slug del canal (ej: caracol-tv, espn-premium, rcn-tv)"}]}
              code={`<!-- Canal de TV en vivo -->
&lt;iframe
  src="${BASE}/embed/live/caracol-tv"
  width="100%"
  height="500"
  frameborder="0"
  allowfullscreen
  allow="autoplay; encrypted-media; fullscreen"
&gt;&lt;/iframe&gt;`}
            />

            {/* SEARCH TV */}
            <EndpointCard
              method="GET"
              path="/api/v1/tv/all?search={query}"
              badge="🔍 Search TV"
              badgeClass="tv"
              desc="Busca canales de TV en vivo consultando múltiples fuentes (TeleOnline + Animux) en tiempo real."
              params={[{name:"search",type:"string",req:true,desc:"Término de búsqueda (ej: caracol, espn, rcn)"}]}
              code={`fetch("${BASE}/api/v1/tv/all?search=caracol")
  .then(r => r.json())
  .then(data => console.log(data.results));`}
            />
          </div>
        </section>

        {/* DEMO */}
        <section id="demo">
          <div className="section-label">// Live Demo</div>
          <div className="section-title">Ejemplos en vivo</div>
          <div className="demo-grid">
            {[
              { type:"movie", id:272, title:"Batman Begins", poster:"https://image.tmdb.org/t/p/w500/6yMWU1vWkOBbNRIwOxhetd2aHhO.jpg", badge:"🎬 Movie", year:"2005" },
              { type:"tv", id:1399, season:1, episode:1, title:"Game of Thrones", poster:"https://image.tmdb.org/t/p/w500/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg", badge:"📺 Series", year:"2011 · T1E1" },
              { type:"tv", id:37854, season:1, episode:1, title:"One Piece", poster:"https://image.tmdb.org/t/p/w500/2uGjavvyQkTK26u2KGW6z2yDg9o.jpg", badge:"⛩️ Anime", year:"1999 · T1E1" },
            ].map((item, i) => {
              const demoUrl = item.type === "movie"
                ? `${BASE}/embed/movie/${item.id}`
                : `${BASE}/embed/tv/${item.id}?season=${item.season}&episode=${item.episode}`;
              return (
                <div className="demo-card" key={i}>
                  <div className="demo-thumb" style={{ cursor: "pointer" }} onClick={() => window.open(demoUrl, "_blank")}>
                    <img className="poster" src={item.poster} alt={item.title} onError={(e) => { (e.target as HTMLImageElement).style.opacity = ".3"; }} />
                    <div className="overlay" />
                    <div className="play-btn">
                      <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    </div>
                  </div>
                  <div className="demo-info">
                    <div className="demo-badge-row">
                      <span className={`ep-type-badge ${item.type === "movie" ? "movie" : "series"}`}>{item.badge}</span>
                      <span style={{fontFamily:"monospace",fontSize:".65rem",color:"var(--muted)"}}>{item.year}</span>
                    </div>
                    <div className="demo-title">{item.title}</div>
                    <div className="demo-url">streamvault-vj0p.onrender.com<span>{item.type === "movie" ? `/embed/movie/${item.id}` : `/embed/tv/${item.id}`}</span></div>
                    <div className="demo-actions">
                      <a className="try-btn" href={demoUrl} target="_blank">▶ Reproducir aquí</a>
                      <a className="try-btn ghost" href={demoUrl} target="_blank">↗</a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* URL BUILDER */}
        <section>
          <div className="section-label">// Generador de URL</div>
          <div className="url-builder">
            <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16,alignItems:"flex-end"}}>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <label style={{fontFamily:"monospace",fontSize:".7rem",color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em"}}>Tipo</label>
                <select id="gen-type" style={{background:"#060910",border:"1px solid var(--border)",color:"var(--text)",fontFamily:"monospace",fontSize:".82rem",padding:"9px 12px",borderRadius:"7px",cursor:"pointer"}}>
                  <option value="movie">🎬 Película</option>
                  <option value="tv">📺 Serie</option>
                </select>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <label style={{fontFamily:"monospace",fontSize:".7rem",color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em"}}>TMDB ID</label>
                <input id="gen-id" type="number" placeholder="ej. 272" defaultValue="272" style={{background:"#060910",border:"1px solid var(--border)",color:"var(--text)",fontFamily:"monospace",fontSize:".82rem",padding:"9px 12px",borderRadius:"7px",width:160}} />
              </div>
              <div id="gen-tv" style={{display:"none",gap:12}}>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <label style={{fontFamily:"monospace",fontSize:".7rem",color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em"}}>Season</label>
                  <input id="gen-s" type="number" defaultValue="1" min="1" style={{background:"#060910",border:"1px solid var(--border)",color:"var(--text)",fontFamily:"monospace",fontSize:".82rem",padding:"9px 12px",borderRadius:"7px",width:110}} />
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <label style={{fontFamily:"monospace",fontSize:".7rem",color:"var(--muted)",textTransform:"uppercase",letterSpacing:".08em"}}>Episode</label>
                  <input id="gen-e" type="number" defaultValue="1" min="1" style={{background:"#060910",border:"1px solid var(--border)",color:"var(--text)",fontFamily:"monospace",fontSize:".82rem",padding:"9px 12px",borderRadius:"7px",width:110}} />
                </div>
              </div>
            </div>
            <div className="code-block" style={{marginTop:0}}>
              <div className="code-top"><span className="code-lang">URL GENERADA</span><button className="copy-btn" id="gen-copy" onClick={() => { const el = document.getElementById("gen-output"); if (el) navigator.clipboard.writeText(el.textContent || "").then(() => { const b = document.getElementById("gen-copy"); if (b) { b.textContent = "✓ Copiado"; b.classList.add("copied"); setTimeout(() => { b.textContent = "Copiar"; b.classList.remove("copied"); }, 2000); } }); }}>Copiar</button></div>
              <pre id="gen-output" style={{color:"var(--accent)"}}>{BASE}/embed/movie/272</pre>
            </div>
            <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>
              <a id="gen-link" href={`${BASE}/embed/movie/272`} target="_blank" className="try-btn">▶ Probar aquí</a>
            </div>
          </div>
        </section>

        {/* SCHEMA */}
        <section id="schema">
          <div className="section-label">// Estructura de URL</div>
          <div className="section-title">Formatos de Embed</div>
          <div className="schema-box">
            <div className="schema-row header"><div>Tipo</div><div>Patrón URL</div><div>Ejemplo</div></div>
            <div className="schema-row"><div className="field-name">🎬 Película</div><div className="field-type">/movie/{"{id}"}</div><div className="field-desc">streamvault-vj0p.onrender.com/embed/movie/272</div></div>
            <div className="schema-row"><div className="field-name">📺 Serie</div><div className="field-type">/tv/{"{id}"}?season=&episode=</div><div className="field-desc">streamvault-vj0p.onrender.com/embed/tv/1399?season=1&episode=1</div></div>
            <div className="schema-row"><div className="field-name">📡 Canales TV</div><div className="field-type">/api/v1/tv/all</div><div className="field-desc">streamvault-vj0p.onrender.com/api/v1/tv/all?page=1&limit=20</div></div>
            <div className="schema-row"><div className="field-name">📺 Live TV</div><div className="field-type">/embed/live/{"{slug}"}</div><div className="field-desc">streamvault-vj0p.onrender.com/embed/live/caracol-tv</div></div>
            <div className="schema-row"><div className="field-name">🔍 Buscar TV</div><div className="field-type">/api/v1/tv/all?search=</div><div className="field-desc">streamvault-vj0p.onrender.com/api/v1/tv/all?search=espn</div></div>
          </div>
        </section>

        <footer>
          <div className="wrapper">
            <strong>StreamVault</strong> · Embed Player API v1.0 · Contenido en español latino · Sin API key requerida
          </div>
        </footer>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        (function(){
          var type=document.getElementById('gen-type');
          var tv=document.getElementById('gen-tv');
          var out=document.getElementById('gen-output');
          var link=document.getElementById('gen-link');
          var id=document.getElementById('gen-id');
          var s=document.getElementById('gen-s');
          var e=document.getElementById('gen-e');
          var BASE='${BASE}';
          function update(){
            var t=type.value;
            tv.style.display=t==='tv'?'flex':'none';
            var url=t==='movie'?BASE+'/embed/movie/'+(id.value||'272'):BASE+'/embed/tv/'+(id.value||'1399')+'?season='+(s.value||1)+'&episode='+(e.value||1);
            out.textContent=url;
            link.href=url;
          }
          type.onchange=update;id.oninput=update;s.oninput=update;e.oninput=update;
        })();
      `}} />
    </>
  );
}

function EndpointCard({ method, path, badge, badgeClass, desc, params, code }: {
  method: string; path: string; badge: string; badgeClass: string;
  desc: string; params: { name: string; type: string; req: boolean; desc: string }[];
  code: string;
}) {
  return (
    <div className="ep-card">
      <div className="ep-header">
        <span className="method get">{method}</span>
        <span className="ep-path">{path.split(/\{([^}]+)\}/g).map((part, i) =>
          i % 2 === 1 ? <em key={i}>{`{${part}}`}</em> : part
        )}</span>
        <span className={`ep-type-badge ${badgeClass}`}>{badge}</span>
      </div>
      <div className="ep-desc">{desc}</div>
      <div className="ep-body">
        <div className="params-title">Parameters</div>
        <table className="params-table">
          <tbody>
            <tr><th>Parámetro</th><th>Tipo</th><th>Req.</th><th>Descripción</th></tr>
            {params.map(p => (
              <tr key={p.name}>
                <td><span className="param-name">{p.name}</span></td>
                <td><span className="param-type">{p.type}</span></td>
                <td><span className={`param-req ${p.req ? "req" : "opt"}`}>{p.req ? "required" : "optional"}</span></td>
                <td>{p.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="code-block">
          <div className="code-top">
            <span className="code-lang">EJEMPLO DE USO</span>
            <button className="copy-btn" onClick={() => navigator.clipboard.writeText(code.replace(/<[^>]*>/g, ""))}>Copiar</button>
          </div>
          <pre dangerouslySetInnerHTML={{ __html: code }} />
        </div>
      </div>
    </div>
  );
}
