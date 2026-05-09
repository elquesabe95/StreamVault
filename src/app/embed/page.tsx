"use client";

import { useState } from "react";
import { Copy, ExternalLink, Code, Film, Tv, Check } from "lucide-react";

export default function EmbedGenerator() {
  const [type, setType] = useState<"movie" | "tv" | "live">("movie");
  const [tmdbId, setTmdbId] = useState("272");
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://streamvault.app";
  
  const embedUrl = type === "movie" 
    ? `${baseUrl}/embed/movie/${tmdbId}`
    : type === "tv"
    ? `${baseUrl}/embed/tv/${tmdbId}?season=${season}&episode=${episode}`
    : `${baseUrl}/embed/live/${tmdbId}`;

  const iframeCode = `<iframe 
  src="${embedUrl}" 
  width="100%" 
  height="500px" 
  frameborder="0" 
  scrolling="no" 
  allowfullscreen
></iframe>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white selection:bg-yellow-500/30">
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-20">
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
            STREAM<span className="text-yellow-500">VAULT</span> EMBED
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto font-medium">
            Integra nuestro potente motor de streaming en tu propio sitio web. 
            Sin anuncios invasivos, alta velocidad y multi-fuente.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Form */}
          <div className="bg-[#121216] border border-white/5 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Code className="text-yellow-500" size={20} />
              Configurador de Iframe
            </h2>

            <div className="space-y-6">
              {/* Type Switcher */}
              <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
                <button 
                  onClick={() => { setType("movie"); setTmdbId("272"); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-semibold ${type === "movie" ? "bg-yellow-500 text-black shadow-lg" : "text-gray-400 hover:text-white"}`}
                >
                  <Film size={18} /> Película
                </button>
                <button 
                  onClick={() => { setType("tv"); setTmdbId("1399"); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-semibold ${type === "tv" ? "bg-yellow-500 text-black shadow-lg" : "text-gray-400 hover:text-white"}`}
                >
                  <Tv size={18} /> Serie
                </button>
                <button 
                  onClick={() => { setType("live"); setTmdbId("caracol-tv"); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-semibold ${type === "live" ? "bg-yellow-500 text-black shadow-lg" : "text-gray-400 hover:text-white"}`}
                >
                  <Tv size={18} /> TV Vivo
                </button>
              </div>

              {/* Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                    {type === "live" ? "Slug del Canal" : "ID de TMDB"}
                  </label>
                  <input 
                    type="text" 
                    value={tmdbId}
                    onChange={(e) => setTmdbId(e.target.value)}
                    placeholder={type === "live" ? "Ej: caracol-tv" : "Ej: 272"}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-500/50 transition-colors text-lg font-medium"
                  />
                </div>

                {type === "tv" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Temporada</label>
                      <input 
                        type="number" 
                        value={season}
                        onChange={(e) => setSeason(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-500/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Episodio</label>
                      <input 
                        type="number" 
                        value={episode}
                        onChange={(e) => setEpisode(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-500/50 transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Copy Button */}
              <button 
                onClick={copyToClipboard}
                className="w-full bg-white text-black hover:bg-yellow-500 transition-all font-black py-4 rounded-xl flex items-center justify-center gap-2 text-lg active:scale-95"
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
                {copied ? "COPIADO" : "COPIAR CÓDIGO"}
              </button>
            </div>
          </div>

          {/* Preview / Code */}
          <div className="space-y-6">
            <div className="bg-black/40 border border-white/5 rounded-3xl p-6">
              <h3 className="text-sm font-bold text-gray-500 mb-4 flex items-center justify-between">
                VISTA PREVIA DEL CÓDIGO
                <a href={embedUrl} target="_blank" className="text-yellow-500 hover:underline flex items-center gap-1 text-[10px]">
                  PROBAR LINK <ExternalLink size={10} />
                </a>
              </h3>
              <pre className="text-xs md:text-sm text-yellow-500/80 bg-black p-6 rounded-2xl border border-yellow-500/10 overflow-x-auto font-mono leading-relaxed">
                {iframeCode}
              </pre>
            </div>

            <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-3xl p-8">
              <h3 className="text-lg font-bold text-yellow-500 mb-2">Instrucciones</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Copia el código de arriba y pégalo en cualquier archivo HTML o componente de React/Next.js. 
                El reproductor se encargará automáticamente de:
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-yellow-500 rounded-full" />
                  Búsqueda automática de fuentes
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-yellow-500 rounded-full" />
                  Saltar anuncios de terceros
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-yellow-500 rounded-full" />
                  Selección de idioma (Latino/Sub)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
