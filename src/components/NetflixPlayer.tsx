"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, SkipForward, AlertCircle, Loader2, Server } from "lucide-react";

interface StreamSource {
  url: string;
  name?: string;
  lang?: string;
  playbackType?: "hls" | "mp4" | "iframe";
  originalUrl?: string;
  headers?: Record<string, string>;
}

interface NetflixPlayerProps {
  sources: StreamSource[];
  title?: string;
  onBack?: () => void;
  headers?: Record<string, string>;
  showLangBadge?: boolean;
}

function sortByPlayback(list: StreamSource[]): StreamSource[] {
  const rank = (s: StreamSource) => {
    const t = s.playbackType ||
      (s.url?.includes(".m3u8") ? "hls" : s.url?.includes(".mp4") ? "mp4" : "iframe");
    return t === "hls" ? 0 : t === "mp4" ? 1 : 2;
  };
  return [...list].sort((a, b) => rank(a) - rank(b));
}

export default function NetflixPlayer({ sources, title, onBack, headers, showLangBadge }: NetflixPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [validSources, setValidSources] = useState<StreamSource[]>(() => sortByPlayback(sources));
  const [isChecking] = useState(false);
  const hlsRef = useRef<any>(null);
  // For debounced seek: track value while dragging, commit on release
  const seekValueRef = useRef<number | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekDisplay, setSeekDisplay] = useState(0);

  useEffect(() => {
    setValidSources(sortByPlayback(sources));
    setCurrentIndex(0);
    setHasError(false);
  }, [sources]);

  const currentSource = validSources[currentIndex] || validSources[0];
  const sourceHeaders = currentSource?.headers || headers;
  const playbackType =
    currentSource?.playbackType ||
    (currentSource?.url?.includes(".m3u8") ? "hls" : currentSource?.url?.includes(".mp4") ? "mp4" : "iframe");
  const isEmbed = playbackType === "iframe";

  const handleFailover = useCallback(() => {
    setCurrentIndex((index) => {
      if (index < validSources.length - 1) {
        return index + 1;
      }
      setHasError(true);
      return index;
    });
  }, [validSources.length]);

  // ── HLS / native video setup ──────────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current || !currentSource?.url || isChecking || isEmbed) return;

    const video = videoRef.current;
    const url = currentSource.url;
    setHasError(false);
    setIsPlaying(false);
    setIsBuffering(true);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let cancelled = false;

    const startNative = () => {
      video.src = url;
      video.onerror = () => { if (!cancelled) handleFailover(); };
      video.play()
        .then(() => { if (!cancelled) setIsPlaying(true); })
        .catch(() => { /* autoplay blocked — user taps to start */ });
    };

    const startHls = async () => {
      // Use the installed hls.js package — no CDN request needed
      const HlsLib = (await import("hls.js")).default;

      if (cancelled) return;

      if (playbackType === "hls" && HlsLib.isSupported()) {
        const hls = new HlsLib({
          enableWorker: true,
          lowLatencyMode: false,       // VOD streams, not live
          backBufferLength: 60,        // keep 60s behind playhead for backward seek
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          maxBufferHole: 0.5,
          nudgeMaxRetry: 10,
          startLevel: -1,             // auto quality
          abrEwmaDefaultEstimate: 1000000,
          fragLoadingTimeOut: 30000,
          manifestLoadingTimeOut: 20000,
          levelLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 3,     // fail fast → our handler retries
          fragLoadingRetryDelay: 500,
          manifestLoadingMaxRetry: 3,
          levelLoadingMaxRetry: 3,
        });

        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          video.play()
            .then(() => { if (!cancelled) setIsPlaying(true); })
            .catch(() => { /* autoplay blocked on mobile — user taps to start */ });
        });

        hls.on(HlsLib.Events.ERROR, (_event: any, data: any) => {
          if (cancelled) return;
          if (!data.fatal) return;

          if (data.type === HlsLib.ErrorTypes.NETWORK_ERROR) {
            // Restart loading from current position
            hls.startLoad(video.currentTime ?? -1);
          } else if (data.type === HlsLib.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            handleFailover();
          }
        });

      } else {
        // iOS Safari: native HLS
        startNative();
      }
    };

    startHls();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute("src");
      video.load();
    };
  }, [currentSource, handleFailover, isChecking, isEmbed, playbackType]);

  // ── Volume sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = volume;
    videoRef.current.muted = isMuted;
  }, [volume, isMuted, currentSource]);

  const nextSource = () => {
    if (currentIndex < validSources.length - 1) setCurrentIndex(currentIndex + 1);
    else setCurrentIndex(0);
  };

  // ── Controls visibility (mouse + touch) ───────────────────────────────────
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const showAndReset = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    };
    const el = containerRef.current;
    el?.addEventListener("mousemove", showAndReset);
    el?.addEventListener("touchstart", showAndReset, { passive: true });
    return () => {
      el?.removeEventListener("mousemove", showAndReset);
      el?.removeEventListener("touchstart", showAndReset);
      clearTimeout(timeout);
    };
  }, [isPlaying]);

  // ── Playback events ───────────────────────────────────────────────────────
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const tot = videoRef.current.duration;
    setCurrentTime(cur);
    setDuration(tot || 0);
    if (tot && tot > 0 && !isSeeking) {
      setProgress((cur / tot) * 100);
    }
  };

  const handleWaiting = () => setIsBuffering(true);
  const handlePlaying = () => setIsBuffering(false);
  const handleCanPlay = () => setIsBuffering(false);

  // ── Seeking — update display while dragging, seek only on release ─────────
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seekValueRef.current = val;
    setSeekDisplay(val);
    setIsSeeking(true);
  };

  const commitSeek = () => {
    const val = seekValueRef.current;
    if (val === null || !videoRef.current || !duration) return;
    const time = (val / 100) * duration;
    videoRef.current.currentTime = time;
    setProgress(val);
    setIsSeeking(false);
    seekValueRef.current = null;
  };

  // ── Transport controls ────────────────────────────────────────────────────
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); }
    else { videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {}); }
  };

  const skip = (amount: number) => {
    if (videoRef.current) videoRef.current.currentTime += amount;
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${m}:${String(sec).padStart(2, "0")}`;
  };

  if (isChecking) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-3xl flex flex-col items-center justify-center border border-gray-800">
        <Loader2 className="animate-spin text-yellow-500 mb-4" size={48} />
        <p className="text-gray-400">Verificando fuentes disponibles...</p>
      </div>
    );
  }

  const displayProgress = isSeeking ? seekDisplay : progress;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden group"
    >
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 p-6">
          <AlertCircle className="text-red-500 mb-4" size={64} />
          <h2 className="text-xl font-bold text-white mb-2">No se pudo cargar el video</h2>
          <p className="text-gray-400 text-center mb-6">Todas las fuentes han fallado o no son compatibles.</p>
          <button onClick={onBack} className="bg-yellow-500 text-black px-6 py-2 rounded-xl font-bold">Volver</button>
        </div>
      ) : isEmbed ? (
        <iframe
          key={currentSource.url}
          src={currentSource.url}
          className="w-full h-full border-0"
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
        />
      ) : (
        <>
          <video
            ref={videoRef}
            onTimeUpdate={handleTimeUpdate}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onCanPlay={handleCanPlay}
            onClick={togglePlay}
            className="w-full h-full cursor-pointer"
            playsInline
          />

          {/* Buffering spinner */}
          {isBuffering && isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Loader2 className="animate-spin text-yellow-500" size={56} />
            </div>
          )}

          {/* Play button overlay — tappeable for mobile autoplay unlock */}
          {!isPlaying && !isBuffering && (
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              onClick={togglePlay}
            >
              <div className="bg-yellow-500/20 backdrop-blur-sm p-8 rounded-full border border-yellow-500/50 animate-pulse">
                <Play size={64} fill="#EAB308" className="text-yellow-500 ml-2" />
              </div>
            </div>
          )}

          {/* Initial loading (buffering before first play) */}
          {isBuffering && !isPlaying && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
              <Loader2 className="animate-spin text-yellow-500" size={56} />
              <p className="text-gray-400 text-sm">Cargando stream...</p>
            </div>
          )}
        </>
      )}

      {/* ── Source selector header ─────────────────────────────────────────── */}
      <div className={`absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-500 ${showControls ? "opacity-100" : "opacity-0"}`}>
        <div className="p-4 md:p-8 flex items-center justify-end">
          {validSources.length > 1 && (
            <div className="flex items-center gap-2">
              <div className="hidden md:flex max-w-xl overflow-x-auto gap-2">
                {validSources.map((source, index) => (
                  <button
                    key={`${source.url}-${index}`}
                    onClick={() => setCurrentIndex(index)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
                      index === currentIndex
                        ? "bg-yellow-500 text-black border-yellow-400"
                        : "bg-white/10 text-white border-white/10 hover:bg-white/20"
                    }`}
                  >
                    <Server size={12} className="inline mr-1" />
                    {source.lang || index + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={nextSource}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl text-sm font-bold border border-white/10 transition-all flex items-center gap-2"
              >
                Siguiente <SkipForward size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Custom controls (direct streams only) ─────────────────────────── */}
      {!isEmbed && !hasError && (
        <div className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end px-4 md:px-8 pb-4 md:pb-8 pt-16 transition-opacity duration-500 ${showControls ? "opacity-100" : "opacity-0"}`}>

          {/* Time labels */}
          <div className="flex justify-between text-xs text-gray-400 mb-1 px-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Seek bar — commits on pointer/touch release to avoid mid-drag seeks */}
          <div className="relative w-full mb-4">
            <input
              type="range"
              min="0"
              max="100"
              value={displayProgress}
              onChange={handleSeekChange}
              onMouseUp={commitSeek}
              onTouchEnd={commitSeek}
              style={{ touchAction: "none" }}
              className="w-full h-2 bg-gray-600 rounded-full appearance-none cursor-pointer accent-yellow-500"
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-8">
              <button onClick={togglePlay} className="text-white hover:text-yellow-500 transition-all">
                {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
              </button>
              <button onClick={() => skip(-10)} className="text-white hover:text-yellow-500 transition-all">
                <RotateCcw size={26} />
              </button>
              <button onClick={() => skip(10)} className="text-white hover:text-yellow-500 transition-all">
                <RotateCw size={26} />
              </button>
              <div className="flex items-center gap-3 group/vol">
                <button onClick={() => setIsMuted(!isMuted)} className="text-white hover:text-yellow-500">
                  {isMuted || volume === 0 ? <VolumeX size={26} /> : <Volume2 size={26} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-0 group-hover/vol:w-20 transition-all accent-yellow-500 appearance-none h-1 bg-gray-600 rounded-full"
                />
              </div>
            </div>

            <button onClick={toggleFullScreen} className="text-white hover:text-yellow-500 transition-all">
              <Maximize size={26} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
