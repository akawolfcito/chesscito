import "@/styles/coach.css";

/**
 * Pass-through layout whose only job is scoping the coach surface
 * stylesheet (viewer + history/journal) to this route segment
 * (P4 CSS split, 2026-06-12).
 */
export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
