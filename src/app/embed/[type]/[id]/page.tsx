"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import NetflixPlayer from "@/components/NetflixPlayer";
import { Loader2, AlertCircle } from "lucide-react";
import { resolveEmbed69Client } from "@/lib/client-jwt";

interface EmbedSource {
  url: string;
  name?: string;
  lang?: string;
  playbackType?: "hls" | "mp4" | "iframe";
}

interface EmbedData {
  type: "movie" | "tv";
  id: number;
  title: string;
  poster: string;
  backdrop: string;
  year: string;
  rating: number;
  season?: number;
  episode?: number;
  sources: EmbedSource[];
}

function resolvePlaybackType(url: string): "hls" | "mp4" | "iframe" {
  if (/\.m3u8(?:[?#].*)?$/i.test(url) || url.includes(".m3u8")) return "hls";
  if (/\.mp4(?:[?#].*)?$/i.test(url) || url.includes(".mp4")) return "mp4";
  return "iframe";
}

function EmbedContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const type = (params.type as string) || "movie";
  const id = params.id as string;
  const season = searchParams.get("season") || "1";
  const episode = searchParams.get("episode") || "1";

  const [data, setData] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingJwt, setResolvingJwt] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const url = `/api/v1/embed-serve?type=${type}&id=${id}&season=${season}&episode=${episode}`;
        const res = await fetch(url);
        const json = await res.json();

        if (cancelled) return;

        if (!json.success) {
          setError(json.message || "No se pudo cargar el contenido");
          return;
        }

        let sources: EmbedSource[] = json.data.sources || [];

        // Client-side JWT resolution for embed69 URLs
        const embed69Sources = sources.filter((s: EmbedSource) => s.url.includes("embed69.org"));
        if (embed69Sources.length > 0) {
          setResolvingJwt(true);
          const jwtResults: EmbedSource[] = [];
          let jwtCount = 0;

          await Promise.all(embed69Sources.map(async (src: EmbedSource) => {
            const resolved = await resolveEmbed69Client(src.url);
            for (const link of resolved) {
              jwtCount++;
              jwtResults.push({
                url: link,
                name: `JWT ${jwtCount}`,
                lang: src.lang || "Latino",
                playbackType: resolvePlaybackType(link),
              });
            }
          }));

          if (jwtResults.length > 0) {
            // Add resolved JWT streams at the beginning
            sources = [...jwtResults, ...sources];
          }
          setResolvingJwt(false);
        }

        setData({ ...json.data, sources });

        if (sources.length === 0) {
          setError("No se encontraron fuentes disponibles para este contenido.");
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Error al conectar con el servidor");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (id && type) load();

    return () => { cancelled = true; };
  }, [id, type, season, episode]);

  if (loading || resolvingJwt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <Loader2 className="animate-spin text-yellow-500 mb-4" size={48} />
        <p className="text-gray-500 font-medium">
          {resolvingJwt ? "Resolviendo streams JWT..." : "Buscando fuentes..."}
        </p>
      </div>
    );
  }

  if (error || !data || data.sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black p-6 text-center">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold mb-2 text-white">No se pudo cargar el video</h2>
        <p className="text-gray-400 max-w-md">{error || "No hay fuentes disponibles"}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <NetflixPlayer
        sources={data.sources}
        title={data.title}
        onBack={() => {}}
        showLangBadge={true}
      />
    </div>
  );
}

export default function EmbedPage() {
  return (
    <div className="w-full h-full min-h-screen bg-black">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="animate-spin text-yellow-500" size={48} />
          </div>
        }
      >
        <EmbedContent />
      </Suspense>
    </div>
  );
}
