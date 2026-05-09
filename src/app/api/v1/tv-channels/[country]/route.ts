import { NextRequest, NextResponse } from "next/server";
import { getChannelsByCountry } from "@/lib/teleonline";
import { getAnimuxChannels } from "@/lib/scrapers/animux";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ country: string }> }
) {
  try {
    const { country } = await params;

    if (!country || !/^[a-z0-9-]+$/.test(country)) {
      return NextResponse.json(
        { success: false, message: "Codigo de pais invalido. Usa solo letras minusculas y guiones." },
        { status: 400 }
      );
    }

    let channels: any[] = [];
    if (country === "animux") {
      const animuxData = await getAnimuxChannels();
      channels = animuxData.map(ch => ({
        slug: ch.id,
        name: ch.name,
        country: "Animux",
        country_slug: "animux",
        logo: ch.logo,
        url: ch.url,
        category: ch.category,
        provider: "Animux"
      }));
    } else {
      channels = await getChannelsByCountry(country);
    }

    return NextResponse.json({
      success: true,
      country,
      count: channels.length,
      data: channels,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
