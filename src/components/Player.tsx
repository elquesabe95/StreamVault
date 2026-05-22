"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Loader2, 
  RotateCcw, 
  RotateCw,
  Settings,
  Tv
} from "lucide-react";

interface PlayerProps {
  url: string;
  title?: string;
}

export default function Player({ url, title }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls on mouse idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowSpeedMenu(false);
      }
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  // Setup Video Player (HLS or Native MP4)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    // Check if it's an iframe
    if (!url.includes(".m3u8") && !url.includes(".mp4")) {
      return;
    }

    setIsLoading(true);
    setIsPlaying(false);
    setCurrentTime(0);

    let hls: Hls | null = null;

    if (url.includes(".m3u8")) {
      if (Hls.isSupported()) {
        hls = new Hls({
          maxMaxBufferLength: 30,
          enableWorker: true,
          lowLatencyMode: true,
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log("Fatal network error encountered, trying to recover...");
                hls?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log("Fatal media error encountered, trying to recover...");
                hls?.recoverMediaError();
                break;
              default:
                console.error("Fatal HLS error, unrecoverable");
                break;
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS for Safari
        video.src = url;
        video.addEventListener("loadedmetadata", () => {
          setIsLoading(false);
        });
      }
    } else {
      // Native MP4
      video.src = url;
      video.addEventListener("loadedmetadata", () => {
        setIsLoading(false);
      });
    }

    // Event Listeners
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration);
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);

    return () => {
      if (hls) {
        hls.destroy();
      }
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
    };
  }, [url]);

  // Controls Logic
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(e => console.log("Play failed", e));
    }
  };

  const skip = (amount: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + amount), duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.volume = val;
    setVolume(val);
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMute = !isMuted;
    video.muted = nextMute;
    setIsMuted(nextMute);
    if (!nextMute && volume === 0) {
      video.volume = 0.5;
      setVolume(0.5);
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error("Fullscreen error:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const changeSpeed = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  // Helper formatting function
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const hrs = Math.floor(time / 3600);
    const mins = Math.floor((time % 3600) / 60);
    const secs = Math.floor(time % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Render iframe fallback if url is not direct stream
  if (!url.includes(".m3u8") && !url.includes(".mp4")) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-gray-800">
        <iframe
          src={url}
          className="absolute inset-0 w-full h-full"
          allowFullScreen
          scrolling="no"
          allow="autoplay; encrypted-media"
        />
        <div className="absolute top-4 left-4 bg-purple-600/90 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 border border-purple-500/30">
          <Tv className="w-3.5 h-3.5" />
          Modo Iframe (Respaldo)
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying) {
          setShowControls(false);
          setShowSpeedMenu(false);
        }
      }}
      className="w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-gray-800/80 relative group select-none"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
      />

      {/* Dark Gradient Overlay for top/bottom controls legibility */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity duration-300 pointer-events-none ${showControls ? "opacity-100" : "opacity-0"}`} />

      {/* Center Spinner/Big Play Overlay */}
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md p-5 rounded-full border border-gray-800">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
          </div>
        </div>
      ) : !isPlaying ? (
        <div 
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
        >
          <div className="bg-purple-600/95 hover:bg-purple-500 text-white p-6 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 border border-purple-400/40 hover:shadow-purple-500/20 active:scale-95">
            <Play className="w-8 h-8 fill-white translate-x-0.5" />
          </div>
        </div>
      ) : null}

      {/* Top Header Information */}
      <div className={`absolute top-4 left-4 right-4 flex items-center justify-between transition-all duration-300 ${showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}`}>
        <div className="bg-green-600/90 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg border border-green-500/30">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Stream Directo (Sin Anuncios)
        </div>
        
        {title && (
          <h2 className="text-sm font-semibold text-white bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-gray-800/40 shadow-lg max-w-[50%] truncate">
            {title}
          </h2>
        )}
      </div>

      {/* Custom Bottom Control Bar */}
      <div className={`absolute bottom-4 left-4 right-4 bg-black/40 backdrop-blur-xl border border-gray-800/40 rounded-2xl p-4 flex flex-col gap-3 transition-all duration-300 shadow-2xl ${showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>
        
        {/* Progress Bar/Timeline */}
        <div className="flex items-center gap-3 group/slider w-full">
          <span className="text-xs font-medium text-gray-300 w-12 text-right">
            {formatTime(currentTime)}
          </span>
          <div className="relative flex-grow flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-gray-700/60 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 focus:outline-none transition-all"
              style={{
                background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${(currentTime / (duration || 1)) * 100}%, rgba(55, 65, 81, 0.6) ${(currentTime / (duration || 1)) * 100}%, rgba(55, 65, 81, 0.6) 100%)`
              }}
            />
          </div>
          <span className="text-xs font-medium text-gray-300 w-12 text-left">
            {formatTime(duration)}
          </span>
        </div>

        {/* Buttons & Sliders */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button 
              onClick={togglePlay}
              className="text-white hover:text-purple-400 transition-colors p-1"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            {/* Skip Back 10s */}
            <button 
              onClick={() => skip(-10)}
              className="text-white hover:text-purple-400 transition-colors p-1"
              title="Retroceder 10s"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Skip Forward 10s */}
            <button 
              onClick={() => skip(10)}
              className="text-white hover:text-purple-400 transition-colors p-1"
              title="Adelantar 10s"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group/volume">
              <button 
                onClick={toggleMute}
                className="text-white hover:text-purple-400 transition-colors p-1"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover/volume:w-20 transition-all duration-300 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 focus:outline-none"
                style={{
                  background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${(isMuted ? 0 : volume) * 100}%, rgba(55, 65, 81, 0.6) ${(isMuted ? 0 : volume) * 100}%, rgba(55, 65, 81, 0.6) 100%)`
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 relative">
            {/* Speed Control */}
            <button 
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="text-white hover:text-purple-400 transition-colors p-1 flex items-center gap-1 text-xs font-semibold uppercase bg-white/10 px-2.5 py-1 rounded-lg border border-white/5 active:scale-95"
              title="Velocidad de reproducción"
            >
              <Settings className="w-4 h-4" />
              <span>{playbackRate}x</span>
            </button>

            {showSpeedMenu && (
              <div className="absolute bottom-12 right-12 bg-gray-900/95 backdrop-blur-xl border border-gray-800 rounded-xl p-2 flex flex-col gap-1 w-28 shadow-2xl z-50 text-xs font-semibold text-gray-200">
                {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => changeSpeed(rate)}
                    className={`px-3 py-1.5 rounded-lg text-left transition-colors ${playbackRate === rate ? "bg-purple-600 text-white font-bold" : "hover:bg-white/10"}`}
                  >
                    {rate}x {rate === 1 && "(Norm)"}
                  </button>
                ))}
              </div>
            )}

            {/* Fullscreen */}
            <button 
              onClick={toggleFullscreen}
              className="text-white hover:text-purple-400 transition-colors p-1"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
