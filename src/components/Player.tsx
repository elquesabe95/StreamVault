"use client";

import { useEffect, useRef } from "react";

interface PlayerProps {
  url: string;
  title?: string;
}

declare global {
  interface Window {
    jwplayer: any;
  }
}

export default function Player({ url, title }: PlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!url) return;

    // If it's an iframe (fallback), we just render the iframe
    if (!url.includes(".m3u8") && !url.includes(".mp4")) {
      return;
    }

    // Load JWPlayer (Assumes the script is in layout or public/index.html)
    if (window.jwplayer && playerRef.current) {
      window.jwplayer(playerRef.current).setup({
        file: url,
        title: title || "Streamix Player",
        width: "100%",
        aspectratio: "16:9",
        autostart: true,
        primary: "html5",
        hlsjsConfig: {
          enableWorker: true,
        },
        // You can add your license key here
        // key: "YOUR_JWPLAYER_KEY"
      });
    }
  }, [url, title]);

  // Handle iframe fallback (for sources we couldn't de-obfuscate yet)
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
        <div className="absolute top-4 left-4 bg-purple-600/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold">
          Modo Iframe (Respaldo)
        </div>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-gray-800 relative group">
      <div ref={playerRef} id="jw-player-container" className="w-full h-full">
        {/* If JWPlayer script is missing, show a nice message */}
        <div className="flex flex-col items-center justify-center h-full text-gray-500 italic">
          <p>Cargando JWPlayer...</p>
          <p className="text-xs mt-2">(Asegúrate de incluir el script de JWPlayer en tu layout)</p>
        </div>
      </div>
      <div className="absolute top-4 left-4 bg-green-600/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        Stream Directo (Sin Anuncios)
      </div>
    </div>
  );
}
