import { MiniGamesLibrary } from "@/components/hub/minigames-library";

/**
 * `/minigames` — the Library route.
 *
 * A ROUTE and not a sheet on the Learn Home, for one reason that is a product
 * requirement rather than a preference: a challenge opened from the Library
 * must RETURN to the Library on completion, and "return" needs an address.
 * A sheet would leave `?from=library` with nowhere to go but the home, which
 * is the origin-collapsing the personal-queue brief explicitly forbids.
 *
 * The Learn Home itself is unchanged: the entry is one pill under the featured
 * tiles, not a fourth card.
 */
export default function MiniGamesLibraryPage() {
  return <MiniGamesLibrary />;
}
