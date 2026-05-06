"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Play,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Bell,
  User,
  Menu,
  Star,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipForward,
  SkipBack,
  ThumbsUp,
  Clock,
  Film,
  Tv,
  Heart,
  Info,
  ArrowLeft,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════ */

interface MediaItem {
  id: number;
  title: string;
  overview: string;
  poster: string;
  backdrop: string;
  release_date: string;
  rating: number;
  media_type: "movie" | "tv";
  popularity: number;
}

interface EmbedSource {
  name: string;
  label: string;
  url: string;
}

interface Genre {
  id: number;
  name: string;
}

interface SeasonInfo {
  season_number: number;
  name: string;
  episode_count: number;
}

interface EpisodeInfo {
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still: string;
  rating: number;
  runtime: number;
}

interface SimilarItem {
  id: number;
  title: string;
  poster: string;
  rating: number;
  media_type: "movie" | "tv";
}

interface MovieDetail {
  id: number;
  title: string;
  overview: string;
  poster: string;
  backdrop: string;
  release_date: string;
  runtime: number;
  rating: number;
  genres: Genre[];
  trailer_key: string | null;
  embeds: EmbedSource[];
  similar: SimilarItem[];
}

interface TvDetail {
  id: number;
  title: string;
  overview: string;
  poster: string;
  backdrop: string;
  first_air_date: string;
  number_of_seasons: number;
  number_of_episodes: number;
  rating: number;
  genres: Genre[];
  seasons: SeasonInfo[];
  episodes: EpisodeInfo[];
  current_season: number;
  trailer_key: string | null;
  embeds: EmbedSource[];
  similar: SimilarItem[];
}

interface ContinueWatchingItem {
  id: number;
  type: "movie" | "tv";
  title: string;
  poster: string;
  backdrop: string;
  season?: number;
  episode?: number;
  timestamp: number;
  runtime?: number;
}

interface PlayerState {
  show: boolean;
  itemId: number;
  itemType: "movie" | "tv";
  title: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  embedUrl: string;
  sources: EmbedSource[];
  runtime?: number;
  episodes?: EpisodeInfo[];
  seasons?: SeasonInfo[];
  totalSeasons?: number;
  nextEpisodeInfo?: { season: number; episode: number; title: string };
}

/* ════════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
   ════════════════════════════════════════════════════════════════ */

const API_BASE = "/api/v1";
const CONTINUE_KEY = "sv_continue_watching";
const MYLIST_KEY = "sv_my_list";
const MAX_CONTINUE = 20;
const AD_DURATION = 5;
const AD_SKIP_AFTER = 3;
const INTRO_SHOW_AT = 20;
const INTRO_HIDE_AT = 80;
const AUTO_NEXT_OFFSET = 30;
const AUTO_NEXT_COUNTDOWN = 15;

async function apiFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || "API Error");
  return data;
}

function loadContinueWatching(): ContinueWatchingItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CONTINUE_KEY);
    if (!raw) return [];
    const items: ContinueWatchingItem[] = JSON.parse(raw);
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return items
      .filter((i) => now - i.timestamp < thirtyDays)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_CONTINUE);
  } catch {
    return [];
  }
}

function saveContinueWatching(item: ContinueWatchingItem): void {
  try {
    const items = loadContinueWatching();
    const filtered = items.filter(
      (i) => !(i.id === item.id && i.type === item.type)
    );
    filtered.unshift(item);
    localStorage.setItem(
      CONTINUE_KEY,
      JSON.stringify(filtered.slice(0, MAX_CONTINUE))
    );
  } catch {
    /* noop */
  }
}

function removeFromContinue(id: number, type: string): void {
  try {
    const items = loadContinueWatching();
    const filtered = items.filter((i) => !(i.id === id && i.type === type));
    localStorage.setItem(CONTINUE_KEY, JSON.stringify(filtered));
  } catch {
    /* noop */
  }
}

function loadMyList(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MYLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function toggleMyList(id: number): boolean {
  const list = loadMyList();
  const idx = list.indexOf(id);
  if (idx >= 0) {
    list.splice(idx, 1);
    localStorage.setItem(MYLIST_KEY, JSON.stringify(list));
    return false;
  }
  list.unshift(id);
  localStorage.setItem(MYLIST_KEY, JSON.stringify(list));
  return true;
}

function isInMyList(id: number): boolean {
  return loadMyList().includes(id);
}

function formatRuntime(minutes: number): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getYear(dateStr: string): string {
  return dateStr ? dateStr.substring(0, 4) : "";
}

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function Home() {
  /* ── Scroll state ── */
  const [scrolled, setScrolled] = useState(false);

  /* ── Search ── */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  /* ── Mobile menu ── */
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* ── Hero banner ── */
  const [heroItems, setHeroItems] = useState<MediaItem[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);

  /* ── Content rows ── */
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [trendingAll, setTrendingAll] = useState<MediaItem[]>([]);
  const [trendingTv, setTrendingTv] = useState<MediaItem[]>([]);
  const [anime, setAnime] = useState<MediaItem[]>([]);
  const [actionMovies, setActionMovies] = useState<MediaItem[]>([]);
  const [topRated, setTopRated] = useState<MediaItem[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);

  /* ── Detail modal ── */
  const [detailItem, setDetailItem] = useState<MovieDetail | TvDetail | null>(null);
  const [detailType, setDetailType] = useState<"movie" | "tv">("movie");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSeason, setDetailSeason] = useState(1);
  const [detailEpisodes, setDetailEpisodes] = useState<EpisodeInfo[]>([]);
  const [detailEpisodesLoading, setDetailEpisodesLoading] = useState(false);

  /* ── Player ── */
  const [player, setPlayer] = useState<PlayerState>({
    show: false,
    itemId: 0,
    itemType: "movie",
    title: "",
    embedUrl: "",
    sources: [],
  });
  const [adVisible, setAdVisible] = useState(false);
  const [adCountdown, setAdCountdown] = useState(AD_DURATION);
  const [adCanSkip, setAdCanSkip] = useState(false);
  const [skipIntroVisible, setSkipIntroVisible] = useState(false);
  const [autoNextVisible, setAutoNextVisible] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState(AUTO_NEXT_COUNTDOWN);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoNextCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeKeyRef = useRef<number>(0);

  /* ── MyList refresh ── */
  const [myListRefresh, setMyListRefresh] = useState(0);

  /* ═══ SCROLL LISTENER ═══ */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ═══ LOAD HERO + ROWS ═══ */
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const trendingData = await apiFetch<{ results: MediaItem[] }>(
          "/trending?type=all&window=week"
        );
        if (cancelled) return;
        const items = trendingData.results.filter(
          (r) => r.backdrop && !r.backdrop.includes("placeholder")
        );
        setHeroItems(items.slice(0, 5));
        setTrendingAll(trendingData.results.slice(0, 20));
      } catch {
        /* noop */
      }

      const promises: Promise<void>[] = [
        apiFetch<{ results: MediaItem[] }>("/trending?type=tv&window=week")
          .then((d) => { if (!cancelled) setTrendingTv(d.results.slice(0, 20)); })
          .catch(() => {}),
        apiFetch<{ results: MediaItem[] }>("/discover?type=tv&genre=16")
          .then((d) => { if (!cancelled) setAnime(d.results.slice(0, 20)); })
          .catch(() => {}),
        apiFetch<{ results: MediaItem[] }>("/discover?type=movie&genre=28")
          .then((d) => { if (!cancelled) setActionMovies(d.results.slice(0, 20)); })
          .catch(() => {}),
        apiFetch<{ results: MediaItem[] }>("/discover?sort=vote_average.desc")
          .then((d) => { if (!cancelled) setTopRated(d.results.slice(0, 20)); })
          .catch(() => {}),
      ];

      await Promise.allSettled(promises);
      if (!cancelled) setRowsLoading(false);
    }

    loadData();
    setContinueWatching(loadContinueWatching());
    return () => { cancelled = true; };
  }, []);

  /* ═══ HERO AUTO-CYCLE ═══ */
  useEffect(() => {
    if (heroItems.length < 2) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroItems.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [heroItems.length]);

  /* ═══ SEARCH DEBOUNCE ═══ */
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch<{ results: MediaItem[] }>(
          `/search?query=${encodeURIComponent(searchQuery)}&type=multi`
        );
        setSearchResults(data.results.slice(0, 12));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  /* Close search on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        searchOpen &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [searchOpen]);

  /* ═══ PLAYER CONTROLS VISIBILITY ═══ */
  useEffect(() => {
    if (!player.show) return;
    function handleMouseMove() {
      setControlsVisible(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }
    window.addEventListener("mousemove", handleMouseMove);
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [player.show]);

  /* ═══ CLEANUP ALL TIMERS ═══ */
  useEffect(() => {
    return () => {
      if (adTimerRef.current) clearInterval(adTimerRef.current);
      if (introTimerRef.current) clearTimeout(introTimerRef.current);
      if (introHideTimerRef.current) clearTimeout(introHideTimerRef.current);
      if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
      if (autoNextCountdownRef.current) clearInterval(autoNextCountdownRef.current);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  /* ═══ LOCK BODY SCROLL ═══ */
  useEffect(() => {
    if (player.show || detailItem) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [player.show, detailItem]);

  /* ═══ HANDLERS ═══ */

  const openDetail = useCallback(async (id: number, type: "movie" | "tv", season?: number, episode?: number) => {
    setDetailLoading(true);
    setDetailItem(null);
    setDetailType(type);
    setMobileMenuOpen(false);

    try {
      const endpoint = type === "movie" ? `/movie/${id}` : `/tv/${id}?season=${season || 1}`;
      const data = await apiFetch<{ data: MovieDetail | TvDetail }>(endpoint);
      setDetailItem(data.data);
      if (type === "tv") {
        const tvData = data.data as TvDetail;
        setDetailSeason(tvData.current_season || 1);
        setDetailEpisodes(tvData.episodes || []);
      }
    } catch {
      /* noop */
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadSeason = useCallback(async (tvId: number, season: number) => {
    setDetailEpisodesLoading(true);
    setDetailSeason(season);
    try {
      const data = await apiFetch<{ data: TvDetail }>(`/tv/${tvId}?season=${season}`);
      setDetailEpisodes(data.data.episodes || []);
      if (detailItem) {
        setDetailItem({ ...detailItem, episodes: data.data.episodes || [] } as TvDetail);
      }
    } catch {
      setDetailEpisodes([]);
    } finally {
      setDetailEpisodesLoading(false);
    }
  }, [detailItem]);

  const openPlayer = useCallback(async (
    id: number,
    type: "movie" | "tv",
    title: string,
    season?: number,
    episode?: number,
    runtime?: number,
    episodes?: EpisodeInfo[],
    seasons?: SeasonInfo[],
    totalSeasons?: number,
    backdrop?: string,
    poster?: string,
    overview?: string,
  ) => {
    /* Save to continue watching */
    const cwItem: ContinueWatchingItem = {
      id,
      type,
      title,
      poster: poster || "",
      backdrop: backdrop || "",
      season: season ? Number(season) : undefined,
      episode: episode ? Number(episode) : undefined,
      timestamp: Date.now(),
      runtime,
    };
    saveContinueWatching(cwItem);
    setContinueWatching(loadContinueWatching());

    /* Determine next episode */
    let nextEp: PlayerState["nextEpisodeInfo"] = undefined;
    if (type === "tv" && episodes && season) {
      const epNum = episode || 1;
      const next = episodes.find((e) => e.episode_number === epNum + 1);
      if (next) {
        nextEp = { season: season, episode: next.episode_number, title: next.name };
      } else if (seasons && totalSeasons) {
        const nextSeason = seasons.find((s) => s.season_number === season + 1);
        if (nextSeason) {
          nextEp = { season: season + 1, episode: 1, title: "Siguiente temporada..." };
        }
      }
    }

    /* Get embed sources */
    let sources: EmbedSource[] = [];
    let embedUrl = "";
    try {
      if (type === "movie") {
        const data = await apiFetch<{ data: { sources: EmbedSource[] } }>(`/embed/movie/${id}`);
        sources = data.data.sources;
      } else {
        const s = season || 1;
        const e = episode || 1;
        const data = await apiFetch<{ data: { sources: EmbedSource[] } }>(
          `/embed/tv/${id}/${s}/${e}`
        );
        sources = data.data.sources;
      }
      if (sources.length > 0) embedUrl = sources[0].url;
    } catch {
      /* noop */
    }

    /* Episode title */
    let epTitle = "";
    if (type === "tv" && episodes) {
      const ep = episodes.find((e) => e.episode_number === (episode || 1));
      epTitle = ep ? ep.name : "";
    }

    setPlayer({
      show: true,
      itemId: id,
      itemType: type,
      title,
      season: season ? Number(season) : undefined,
      episode: episode ? Number(episode) : undefined,
      episodeTitle: epTitle,
      embedUrl,
      sources,
      runtime,
      episodes,
      seasons,
      totalSeasons,
      nextEpisodeInfo: nextEp,
    });
    setAdVisible(true);
    setAdCountdown(AD_DURATION);
    setAdCanSkip(false);
    setSkipIntroVisible(false);
    setAutoNextVisible(false);
    setAutoNextCountdown(AUTO_NEXT_COUNTDOWN);
    setSourceDropdownOpen(false);
    iframeKeyRef.current += 1;
  }, []);

  const dismissAd = useCallback(() => {
    setAdVisible(false);
    if (adTimerRef.current) clearInterval(adTimerRef.current);
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
    if (introHideTimerRef.current) clearTimeout(introHideTimerRef.current);

    /* Start intro skip timer for TV */
    if (player.itemType === "tv") {
      introTimerRef.current = setTimeout(() => {
        setSkipIntroVisible(true);
        introHideTimerRef.current = setTimeout(() => {
          setSkipIntroVisible(false);
        }, (INTRO_HIDE_AT - INTRO_SHOW_AT) * 1000);
      }, INTRO_SHOW_AT * 1000);
    }

    /* Start auto-next timer for TV */
    if (player.itemType === "tv" && player.nextEpisodeInfo) {
      const rt = player.runtime || 1320;
      const delay = (rt - AUTO_NEXT_OFFSET) * 1000;
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
  }, [player]);

  /* Ad countdown */
  useEffect(() => {
    if (!adVisible) {
      if (adTimerRef.current) clearInterval(adTimerRef.current);
      return;
    }
    adTimerRef.current = setInterval(() => {
      setAdCountdown((prev) => {
        if (prev <= 1) {
          if (adTimerRef.current) clearInterval(adTimerRef.current);
          dismissAd();
          return 0;
        }
        if (prev === AD_SKIP_AFTER + 1) setAdCanSkip(true);
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (adTimerRef.current) clearInterval(adTimerRef.current);
    };
  }, [adVisible, dismissAd]);

  const handlePlayNext = useCallback(() => {
    if (autoNextCountdownRef.current) clearInterval(autoNextCountdownRef.current);
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    setAutoNextVisible(false);

    const next = player.nextEpisodeInfo;
    if (!next) return;
    const nextS = next.season;
    const nextE = next.episode;
    const nextEpisodes = player.episodes?.filter(
      (e) => e.episode_number >= nextE
    ) || [];

    openPlayer(
      player.itemId,
      "tv",
      player.title,
      nextS,
      nextE,
      nextEpisodes[0]?.runtime,
      nextS === player.season ? player.episodes : [],
      player.seasons,
      player.totalSeasons,
      undefined,
      undefined,
      undefined,
    );
  }, [player, openPlayer]);

  /* Auto-next countdown reaching 0 */
  useEffect(() => {
    if (autoNextVisible && autoNextCountdown === 0) {
      setAutoNextVisible(false);
      if (autoNextCountdownRef.current) clearInterval(autoNextCountdownRef.current);
      handlePlayNext();
    }
  }, [autoNextCountdown, autoNextVisible, handlePlayNext]);

  const closePlayer = useCallback(() => {
    setPlayer({
      show: false,
      itemId: 0,
      itemType: "movie",
      title: "",
      embedUrl: "",
      sources: [],
    });
    setAdVisible(false);
    setSkipIntroVisible(false);
    setAutoNextVisible(false);
    setControlsVisible(true);
    if (adTimerRef.current) clearInterval(adTimerRef.current);
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
    if (introHideTimerRef.current) clearTimeout(introHideTimerRef.current);
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    if (autoNextCountdownRef.current) clearInterval(autoNextCountdownRef.current);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (isFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [isFullscreen]);

  const switchSource = useCallback((url: string) => {
    setPlayer((prev) => ({ ...prev, embedUrl: url }));
    setSourceDropdownOpen(false);
    iframeKeyRef.current += 1;
  }, []);

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

  const handlePlayMovie = useCallback(async () => {
    if (!detailItem || detailType !== "movie") return;
    const movie = detailItem as MovieDetail;
    await openPlayer(movie.id, "movie", movie.title, undefined, undefined, movie.runtime);
  }, [detailItem, detailType, openPlayer]);

  const handlePlayEpisode = useCallback(async (ep: EpisodeInfo) => {
    if (!detailItem || detailType !== "tv") return;
    const tv = detailItem as TvDetail;
    await openPlayer(
      tv.id,
      "tv",
      tv.title,
      detailSeason,
      ep.episode_number,
      ep.runtime,
      detailEpisodes,
      tv.seasons,
      tv.number_of_seasons,
    );
  }, [detailItem, detailType, detailSeason, detailEpisodes, openPlayer]);

  const handleAddToList = useCallback((id: number) => {
    toggleMyList(id);
    setMyListRefresh((p) => p + 1);
  }, []);

  /* ════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════ */

  const heroItem = heroItems[heroIndex];

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* ═══ HEADER ═══ */}
      <Header
        scrolled={scrolled}
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        searching={searching}
        searchResults={searchResults}
        mobileMenuOpen={mobileMenuOpen}
        onToggleSearch={() => {
          setSearchOpen(!searchOpen);
          if (searchOpen) {
            setSearchQuery("");
            setSearchResults([]);
          }
          setTimeout(() => searchInputRef.current?.focus(), 100);
        }}
        onSearchChange={setSearchQuery}
        onSearchSelect={(item) => {
          setSearchOpen(false);
          setSearchQuery("");
          openDetail(item.id, item.media_type);
        }}
        onToggleMobile={() => setMobileMenuOpen(!mobileMenuOpen)}
        searchInputRef={searchInputRef}
        searchContainerRef={searchContainerRef}
      />

      {/* ═══ HERO BANNER ═══ */}
      <HeroBanner item={heroItem} index={heroIndex} />

      {/* ═══ MOBILE MENU ═══ */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <MobileMenu onClose={() => setMobileMenuOpen(false)} />
        )}
      </AnimatePresence>

      {/* ═══ CONTENT ═══ */}
      <main className="relative z-10 -mt-16 pb-16 space-y-8 md:space-y-10">
        {continueWatching.length > 0 && (
          <ContentRow
            title="Continuar Viendo"
            items={continueWatching.map((cw) => ({
              id: cw.id,
              title: cw.title,
              poster: cw.poster,
              backdrop: cw.backdrop,
              rating: 0,
              media_type: cw.type,
              release_date: "",
              overview: "",
              popularity: 0,
            }))}
            loading={false}
            onCardClick={(item) => {
              openDetail(
                item.id,
                item.media_type,
                continueWatching.find((cw) => cw.id === item.id)?.season,
                continueWatching.find((cw) => cw.id === item.id)?.episode,
              );
            }}
            showProgress
          />
        )}

        <ContentRow
          title="Tendencias Ahora"
          items={trendingAll}
          loading={rowsLoading}
          onCardClick={(item) => openDetail(item.id, item.media_type)}
        />
        <ContentRow
          title="Series Populares"
          items={trendingTv}
          loading={rowsLoading}
          onCardClick={(item) => openDetail(item.id, item.media_type)}
        />
        <ContentRow
          title="Anime"
          items={anime}
          loading={rowsLoading}
          onCardClick={(item) => openDetail(item.id, item.media_type)}
        />
        <ContentRow
          title="Peliculas de Accion"
          items={actionMovies}
          loading={rowsLoading}
          onCardClick={(item) => openDetail(item.id, item.media_type)}
        />
        <ContentRow
          title="Mejor Valoradas"
          items={topRated}
          loading={rowsLoading}
          onCardClick={(item) => openDetail(item.id, item.media_type)}
        />
      </main>

      {/* ═══ DETAIL MODAL ═══ */}
      <AnimatePresence>
        {detailItem && (
          <DetailModal
            item={detailItem}
            type={detailType}
            loading={detailLoading}
            season={detailSeason}
            episodes={detailEpisodes}
            episodesLoading={detailEpisodesLoading}
            myListRefresh={myListRefresh}
            onClose={() => setDetailItem(null)}
            onPlayMovie={handlePlayMovie}
            onSelectSeason={(s) => loadSeason(detailItem.id, s)}
            onPlayEpisode={handlePlayEpisode}
            onSelectSimilar={(item) => openDetail(item.id, item.media_type)}
            onAddToList={handleAddToList}
          />
        )}
      </AnimatePresence>

      {/* ═══ PLAYER OVERLAY ═══ */}
      <AnimatePresence>
        {player.show && (
          <PlayerOverlay
            player={player}
            iframeKey={iframeKeyRef.current}
            controlsVisible={controlsVisible}
            adVisible={adVisible}
            adCountdown={adCountdown}
            adCanSkip={adCanSkip}
            skipIntroVisible={skipIntroVisible}
            autoNextVisible={autoNextVisible}
            autoNextCountdown={autoNextCountdown}
            sourceDropdownOpen={sourceDropdownOpen}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            playerContainerRef={playerContainerRef}
            onDismissAd={dismissAd}
            onSkipIntro={() => setSkipIntroVisible(false)}
            onAutoNextCancel={() => {
              setAutoNextVisible(false);
              if (autoNextCountdownRef.current) clearInterval(autoNextCountdownRef.current);
            }}
            onPlayNext={handlePlayNext}
            onClose={closePlayer}
            onBackToDetail={() => {
              closePlayer();
              openDetail(player.itemId, player.itemType);
            }}
            onToggleSourceDropdown={() => setSourceDropdownOpen(!sourceDropdownOpen)}
            onSwitchSource={switchSource}
            onToggleMute={() => setIsMuted(!isMuted)}
            onToggleFullscreen={toggleFullscreen}
            onPlayPrevEpisode={() => {
              if (player.itemType === "tv" && player.season && player.episode && player.episode && player.episode > 1) {
                closePlayer();
                openDetail(player.itemId, "tv", player.season, player.episode - 1);
              }
            }}
            onPlayNextEpisode={() => {
              if (player.itemType === "tv" && player.nextEpisodeInfo) {
                closePlayer();
                const n = player.nextEpisodeInfo;
                openDetail(player.itemId, "tv", n.season, n.episode);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* ═══ FOOTER ═══ */}
      <Footer />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   HEADER COMPONENT
   ════════════════════════════════════════════════════════════════ */

function Header({
  scrolled,
  searchOpen,
  searchQuery,
  searching,
  searchResults,
  mobileMenuOpen,
  onToggleSearch,
  onSearchChange,
  onSearchSelect,
  onToggleMobile,
  searchInputRef,
  searchContainerRef,
}: {
  scrolled: boolean;
  searchOpen: boolean;
  searchQuery: string;
  searching: boolean;
  searchResults: MediaItem[];
  mobileMenuOpen: boolean;
  onToggleSearch: () => void;
  onSearchChange: (q: string) => void;
  onSearchSelect: (item: MediaItem) => void;
  onToggleMobile: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const navItems = ["Inicio", "Series", "Anime", "Peliculas", "Mi Lista"];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled || searchOpen ? "bg-[#141414] shadow-lg" : "bg-gradient-to-b from-black/80 to-transparent"
      }`}
    >
      <div className="flex items-center justify-between px-4 md:px-12 h-16 md:h-[68px]">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          <span className="text-[#E50914] text-xl md:text-2xl font-extrabold tracking-wider cursor-pointer select-none">
            STREAMVAULT
          </span>
          <nav className="hidden md:flex items-center gap-5">
            {navItems.map((label, i) => (
              <button
                key={label}
                className={`text-sm transition-colors duration-200 hover:text-white ${
                  i === 0 ? "text-white font-semibold" : "text-[#b3b3b3]"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4" ref={searchContainerRef}>
          {/* Search */}
          <div className="relative flex items-center">
            <AnimatePresence>
              {searchOpen && (
                <motion.input
                  ref={searchInputRef}
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 240, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Titulos, personas, generos"
                  className="bg-black/80 border border-white/30 text-white text-sm px-3 py-1.5 rounded outline-none placeholder:text-[#808080]"
                />
              )}
            </AnimatePresence>
            <button
              onClick={onToggleSearch}
              className="text-white hover:text-[#b3b3b3] transition-colors p-1"
              aria-label="Buscar"
            >
              {searchOpen ? <X size={22} /> : <Search size={22} />}
            </button>
          </div>

          {/* Bell */}
          <button className="text-white hover:text-[#b3b3b3] transition-colors hidden sm:block">
            <Bell size={22} />
          </button>

          {/* Profile */}
          <div className="w-8 h-8 rounded-md bg-[#E50914] flex items-center justify-center cursor-pointer">
            <User size={16} className="text-white" />
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={onToggleMobile}
            className="md:hidden text-white hover:text-[#b3b3b3] transition-colors p-1"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Search Results Dropdown */}
      <AnimatePresence>
        {searchOpen && searchQuery.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 bg-[#141414]/98 border-t border-white/10 shadow-2xl z-50"
          >
            <div className="max-w-7xl mx-auto px-4 md:px-12 py-4">
              {searching ? (
                <div className="flex items-center gap-2 text-[#808080] text-sm">
                  <div className="w-4 h-4 border-2 border-[#808080] border-t-transparent rounded-full animate-spin" />
                  Buscando...
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-[#808080] text-sm py-4">
                  No se encontraron resultados para &quot;{searchQuery}&quot;
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {searchResults.map((item) => (
                    <button
                      key={`${item.media_type}-${item.id}`}
                      onClick={() => onSearchSelect(item)}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                    >
                      <img
                        src={item.poster}
                        alt={item.title}
                        className="w-10 h-14 object-cover rounded"
                        loading="lazy"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate">{item.title}</p>
                        <p className="text-xs text-[#808080]">
                          {item.media_type === "movie" ? "Pelicula" : "Serie"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════════
   MOBILE MENU
   ════════════════════════════════════════════════════════════════ */

function MobileMenu({ onClose }: { onClose: () => void }) {
  const items = ["Inicio", "Series", "Anime", "Peliculas", "Mi Lista"];
  return (
    <motion.div
      initial={{ opacity: 0, x: "100%" }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: "100%" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed inset-0 z-40 bg-[#141414]/95 backdrop-blur-sm md:hidden"
    >
      <div className="flex flex-col pt-20 px-8 gap-1">
        {items.map((label, i) => (
          <button
            key={label}
            onClick={onClose}
            className={`text-left text-lg py-3 border-b border-white/5 transition-colors ${
              i === 0 ? "text-white font-semibold" : "text-[#b3b3b3] hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════
   HERO BANNER
   ════════════════════════════════════════════════════════════════ */

function HeroBanner({ item, index }: { item: MediaItem | undefined; index: number }) {
  if (!item) {
    return (
      <div className="relative w-full h-[60vh] md:h-[80vh] skeleton-shimmer" />
    );
  }

  return (
    <div className="relative w-full h-[60vh] md:h-[80vh] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0"
        >
          <img
            src={item.backdrop}
            alt=""
            className="w-full h-full object-cover object-center"
          />
        </motion.div>
      </AnimatePresence>

      {/* Gradient overlays */}
      <div className="absolute inset-0 nf-hero-gradient" />
      <div className="absolute inset-0 nf-hero-left" />

      {/* Hero Dots */}
      {heroItemsLength(index) > 1 && (
        <div className="absolute bottom-20 md:bottom-28 left-4 md:left-12 flex gap-1.5">
          {Array.from({ length: heroItemsLength(index) }).map((_, i) => (
            <div
              key={i}
              className={`h-0.5 rounded-full transition-all duration-500 ${
                i === index ? "w-6 bg-white" : "w-3 bg-white/40"
              }`}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="absolute bottom-16 md:bottom-28 left-4 md:left-12 max-w-xl md:max-w-2xl z-10">
        {/* Top badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[#E50914] text-xs md:text-sm font-bold tracking-wider uppercase">
            TOP {index + 1} EN {item.media_type === "movie" ? "PELICULAS" : "SERIES"} HOY
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold mb-3 md:mb-4 drop-shadow-lg leading-tight">
          {item.title}
        </h1>

        {/* Description */}
        <p className="text-sm md:text-base text-[#b3b3b3] mb-5 md:mb-6 line-clamp-2 md:line-clamp-3 max-w-lg">
          {item.overview}
        </p>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white text-black font-bold px-5 md:px-8 py-2 md:py-3 rounded text-sm md:text-base hover:bg-white/80 transition-colors">
            <Play size={20} fill="black" />
            Reproducir
          </button>
          <button className="flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white font-semibold px-5 md:px-8 py-2 md:py-3 rounded text-sm md:text-base hover:bg-white/30 transition-colors">
            <Plus size={20} />
            Mi Lista
          </button>
          <button className="flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors">
            <Info size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

function heroItemsLength(index: number): number {
  void index;
  return 5;
}

/* ════════════════════════════════════════════════════════════════
   CONTENT ROW
   ════════════════════════════════════════════════════════════════ */

function ContentRow({
  title,
  items,
  loading,
  onCardClick,
  showProgress,
}: {
  title: string;
  items: MediaItem[];
  loading: boolean;
  onCardClick: (item: MediaItem) => void;
  showProgress?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState(false);

  const scroll = useCallback((direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const cardWidth = window.innerWidth < 640 ? 140 + 8 : 230 + 12;
    const scrollAmount = cardWidth * 3;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }, []);

  if (loading) {
    return (
      <div className="px-4 md:px-12">
        <h2 className="text-lg md:text-xl font-bold text-white mb-3">{title}</h2>
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="shrink-0 skeleton-shimmer rounded-md" style={{ width: 230, aspectRatio: "2/3" }} />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div
      className="relative group/row"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <h2 className="text-lg md:text-xl font-bold text-white mb-3 px-4 md:px-12">
        {title}
      </h2>

      {/* Left arrow */}
      {hovered && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white hover:bg-black/90 transition-all hidden md:flex"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Right arrow */}
      {hovered && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white hover:bg-black/90 transition-all hidden md:flex"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex gap-2 md:gap-3 overflow-x-auto no-scrollbar px-4 md:px-12"
      >
        {items.map((item) => (
          <ContentCard
            key={`${item.media_type}-${item.id}`}
            item={item}
            onClick={() => onCardClick(item)}
            showProgress={showProgress}
          />
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   CONTENT CARD
   ════════════════════════════════════════════════════════════════ */

function ContentCard({
  item,
  onClick,
  showProgress,
}: {
  item: MediaItem;
  onClick: () => void;
  showProgress?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className="nf-card shrink-0 cursor-pointer relative rounded-md overflow-hidden group"
      style={{ width: "calc((100vw - 3.5rem) / 2.5)", maxWidth: 140 }}
    >
      {/* Desktop size override */}
      <div className="hidden md:block" style={{ width: 230 }}>
        <CardInner item={item} showProgress={showProgress} />
      </div>
      {/* Mobile size */}
      <div className="md:hidden">
        <CardInner item={item} showProgress={showProgress} mobile />
      </div>
    </div>
  );
}

function CardInner({
  item,
  showProgress,
  mobile,
}: {
  item: MediaItem;
  showProgress?: boolean;
  mobile?: boolean;
}) {
  const hasPoster = item.poster && !item.poster.includes("placeholder");
  const w = mobile ? "100%" : 230;

  return (
    <div className="relative rounded-md overflow-hidden" style={{ width: w, aspectRatio: "2/3" }}>
      {hasPoster ? (
        <img
          src={item.poster}
          alt={item.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-[#181818] flex items-center justify-center">
          <Film size={32} className="text-[#333]" />
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      {/* Type badge */}
      <div className="absolute top-2 left-2">
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            item.media_type === "movie"
              ? "bg-[#E50914]/80 text-white"
              : "bg-[#333]/90 text-[#e5e5e5]"
          }`}
        >
          {item.media_type === "movie" ? "PEL" : "SER"}
        </span>
      </div>

      {/* Rating badge */}
      {item.rating > 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
          <Star size={10} className="text-[#f5c518] fill-[#f5c518]" />
          <span className="text-[10px] font-semibold text-white">
            {item.rating.toFixed(1)}
          </span>
        </div>
      )}

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-xs font-semibold text-white truncate">{item.title}</p>
      </div>

      {/* Progress bar (for continue watching) */}
      {showProgress && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#333]">
          <div
            className="h-full bg-[#E50914]"
            style={{ width: `${Math.random() * 60 + 20}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DETAIL MODAL
   ════════════════════════════════════════════════════════════════ */

function DetailModal({
  item,
  type,
  loading,
  season,
  episodes,
  episodesLoading,
  myListRefresh,
  onClose,
  onPlayMovie,
  onSelectSeason,
  onPlayEpisode,
  onSelectSimilar,
  onAddToList,
}: {
  item: MovieDetail | TvDetail;
  type: "movie" | "tv";
  loading: boolean;
  season: number;
  episodes: EpisodeInfo[];
  episodesLoading: boolean;
  myListRefresh: number;
  onClose: () => void;
  onPlayMovie: () => void;
  onSelectSeason: (s: number) => void;
  onPlayEpisode: (ep: EpisodeInfo) => void;
  onSelectSimilar: (item: SimilarItem) => void;
  onAddToList: (id: number) => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const inList = isInMyList(item.id);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div className="w-full max-w-[850px] skeleton-shimmer rounded-xl" style={{ height: "80vh" }} />
      </motion.div>
    );
  }

  const isMovie = type === "movie";
  const movieItem = isMovie ? (item as MovieDetail) : null;
  const tvItem = !isMovie ? (item as TvDetail) : null;

  const title = item.title;
  const backdrop = item.backdrop;
  const overview = item.overview;
  const rating = item.rating;
  const genres = item.genres;
  const similar = item.similar || [];
  const year = isMovie
    ? getYear((item as MovieDetail).release_date)
    : getYear((item as TvDetail).first_air_date);
  const runtime = isMovie ? (item as MovieDetail).runtime : 0;
  const seasons = tvItem?.seasons || [];
  const numSeasons = tvItem?.number_of_seasons || 0;
  const numEpisodes = tvItem?.number_of_episodes || 0;

  return (
    <motion.div
      ref={modalRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto"
      onClick={(e) => {
        if (e.target === modalRef.current) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-[850px] bg-[#181818] rounded-xl overflow-hidden my-8 mx-4 shadow-2xl"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-[#181818] flex items-center justify-center text-white hover:bg-[#333] transition-colors"
        >
          <X size={20} />
        </button>

        {/* Backdrop */}
        <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
          {backdrop && !backdrop.includes("placeholder") ? (
            <img src={backdrop} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#222] flex items-center justify-center">
              <Film size={48} className="text-[#444]" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent" />
        </div>

        {/* Content */}
        <div className="px-6 md:px-8 pb-8 -mt-20 relative z-10">
          {/* Title */}
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">{title}</h2>

          {/* Info row */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#b3b3b3] mb-4">
            {rating > 0 && (
              <span className="flex items-center gap-1">
                <Star size={14} className="text-[#f5c518] fill-[#f5c518]" />
                {rating.toFixed(1)}
              </span>
            )}
            {year && <span>{year}</span>}
            {runtime > 0 && <span>{formatRuntime(runtime)}</span>}
            {!isMovie && numSeasons > 0 && <span>{numSeasons} temporada{numSeasons > 1 ? "s" : ""}</span>}
            {!isMovie && numEpisodes > 0 && <span>{numEpisodes} episodio{numEpisodes > 1 ? "s" : ""}</span>}
            {genres.length > 0 && (
              <span className="text-[#808080]">
                {genres.map((g) => g.name).join(" · ")}
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-[#b3b3b3] mb-5 line-clamp-3 leading-relaxed">
            {overview}
          </p>

          {/* Buttons */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={isMovie ? onPlayMovie : () => episodes.length > 0 && onPlayEpisode(episodes[0])}
              className="flex items-center gap-2 bg-white text-black font-bold px-6 py-2.5 rounded text-sm hover:bg-white/80 transition-colors"
            >
              <Play size={18} fill="black" />
              Reproducir
            </button>
            <button
              onClick={() => {
                onAddToList(item.id);
              }}
              className={`flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold transition-colors ${
                inList
                  ? "bg-[#E50914] text-white"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              {inList ? <Heart size={18} fill="white" /> : <Plus size={18} />}
              {inList ? "En Mi Lista" : "Mi Lista"}
            </button>
            <button className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
              <ThumbsUp size={18} />
            </button>
          </div>

          {/* TV: Season tabs + Episode list */}
          {!isMovie && tvItem && (
            <div className="mb-6">
              {/* Season tabs */}
              {seasons.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
                  {seasons.map((s) => (
                    <button
                      key={s.season_number}
                      onClick={() => onSelectSeason(s.season_number)}
                      className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        season === s.season_number
                          ? "bg-white text-black"
                          : "bg-[#333] text-[#b3b3b3] hover:bg-[#444]"
                      }`}
                    >
                      T{s.season_number}
                    </button>
                  ))}
                </div>
              )}

              {/* Episode list */}
              {episodesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-20 skeleton-shimmer rounded-lg" />
                  ))}
                </div>
              ) : episodes.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto sv-scrollbar pr-1">
                  {episodes.map((ep) => (
                    <button
                      key={ep.episode_number}
                      onClick={() => onPlayEpisode(ep)}
                      className="w-full flex items-center gap-4 p-3 rounded-lg bg-[#222]/50 hover:bg-[#2a2a2a] transition-colors text-left group"
                    >
                      {/* Thumbnail */}
                      <div className="shrink-0 w-28 md:w-36 rounded overflow-hidden relative" style={{ aspectRatio: "16/9" }}>
                        {ep.still && !ep.still.includes("placeholder") ? (
                          <img src={ep.still} alt={ep.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full bg-[#333] flex items-center justify-center">
                            <Tv size={20} className="text-[#555]" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <Play size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="white" />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-[#808080] font-medium">
                            E{ep.episode_number}
                          </span>
                          {ep.runtime > 0 && (
                            <span className="text-xs text-[#808080]">
                              {formatRuntime(ep.runtime)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-white truncate">{ep.name}</p>
                        <p className="text-xs text-[#808080] line-clamp-1 mt-0.5">{ep.overview}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#808080] py-4 text-center">
                  No hay episodios disponibles para esta temporada.
                </p>
              )}
            </div>
          )}

          {/* Similares */}
          {similar.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Similares</h3>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {similar.map((s) => (
                  <button
                    key={s.id}
                    onClick={() =>
                      onSelectSimilar({
                        ...s,
                        overview: "",
                        backdrop: "",
                        release_date: "",
                        popularity: 0,
                      })
                    }
                    className="nf-card shrink-0 rounded-md overflow-hidden"
                    style={{ width: 130 }}
                  >
                    <div style={{ aspectRatio: "2/3" }}>
                      {s.poster && !s.poster.includes("placeholder") ? (
                        <img src={s.poster} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-[#222] flex items-center justify-center">
                          <Film size={20} className="text-[#444]" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-xs text-white truncate">{s.title}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PLAYER OVERLAY
   ════════════════════════════════════════════════════════════════ */

function PlayerOverlay({
  player,
  iframeKey,
  controlsVisible,
  adVisible,
  adCountdown,
  adCanSkip,
  skipIntroVisible,
  autoNextVisible,
  autoNextCountdown,
  sourceDropdownOpen,
  isMuted,
  isFullscreen,
  playerContainerRef,
  onDismissAd,
  onSkipIntro,
  onAutoNextCancel,
  onPlayNext,
  onClose,
  onBackToDetail,
  onToggleSourceDropdown,
  onSwitchSource,
  onToggleMute,
  onToggleFullscreen,
  onPlayPrevEpisode,
  onPlayNextEpisode,
}: {
  player: PlayerState;
  iframeKey: number;
  controlsVisible: boolean;
  adVisible: boolean;
  adCountdown: number;
  adCanSkip: boolean;
  skipIntroVisible: boolean;
  autoNextVisible: boolean;
  autoNextCountdown: number;
  sourceDropdownOpen: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  playerContainerRef: React.RefObject<HTMLDivElement | null>;
  onDismissAd: () => void;
  onSkipIntro: () => void;
  onAutoNextCancel: () => void;
  onPlayNext: () => void;
  onClose: () => void;
  onBackToDetail: () => void;
  onToggleSourceDropdown: () => void;
  onSwitchSource: (url: string) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onPlayPrevEpisode: () => void;
  onPlayNextEpisode: () => void;
}) {
  return (
    <motion.div
      ref={playerContainerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[60] bg-black flex flex-col"
    >
      {/* ═══ PRE-ROLL AD ═══ */}
      <AnimatePresence>
        {adVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[70] bg-gradient-to-br from-[#0a0a0a] via-[#141414] to-[#0a0a0a] flex flex-col items-center justify-center p-8"
          >
            {/* Ad progress bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#333]">
              <div
                className="h-full bg-[#E50914] transition-all duration-1000 ease-linear"
                style={{ width: `${((AD_DURATION - adCountdown) / AD_DURATION) * 100}%` }}
              />
            </div>

            <div className="text-center max-w-md">
              <div className="text-[#E50914] font-bold text-sm tracking-wider uppercase mb-4">
                Anuncio
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                StreamVault Premium
              </h3>
              <p className="text-[#b3b3b3] text-sm mb-2">
                Disfruta de streaming sin interrupciones con nuestra suscripcion premium.
              </p>
              <p className="text-[#808080] text-xs mb-6">
                Visita tveo.site para mas opciones de streaming.
              </p>

              <p className="text-[#808080] text-xs mb-4">
                El video comenzara en {adCountdown}s...
              </p>

              {adCanSkip && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={onDismissAd}
                  className="flex items-center gap-2 bg-[#E50914] text-white font-bold px-8 py-3 rounded-lg hover:bg-[#c40812] transition-colors text-sm"
                >
                  <Play size={16} fill="white" />
                  Omitir anuncio
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ TOP BAR ═══ */}
      <AnimatePresence>
        {controlsVisible && !adVisible && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/80 to-transparent px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <button
                onClick={onBackToDetail}
                className="flex items-center gap-2 text-white hover:text-[#b3b3b3] transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="hidden sm:inline text-sm">Volver</span>
              </button>
              <div className="text-sm text-white font-medium">
                {player.title}
                {player.itemType === "tv" && player.season && player.episode && (
                  <span className="text-[#b3b3b3] ml-2">
                    T{player.season}:E{player.episode}
                    {player.episodeTitle ? ` - ${player.episodeTitle}` : ""}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Source selector */}
              {player.sources.length > 1 && (
                <div className="relative">
                  <button
                    onClick={onToggleSourceDropdown}
                    className="flex items-center gap-2 text-sm text-white hover:text-[#b3b3b3] transition-colors bg-white/10 px-3 py-1.5 rounded"
                  >
                    <Tv size={14} />
                    <span className="hidden sm:inline">Fuente</span>
                    <ChevronRight size={14} className="rotate-90" />
                  </button>
                  <AnimatePresence>
                    {sourceDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute right-0 top-full mt-2 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[160px]"
                      >
                        {player.sources.map((source, i) => (
                          <button
                            key={source.name}
                            onClick={() => onSwitchSource(source.url)}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                              source.url === player.embedUrl
                                ? "bg-[#E50914]/20 text-[#E50914]"
                                : "text-white hover:bg-white/5"
                            } ${i > 0 ? "border-t border-white/5" : ""}`}
                          >
                            <span>{source.label}</span>
                            {source.url === player.embedUrl && (
                              <span className="text-[10px] font-bold uppercase">Activa</span>
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Fullscreen */}
              <button
                onClick={onToggleFullscreen}
                className="text-white hover:text-[#b3b3b3] transition-colors"
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ IFRAME (centered) ═══ */}
      {!adVisible && (
        <div className="flex-1 flex items-center justify-center relative">
          <div className="w-full h-full max-w-[1200px] max-h-full flex items-center justify-center p-2">
            <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
              <iframe
                key={iframeKey}
                src={player.embedUrl}
                className="w-full h-full rounded-lg"
                allowFullScreen
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                style={{ border: "none" }}
                title="Player"
              />
            </div>
          </div>

          {/* Skip Intro Button */}
          <AnimatePresence>
            {skipIntroVisible && (
              <motion.button
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 200 }}
                onClick={onSkipIntro}
                className="intro-skip-btn absolute bottom-20 right-4 md:right-8 z-30 flex items-center gap-2 bg-[#E50914] text-white font-bold px-5 py-2.5 rounded-lg hover:bg-[#c40812] transition-colors text-sm shadow-lg"
              >
                Saltar Intro
                <Play size={14} fill="white" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ═══ BOTTOM BAR ═══ */}
      <AnimatePresence>
        {controlsVisible && !adVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/80 to-transparent px-4 py-3"
          >
            {/* Progress bar (decorative) */}
            <div className="w-full h-1 bg-white/20 rounded-full mb-3 group cursor-pointer">
              <div className="h-full bg-[#E50914] rounded-full w-1/3 relative">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#E50914] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {player.itemType === "tv" && (
                  <>
                    <button
                      onClick={onPlayPrevEpisode}
                      className="text-white hover:text-[#b3b3b3] transition-colors disabled:text-[#555]"
                      disabled={!player.episode || player.episode <= 1}
                    >
                      <SkipBack size={22} />
                    </button>
                  </>
                )}
                <button className="text-white hover:text-[#b3b3b3] transition-colors">
                  <Play size={26} fill="white" />
                </button>
                {player.itemType === "tv" && (
                  <button
                    onClick={onPlayNextEpisode}
                    className="text-white hover:text-[#b3b3b3] transition-colors disabled:text-[#555]"
                    disabled={!player.nextEpisodeInfo}
                  >
                    <SkipForward size={22} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <span className="text-xs text-[#808080] mr-2">
                  {player.itemType === "tv" && player.season && player.episode
                    ? `T${player.season}:E${player.episode}`
                    : ""}
                </span>
                <button
                  onClick={onToggleMute}
                  className="text-white hover:text-[#b3b3b3] transition-colors"
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <button
                  onClick={onToggleFullscreen}
                  className="text-white hover:text-[#b3b3b3] transition-colors ml-1"
                >
                  {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ AUTO-NEXT EPISODE BANNER ═══ */}
      <AnimatePresence>
        {autoNextVisible && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 200 }}
            className="absolute bottom-16 left-4 right-4 md:left-8 md:right-8 z-40 bg-[#1a1a1a]/95 backdrop-blur-md border border-white/10 rounded-xl p-5 flex items-center gap-5 shadow-2xl"
          >
            {/* Countdown circle */}
            <div className="relative w-12 h-12 shrink-0">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                <circle
                  cx="24" cy="24" r="20"
                  fill="none"
                  stroke="#333"
                  strokeWidth="3"
                />
                <circle
                  cx="24" cy="24" r="20"
                  fill="none"
                  stroke="#E50914"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - autoNextCountdown / AUTO_NEXT_COUNTDOWN)}`}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                {autoNextCountdown}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Siguiente Episodio</p>
              {player.nextEpisodeInfo && (
                <p className="text-xs text-[#b3b3b3]">
                  T{player.nextEpisodeInfo.season} E{player.nextEpisodeInfo.episode}: {player.nextEpisodeInfo.title}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onPlayNext}
                className="flex items-center gap-2 bg-white text-black font-bold px-4 py-2 rounded text-sm hover:bg-white/80 transition-colors"
              >
                <Play size={14} fill="black" />
                Reproducir
              </button>
              <button
                onClick={onAutoNextCancel}
                className="text-[#808080] hover:text-white transition-colors px-3 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════
   FOOTER
   ════════════════════════════════════════════════════════════════ */

function Footer() {
  const columns = [
    {
      title: "Acerca de",
      links: ["Nosotros", "Centro de ayuda", "Terminos de uso", "Privacidad"],
    },
    {
      title: "Ayuda",
      links: ["FAQ", "Contacto", "Soporte tecnico", "Reportar bug"],
    },
    {
      title: "Legal",
      links: ["Aviso legal", "Cookies", "Licencias", "DMCA"],
    },
    {
      title: "Social",
      links: ["Twitter", "Discord", "Instagram", "GitHub"],
    },
  ];

  return (
    <footer className="bg-[#141414] border-t border-white/5 px-4 md:px-12 pt-12 pb-8 mt-8">
      <div className="max-w-6xl mx-auto">
        {/* Social icons */}
        <div className="flex items-center gap-4 mb-8">
          {["Twitter", "Discord", "Instagram", "GitHub"].map((name) => (
            <button
              key={name}
              className="w-9 h-9 rounded-full bg-[#333] hover:bg-[#444] transition-colors flex items-center justify-center text-[#b3b3b3] hover:text-white"
              aria-label={name}
            >
              <span className="text-xs font-bold">{name[0]}</span>
            </button>
          ))}
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-bold text-[#808080] uppercase tracking-wider mb-3">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <button className="text-xs text-[#555] hover:text-[#b3b3b3] hover:underline transition-colors">
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Service code */}
        <button className="text-xs text-[#555] hover:text-[#808080] transition-colors border border-[#333] px-3 py-1 rounded mb-6">
          Codigo de servicio
        </button>

        {/* Copyright */}
        <p className="text-xs text-[#555]">
          &copy; 2025 StreamVault. Todos los derechos reservados.
        </p>
        <p className="text-xs text-[#444] mt-1">
          Hecho con Next.js y TMDB
        </p>
      </div>
    </footer>
  );
}
