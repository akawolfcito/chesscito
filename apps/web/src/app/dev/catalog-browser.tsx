"use client";

import { useEffect, useMemo, useState } from "react";

import {
  DEV_GROUPS,
  DEV_SCREENS,
  DEV_TOOLS,
  devSurfaceHref,
  type DevSurface,
} from "@/lib/dev/dev-catalog";

/** Remembers the last opened surface so a reload lands where you were. */
const STORAGE_KEY = "chesscito.dev.catalog.last";

/** MiniPay's viewport. The preview is the real thing, not a scaled thumbnail. */
const PREVIEW_WIDTH = 390;
const PREVIEW_HEIGHT = 844;

type Selection = { readonly id: string; readonly option?: string };

const GROUP_LABELS: Record<string, string> = {
  exercises: "Exercises",
  arena: "Arena",
  hub: "Hub",
  coach: "Coach",
  payments: "Payments",
  chips: "Chips & buttons",
  boards: "Lane-2 boards",
  tools: "Authoring tools",
  probes: "Chain probes",
};

export function DevCatalogBrowser() {
  const [selection, setSelection] = useState<Selection>({
    id: "exercises-popups",
    option: "piece-complete-final",
  });
  const [restored, setRestored] = useState(false);

  // Read after mount: server and first client render must agree.
  //
  // ⛔ The URL wins over storage. The catalog's job is to make a screen
  // ADDRESSABLE — `/dev?s=arena-end-state&o=win-timeout` has to reopen exactly
  // that, or you cannot hand someone a link to the thing you want changed,
  // which is most of the point.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("s");
    if (fromUrl) {
      setSelection({ id: fromUrl, option: params.get("o") ?? undefined });
      setRestored(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSelection(JSON.parse(raw) as Selection);
    } catch {
      /* private window, blocked storage — the default is fine */
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } catch {
      /* nothing to do — this is a convenience, not state */
    }
    // replaceState, not a router push: this is the address bar tracking the
    // panel, not navigation. A push would make Back walk every click.
    const params = new URLSearchParams();
    params.set("s", selection.id);
    if (selection.option) params.set("o", selection.option);
    window.history.replaceState(null, "", `/dev?${params.toString()}`);
  }, [selection, restored]);

  const active = useMemo(
    () => [...DEV_SCREENS, ...DEV_TOOLS].find((s) => s.id === selection.id),
    [selection.id],
  );

  const href = active ? devSurfaceHref(active, selection.option) : "/dev";
  const previewable = Boolean(active && !active.sideEffect && !active.fork);

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100 lg:flex-row">
      <nav className="w-full shrink-0 overflow-y-auto border-neutral-800 border-b p-4 lg:h-screen lg:w-80 lg:border-r lg:border-b-0">
        <header className="mb-4">
          <h1 className="font-semibold text-lg">/dev catalog</h1>
          <p className="text-neutral-400 text-xs">
            {DEV_SCREENS.length} screens · {DEV_TOOLS.length} tools &amp; probes
          </p>
        </header>

        {DEV_GROUPS.map((group) => {
          const surfaces = [...DEV_SCREENS, ...DEV_TOOLS].filter(
            (surface) => surface.group === group,
          );
          if (surfaces.length === 0) return null;

          return (
            <section key={group} className="mb-5">
              <h2 className="mb-2 font-medium text-[10px] text-neutral-500 uppercase tracking-wider">
                {GROUP_LABELS[group] ?? group}
              </h2>
              <ul className="space-y-1">
                {surfaces.map((surface) => (
                  <SurfaceRow
                    key={surface.id}
                    surface={surface}
                    selection={selection}
                    onSelect={setSelection}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </nav>

      <main className="flex-1 overflow-y-auto p-6">
        {active ? (
          <>
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-semibold text-xl">{active.title}</h2>
              <code className="text-neutral-400 text-xs">{href}</code>
              <a
                className="text-sky-400 text-xs underline"
                href={href}
                rel="noreferrer"
                target="_blank"
              >
                open in a tab ↗
              </a>
            </div>

            <p className="mb-4 max-w-2xl text-neutral-300 text-sm">
              {active.blurb}
            </p>

            {active.fork ? (
              <p className="mb-4 max-w-2xl rounded border border-red-800 bg-red-950/60 p-3 text-red-200 text-xs">
                <strong>Forked fixture — an edit here reaches nobody.</strong>{" "}
                {active.fork}
              </p>
            ) : null}

            {active.sideEffect ? (
              <p className="mb-4 max-w-2xl rounded border border-amber-800 bg-amber-950/60 p-3 text-amber-200 text-xs">
                <strong>Side effect.</strong> {active.sideEffect}
              </p>
            ) : null}

            {active.options && active.param ? (
              <div className="mb-5">
                <h3 className="mb-2 text-[10px] text-neutral-500 uppercase tracking-wider">
                  ?{active.param}=
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {active.options.map((option) => (
                    <button
                      className={`rounded border px-2 py-1 text-xs transition ${
                        selection.option === option
                          ? "border-sky-500 bg-sky-500/20 text-sky-200"
                          : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                      }`}
                      key={option}
                      onClick={() =>
                        setSelection({ id: active.id, option })
                      }
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <BlastRadius surface={active} />

            {previewable ? (
              <iframe
                className="rounded border border-neutral-700 bg-white"
                height={PREVIEW_HEIGHT}
                /* key on the href so switching variant remounts rather than
                   leaving the old render up while the new one loads. */
                key={href}
                src={href}
                title={`${active.title} preview`}
                width={PREVIEW_WIDTH}
              />
            ) : (
              <p className="text-neutral-500 text-xs">
                No preview — open it in a tab deliberately.
              </p>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

/**
 * What a style edit made from this surface actually moves.
 *
 * ⚠️ The list is production files only. A fixture mounts the real component,
 * so the change propagates to every file here — but the fixture may pass
 * FEWER props than production, so what you SEE can be a state short.
 */
function BlastRadius({ surface }: { surface: DevSurface }) {
  if (!surface.mounts?.length) return null;

  return (
    <details className="mb-5 max-w-2xl rounded border border-neutral-800 bg-neutral-900/60 p-3">
      <summary className="cursor-pointer text-neutral-300 text-xs">
        Editing this reaches{" "}
        <strong>{surface.consumers?.length ?? 0} production file(s)</strong>{" "}
        through {surface.mounts.length} component(s)
      </summary>
      <div className="mt-3 space-y-3">
        <div>
          <h4 className="mb-1 text-[10px] text-neutral-500 uppercase tracking-wider">
            mounts
          </h4>
          <ul className="space-y-0.5">
            {surface.mounts.map((mount) => (
              <li className="text-neutral-400 text-xs" key={mount}>
                <code>components/{mount}</code>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-1 text-[10px] text-neutral-500 uppercase tracking-wider">
            consumers
          </h4>
          <ul className="space-y-0.5">
            {surface.consumers?.map((consumer) => (
              <li className="text-neutral-400 text-xs" key={consumer}>
                <code>{consumer}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

function SurfaceRow({
  surface,
  selection,
  onSelect,
}: {
  surface: DevSurface;
  selection: Selection;
  onSelect: (next: Selection) => void;
}) {
  const isActive = selection.id === surface.id;

  return (
    <li>
      <button
        className={`w-full rounded px-2 py-1.5 text-left text-sm transition ${
          isActive
            ? "bg-neutral-800 text-neutral-50"
            : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
        }`}
        onClick={() =>
          onSelect({ id: surface.id, option: surface.options?.[0] })
        }
        type="button"
      >
        <span className="flex items-center gap-1.5">
          <span className="truncate">{surface.title}</span>
          {surface.fork ? (
            <span className="shrink-0 rounded bg-red-900 px-1 text-[9px] text-red-200">
              FORK
            </span>
          ) : null}
          {surface.sideEffect ? (
            <span className="shrink-0 rounded bg-amber-900 px-1 text-[9px] text-amber-200">
              !
            </span>
          ) : null}
          {surface.options ? (
            <span className="ml-auto shrink-0 text-[10px] text-neutral-600">
              {surface.options.length}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
