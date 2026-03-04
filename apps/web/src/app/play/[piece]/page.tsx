import { AppShell } from "@/components/app-shell";

const pieceCopy: Record<string, { title: string; description: string; status: string }> = {
  rook: {
    title: "Torre",
    description: "Aqui viviran el tutorial y el challenge de Torre. En este slice solo dejamos el slot, la ruta y el framing movil.",
    status: "Primera pieza jugable",
  },
  bishop: {
    title: "Alfil",
    description: "Ruta reservada para diagonales. Se implementa despues de cerrar Torre y on-chain proof.",
    status: "Pendiente M4",
  },
  knight: {
    title: "Caballo",
    description: "Ruta reservada para movimientos en L. No se activa hasta cerrar la ruta critica principal.",
    status: "Pendiente M4",
  },
};

export default function PlayPiecePage({
  params,
}: {
  params: { piece: string };
}) {
  const piece = pieceCopy[params.piece] ?? {
    title: "Pieza desconocida",
    description: "Esta ruta existe para soportar el esquema del juego, pero la pieza aun no esta configurada.",
    status: "Sin configurar",
  };

  return (
    <AppShell
      eyebrow="Play"
      title={piece.title}
      description={piece.description}
      cta={{ href: "/result", label: "Ver resultado placeholder" }}
      secondaryCta={{ href: "/levels", label: "Cambiar pieza" }}
    >
      <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          {piece.status}
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          El board renderer, rules engine y challenge se agregan en los siguientes PRs.
        </p>
      </div>
    </AppShell>
  );
}
