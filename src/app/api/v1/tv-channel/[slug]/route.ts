import { NextRequest, NextResponse } from "next/server";
import { getChannelPage, getChannelEmbedUrl } from "@/lib/teleonline";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { success: false, message: "Slug de canal invalido" },
        { status: 400 }
      );
    }

    const channelData = await getChannelPage(slug);

    return NextResponse.json({
      success: true,
      data: {
        slug,
        name: channelData.channel_name,
        logo: channelData.logo,
        post_id: channelData.post_id,
        embed_url: getChannelEmbedUrl(slug),
        page_url: `https://teleonline.org/canal/${slug}/`,
        has_post_id: !!channelData.post_id,
        epg_available: !!channelData.post_id,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
