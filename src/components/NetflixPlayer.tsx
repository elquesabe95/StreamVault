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

// Prefer direct streams (our own player) over site iframes. Array.sort is
// stable in V8, so provider order is preserved within each playbackType group.
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
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [validSources, setValidSources] = useState<StreamSource[]>(() => sortByPlayback(sources));
  const [isChecking, setIsChecking] = useState(false);
  const hlsRef = useRef<any>(null);

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
        console.log(`[Player] Failing over to next source: ${index + 1}`);
        return index + 1;
      }

      setHasError(true);
      return index;
    });
  }, [validSources.length]);

  useEffect(() => {
    if (!videoRef.current || !currentSource?.url || isChecking || isEmbed) return;

    const url = currentSource.url;
    setHasError(false);
    setIsPlaying(false);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const loadHls = () => {
      const attach = () => {
        const Hls = (window as any).Hls;
        if (playbackType === "hls" && Hls?.isSupported()) {
          const hls = new Hls({
            // Better seek & recovery settings
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferHole: 0.5,
            nudgeMaxRetry: 5,
            startLevel: -1,           // auto quality
            abrEwmaDefaultEstimate: 500000,
            fragLoadingTimeOut: 20000,
            manifestLoadingTimeOut: 15000,
            levelLoadingTimeOut: 15000,
            fragLoadingMaxRetry: 4,
            fragLoadingRetryDelay: 500,
          });
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(videoRef.current!);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            // Only mark playing if play() actually succeeds — on mobile autoplay
            // is blocked by the browser and play() rejects; keeping isPlaying=false
            // lets the play-button overlay show so the user can tap to start.
            videoRef.current?.play()
              .then(() => setIsPlaying(true))
              .catch(() => { /* autoplay blocked — user must tap play */ });
          });
          hls.on(Hls.Events.ERROR, (event: any, data: any) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // Resume loading from the current seek position
              hls.startLoad(videoRef.current?.currentTime ?? -1);
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              handleFailover();
            }
          });
        } else {
          videoRef.current!.src = url;
          videoRef.current!.onerror = () => handleFailover();
          videoRef.current?.play()
            .then(() => setIsPlaying(true))
            .catch(() => { /* autoplay blocked on mobile — user taps to start */ });
        }
      };

      if ((window as any).Hls || playbackType !== "hls") {
        attach();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
      script.onload = attach;
      script.onerror = () => handleFailover();
      document.head.appendChild(script);
    };

    loadHls();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentSource, handleFailover, sourceHeaders, isChecking, isEmbed, playbackType]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = volume;
    videoRef.current.muted = isMuted;
  }, [volume, isMuted, currentSource]);

  const nextSource = () => {
    if (currentIndex < validSources.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0); // Loop back
    }
  };

  // Controls Visibility Timeout — mouse + touch
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
    };
  }, [isPlaying]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setCurrentTime(current);
      setDuration(total || 0);
      
      // Safety check for live streams or empty duration
      if (total && total > 0) {
        setProgress((current / total) * 100);
      } else {
        setProgress(0);
      }
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = (parseFloat(e.target.value) / 100) * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setProgress(parseFloat(e.target.value));
    }
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

  if (isChecking) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-3xl flex flex-col items-center justify-center border border-gray-800">
        <Loader2 className="animate-spin text-yellow-500 mb-4" size={48} />
        <p className="text-gray-400">Verificando fuentes disponibles...</p>
      </div>
    );
  }

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
            onClick={togglePlay}
            className="w-full h-full cursor-pointer"
            playsInline
          />
          {!isPlaying && (
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              onClick={togglePlay}
            >
              <div className="bg-yellow-500/20 backdrop-blur-sm p-8 rounded-full border border-yellow-500/50 animate-pulse">
                <Play size={64} fill="#EAB308" className="text-yellow-500 ml-2" />
              </div>
            </div>
          )}
        </>
      )}

      {/* Header Info */}
      <div className={`absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-500 ${showControls ? "opacity-100" : "opacity-0"}`}>
        <div className="p-8 flex items-center justify-between">
          <div />
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
                    title={source.url}
                  >
                    <Server size={12} className="inline mr-1" />
                    {index + 1}
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

      {/* Custom Controls - Only show for direct streams */}
      {!isEmbed && !hasError && (
        <div className={`absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-8 transition-opacity duration-500 ${showControls ? "opacity-100" : "opacity-0"}`}>
          <div className="relative w-full mb-6 group/bar">
            <input
              type="range"
              min="0"
              max="100"
              value={progress || 0}
              onChange={seek}
              style={{ touchAction: "none" }}
              className="w-full h-2 md:h-1 bg-gray-600 rounded-full appearance-none cursor-pointer accent-yellow-500 md:hover:h-2 transition-all"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <button onClick={togglePlay} className="text-white hover:text-yellow-500 transform hover:scale-110 transition-all">
                {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
              </button>
              
              <div className="flex items-center gap-6">
                <button onClick={() => skip(-10)} className="text-white hover:text-yellow-500 transition-all">
                  <RotateCcw size={28} />
                </button>
                <button onClick={() => skip(10)} className="text-white hover:text-yellow-500 transition-all">
                  <RotateCw size={28} />
                </button>
              </div>

              <div className="flex items-center gap-4 group/vol">
                <button onClick={() => setIsMuted(!isMuted)} className="text-white hover:text-yellow-500">
                  {isMuted || volume === 0 ? <VolumeX size={28} /> : <Volume2 size={28} />}
                </button>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={volume} 
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-0 group-hover/vol:w-24 transition-all accent-yellow-500 appearance-none h-1 bg-gray-600 rounded-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-8">
              <button onClick={toggleFullScreen} className="text-white hover:text-yellow-500 transition-all">
                <Maximize size={28} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
