import { AppShell } from "@/components/app-shell";
import { Board } from "@/components/board";

const pieceCopy: Record<
  string,
  {
    title: string;
    description: string;
    status: string;
    isPlayable: boolean;
  }
> = {
  rook: {
    title: "Torre",
    description: "Primer vertical slice jugable: tablero responsive, coordenadas y movimiento legal de Torre en tablero vacio.",
    status: "Playable MVP",
    isPlayable: true,
  },
  bishop: {
    title: "Alfil",
    description: "Ruta reservada para diagonales. Se implementa despues de cerrar Torre y on-chain proof.",
    status: "Pendiente M4",
    isPlayable: false,
  },
  knight: {
    title: "Caballo",
    description: "Ruta reservada para movimientos en L. No se activa hasta cerrar la ruta critica principal.",
    status: "Pendiente M4",
    isPlayable: false,
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
    isPlayable: false,
  };

  return (
    <AppShell
      eyebrow="Play"
      title={piece.title}
      description={piece.description}
      cta={piece.isPlayable ? { href: "/result", label: "Ver resultado placeholder" } : undefined}
      secondaryCta={{ href: "/levels", label: "Cambiar pieza" }}
    >
      {piece.isPlayable ? (
        <Board />
      ) : (
        <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            {piece.status}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            El board renderer jugable se activa primero para Torre. Esta pieza sigue reservada para un slice posterior.
          </p>
        </div>
      )}
    </AppShell>
  );
}
