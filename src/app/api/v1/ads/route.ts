import { NextResponse } from "next/server";

// Custom ad management API
// Ads are served before content starts playing (pre-roll)

interface CustomAd {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  clickUrl?: string;
  duration: number;
  active: boolean;
  priority: number;
}

// Default ads (can be customized via environment variables or this file)
const DEFAULT_ADS: CustomAd[] = [
  {
    id: "sv-premium",
    title: "StreamVault Premium",
    description: "Disfruta sin interrupciones con StreamVault Premium. Miles de series y peliculas en HD.",
    clickUrl: "",
    duration: 5,
    active: true,
    priority: 1,
  },
  {
    id: "tveo-site",
    title: "TVeo - Tu Streaming Favorito",
    description: "Visita tveo.site para mas contenido en vivo y bajo demanda.",
    clickUrl: "https://tveo.site",
    duration: 5,
    active: true,
    priority: 2,
  },
];

function getAdsFromEnv(): CustomAd[] {
  const envAds = process.env.CUSTOM_ADS;
  if (!envAds) return DEFAULT_ADS;
  try {
    return JSON.parse(envAds);
  } catch {
    return DEFAULT_ADS;
  }
}

export async function GET() {
  const ads = getAdsFromEnv()
    .filter((ad) => ad.active)
    .sort((a, b) => a.priority - b.priority);

  const ad = ads.length > 0 ? ads[Math.floor(Math.random() * ads.length)] : null;

  return NextResponse.json({
    success: true,
    data: {
      ad,
      settings: {
        adEnabled: process.env.ADS_ENABLED !== "false",
        adDuration: 5,
        skipAfter: 3,
        showAds: true,
      },
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.title || !body.duration) {
      return NextResponse.json(
        { success: false, message: "Se requieren: title, duration" },
        { status: 400 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Ad configurado correctamente",
      data: {
        id: `custom-${Date.now()}`,
        ...body,
        active: true,
        priority: body.priority || 10,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Error al procesar la solicitud" },
      { status: 400 }
    );
  }
}
