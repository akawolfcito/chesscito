// El subárbol de operación. Vive fuera de `[locale]` porque no es producto: no
// tiene idioma, no tiene wallet, no tiene jugador.
//
// ⛔ Y a diferencia de `/dev`, NO lleva `isDevSurfaceEnabled()`: `/dev` es 404 en
// producción a propósito, y esta página tiene que funcionar JUSTAMENTE en
// producción — es el interruptor que se toca durante un pico. Quien la protege
// es `ADMIN_TOKEN`, verificado server-side en la ruta; la página sin token no
// muestra ni un dato.
//
// ⛔ EL NOMBRE NO ES UN CONTROL, Y NO DEBE CONFIARSE EN ÉL. Se eligió uno poco
// obvio (founder, 2026-08-14) para evitar el descubrimiento casual, pero **este
// repositorio es público**: la ruta está publicada como el nombre de este
// directorio, la escriba alguien en un doc o no. Lo único que protege es el
// token, que hoy son 64 hex = 256 bits de entropía. Si algún día alguien
// justifica una decisión de seguridad con "igual nadie sabe la URL", esa
// premisa es falsa desde el primer commit.
//
// ⚠️ Después de la Stage 1 de i18n no hay `app/layout.tsx`, así que este layout
// es la raíz de facto de su subárbol y tiene que cargar los estilos él mismo.
import "../globals.css";

export const metadata = {
  // Sin descripción y con un título mudo, a pedido del founder: nada acá debe
  // anunciar qué es esto ni para qué sirve.
  title: "—",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-neutral-950">{children}</body>
    </html>
  );
}
