import { ImageResponse } from "next/og";
import sharp from "sharp";
import { CardShell } from "@/lib/og/card-shell";
import { loadCinzelFont } from "@/lib/og/font-loader";
import { sanitizeName, readSearchParams } from "@/lib/og/validators";

export const runtime = "nodejs";

const W = 1200;
const H = 630;

const SUCCESS_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  "CDN-Cache-Control": "public, s-maxage=3600",
};

export async function GET(req: Request) {
  const qs = readSearchParams(req);
  const from = sanitizeName(qs.get("from"), 20);

  const bgUrl = new URL("/art/redesign/bg/bg-ch.png", req.url).toString();
  const mascotUrl = new URL("/art/favicon-wolf.png", req.url).toString();
  const badgeUrl = new URL("/art/badge-chesscito.png", req.url).toString();

  const cinzelData = await loadCinzelFont(req.url);
  const useCinzel = Boolean(cinzelData);

  const subtitle = from
    ? `${from} is playing Chesscito.`
    : "Learn chess on Celo.";

  const pngResponse = new ImageResponse(
    (
      <CardShell
        bgUrl={bgUrl}
        mascotUrl={mascotUrl}
        title="PLAY WITH ME"
        subtitle={subtitle}
        footer="chesscito.vercel.app"
        useCinzel={useCinzel}
        rightSlot={
          <div
            style={{
              position: "relative",
              display: "flex",
              width: 360,
              height: 360,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 360,
                height: 360,
                borderRadius: 9999,
                background:
                  "radial-gradient(circle, rgba(245, 158, 11, 0.30) 0%, rgba(217, 180, 74, 0.12) 50%, transparent 80%)",
                display: "flex",
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={badgeUrl}
              alt=""
              width={300}
              height={300}
              style={{
                position: "relative",
                filter: "drop-shadow(0 10px 20px rgba(120, 65, 5, 0.35))",
              }}
            />
          </div>
        }
      />
    ),
    {
      width: W,
      height: H,
      ...(cinzelData
        ? {
            fonts: [{
              name: "Cinzel",
              data: cinzelData,
              weight: 700 as const,
              style: "normal" as const,
            }],
          }
        : {}),
    },
  );

  const pngBuffer = Buffer.from(await pngResponse.arrayBuffer());
  const jpegBuffer = await sharp(pngBuffer).jpeg({ quality: 80 }).toBuffer();

  return new Response(new Uint8Array(jpegBuffer), {
    headers: {
      "Content-Type": "image/jpeg",
      ...SUCCESS_HEADERS,
    },
  });
}
