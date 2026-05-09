"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import NetflixPlayer from "@/components/NetflixPlayer";
import { Loader2, AlertCircle } from "lucide-react";

function EmbedContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  
  const type = params.type as string;
  const id = params.id as string;
  const season = searchParams.get("season") || "1";
  const episode = searchParams.get("episode") || "1";
  
  const [sources, setSources] = useState<any[]>([]);
  const [title, setTitle] = useState("Reproductor");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      
      try {
        if (type === 'live') {
          // Live TV Logic: Try multiple providers for better reliability
          setTitle(id.replace(/-/g, ' ').toUpperCase());
          
          // Try TeleOnline first (Fixed parameters to match API: provider & slug)
          const teleRes = await fetch(`/api/v1/scraper?provider=teleonline&slug=${encodeURIComponent(id)}`);
          const teleData = await teleRes.json();
          
          let liveSources: any[] = [];
          if (teleData.success && teleData.sources) liveSources.push(...teleData.sources);

          // Try Animux as backup if needed
          if (liveSources.length === 0) {
            const animuxRes = await fetch(`/api/v1/scraper?provider=animux&slug=${encodeURIComponent(id)}`);
            const animuxData = await animuxRes.json();
            if (animuxData.success && animuxData.sources) liveSources.push(...animuxData.sources);
          }
          
          if (liveSources.length > 0) {
            setSources(liveSources);
          } else {
            throw new Error("El canal no pudo ser localizado. Verifica si el nombre (slug) es correcto.");
          }
        } else {
          // 1. Get metadata from TMDB to get the title
          const tmdbRes = await fetch(`/api/v1/${type === 'movie' ? 'movie' : 'tv'}/${id}`);
          const tmdbData = await tmdbRes.json();
          
          if (!tmdbData.success) {
             throw new Error("No se pudo obtener información de TMDB");
          }
          
          const contentTitle = tmdbData.data.title || tmdbData.data.name;
          setTitle(contentTitle);

          // 2. Get stream sources
          let apiUrl = `/api/v1/scraper?query=${encodeURIComponent(contentTitle)}&type=${type}&id=${id}`;
          if (type !== 'movie') {
             apiUrl += `&season=${season}&episode=${episode}`;
          }

          const scraperRes = await fetch(apiUrl);
          const scraperData = await scraperRes.json();

          if (scraperData.success && scraperData.sources && scraperData.sources.length > 0) {
            setSources(scraperData.sources);
          } else {
            setError("No se encontraron fuentes disponibles para este contenido.");
          }
        }
      } catch (e: any) {
        console.error("Embed Error:", e);
        setError(e.message || "Error al cargar el video.");
      } finally {
        setLoading(false);
      }
    }

    if (id && type) {
      loadData();
    }
  }, [id, type, season, episode]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <Loader2 className="animate-spin text-yellow-500 mb-4" size={48} />
        <p className="text-gray-500 font-medium">Buscando fuentes de alta velocidad...</p>
      </div>
    );
  }

  if (error || sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black p-6 text-center">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold mb-2 text-white">No se pudo cargar el video</h2>
        <p className="text-gray-400 max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <NetflixPlayer 
        sources={sources} 
        title={title}
        onBack={() => {}} // No back button in embed
        showLangBadge={type === 'anime'}
      />
    </div>
  );
}

export default function EmbedPage() {
  return (
    <div className="w-full h-full min-h-screen bg-black">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="animate-spin text-yellow-500" size={48} />
        </div>
      }>
        <EmbedContent />
      </Suspense>
    </div>
  );
}
