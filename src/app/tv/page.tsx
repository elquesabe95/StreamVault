"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, Tv, Play, Loader2, Info } from "lucide-react";
import Link from "next/link";

interface Channel {
  name: string;
  url: string;
  logo: string;
  category: string;
  provider: string;
  country?: string;
}

export default function TVHub() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const observer = useRef<IntersectionObserver | null>(null);
  const lastChannelElementRef = useCallback((node: any) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  const fetchChannels = async (pageNum: number, isNewSearch: boolean = false) => {
    if (pageNum > 1) setLoadingMore(true);
    else setLoading(true);

    try {
      // Use the hybrid API
      const res = await fetch(`/api/v1/tv/all?page=${pageNum}&limit=20&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      
      if (data.success) {
        if (isNewSearch) setChannels(data.results);
        else setChannels(prev => [...prev, ...data.results]);
        setHasMore(data.page < data.totalPages && data.results.length >= 20);
      }
    } catch (e) {
      console.error("Error loading channels:", e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Debounce search to avoid too many requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchChannels(1, true);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (page > 1) fetchChannels(page);
  }, [page]);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white">
      <div className="relative h-[25vh] flex items-center justify-center overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/10 via-transparent to-[#0a0a0c]" />
        <div className="relative z-10 text-center space-y-6 px-6 w-full max-w-2xl">
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">
            TV <span className="text-yellow-500">Hub</span>
          </h1>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-yellow-500" size={18} />
            <input 
              type="text" 
              placeholder="Buscar canal (Ej: RCN, Caracol, ESPN...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 transition-all text-sm backdrop-blur-md"
            />
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {loading && page === 1 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-yellow-500 mb-4" size={48} />
            <p className="text-gray-500 text-sm italic">Buscando en todas las fuentes...</p>
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-20 bg-[#121216] rounded-3xl border border-dashed border-white/10">
            <Info className="mx-auto text-gray-600 mb-4" size={48} />
            <p className="text-xl font-bold text-gray-500">No encontramos resultados para "{search}"</p>
            <p className="text-gray-600 text-sm mt-2">Intenta con otro nombre de canal</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
              {channels.map((channel, i) => {
                const isLast = i === channels.length - 1;
                const card = (
                  <Link 
                    key={`${channel.name}-${channel.provider}-${i}`}
                    href={`/watch?query=${encodeURIComponent(channel.name)}&url=${encodeURIComponent(channel.url)}&type=live`}
                    className="group relative bg-[#121216] border border-white/5 rounded-2xl overflow-hidden hover:border-yellow-500/50 transition-all hover:-translate-y-1"
                  >
                    <div className="aspect-video bg-black flex items-center justify-center p-4 relative">
                      <img 
                        src={channel.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.name)}&background=111&color=EAB308`} 
                        alt={channel.name}
                        className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.name)}&background=111&color=EAB308`; }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
                          <Play className="text-black ml-1" size={20} fill="currentColor" />
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-gradient-to-t from-black to-transparent">
                      <p className="font-bold text-[11px] truncate group-hover:text-yellow-500 transition-colors">{channel.name}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[8px] uppercase font-black text-gray-500 tracking-tighter truncate max-w-[60%]">{channel.category}</span>
                        <span className="text-[7px] px-1 py-0.5 rounded bg-white/5 text-white/30 border border-white/5 font-mono">{channel.provider}</span>
                      </div>
                    </div>
                  </Link>
                );

                return isLast ? (
                  <div key={`${channel.name}-${i}`} ref={lastChannelElementRef}>{card}</div>
                ) : (
                  <div key={`${channel.name}-${i}`}>{card}</div>
                );
              })}
            </div>
            {loadingMore && (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-yellow-500" size={32} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
