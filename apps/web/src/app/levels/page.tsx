import { AppShell } from "@/components/app-shell";

const levels = [
  {
    piece: "Torre",
    href: "/play/rook",
    status: "MVP",
    description: "Aprende lineas rectas, control de columnas y capturas basicas.",
  },
  {
    piece: "Alfil",
    href: "/play/bishop",
    status: "Stretch",
    description: "Ruta reservada para diagonales en la siguiente fase.",
  },
  {
    piece: "Caballo",
    href: "/play/knight",
    status: "Stretch",
    description: "Ruta reservada para patrones en L y vision tactica.",
  },
];

export default function LevelsPage() {
  return (
    <AppShell
      eyebrow="Levels"
      title="Escoge una pieza"
      description="La ruta critica arranca con Torre. Alfil y Caballo quedan listos como placeholders para los siguientes vertical slices."
      cta={{ href: "/play/rook", label: "Jugar Torre" }}
      secondaryCta={{ href: "/", label: "Volver al inicio" }}
    >
      <div className="space-y-3">
        {levels.map((level) => (
          <div
            key={level.piece}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-950">{level.piece}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{level.description}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {level.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
