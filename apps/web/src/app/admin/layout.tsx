// El subárbol de operación. Vive fuera de `[locale]` porque no es producto: no
// tiene idioma, no tiene wallet, no tiene jugador.
//
// ⛔ Y a diferencia de `/dev`, NO lleva `isDevSurfaceEnabled()`: `/dev` es 404 en
// producción a propósito, y esta página tiene que funcionar JUSTAMENTE en
// producción — es el interruptor que se toca durante un pico. Quien la protege
// es `ADMIN_TOKEN`, verificado server-side en la ruta; la página sin token no
// muestra ni un dato.
//
// ⚠️ Después de la Stage 1 de i18n no hay `app/layout.tsx`, así que este layout
// es la raíz de facto de su subárbol y tiene que cargar los estilos él mismo.
import "../globals.css";

export const metadata = {
  title: "Chesscito — Ops",
  description: "Internal operations surface. Not user-facing.",
  // ⛔ La seguridad la da el token, NUNCA la oscuridad. Esto es higiene: que la
  // URL no aparezca en un buscador no la protege, sólo evita que invite.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-neutral-950">{children}</body>
    </html>
  );
}
