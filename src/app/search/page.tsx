"use client";

import { useState, useEffect } from "react";
import { Search, Play, Film, Loader2, Tv, MonitorPlay, Ghost } from "lucide-react";

interface MediaResult {
  title: string;
  url: string;
  poster?: string;
  provider: string;
  type: "movie" | "series" | "anime";
  id?: number;
}

interface Channel {
  name: string;
  url: string;
  logo: string;
  category: string;
  provider: string;
  headers?: Record<string, string>;
}

export default function SearchPage() {
  const [activeTab, setActiveTab] = useState<"movies" | "series" | "tv" | "anime">("movies");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaResult[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === "tv" && channels.length === 0) {
      fetchChannels();
    } else if (activeTab !== "tv" && query === "") {
      fetchTrending();
    }
  }, [activeTab]);

  const fetchTrending = async () => {
    setLoading(true);
    try {
      const type = activeTab === "movies" ? "movie" : "tv";
      // This endpoint doesn't exist yet, but we'll use TMDB directly or a new api route
      const res = await fetch(`/api/v1/search?query=a&type=${type}`); // fallback search just to show something
      const data = await res.json();
      
      setResults(data.results?.map((r: any) => ({
        title: r.title || r.name,
        url: "",
        poster: r.poster,
        provider: "TMDB",
        type: activeTab === "anime" ? "anime" : (activeTab === "series" || r.media_type === "tv") ? "series" : "movie",
        id: r.id
      })) || []);
    } catch (error) {
      console.error("Failed to fetch trending:", error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (selectedMedia && (selectedMedia.type === "series" || selectedMedia.type === "anime")) {
        fetchSeasons(selectedMedia.id);
    }
  }, [selectedMedia]);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/tv/all");
      const data = await res.json();
      setChannels(data.results || []);
    } catch (e) {
      console.error("Failed to fetch channels:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSeasons = async (id: number) => {
    setLoading(true);
    try {
        const res = await fetch(`/api/v1/tv/${id}?season=1`);
        const data = await res.json();
        setSeasons(data.data.seasons || []);
        if (data.data.seasons?.length > 0) {
            setSelectedSeason(data.data.seasons[0].season_number);
            setEpisodes(data.data.episodes || []);
        }
    } catch (e) {
        console.error("Failed to fetch seasons:", e);
    } finally {
        setLoading(false);
    }
  };

  const handleSeasonChange = async (tvId: number, seasonNum: number) => {
    setSelectedSeason(seasonNum);
    setLoading(true);
    try {
        const res = await fetch(`/api/v1/tv/${tvId}?season=${seasonNum}`);
        const data = await res.json();
        setEpisodes(data.data.episodes || []);
    } catch (e) {
        console.error("Failed to fetch episodes:", e);
    } finally {
        setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    try {
      let endpoint = `/api/v1/search?query=${encodeURIComponent(query)}`;
      if (activeTab === "movies") endpoint += "&type=movie";
      else if (activeTab === "series") endpoint += "&type=tv";
      else if (activeTab === "anime") endpoint += "&type=tv";
      
      const res = await fetch(endpoint);
      const data = await res.json();
      
      setResults(data.results.map((r: any) => ({
        title: r.title || r.name,
        url: "",
        poster: r.poster,
        provider: "TMDB",
        type: activeTab === "anime" ? "anime" : (activeTab === "series" || r.media_type === "tv") ? "series" : "movie",
        id: r.id
      })) || []);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-6 md:p-12 font-sans">
      {/* Selection Overlay for Series/Anime */}
      {selectedMedia && (selectedMedia.type === "series" || selectedMedia.type === "anime") && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
              <div className="bg-[#16161e] w-full max-w-5xl rounded-3xl overflow-hidden border border-gray-800 shadow-2xl flex flex-col md:flex-row max-h-[90vh]">
                  <div className="w-full md:w-1/3 aspect-[2/3] relative">
                      <img src={selectedMedia.poster} className="w-full h-full object-cover" alt="" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#16161e] to-transparent"></div>
                      <div className="absolute bottom-6 left-6 right-6">
                        <h2 className="text-3xl font-black text-white mb-2">{selectedMedia.title}</h2>
                        <button 
                            onClick={() => setSelectedMedia(null)}
                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl backdrop-blur-md transition-all text-sm font-bold"
                        >
                            Cerrar
                        </button>
                      </div>
                  </div>
                  <div className="w-full md:w-2/3 p-8 overflow-y-auto">
                      <div className="flex items-center justify-between mb-8">
                          <h3 className="text-xl font-bold text-yellow-500">Temporadas</h3>
                          <select 
                            value={selectedSeason}
                            onChange={(e) => handleSeasonChange(selectedMedia.id, parseInt(e.target.value))}
                            className="bg-gray-800 text-white px-4 py-2 rounded-xl border border-gray-700 outline-none"
                          >
                              {seasons.map(s => (
                                  <option key={s.id} value={s.season_number}>{s.name}</option>
                              ))}
                          </select>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                          {loading && <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-yellow-500" /></div>}
                          {!loading && episodes.map(ep => (
                                <div 
                                  key={ep.id}
                                  onClick={() => window.location.href = `/watch?query=${encodeURIComponent(selectedMedia.title)}&type=${selectedMedia.type}&id=${selectedMedia.id}&season=${selectedSeason}&episode=${ep.episode_number}`}
                                  className="flex items-center gap-4 p-4 bg-black/30 rounded-2xl border border-gray-800 hover:border-yellow-500 cursor-pointer transition-all group"
                                >
                                  <div className="w-32 aspect-video bg-gray-900 rounded-lg overflow-hidden flex-shrink-0">
                                      <img src={ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : selectedMedia.poster} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                  </div>
                                  <div className="flex-grow">
                                      <h4 className="font-bold group-hover:text-yellow-500">{ep.episode_number}. {ep.name}</h4>
                                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">{ep.overview}</p>
                                  </div>
                                  <Play size={20} className="text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Header */}
      <div className="max-w-5xl mx-auto text-center mb-12">

        <h1 className="text-6xl font-black mb-4 bg-gradient-to-r from-yellow-500 via-yellow-400 to-orange-500 bg-clip-text text-transparent italic tracking-tighter">
          STREAMVAULT
        </h1>
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-12 bg-[#16161e] p-2 rounded-3xl w-fit mx-auto border border-gray-800/50 backdrop-blur-xl shadow-2xl">
          <button 
            onClick={() => setActiveTab("movies")}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all duration-300 ${activeTab === "movies" ? "bg-yellow-500 text-black shadow-[0_0_30px_rgba(234,179,8,0.3)] scale-105" : "text-gray-400 hover:text-white hover:bg-gray-800/50"}`}
          >
            <Film size={20} /> Películas
          </button>
          <button 
            onClick={() => setActiveTab("series")}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all duration-300 ${activeTab === "series" ? "bg-yellow-500 text-black shadow-[0_0_30px_rgba(234,179,8,0.3)] scale-105" : "text-gray-400 hover:text-white hover:bg-gray-800/50"}`}
          >
            <MonitorPlay size={20} /> Series
          </button>
          <button 
            onClick={() => setActiveTab("anime")}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all duration-300 ${activeTab === "anime" ? "bg-yellow-500 text-black shadow-[0_0_30px_rgba(234,179,8,0.3)] scale-105" : "text-gray-400 hover:text-white hover:bg-gray-800/50"}`}
          >
            <Ghost size={20} /> Anime
          </button>
          <button 
            onClick={() => setActiveTab("tv")}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all duration-300 ${activeTab === "tv" ? "bg-yellow-500 text-black shadow-[0_0_30px_rgba(234,179,8,0.3)] scale-105" : "text-gray-400 hover:text-white hover:bg-gray-800/50"}`}
          >
            <Tv size={20} /> TV en Vivo
          </button>
        </div>

        <form onSubmit={handleSearch} className="relative group max-w-2xl mx-auto">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar ${activeTab === "movies" ? "películas" : activeTab === "series" ? "series" : activeTab === "anime" ? "animes" : "canales de TV"}...`}
            className="w-full bg-[#16161e] border-2 border-gray-800/50 rounded-3xl py-5 px-8 pl-16 text-xl focus:outline-none focus:border-yellow-500 transition-all duration-500 shadow-2xl placeholder:text-gray-600"
          />
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-yellow-500 transition-colors" size={28} />
          {activeTab !== "tv" && (
            <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-2.5 rounded-2xl font-black transition-all active:scale-95 shadow-lg">
              {loading ? <Loader2 className="animate-spin" /> : "BUSCAR"}
            </button>
          )}
        </form>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto">
        {loading && activeTab === "tv" && (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-yellow-500 mb-4" size={48} />
                <p className="text-gray-500 font-bold animate-pulse">Sincronizando canales premium...</p>
            </div>
        )}

        {activeTab === "tv" ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {channels.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).map((channel, i) => (
              <div 
                key={i}
                onClick={() => {
                  const params = new URLSearchParams({
                    query: channel.name,
                    url: channel.url,
                  });
                  if (channel.headers) {
                    params.set("headers", JSON.stringify(channel.headers));
                  }
                  window.location.href = `/watch?${params.toString()}`;
                }}
                className="bg-[#16161e] rounded-3xl p-5 border border-gray-800 hover:border-yellow-500/50 cursor-pointer transition-all duration-300 group hover:-translate-y-2 shadow-xl"
              >
                <div className="aspect-square bg-black/50 rounded-2xl mb-4 p-4 flex items-center justify-center overflow-hidden relative border border-gray-800/50">
                  <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute top-2 right-2 bg-yellow-500 text-[8px] font-black px-1.5 py-0.5 rounded text-black">LIVE</div>
                </div>
                <h3 className="font-bold text-center group-hover:text-yellow-500 line-clamp-1">{channel.name}</h3>
                <div className="flex items-center justify-center gap-2 mt-2">
                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-tighter">{channel.category}</span>
                    <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                    <span className="text-[10px] text-yellow-500/70 font-black tracking-tighter">{channel.provider}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
            {results.map((item, index) => (
              <div 
                key={index} 
                className="group relative bg-[#16161e] rounded-3xl overflow-hidden hover:scale-105 transition-all duration-500 cursor-pointer border border-gray-800/50 hover:border-yellow-500 shadow-2xl"
                onClick={() => {
                  if (item.type === "series" || activeTab === "anime") {
                    setSelectedMedia({...item, type: item.type});
                  } else {
                    window.location.href = `/watch?query=${encodeURIComponent(item.title)}&id=${item.id}&type=movie`;
                  }
                }}
              >
                <div className="aspect-[2/3] w-full overflow-hidden relative">
                  {item.poster ? (
                    <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:opacity-40 transition-opacity duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gray-900 flex items-center justify-center"><Film size={48} className="text-gray-700" /></div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <div className="bg-yellow-500 p-5 rounded-full shadow-[0_0_50px_rgba(234,179,8,0.5)] transform scale-50 group-hover:scale-100 transition-transform duration-500">
                        <Play size={32} fill="black" />
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md text-[10px] px-3 py-1 rounded-full uppercase font-black text-yellow-400 border border-yellow-500/30 shadow-xl">
                    {item.provider}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-sm lg:text-base line-clamp-2 group-hover:text-yellow-400 transition-colors">{item.title}</h3>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
