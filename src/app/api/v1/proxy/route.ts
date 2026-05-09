import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("No URL provided", { status: 400 });

  try {
    const response = await fetch(url, {
      headers: {
        "Referer": "https://teleonline.org/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    const contentType = response.headers.get("content-type");
    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType || "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
      }
    });
  } catch (error) {
    return new NextResponse("Proxy Error", { status: 500 });
  }
}
