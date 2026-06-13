import "@/styles/exercises.css";

/**
 * Pass-through layout whose only job is scoping the exercises surface
 * stylesheet to this route segment (P4 CSS split, 2026-06-12).
 */
export default function ExercisesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
