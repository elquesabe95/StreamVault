"use client";

import { useEffect, useState, use } from "react";
import NetflixPlayer from "@/components/NetflixPlayer";
import { Loader2, AlertCircle } from "lucide-react";

export default function LiveEmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [sources, setSources] = useState<any[]>([]);
  const [title, setTitle] = useState("Cargando...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Try TeleOnline first
        const res = await fetch(`/api/v1/scraper?provider=teleonline&slug=${encodeURIComponent(slug)}`);
        const data = await res.json();

        if (!cancelled && data.success && data.sources?.length > 0) {
          setTitle(slug.replace(/-/g, " ").toUpperCase());
          setSources(data.sources);
          setLoading(false);
          return;
        }

        // Try Animux as fallback
        const animuxRes = await fetch(`/api/v1/scraper?provider=animux&slug=${encodeURIComponent(slug)}`);
        const animuxData = await animuxRes.json();

        if (!cancelled && animuxData.success && animuxData.sources?.length > 0) {
          setTitle(slug.replace(/-/g, " ").toUpperCase());
          setSources(animuxData.sources);
          setLoading(false);
          return;
        }

        if (!cancelled) setError("Canal no disponible en este momento");
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Error al cargar el canal");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <Loader2 className="animate-spin text-yellow-500 mb-4" size={48} />
        <p className="text-gray-500">Cargando canal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black p-6 text-center">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold mb-2 text-white">{title}</h2>
        <p className="text-gray-400 max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <NetflixPlayer sources={sources} title={title} onBack={() => {}} showLangBadge={false} />
    </div>
  );
}
