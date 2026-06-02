"use client";

import type { ReactNode } from "react";

import { PrincipalButton } from "@/components/scene-rooted/principal-button";

type Verdict =
  | "unified"
  | "unified-blue"
  | "unified-cream"
  | "propose"
  | "decision"
  | "candidate"
  | "keep";

const VERDICT_LABEL: Record<Verdict, string> = {
  unified: "UNIFICADO VERDE",
  "unified-blue": "UNIFICADO AZUL",
  "unified-cream": "UNIFICADO CREMA",
  propose: "PROPUESTA · DECIDE",
  decision: "REQUIERE DECISIÓN",
  candidate: "CANDIDATO A MIGRAR",
  keep: "MANTENER DISTINTO",
};

const VERDICT_COLOR: Record<Verdict, string> = {
  unified: "rgba(34, 139, 34, 0.92)",
  "unified-blue": "rgba(20, 100, 170, 0.92)",
  "unified-cream": "rgba(180, 130, 50, 0.92)",
  propose: "rgba(232, 132, 18, 0.92)",
  decision: "rgba(124, 58, 237, 0.92)",
  candidate: "rgba(232, 132, 18, 0.92)",
  keep: "rgba(120, 65, 15, 0.92)",
};

function ButtonCard({
  title,
  classNames,
  role,
  verdict,
  notes,
  children,
}: {
  title: string;
  classNames: string;
  role: string;
  verdict: Verdict;
  notes?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        padding: "1rem",
        borderRadius: "0.875rem",
        background: "rgba(255, 248, 222, 0.9)",
        border: "1px solid rgba(180, 120, 35, 0.35)",
        boxShadow: "0 2px 6px rgba(110, 65, 15, 0.10)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <strong style={{ color: "rgba(63, 34, 8, 0.95)", fontSize: "0.95rem" }}>{title}</strong>
        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 800,
            letterSpacing: "0.04em",
            padding: "0.2rem 0.55rem",
            borderRadius: "9999px",
            background: VERDICT_COLOR[verdict],
            color: "#fff8de",
          }}
        >
          {VERDICT_LABEL[verdict]}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "96px",
          padding: "1rem 0.5rem",
          borderRadius: "0.625rem",
          background: "rgba(245, 230, 195, 0.55)",
        }}
      >
        {children}
      </div>

      <code
        style={{
          fontSize: "0.72rem",
          fontFamily: "ui-monospace, monospace",
          color: "rgba(63, 34, 8, 0.85)",
          background: "rgba(255, 255, 255, 0.55)",
          padding: "0.3rem 0.5rem",
          borderRadius: "0.375rem",
          wordBreak: "break-all",
        }}
      >
        {classNames}
      </code>

      <p style={{ fontSize: "0.78rem", color: "rgba(63, 34, 8, 0.85)", margin: 0, lineHeight: 1.35 }}>
        {role}
      </p>

      {notes ? (
        <p style={{ fontSize: "0.72rem", color: "rgba(150, 80, 10, 0.85)", margin: 0, fontStyle: "italic" }}>
          {notes}
        </p>
      ) : null}
    </div>
  );
}

function SectionHeader({ label, badge }: { label: string; badge: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        margin: "1.25rem 0 0.5rem",
      }}
    >
      <span style={{ fontSize: "1.1rem" }}>{badge}</span>
      <h2 style={{ margin: 0, fontSize: "1rem", color: "rgba(63, 34, 8, 0.95)", letterSpacing: "0.04em" }}>
        {label}
      </h2>
    </div>
  );
}

export default function ButtonGalleryPage() {
  return (
    <div
      style={{
        maxWidth: "var(--app-max-width, 390px)",
        margin: "0 auto",
        padding: "1.25rem 1rem 4rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      <h1 style={{ fontSize: "1.25rem", margin: 0, color: "rgba(63, 34, 8, 0.95)" }}>
        Button gallery
      </h1>
      <p style={{ fontSize: "0.82rem", color: "rgba(63, 34, 8, 0.75)", margin: 0 }}>
        Cada tarjeta muestra el botón real + class name + rol + veredicto de
        migración.
      </p>

      <div
        style={{
          marginTop: "0.5rem",
          padding: "0.75rem 1rem",
          borderRadius: "0.625rem",
          background: "rgba(255, 248, 222, 0.85)",
          border: "1px solid rgba(180, 120, 35, 0.45)",
          fontSize: "0.75rem",
          color: "rgba(63, 34, 8, 0.92)",
          lineHeight: 1.45,
        }}
      >
        <strong style={{ display: "block", marginBottom: "0.3rem", letterSpacing: "0.03em" }}>
          REGLA SEMÁNTICA
        </strong>
        <span style={{ color: "rgb(40, 110, 30)" }}>● Verde</span> = practicar / continuar<br />
        <span style={{ color: "rgb(20, 100, 170)" }}>● Azul</span> = competir<br />
        <span style={{ color: "rgb(180, 130, 50)" }}>● Crema</span> = secundario (no compite)<br />
        <span style={{ color: "rgb(200, 140, 20)" }}>● Dorado</span> = ganar / desbloquear / premio
        <span style={{ opacity: 0.6 }}> (pendiente mintar)</span>
      </div>

      {/* ───────── UNIFIED ───────── */}
      <SectionHeader label="Ya unificados con --cta-primary-green-grad" badge="✅" />

      <ButtonCard
        title="Arena entry PLAY"
        classNames=".primary-play-cta .primary-play-cta--green-css .primary-play-cta--arena-entry"
        role="Botón dominante en /arena (entrada con selector de dificultad)"
        verdict="unified"
      >
        <button
          type="button"
          className="primary-play-cta primary-play-cta--green-css primary-play-cta--arena-entry"
        >
          <span className="primary-play-cta-label">PLAY</span>
        </button>
      </ButtonCard>

      <ButtonCard
        title="Popup PLAY (resigned / victory / error)"
        classNames=".arena-result-primary-cta .arena-result-primary-cta--amber .arena-result-primary-cta--inset"
        role="PLAY al pie del popup de fin de partida"
        verdict="unified"
      >
        <button
          type="button"
          className="arena-result-primary-cta arena-result-primary-cta--amber arena-result-primary-cta--inset"
        >
          <span className="arena-result-primary-cta-label">PLAY</span>
        </button>
      </ButtonCard>

      <ButtonCard
        title="<PrincipalButton> (Connect Wallet / continue / claim)"
        classNames=".principal-button.principal-button-medium"
        role="Componente compartido: trophies, PRO sheet, badge, victory page, mission briefing, ask-coach, action-pin"
        verdict="unified"
      >
        <PrincipalButton size="medium" onClick={() => {}}>
          Connect Wallet
        </PrincipalButton>
      </ButtonCard>

      {/* ───────── CANDIDATES ───────── */}
      <SectionHeader label="Unificados — hub / landing / rescue" badge="✅" />

      <ButtonCard
        title="Hub → Arena CTA"
        classNames=".primary-play-cta .primary-play-cta--playhub .hub-scaffold-arena-cta"
        role="Entrada a /arena desde el Hub. Twin azul del verde unificado."
        verdict="unified-blue"
        notes="Migrado a --cta-primary-blue-* (mirror exacto del verde en azul saturado)."
      >
        <button
          type="button"
          className="primary-play-cta primary-play-cta--playhub hub-scaffold-arena-cta"
          style={{ minHeight: 78 }}
        >
          <span className="primary-play-cta-label" style={{ fontSize: "0.85rem" }}>ARENA</span>
        </button>
      </ButtonCard>

      <ButtonCard
        title="Hub → Practice CTA"
        classNames=".primary-play-cta .primary-play-cta--playhub .hub-scaffold-practice-cta"
        role="Entrada a /exercises desde el Hub. Sibling del arena CTA."
        verdict="unified"
        notes="Migrado al verde unificado (mismo tono que /arena PLAY)."
      >
        <button
          type="button"
          className="primary-play-cta primary-play-cta--playhub hub-scaffold-practice-cta"
          style={{ minHeight: 78 }}
        >
          <span className="primary-play-cta-label" style={{ fontSize: "0.85rem" }}>PIECES</span>
        </button>
      </ButtonCard>

      <ButtonCard
        title="Fail rescue modal primary"
        classNames=".fail-rescue-modal-primary"
        role="CTA principal del modal de rescate al fallar un ejercicio."
        verdict="unified"
        notes="Migrado al verde unificado. Si necesitamos ámbar/dorado más adelante, mintamos --cta-primary-amber-* sobre la misma estructura."
      >
        <button type="button" className="fail-rescue-modal-primary">
          <span className="fail-rescue-modal-primary-label">Retry</span>
        </button>
      </ButtonCard>

      <ButtonCard
        title="Landing green CTA"
        classNames=".landing-green-cta .landing-green-cta--large"
        role="CTA principal de la landing marketing (/)"
        verdict="unified"
        notes="Migrado al verde unificado (landing ↔ app misma marca)."
      >
        <button type="button" className="landing-green-cta landing-green-cta--large">
          Play now
        </button>
      </ButtonCard>

      {/* ───────── UNIFIED CREMA ───────── */}
      <SectionHeader label="Unificados — familia CREMA secundaria" badge="✅" />

      <ButtonCard
        title="Fail rescue secondary — template del CREMA"
        classNames=".fail-rescue-modal-secondary"
        role="Botón secundario del modal de rescate. Texto real: 'Retry anyway'."
        verdict="unified-cream"
        notes="Tokenizado: consume --cta-secondary-cream-* (grad/border/bevel/color/text-shadow). Referencia canónica de la familia crema."
      >
        <button type="button" className="fail-rescue-modal-secondary">
          Retry anyway
        </button>
      </ButtonCard>

      <ButtonCard
        title="Soft-gate primary — PIECES (→ verde)"
        classNames=".arena-scaffold-soft-gate-primary"
        role="Modal '¿Want a warm-up first?'. Lleva a /exercises (practica una pieza)."
        verdict="unified"
        notes="Migrado al VERDE (semántica: practicar)."
      >
        <button type="button" className="arena-scaffold-soft-gate-primary">
          PIECES
        </button>
      </ButtonCard>

      <ButtonCard
        title="Soft-gate secondary — ARENA (→ crema)"
        classNames=".arena-scaffold-soft-gate-secondary"
        role="Misma modal, opción 'skip the warm-up' que entra directo a /arena."
        verdict="unified-cream"
        notes="Migrado al CREMA (es el 'no quiero el warm-up' = secundario, no compite)."
      >
        <button type="button" className="arena-scaffold-soft-gate-secondary">
          ARENA
        </button>
      </ButtonCard>

      {/* ───────── KEEP DISTINCT ───────── */}
      <SectionHeader label="Mantener distintos (preservan semántica)" badge="❌" />

      <ButtonCard
        title="Coach viewer tile — Play again"
        classNames='.coach-viewer__tile[data-kind="play-again"]'
        role="Tile flotante en /coach/[gameId]. El asset PNG ES el botón (icon-as-button)."
        verdict="keep"
        notes="Decisión Wolfcito: mantener vocabulary distinto. El asset pintado lleva el peso visual; no es una pill CSS."
      >
        <button type="button" className="coach-viewer__tile" data-kind="play-again">
          <picture className="coach-viewer__tile-icon">
            <source srcSet="/art/new-assets-chesscito/btns/play-again-icon.avif" type="image/avif" />
            <source srcSet="/art/new-assets-chesscito/btns/play-again-icon.webp" type="image/webp" />
            <img src="/art/new-assets-chesscito/btns/play-again-icon.png" alt="" draggable={false} />
          </picture>
          <span className="coach-viewer__tile-label">Play again</span>
        </button>
      </ButtonCard>

      <ButtonCard
        title="Coach viewer tile — Ask Coach"
        classNames='.coach-viewer__tile[data-kind="ask-coach"]'
        role="Mismo patrón que Play again — icono pintado + label cream."
        verdict="keep"
        notes="Decisión Wolfcito: mantener icon-as-button. La identidad Coach (violeta) la lleva el asset, no el contenedor."
      >
        <button type="button" className="coach-viewer__tile" data-kind="ask-coach">
          <picture className="coach-viewer__tile-icon">
            <source srcSet="/art/new-assets-chesscito/btns/ask-coach-icon.avif" type="image/avif" />
            <source srcSet="/art/new-assets-chesscito/btns/ask-coach-icon.webp" type="image/webp" />
            <img src="/art/new-assets-chesscito/btns/ask-coach-icon.png" alt="" draggable={false} />
          </picture>
          <span className="coach-viewer__tile-label">Ask Coach</span>
        </button>
      </ButtonCard>

      <ButtonCard
        title="Shop buy pill — green (USD)"
        classNames=".shop-item-tile-buy-pill .shop-item-tile-buy-pill--green"
        role="Confirmar compra en USD (Shop)"
        verdict="keep"
        notes="Vive en familia 3-color (green/yellow/purple). Migrar rompe simetría con CELO y Coach."
      >
        <button type="button" className="shop-item-tile-buy-pill shop-item-tile-buy-pill--green candy-tray-pill">
          $1.99
        </button>
      </ButtonCard>

      <ButtonCard
        title="Shop buy pill — yellow (CELO)"
        classNames=".shop-item-tile-buy-pill .shop-item-tile-buy-pill--yellow"
        role="Confirmar compra en CELO"
        verdict="keep"
        notes="Peer del verde shop — referencia visual."
      >
        <button type="button" className="shop-item-tile-buy-pill shop-item-tile-buy-pill--yellow candy-tray-pill">
          Pay with CELO
        </button>
      </ButtonCard>

      <ButtonCard
        title="Coach pill — purple"
        classNames=".shop-item-tile-buy-pill--purple .candy-tray-pill"
        role="Acción de Coach (Ask Coach) — identidad violeta"
        verdict="keep"
        notes="Purple es la firma de Coach en TODA la app. Verde colapsa esa identidad."
      >
        <button type="button" className="shop-item-tile-buy-pill shop-item-tile-buy-pill--purple candy-tray-pill">
          Ask Coach
        </button>
      </ButtonCard>

      <ButtonCard
        title="Arena result primary — amber (legacy name)"
        classNames=".arena-result-primary-cta .arena-result-primary-cta--amber"
        role="CTA primario dentro del popup (Save Victory / Mint Victory). Twin del arena PLAY."
        verdict="unified"
        notes="Migrado al verde unificado + dimensiones gemelas (52px / 14px / 1.1rem). El nombre --amber queda como legacy."
      >
        <button type="button" className="arena-result-primary-cta arena-result-primary-cta--amber">
          <span className="arena-result-primary-cta-label">Save Victory</span>
        </button>
      </ButtonCard>

      <div style={{ marginTop: "2rem", padding: "1rem", borderRadius: "0.625rem", background: "rgba(63, 34, 8, 0.05)", border: "1px dashed rgba(110, 65, 15, 0.35)" }}>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "rgba(63, 34, 8, 0.75)", lineHeight: 1.4 }}>
          <strong>Recordatorio:</strong> esta página es para revisión visual.
          Toda la decisión queda en chat. Mark <code>.dev/button-gallery</code> for
          deletion when terminamos la migración.
        </p>
      </div>
    </div>
  );
}
