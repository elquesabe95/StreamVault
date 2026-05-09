"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import NetflixPlayer from "@/components/NetflixPlayer";
import { Loader2, AlertCircle, Home } from "lucide-react";

function WatchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("query");
  const type = searchParams.get("type");
  const [sources, setSources] = useState<{
    url: string;
    name?: string;
    lang?: string;
    playbackType?: "hls" | "mp4" | "iframe";
    originalUrl?: string;
    headers?: Record<string, string>;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getStream() {
      if (!query) return;

      const directUrl = searchParams.get("url");
      if (directUrl) {
        const headersParam = searchParams.get("headers");
        let headers: Record<string, string> | undefined;
        try {
          headers = headersParam ? JSON.parse(headersParam) : undefined;
        } catch {
          headers = undefined;
        }

        if (directUrl.startsWith("/api/v1")) {
          try {
            const res = await fetch(directUrl);
            const data = await res.json();
            if (data.url) setSources([{ url: data.url, headers }]);
            else if (data.sources) setSources(data.sources);
            else setError("Error al resolver el canal.");
          } catch (e) {
            setError("Error al conectar con el servidor.");
          } finally {
            setLoading(false);
          }
          return;
        }
        setSources([{ url: directUrl, headers }]);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        let apiUrl = `/api/v1/scraper?query=${encodeURIComponent(query)}`;
        const season = searchParams.get("season");
        const episode = searchParams.get("episode");
        const id = searchParams.get("id");

        if (type) apiUrl += `&type=${type}`;
        if (season) apiUrl += `&season=${season}`;
        if (episode) apiUrl += `&episode=${episode}`;
        if (id) apiUrl += `&id=${id}`;

        const res = await fetch(apiUrl);
        if (res.redirected) {
          setSources([{ url: res.url }]);
        } else {
          const data = await res.json();
          if (data.sources && data.sources.length > 0) {
              setSources(data.sources);
          } else if (data.url) {
              setSources([{ url: data.url }]);
          } else {
              setError("No se pudo encontrar el flujo de video en ninguna de nuestras fuentes.");
          }
        }
      } catch (e) {
        setError("Error al conectar con el servidor.");
      } finally {
        setLoading(false);
      }
    }

    getStream();
  }, [query, type, searchParams]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <Loader2 className="animate-spin text-yellow-500 mb-4" size={64} />
        <p className="text-gray-400 animate-pulse font-medium">Sincronizando fuentes de alta velocidad...</p>
      </div>
    );
  }

  if (error || sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black p-6">
        <AlertCircle className="text-red-500 mb-4" size={64} />
        <h2 className="text-2xl font-bold mb-2 text-white">¡Vaya! Algo salió mal</h2>
        <p className="text-gray-400 mb-8 text-center max-w-md">{error || "No hay fuentes disponibles."}</p>
        <button 
          onClick={() => window.location.href = "/search"}
          className="bg-yellow-500 text-black px-8 py-3 rounded-xl font-bold hover:bg-yellow-400 transition-all flex items-center gap-2"
        >
          <Home size={20} /> Volver al buscador
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-0 md:p-8">
      <div className="w-full max-w-7xl aspect-video">
        <NetflixPlayer 
          sources={sources} 
          title={query || "Película"} 
          onBack={() => window.location.href = "/search"} 
          showLangBadge={type === 'anime'}
        />
        <div className="mt-8 p-8 bg-[#16161e] rounded-3xl border border-gray-800 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-4xl font-bold text-yellow-500">{query}</h1>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 text-xs font-bold rounded-full border border-yellow-500/20 uppercase tracking-wider">
                        Auto-Failover Activo
                    </span>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div className="p-4 bg-black/40 rounded-2xl border border-gray-800/50">
                    <p className="text-gray-400 font-semibold mb-1">Calidad</p>
                    <p className="text-white">Auto (HD/4K)</p>
                </div>
                <div className="p-4 bg-black/40 rounded-2xl border border-gray-800/50">
                    <p className="text-gray-400 font-semibold mb-1">Fuentes</p>
                    <p className="text-white">{sources.length} Servidores Activos</p>
                </div>
                <div className="p-4 bg-black/40 rounded-2xl border border-gray-800/50">
                    <p className="text-gray-400 font-semibold mb-1">Estado</p>
                    <p className="text-green-500 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Streaming Estable
                    </p>
                </div>
            </div>

            <p className="text-gray-500 mt-8 leading-relaxed">
                Nuestra tecnología de <strong>Auto-Failover</strong> monitoriza múltiples fuentes en tiempo real. Si una conexión se degrada o falla, el reproductor transiciona automáticamente al siguiente servidor disponible para garantizar una experiencia sin interrupciones.
            </p>
        </div>
      </div>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <WatchContent />
    </Suspense>
  );
}
