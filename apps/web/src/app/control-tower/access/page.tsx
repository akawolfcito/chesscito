"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * El interruptor del waitlist, pensado para el teléfono.
 *
 * ⛔ **No es un dashboard, y esa restricción es deliberada.** Hace una sola cosa:
 * abrir y cerrar el acceso web, y decir cuánto queda. El pedido que lo originó
 * fue *"mi botón de apagado o encendido del waitlist desde cualquier lugar sin
 * estresarme por queries, permisos, etc"* — durante un pico, "entrar al
 * dashboard de Supabase y escribir SQL" no es un camino.
 *
 * ⛔ **Y ES LO QUE HACE QUE SU AUTENTICACIÓN SIMPLE ALCANCE.** Con el token, lo
 * peor que se logra es apagar el tope (pagamos Privy) o ponerlo en 1 (nadie
 * nuevo entra): ningún dato se expone y las dos cosas se revierten en un tap. El
 * día que esta página crezca hacia otras operaciones, ese techo se cae y la
 * autenticación tiene que rehacerse ANTES, no después.
 *
 * ⚠️ El token vive en el localStorage del teléfono y viaja **por header**. En el
 * query string quedaría en el historial, en los logs del CDN y en cualquier
 * Referer que la página emita.
 *
 * ⚠️ Neutrales crudos de Tailwind a propósito, no los design tokens del juego:
 * esto es una herramienta de operación, y un restyle del producto no debe mover
 * los muebles del interruptor ni al revés.
 */

const STORAGE_KEY = "chesscito.ct";
const ENDPOINT = "/api/control-tower";

type CapacityState = {
  enabled: boolean;
  limit: number;
  browserAccounts: number | null;
  headroom: number | null;
  open: boolean;
  overPlanCeiling?: boolean;
};

export default function AdminAccessPage() {
  const [token, setToken] = useState<string | null>(null);
  const [draftToken, setDraftToken] = useState("");
  const [state, setState] = useState<CapacityState | null>(null);
  const [error, setError] = useState<"forbidden" | "failed" | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftLimit, setDraftLimit] = useState("");

  useEffect(() => {
    setToken(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const call = useCallback(
    async (body?: Record<string, unknown>) => {
      if (!token) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(ENDPOINT, {
          method: body ? "POST" : "GET",
          headers: { "x-admin-token": token, "content-type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (res.status === 403 || res.status === 503) {
          setError("forbidden");
          return;
        }
        if (!res.ok) {
          setError("failed");
          return;
        }
        // ⛔ Se dibuja lo que devolvió la BASE, jamás lo que se pidió: si
        // pintáramos la intención, un write rechazado se vería como uno exitoso.
        setState((await res.json()) as CapacityState);
      } catch {
        setError("failed");
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (token) void call();
  }, [token, call]);

  function forgetToken() {
    window.localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setState(null);
    setError(null);
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-sm p-6 text-neutral-100">
        {/* ⛔ Antes de autenticar, la pantalla no dice qué es esto ni para qué
            sirve. Después sí: a esa altura ya no hay nada que ocultarle a quien
            está mirando, y una herramienta muda es peor de operar a las 3am. */}
        <label className="block text-sm text-neutral-400" htmlFor="admin-token">
          Admin token
        </label>
        <input
          id="admin-token"
          type="password"
          autoComplete="off"
          value={draftToken}
          onChange={(e) => setDraftToken(e.target.value)}
          className="mt-2 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
        />
        <button
          type="button"
          disabled={!draftToken.trim()}
          onClick={() => {
            window.localStorage.setItem(STORAGE_KEY, draftToken.trim());
            setToken(draftToken.trim());
          }}
          className="mt-4 w-full rounded bg-neutral-100 px-4 py-3 font-semibold text-neutral-900 disabled:opacity-40"
        >
          Entrar
        </button>
        <p className="mt-4 text-xs text-neutral-500">
          Se guarda en este teléfono y viaja por header. No queda en la URL.
        </p>
        {/* ⛔ Ni un enlace de vuelta al producto: un `<a>` acá convertiría a esta
            página en un descubrimiento a partir del sitio, que es exactamente lo
            que el nombre poco obvio intenta evitar. */}
      </main>
    );
  }

  if (error === "forbidden") {
    return (
      <main className="mx-auto max-w-sm p-6 text-neutral-100">
        <h1 className="mb-4 text-lg font-semibold">Ese token no sirve</h1>
        <p className="mb-6 text-sm text-neutral-400">
          Puede estar vencido, o ser el de otro entorno.
        </p>
        <button
          type="button"
          onClick={forgetToken}
          className="w-full rounded bg-neutral-100 px-4 py-3 font-semibold text-neutral-900"
        >
          Olvidar y empezar de nuevo
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm p-6 text-neutral-100">
      <h1 className="mb-6 text-lg font-semibold">Chesscito · acceso web</h1>

      {!state ? (
        <p className="text-sm text-neutral-400">Leyendo…</p>
      ) : (
        <>
          <p className="text-sm text-neutral-400">
            {/* En palabras y no sólo con un color: esto se mira a las 3am. */}
            {!state.enabled
              ? "Sin tope — entra todo el mundo"
              : state.open
                ? "Abierto"
                : "Cerrado — el excedente va a la waitlist"}
          </p>

          {state.browserAccounts === null ? (
            <p className="mt-2 text-2xl font-semibold text-amber-400">
              No se pudo contar
            </p>
          ) : (
            <>
              <p className="mt-2 text-4xl font-semibold tabular-nums">
                {state.browserAccounts} / {state.limit}
              </p>
              <p className="mt-1 text-sm text-neutral-400">
                quedan {state.headroom} lugares
              </p>
            </>
          )}

          {state.overPlanCeiling ? (
            <p className="mt-4 rounded border border-amber-700 bg-amber-950 p-3 text-sm text-amber-300">
              Ese número está por encima del plan gratis de Privy (499). Se
              guardó igual, pero cruzarlo cuesta USD 299/mes.
            </p>
          ) : null}

          <div className="mt-8 space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void call({ enabled: !state.enabled })}
              className="w-full rounded bg-neutral-100 px-4 py-4 font-semibold text-neutral-900 disabled:opacity-40"
            >
              {state.enabled ? "Quitar el tope" : "Volver a poner el tope"}
            </button>

            <div className="flex gap-2">
              <input
                aria-label="Nuevo tope"
                inputMode="numeric"
                placeholder={String(state.limit)}
                value={draftLimit}
                onChange={(e) => setDraftLimit(e.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-3 tabular-nums"
              />
              <button
                type="button"
                disabled={busy || !/^\d+$/.test(draftLimit.trim())}
                onClick={() => {
                  void call({ limit: Number(draftLimit.trim()) });
                  setDraftLimit("");
                }}
                className="rounded border border-neutral-700 px-4 py-3 disabled:opacity-40"
              >
                Guardar
              </button>
            </div>
          </div>

          {error === "failed" ? (
            <p className="mt-4 text-sm text-amber-400">
              No se pudo aplicar. El estado de arriba es el último confirmado.
            </p>
          ) : null}

          <p className="mt-8 text-xs text-neutral-500">
            Tarda hasta ~20 s en verse, por el caché. El allowlist de Privy sigue
            siendo lo que concede el acceso: esto es el presupuesto.
          </p>

          <button
            type="button"
            onClick={forgetToken}
            className="mt-4 text-xs text-neutral-500 underline"
          >
            Olvidar este token
          </button>
        </>
      )}
    </main>
  );
}
