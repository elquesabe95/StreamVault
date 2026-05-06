import { NextRequest, NextResponse } from "next/server";
import { getCountries } from "@/lib/teleonline";

export async function GET() {
  try {
    const countries = await getCountries();
    
    // Add Animux as a premium source
    countries.unshift({
      name: "Animux Premium (Latino)",
      slug: "animux",
      flag_url: "https://animux.site/favicon.ico",
      channel_count: 500
    });

    return NextResponse.json({
      success: true,
      data: countries,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
