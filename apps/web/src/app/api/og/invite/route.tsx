import { ImageResponse } from "next/og";
import sharp from "sharp";
import { CardShell, CARD_WIDTH as W, CARD_HEIGHT as H } from "@/lib/og/card-shell";
import { loadCinzelFont } from "@/lib/og/font-loader";
import { sanitizeName, readSearchParams } from "@/lib/og/validators";
import { resolveOgThemeAsset } from "@/lib/og/theme-assets";

export const runtime = "nodejs";

const SUCCESS_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  "CDN-Cache-Control": "public, s-maxage=3600",
};

export async function GET(req: Request) {
  const qs = readSearchParams(req);
  const from = sanitizeName(qs.get("from"), 20);

  // PNG (RGBA). WebP rendered empty in Satori; PNGs work after the
  // colormap → RGBA re-encode in adb19ae4.
  // avatar-confiado (smirk challenger) addresses the visitor being
  // invited to play — see feedback_avatar_emotion_selection.
  const mascotUrl = resolveOgThemeAsset(req.url, "shared.feedback-confident");
  const panelBgUrl = resolveOgThemeAsset(req.url, "shared.mission-panel");
  // Hero — the candy-forest invite icon (envelope + knight card +
  // pawn). On-brand 3D scene that reads as "invitation to play".
  // Triplet at /art/hub-new/invite-icon.{avif,webp,png}.
  const heroUrl = resolveOgThemeAsset(req.url, "hub.invite-icon");

  const cinzelData = await loadCinzelFont(req.url);
  const useCinzel = Boolean(cinzelData);

  const chip = "Play with me";
  const footer = from
    ? `chesscito.com \u2022 by ${from}`
    : "chesscito.com";

  // Hero — invite-icon. No amber radial-gradient halo: the icon
  // carries its own relief drop-shadow filter, and dropping the extra
  // layer keeps the @vercel/og render lean.
  const heroSlot = (
    <div
      style={{
        display: "flex",
        width: 860,
        height: 860,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {heroUrl ? <img
        src={heroUrl}
        alt=""
        width={620}
        height={620}
        style={{
          filter: "drop-shadow(0 16px 30px rgba(120, 65, 5, 0.45))",
        }}
      /> : null}
    </div>
  );

  const pngResponse = new ImageResponse(
    (
      <CardShell
        bgUrl={null}
        panelBgUrl={panelBgUrl}
        mascotUrl={mascotUrl}
        chip={chip}
        footer={footer}
        useCinzel={useCinzel}
        mascotMode="half-body"
        mascotScale={0.55}
        softenPanel
        heroSlot={heroSlot}
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
