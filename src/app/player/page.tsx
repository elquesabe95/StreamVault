"use client";

import React, { useState, useEffect, useRef, useReducer, useCallback } from "react";
import {
  Play, SkipForward, SkipBack, Volume2, VolumeX,
  Maximize, Minimize, X, ChevronDown, Clock, Tv, Film,
  AlertCircle, Loader2, ExternalLink,
} from "lucide-react";

/* ──────────────────────────────────────────────
   STREAMVAULT EMBED PLAYER — Netflix Style
   Usage: /player?type=tv&id=37854&season=1&episode=1
          /player?type=movie&id=550

   Embed on your site:
   <iframe src="/player?type=tv&id=37854&season=1&episode=1"
           style="width:100%;aspect-ratio:16/9;border:none;" />
   ────────────────────────────────────────────── */

// ─── Types ──────────────────────────────────

interface EmbedSource {
  name: string;
  label: string;
  url: string;
}

interface EpisodeData {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still: string;
  rating: number;
  runtime: number;
}

interface SeasonInfo {
  season_number: number;
  name: string;
  episode_count: number;
}

interface PlayerData {
  type: "movie" | "tv";
  id: number;
  title: string;
  poster: string;
  backdrop: string;
  rating: number;
  genres: string[];
  season?: number;
  episode?: number;
  episodeTitle?: string;
  episodeOverview?: string;
  episodeRuntime?: number;
  episodes?: EpisodeData[];
  totalSeasons?: number;
  seasons?: SeasonInfo[];
  sources: EmbedSource[];
  nextEpisode: { season: number; episode: number; title: string } | null;
  isLastEpisode: boolean;
  hasNextSeason: boolean;
  showCompleted: boolean;
  runtime?: number;
  year?: string;
}

interface AdData {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  clickUrl?: string;
  duration: number;
}

// ─── Constants ──────────────────────────────

const AD_DURATION = 5;
const AD_SKIP_AFTER = 3;
const INTRO_SHOW_AT = 20;
const INTRO_HIDE_AT = 80;
const AUTO_NEXT_OFFSET = 30;
const AUTO_NEXT_COUNTDOWN = 15;
const CONTROLS_HIDE_DELAY = 3500;

const API_BASE = "/api/v1";

// ─── State Reducer ─────────────────────────

interface PlayerState {
  data: PlayerData | null;
  loading: boolean;
  error: string;
}

type PlayerAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: PlayerData }
  | { type: "FETCH_ERROR"; message: string }
  | { type: "NO_ID" };

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: "" };
    case "FETCH_SUCCESS":
      return { data: action.payload, loading: false, error: "" };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.message };
    case "NO_ID":
      return { ...state, loading: false, error: "ID requerido. Usa /player?type=movie&id=550" };
    default:
      return state;
  }
}

// ─── Main Player Component ──────────────────

export default function PlayerPage() {
  const [playerType] = useState<"movie" | "tv">(() => {
    if (typeof window === "undefined") return "movie";
    const p = new URLSearchParams(window.location.search);
    return (p.get("type") as "movie" | "tv") || "movie";
  });
  const [itemId] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const p = new URLSearchParams(window.location.search);
    return parseInt(p.get("id") || p.get("tmdbId") || "0");
  });
  const [currentSeason, setCurrentSeason] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const p = new URLSearchParams(window.location.search);
    return parseInt(p.get("season") || "1");
  });
  const [currentEpisode, setCurrentEpisode] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const p = new URLSearchParams(window.location.search);
    return parseInt(p.get("episode") || "1");
  });

  // Player state
  const [state, dispatch] = useReducer(playerReducer, { data: null, loading: true, error: "" });
  const data = state.data;
  const loading = state.loading;
  const error = state.error;

  const [activeSource, setActiveSource] = useState("");
  const [sources, setSources] = useState<EmbedSource[]>([]);
  const [iframeKey, setIframeKey] = useState(0);

  // Ad system
  const [adVisible, setAdVisible] = useState(true);
  const [adCountdown, setAdCountdown] = useState(AD_DURATION);
  const [adCanSkip, setAdCanSkip] = useState(false);
  const [adData, setAdData] = useState<AdData | null>(null);
  const adTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adStartedRef = useRef(false);

  // Controls
  const [controlsVisible, setControlsVisible] = useState(true);
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Skip intro
  const [skipIntroVisible, setSkipIntroVisible] = useState(false);
  const [introSkipped, setIntroSkipped] = useState(false);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto next
  const [autoNextVisible, setAutoNextVisible] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState(AUTO_NEXT_COUNTDOWN);
  const autoNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoNextCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Episode selector
  const [epSelectorOpen, setEpSelectorOpen] = useState(false);

  // Refs for latest values (to avoid stale closures)
  const latestDataRef = useRef<PlayerData | null>(null);
  const latestPlayerTypeRef = useRef<"movie" | "tv">(playerType);
  const latestItemIdRef = useRef<number>(itemId);
  const latestSeasonRef = useRef<number>(currentSeason);
  const latestEpisodeRef = useRef<number>(currentEpisode);

  useEffect(() => { latestPlayerTypeRef.current = playerType; }, [playerType]);
  useEffect(() => { latestItemIdRef.current = itemId; }, [itemId]);
  useEffect(() => { latestSeasonRef.current = currentSeason; }, [currentSeason]);
  useEffect(() => { latestEpisodeRef.current = currentEpisode; }, [currentEpisode]);
  useEffect(() => { latestDataRef.current = data; }, [data]);

  // ─── Load player data ─────────────────────

  const [loadTrigger, setLoadTrigger] = useState(0);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get("type") || "movie";
    const id = parseInt(urlParams.get("id") || "0");
    const season = parseInt(urlParams.get("season") || "1");
    const episode = parseInt(urlParams.get("episode") || "1");

    if (!id) {
      dispatch({ type: "NO_ID" });
      return;
    }

    dispatch({ type: "FETCH_START" });

    let cancelled = false;
    fetch(`${API_BASE}/player?type=${type}&id=${id}&season=${season}&episode=${episode}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) {
          dispatch({ type: "FETCH_ERROR", message: json.message || "Error cargando datos" });
          return;
        }
        const pd = json.data as PlayerData;
        dispatch({ type: "FETCH_SUCCESS", payload: pd });
        setSources(pd.sources);
        if (pd.sources.length > 0) setActiveSource(pd.sources[0].url);
      })
      .catch((err) => {
        if (cancelled) return;
        // Fallback: If player data fetch fails, we still want to show the UI if possible
        // or at least show a less disruptive error.
        dispatch({ type: "FETCH_ERROR", message: "Error cargando fuente principal. Prueba seleccionando otra fuente en el menu superior." });
        
        // Try to construct basic sources if we have the ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const type = (urlParams.get("type") || "movie") as "movie" | "tv";
        const id = parseInt(urlParams.get("id") || "0");
        if (id) {
          const fallbackSources = [
            { name: "vidsrc", label: "VidSrc (Alternativo)", url: type === "movie" ? `https://vidsrc.xyz/embed/movie/${id}` : `https://vidsrc.xyz/embed/tv/${id}/${urlParams.get("season") || 1}/${urlParams.get("episode") || 1}` },
            { name: "vidsrc-cc", label: "VidSrc CC", url: type === "movie" ? `https://vidsrc.cc/v2/embed/movie/${id}` : `https://vidsrc.cc/v2/embed/tv/${id}/${urlParams.get("season") || 1}/${urlParams.get("episode") || 1}` }
          ];
          setSources(fallbackSources);
          setActiveSource(fallbackSources[0].url);
        }
      });

    return () => { cancelled = true; };
  }, [loadTrigger]);

  // Load ad
  useEffect(() => {
    fetch(`${API_BASE}/ads`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.ad) setAdData(json.data.ad);
      })
      .catch(() => {});
  }, []);

  // ─── Timers: Clear all ───────────────────

  const clearAllTimers = useCallback(() => {
    if (adTimerRef.current) clearInterval(adTimerRef.current);
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
    if (introHideTimerRef.current) clearTimeout(introHideTimerRef.current);
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    if (autoNextCountdownRef.current) clearInterval(autoNextCountdownRef.current);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
  }, []);

  // ─── Dismiss ad & start content timers ───

  const dismissAdAndStart = useCallback(() => {
    setAdVisible(false);
    if (adTimerRef.current) clearInterval(adTimerRef.current);

    const pType = latestPlayerTypeRef.current;
    const d = latestDataRef.current;

    // Start intro timer for TV
    if (pType === "tv" && !introSkipped) {
      introTimerRef.current = setTimeout(() => {
        setSkipIntroVisible(true);
        introHideTimerRef.current = setTimeout(() => {
          setSkipIntroVisible(false);
        }, (INTRO_HIDE_AT - INTRO_SHOW_AT) * 1000);
      }, INTRO_SHOW_AT * 1000);
    }

    // Start auto-next timer for TV
    if (pType === "tv" && d?.nextEpisode) {
      const rt = d.episodeRuntime || 1320;
      const delay = Math.max((rt - AUTO_NEXT_OFFSET) * 1000, 60000);
      autoNextTimerRef.current = setTimeout(() => {
        setAutoNextVisible(true);
        setAutoNextCountdown(AUTO_NEXT_COUNTDOWN);
        autoNextCountdownRef.current = setInterval(() => {
          setAutoNextCountdown((prev) => {
            if (prev <= 1) {
              if (autoNextCountdownRef.current) clearInterval(autoNextCountdownRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, delay);
    }
  }, [introSkipped]);

  // ─── Ad countdown ────────────────────────

  useEffect(() => {
    if (!adVisible || adStartedRef.current) return;
    adStartedRef.current = true;

    adTimerRef.current = setInterval(() => {
      setAdCountdown((prev) => {
        if (prev <= 1) {
          if (adTimerRef.current) clearInterval(adTimerRef.current);
          // dismiss via ref callback
          setTimeout(() => dismissAdAndStart(), 0);
          return 0;
        }
        if (prev === AD_SKIP_AFTER + 1) setAdCanSkip(true);
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (adTimerRef.current) clearInterval(adTimerRef.current);
    };
  }, [adVisible, dismissAdAndStart]);

  // Manual skip ad
  const handleSkipAd = useCallback(() => {
    if (adCanSkip) dismissAdAndStart();
  }, [adCanSkip, dismissAdAndStart]);

  // ─── Auto-next countdown reaching 0 ──────

  const navigateToEpisode = useCallback((season: number, episode: number) => {
    // Clear all timers
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
    if (introHideTimerRef.current) clearTimeout(introHideTimerRef.current);
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    if (autoNextCountdownRef.current) clearInterval(autoNextCountdownRef.current);

    setAutoNextVisible(false);
    setSkipIntroVisible(false);
    setIntroSkipped(false);

    // Update URL (this changes what the load effect reads)
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("season", String(season));
    newUrl.searchParams.set("episode", String(episode));
    window.history.replaceState(null, "", newUrl.toString());

    setCurrentSeason(season);
    setCurrentEpisode(episode);
    setIframeKey((k) => k + 1);
    setEpSelectorOpen(false);

    // Trigger data reload
    setLoadTrigger((n) => n + 1);
  }, []);

  // When season/episode changes via navigateToEpisode, everything is handled there

  // Handle play next
  useEffect(() => {
    if (autoNextVisible && autoNextCountdown === 0 && latestDataRef.current?.nextEpisode) {
      const next = latestDataRef.current.nextEpisode;
      navigateToEpisode(next.season, next.episode);
    }
  }, [autoNextCountdown, autoNextVisible, navigateToEpisode]);

  const handlePlayNextManual = useCallback(() => {
    if (autoNextCountdownRef.current) clearInterval(autoNextCountdownRef.current);
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    setAutoNextVisible(false);

    const d = latestDataRef.current;
    if (!d?.nextEpisode) return;
    navigateToEpisode(d.nextEpisode.season, d.nextEpisode.episode);
  }, [navigateToEpisode]);

  // ─── Controls auto-hide ──────────────────

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, CONTROLS_HIDE_DELAY);
  }, []);

  useEffect(() => {
    const handleMouse = () => showControls();
    window.addEventListener("mousemove", handleMouse);
    window.addEventListener("touchstart", handleMouse);
    return () => {
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("touchstart", handleMouse);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [showControls]);

  // ─── Fullscreen ──────────────────────────

  const toggleFullscreen = useCallback(() => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // ─── Switch source ───────────────────────

  const switchSource = useCallback((url: string) => {
    setActiveSource(url);
    setSourceDropdownOpen(false);
    setIframeKey((k) => k + 1);
    setSkipIntroVisible(false);
  }, []);

  // ─── Cleanup on unmount ──────────────────

  useEffect(() => {
    return clearAllTimers;
  }, [clearAllTimers]);

  // ─── RENDER ──────────────────────────────

  return (
    <div
      ref={playerContainerRef}
      className="relative w-full h-screen bg-black overflow-hidden select-none"
      style={{ cursor: controlsVisible ? "default" : "none" }}
      onMouseMove={showControls}
      onTouchStart={showControls}
    >
      {/* ── LOADING ── */}
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
          <Loader2 className="w-12 h-12 text-[#E50914] animate-spin mb-4" />
          <p className="text-white/60 text-sm">Cargando reproductor...</p>
        </div>
      )}

      {/* ── ERROR ── */}
      {error && !loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
          <AlertCircle className="w-12 h-12 text-[#E50914] mb-4" />
          <p className="text-white/80 text-sm mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#E50914] text-white rounded text-sm font-semibold hover:bg-[#b20710] transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── IFRAME PLAYER ── */}
      {!loading && activeSource && (
        <iframe
          key={iframeKey}
          src={activeSource}
          className="absolute inset-0 w-full h-full"
          allowFullScreen
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          style={{ border: "none" }}
          title={`${data?.title || "Player"} - StreamVault`}
        />
      )}

      {/* ── PRE-ROLL AD OVERLAY ── */}
      {adVisible && !loading && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #000 0%, #1a0000 50%, #000 100%)" }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 50% 50%, #E50914 0%, transparent 60%)" }}
          />
          <div className="relative z-10 text-center max-w-md px-6">
            {/* Logo */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-lg bg-[#E50914] flex items-center justify-center">
                <Play className="w-5 h-5 text-white fill-white" />
              </div>
              <span className="text-white font-bold text-xl tracking-tight">STREAMVAULT</span>
            </div>

            {/* Ad content */}
            {adData && (
              <div className="mb-8">
                <div className="inline-block px-3 py-1 bg-[#E50914]/20 border border-[#E50914]/40 rounded-full mb-3">
                  <span className="text-[#E50914] text-xs font-semibold uppercase tracking-wider">
                    Publicidad
                  </span>
                </div>
                <h3 className="text-white text-lg font-bold mb-2">{adData.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{adData.description}</p>
                {adData.clickUrl && (
                  <a
                    href={adData.clickUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#E50914] text-xs mt-2 hover:underline"
                  >
                    Mas info <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {/* Skip / countdown */}
            {adCanSkip ? (
              <button
                onClick={handleSkipAd}
                className="px-6 py-3 bg-white text-black rounded font-bold text-sm hover:bg-white/90 transition-all hover:scale-105 active:scale-95"
              >
                Omitir anuncio ▶
              </button>
            ) : (
              <div>
                <p className="text-white/40 text-xs mb-2">El video comenzara en {adCountdown}s...</p>
                <div className="w-48 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
                  <div
                    className="h-full bg-[#E50914] rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${((AD_DURATION - adCountdown) / AD_DURATION) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SKIP INTRO ── */}
      {skipIntroVisible && !adVisible && (
        <div
          className="absolute bottom-24 right-4 z-30"
          style={{ animation: "svSlideRight 0.4s cubic-bezier(0.16,1,0.3,1)" }}
        >
          <button
            onClick={() => {
              setSkipIntroVisible(false);
              setIntroSkipped(true);
              if (introTimerRef.current) clearTimeout(introTimerRef.current);
              if (introHideTimerRef.current) clearTimeout(introHideTimerRef.current);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#E50914] text-white rounded font-bold text-sm hover:bg-[#b20710] transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#E50914]/30"
          >
            <SkipForward className="w-4 h-4" />
            Saltar Intro
          </button>
        </div>
      )}

      {/* ── AUTO-NEXT BANNER ── */}
      {autoNextVisible && !adVisible && (
        <div
          className="absolute bottom-0 left-0 right-0 z-30 p-4"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 60%, transparent 100%)",
            animation: "svSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {data?.showCompleted ? (
            <div className="flex items-center justify-between max-w-3xl mx-auto">
              <div>
                <p className="text-white font-bold text-lg mb-1">Has completado {data.title}</p>
                <p className="text-white/50 text-sm">Gracias por ver en StreamVault</p>
              </div>
              <button
                onClick={() => {
                  setAutoNextVisible(false);
                  if (autoNextCountdownRef.current) clearInterval(autoNextCountdownRef.current);
                }}
                className="px-4 py-2 bg-white/10 text-white rounded text-sm font-semibold hover:bg-white/20 transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between max-w-3xl mx-auto gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white/50 text-xs uppercase tracking-wider mb-1">
                  {data?.isLastEpisode ? "Siguiente temporada" : "Siguiente episodio"}
                </p>
                {data?.nextEpisode && (
                  <p className="text-white font-bold text-sm truncate">
                    T{data.nextEpisode.season}:E{data.nextEpisode.episode} — {data.nextEpisode.title}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Circular countdown */}
                <div className="relative w-10 h-10">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                    <circle
                      cx="20" cy="20" r="18" fill="none" stroke="#E50914" strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 18}`}
                      strokeDashoffset={`${2 * Math.PI * 18 * (1 - autoNextCountdown / AUTO_NEXT_COUNTDOWN)}`}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold">
                    {autoNextCountdown}
                  </span>
                </div>

                <button
                  onClick={handlePlayNextManual}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded font-bold text-sm hover:bg-white/90 transition-all hover:scale-105 active:scale-95"
                >
                  <Play className="w-4 h-4 fill-black" />
                  Reproducir
                </button>

                <button
                  onClick={() => {
                    setAutoNextVisible(false);
                    if (autoNextCountdownRef.current) clearInterval(autoNextCountdownRef.current);
                    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
                  }}
                  className="px-3 py-2.5 bg-white/10 text-white rounded text-sm font-semibold hover:bg-white/20 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CONTROLS OVERLAY ── */}
      {controlsVisible && !adVisible && !loading && (
        <>
          {/* Top bar */}
          <div
            className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)" }}
          >
            <div className="flex items-center gap-3">
              <a
                href={typeof window !== "undefined" ? document.referrer || "#" : "#"}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                title="Volver"
              >
                <X className="w-4 h-4 text-white" />
              </a>
              <div className="flex items-center gap-2">
                {data?.type === "tv" ? (
                  <Tv className="w-4 h-4 text-[#E50914]" />
                ) : (
                  <Film className="w-4 h-4 text-[#E50914]" />
                )}
                <span className="text-white text-sm font-semibold truncate max-w-[200px] sm:max-w-[400px]">
                  {data?.title}
                </span>
                {data?.type === "tv" && (
                  <span className="text-white/50 text-sm hidden sm:inline">
                    T{currentSeason}:E{currentEpisode}
                    {data?.episodeTitle ? ` — ${data.episodeTitle}` : ""}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Source selector */}
              {sources.length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => setSourceDropdownOpen(!sourceDropdownOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded text-white text-xs font-medium hover:bg-white/20 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Fuente
                    <ChevronDown className={`w-3 h-3 transition-transform ${sourceDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {sourceDropdownOpen && (
                    <div
                      className="absolute right-0 top-full mt-2 w-52 rounded-lg overflow-hidden shadow-2xl z-50 border border-white/10"
                      style={{ background: "#181818" }}
                    >
                      <div className="p-2 text-xs text-white/40 font-semibold uppercase tracking-wider">
                        Servidores
                      </div>
                      {sources.map((s, i) => (
                        <button
                          key={s.name}
                          onClick={() => switchSource(s.url)}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-white/10 transition-colors ${
                            activeSource === s.url ? "text-[#E50914] bg-white/5" : "text-white"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              activeSource === s.url ? "bg-[#E50914]" : "bg-white/30"
                            }`}
                          />
                          <span className="font-medium">{s.label}</span>
                          {i === 0 && (
                            <span className="ml-auto text-[9px] bg-[#E50914]/20 text-[#E50914] px-1.5 py-0.5 rounded font-semibold">
                              REC
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={toggleFullscreen}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4 text-white" />
                ) : (
                  <Maximize className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-3 pt-8"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }}
          >
            {data?.type === "tv" && (
              <div className="mb-3 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">
                    T{currentSeason}:E{currentEpisode} — {data?.episodeTitle || `Episodio ${currentEpisode}`}
                  </p>
                  {data?.episodeOverview && (
                    <p className="text-white/50 text-xs truncate mt-0.5">{data.episodeOverview}</p>
                  )}
                </div>
                <button
                  onClick={() => setEpSelectorOpen(!epSelectorOpen)}
                  className="px-3 py-1.5 bg-white/10 rounded text-white text-xs font-medium hover:bg-white/20 transition-colors shrink-0"
                >
                  Episodios
                </button>
              </div>
            )}

            <div className="flex items-center gap-3">
              {data?.type === "tv" && (
                <button
                  onClick={() => currentEpisode > 1 && navigateToEpisode(currentSeason, currentEpisode - 1)}
                  disabled={currentEpisode <= 1}
                  className="p-1.5 text-white/60 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
              )}

              <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden group cursor-pointer">
                <div className="h-full bg-[#E50914] rounded-full" style={{ width: "0%" }} />
              </div>

              {data?.type === "tv" && (
                <button
                  onClick={handlePlayNextManual}
                  disabled={!data?.nextEpisode}
                  className="p-1.5 text-white/60 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              )}

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 text-white/60 hover:text-white transition-colors"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              <div className="text-white/50 text-xs font-mono flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {data?.type === "movie"
                  ? `${data?.runtime || 0} min`
                  : `${data?.episodeRuntime || 0} min`}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── EPISODE SELECTOR ── */}
      {epSelectorOpen && !adVisible && (
        <div className="absolute inset-0 z-25 flex">
          <div className="absolute inset-0 bg-black/80" onClick={() => setEpSelectorOpen(false)} />
          <div
            className="relative ml-auto w-full max-w-sm bg-[#181818] h-full overflow-y-auto sv-scrollbar"
            style={{ animation: "svSlideRight 0.3s ease" }}
          >
            <div className="sticky top-0 bg-[#181818] border-b border-white/10 px-4 py-3 flex items-center justify-between z-10">
              <h3 className="text-white font-bold text-sm">Episodios — {data?.title}</h3>
              <button onClick={() => setEpSelectorOpen(false)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {data?.seasons && data.seasons.length > 1 && (
              <div className="flex gap-1 px-4 py-2 overflow-x-auto no-scrollbar border-b border-white/5">
                {data.seasons.map((s) => (
                  <button
                    key={s.season_number}
                    onClick={() => navigateToEpisode(s.season_number, 1)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                      s.season_number === currentSeason
                        ? "bg-white text-black"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    T{s.season_number}
                  </button>
                ))}
              </div>
            )}

            <div className="p-2 space-y-1">
              {(data?.episodes || []).map((ep) => (
                <button
                  key={ep.episode_number}
                  onClick={() => navigateToEpisode(currentSeason, ep.episode_number)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    ep.episode_number === currentEpisode ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded flex items-center justify-center shrink-0 text-sm font-bold ${
                      ep.episode_number === currentEpisode
                        ? "bg-[#E50914] text-white"
                        : "bg-white/10 text-white/50"
                    }`}
                  >
                    {ep.episode_number === currentEpisode ? (
                      <Play className="w-3.5 h-3.5 fill-white" />
                    ) : (
                      ep.episode_number
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        ep.episode_number === currentEpisode ? "text-[#E50914]" : "text-white"
                      }`}
                    >
                      {ep.name}
                    </p>
                    <p className="text-[11px] text-white/40 truncate mt-0.5">{ep.overview}</p>
                  </div>
                  {ep.runtime > 0 && (
                    <span className="text-[10px] text-white/30 font-mono shrink-0">{ep.runtime}m</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── GLOBAL ANIMATIONS ── */}
      <style>{`
        @keyframes svSlideRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes svSlideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
