import { NextRequest, NextResponse } from "next/server";
import { getChannelEPG } from "@/lib/teleonline";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("post_id");

    if (!postId || !/^\d+$/.test(postId)) {
      return NextResponse.json(
        { success: false, message: "Parametro 'post_id' es requerido (numero entero)" },
        { status: 400 }
      );
    }

    const epg = await getChannelEPG(parseInt(postId));

    return NextResponse.json(epg);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
