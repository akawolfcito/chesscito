import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const APP_DIR = process.cwd();
const SRC_DIR = path.join(APP_DIR, "src");
const PUBLIC_DIR = path.join(APP_DIR, "public");
const REGISTRY_FILE = path.join(SRC_DIR, "lib/themes/theme-registry.ts");
const OUTPUT_FILE = path.resolve(
  APP_DIR,
  "../../docs/audits/2026-07-18-theme-runtime-inventory.json",
);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const CHECK_MODE = process.argv.includes("--check");
// Empty on purpose. An entry here is an asset nobody can replace from the
// builder, which is the exact failure the catalog exists to prevent — every
// former exception is now a registered slot.
const ALLOWED_UNREGISTERED_LITERALS = new Map([]);
const ART_LITERAL_RE = /["'`](\/art\/[^"'`\s),;]+)/g;
const IMAGE_EXT_RE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
const INITIAL_CATEGORIES = {
  A: new Set(["hub.portal", "hub.avatar"]),
  C: new Set([
    "hub.enter-arena", "hub.train-pieces", "hub.play-chess", "hub.training",
    "hub.training-icon", "hub.daily-icon", "hub.shop-icon", "shared.lock",
    "shared.feedback-happy", "shared.feedback-confident", "shared.feedback-scared",
    "shared.trophy-epic", "exercises.badge-menu", "exercises.refuge",
    "exercises.leaderboard-menu", "exercises.shop-menu", "exercises.saved-seal",
    "arena.resign", "arena.undo", "peones.hint", "tactics.daily-exercise",
    "hud.trophy", "arena.player-you", "hub.mate-icon", "account.account-icon",
    "board.thumbnail",
  ]),
  D: new Set([
    "shared.panel-bg", "shared.star", "exercises.badge", "scene.gem-pill",
    "scene.panel-pro", "scene.pedestal", ...Array.from({ length: 10 }, (_, i) => `scene.stone-${i + 1}`),
    "scene.chest-large", "scene.chest-small", "scene.banner-large", "scene.banner-medium",
    "scene.banner-short", "bg.splash-chesscito", "bg.wallpaper-lite", "bg.dock-4slots",
    "bg.menu-wall", "bg.path-map", "bg.path-map-base", "bg.splash-loading",
    "shop.slot-frame", "arena.bg-matchup", "hub.bg", "hub.btn-stone-bg",
    "hub.focus-passport-streak", "exercises.wall", "exercises.wallpaper",
    "shared.panel-frame", "board.tile.light", "board.tile.dark",
  ]),
  E: new Set([
    "hub.pro-chip", "arena.rival-kairo", "arena.rival-pipo", "arena.rival-frame-blue",
    "arena.rival-frame-gold", "arena.rival-frame-silver", "board.frame",
    "board.piece.white.rook", "board.piece.white.bishop", "board.piece.white.knight",
    "board.piece.white.pawn", "board.piece.white.queen", "board.piece.white.king",
    "board.piece.black.rook", "board.piece.black.bishop", "board.piece.black.knight",
    "board.piece.black.pawn", "board.piece.black.queen", "board.piece.black.king",
  ]),
  F: new Set([
    "hub.principal-button", "hub.mastery.piece.rook", "hub.mastery.piece.bishop",
    "hub.mastery.piece.knight", "hub.mastery.piece.pawn", "hub.mastery.piece.queen",
    "hub.mastery.piece.king", "pro-mission.sms", "shop.coach-pack-20",
    "hub.cta-principal", "board.legacy-bg",
  ]),
};

function initialCategory(slotId) {
  for (const [category, slotIds] of Object.entries(INITIAL_CATEGORIES)) {
    if (slotIds.has(slotId)) return category;
  }
  return "B";
}

function relative(file) {
  return path.relative(APP_DIR, file).split(path.sep).join("/");
}

function groupBy(items, keyFor) {
  const result = new Map();
  for (const item of items) {
    const key = keyFor(item);
    const group = result.get(key) ?? [];
    group.push(item);
    result.set(key, group);
  }
  return result;
}

function walk(dir) {
  const result = [];
  for (const entry of readdirSync(dir)) {
    const absolute = path.join(dir, entry);
    const rel = relative(absolute);
    if (
      entry === "node_modules" ||
      entry === ".next" ||
      rel.includes("/__tests__/") ||
      rel.startsWith("src/app/dev/") ||
      // Public share/OG landing pages render with no theme provider in scope
      // (they are social-preview surfaces, not the themeable app runtime), so
      // their /art literals are hardcoded by design — same rationale as the
      // dev/ exclusion above. Every slot they touch (hub.daily-icon,
      // screen-mission/panel-mision-icon) is also consumed via the resolver
      // elsewhere, so excluding this route orphans nothing.
      rel.startsWith("src/app/[locale]/share/") ||
      rel.startsWith("src/lib/themes/")
    ) {
      continue;
    }
    const stat = statSync(absolute);
    if (stat.isDirectory()) result.push(...walk(absolute));
    else if (SOURCE_EXTENSIONS.has(path.extname(entry))) result.push(absolute);
  }
  return result;
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return null;
}

function property(object, name) {
  return object.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) && propertyName(candidate.name) === name,
  );
}

function objectInitializer(assignment, label) {
  if (!assignment || !ts.isObjectLiteralExpression(assignment.initializer)) {
    throw new Error(`Could not locate ${label}`);
  }
  return assignment.initializer;
}

function stringValue(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;
}

function variantValue(entry, variant) {
  const assignment = property(entry, variant);
  if (!assignment) return variant === "pro" ? { mode: "inherit" } : { mode: "none" };
  const direct = stringValue(assignment.initializer);
  if (direct) return { mode: "asset", path: direct };
  if (!ts.isObjectLiteralExpression(assignment.initializer)) return { mode: "unknown" };
  const mode = stringValue(property(assignment.initializer, "mode")?.initializer);
  const assetPath = stringValue(property(assignment.initializer, "path")?.initializer);
  return mode === "asset" && assetPath ? { mode, path: assetPath } : { mode: mode ?? "unknown" };
}

function stringArray(entry, name) {
  const assignment = property(entry, name);
  if (!assignment || !ts.isArrayLiteralExpression(assignment.initializer)) return [];
  return assignment.initializer.elements.map(stringValue).filter(Boolean);
}

function parseRegistry() {
  const source = readFileSync(REGISTRY_FILE, "utf8");
  const file = ts.createSourceFile(REGISTRY_FILE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let themes = null;
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "THEMES" &&
        declaration.initializer &&
        ts.isObjectLiteralExpression(declaration.initializer)
      ) {
        themes = declaration.initializer;
      }
    }
  }
  if (!themes) throw new Error("Could not locate THEMES");
  const theme = objectInitializer(property(themes, "candy-forest"), "candy-forest");
  const assets = objectInitializer(property(theme, "assets"), "candy-forest assets");
  return assets.properties
    .filter(ts.isPropertyAssignment)
    .map((assignment) => {
      const key = propertyName(assignment.name);
      if (!key || !ts.isObjectLiteralExpression(assignment.initializer)) return null;
      const entry = assignment.initializer;
      return {
        slotId: key,
        root: stringValue(property(entry, "root")?.initializer) ?? "web",
        default: variantValue(entry, "default"),
        pro: variantValue(entry, "pro"),
        usedIn: stringArray(entry, "usedIn"),
        deprecated: stringValue(property(entry, "deprecated")?.initializer),
      };
    })
    .filter(Boolean);
}

function canonicalArtPath(raw, registeredPaths) {
  const withoutQuery = raw.split(/[?#]/, 1)[0].replace(/[;}]+$/, "");
  const withoutExtension = withoutQuery.replace(IMAGE_EXT_RE, "");
  if (registeredPaths.has(withoutExtension)) return withoutExtension;
  const withoutResponsiveWidth = withoutExtension.replace(/-\d+w$/, "");
  return registeredPaths.has(withoutResponsiveWidth)
    ? withoutResponsiveWidth
    : withoutExtension;
}

function literalOccurrences(files, registeredPaths) {
  const byPath = new Map();
  const allLiterals = new Map();
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    let inBlockComment = false;
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (inBlockComment) {
        if (trimmed.includes("*/")) inBlockComment = false;
        return;
      }
      if (trimmed.startsWith("/*") || trimmed.startsWith("{/*")) {
        if (!trimmed.includes("*/")) inBlockComment = true;
        return;
      }
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
      for (const match of line.matchAll(ART_LITERAL_RE)) {
        const raw = match[1];
        const basename = canonicalArtPath(raw, registeredPaths);
        const occurrence = {
          file: relative(file),
          line: index + 1,
          raw,
          sourceLine: line.trim(),
        };
        if (!byPath.has(basename)) byPath.set(basename, []);
        byPath.get(basename).push(occurrence);
        if (!allLiterals.has(basename)) allLiterals.set(basename, []);
        allLiterals.get(basename).push(occurrence);
      }
    });
  }
  return { byPath, allLiterals };
}

function resolverFiles(files, slotIds) {
  const result = new Map();
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const source = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function visit(node) {
      if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        slotIds.has(node.text)
      ) {
        if (!result.has(node.text)) result.set(node.text, []);
        result.get(node.text).push(relative(file));
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  for (const [slotId, slotFiles] of result) {
    result.set(slotId, [...new Set(slotFiles)]);
  }
  return result;
}

function composedFamilyFiles(slot, files) {
  const assetPath = slot.default.path ?? slot.pro.path ?? "";
  const basename = assetPath.split("/").at(-1) ?? "";
  const iconName = basename.replace(/^pro-chip-(?:active|inactive)$/, "pro-chip");
  return files
    .filter((file) => {
      const content = readFileSync(file, "utf8");
      if (assetPath.startsWith("/art/redesign/pieces/")) {
        return /THEME_CONFIG\.piecesBase|PIECE_BASE|PIECES_ASSET_BASE|useThemePieceAssets|pieceThemeSlot/.test(content);
      }
      if (assetPath.startsWith("/art/rivals/")) return content.includes("/art/rivals/${");
      if (slot.slotId === "board.frame") return content.includes(basename);
      if (slot.slotId === "hub.pro-chip") return content.includes("pro-chip-active") || content.includes("pro-chip-inactive");
      if (slot.slotId === "shared.lock" || slot.slotId === "hud.trophy") {
        return content.includes(`<CandyIcon name="${basename}"`) || content.includes(`name="${basename}"`);
      }
      return iconName.length > 0 && false;
    })
    .map(relative);
}

function usedInFile(locator) {
  if (!locator.startsWith("↳ ") || locator.startsWith("↳ +")) return null;
  const value = locator.slice(2).split(" ", 1)[0];
  const withoutDetail = value.replace(/\s*\(.+$/, "");
  if (withoutDetail === "globals.css") return "src/app/globals.css";
  if (/^(app|components|hooks|lib)\//.test(withoutDetail)) return `src/${withoutDetail}`;
  return null;
}

function fileSignals(file, occurrences, slotId, forcedCategory) {
  const absolute = path.join(APP_DIR, file);
  if (!existsSync(absolute)) return null;
  const content = readFileSync(absolute, "utf8");
  const relevantLines = occurrences.map((item) => item.sourceLine).join("\n");
  const escapedSlotId = slotId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const usesResolver =
    new RegExp(`["']${escapedSlotId}["']`).test(content) ||
    (forcedCategory === "E" && /useThemePieceAssets|pieceThemeSlot/.test(content));
  const usesCssBackground =
    file.endsWith(".css") && /background(?:-image)?\s*:|url\(/.test(content);
  const usesPicture = occurrences.some((item) => {
    const prefix = content.slice(Math.max(0, content.indexOf(item.sourceLine) - 800), content.indexOf(item.sourceLine) + 800);
    return prefix.includes("<picture");
  });
  const usesImg = occurrences.some((item) => /<img|\bsrc=/.test(item.sourceLine));
  const usesSharedMap = forcedCategory === "C" ||
    /iconSrc=|pieceIconSrc=|<TileIconSlot|<DockIcon|\b(?:const|export const)\s+[A-Z0-9_]+/.test(
      relevantLines,
    );
  const buildsPathDynamically = forcedCategory === "E" ||
    /\$\{|\.replace\(|\+\s*["'`]|`[^`]*\/art\//.test(relevantLines);
  if (
    !usesResolver &&
    occurrences.length === 0 &&
    !usesSharedMap &&
    !buildsPathDynamically &&
    !usesCssBackground
  ) {
    return null;
  }
  return {
    file,
    occurrences: occurrences.map(({ line, raw }) => ({ line, raw })),
    usesResolver,
    usesHardcodedPath: occurrences.length > 0,
    usesImg,
    usesPicture,
    usesCssBackground,
    usesSharedMap,
    buildsPathDynamically,
  };
}

function assetExists(basename) {
  const relativePath = basename.replace(/^\//, "");
  return ["avif", "gif", "jpg", "jpeg", "png", "svg", "webp"].some((extension) =>
    existsSync(path.join(PUBLIC_DIR, `${relativePath}.${extension}`)),
  );
}

function classify(slot, consumers) {
  const usesResolver = consumers.some((consumer) => consumer.usesResolver);
  const usesHardcodedPath = consumers.some((consumer) => consumer.usesHardcodedPath);
  const noActiveConsumer = consumers.length === 0;
  if (slot.deprecated || noActiveConsumer) return "F";
  if (usesResolver) return "A";
  if (consumers.some((consumer) => consumer.usesCssBackground)) return "D";
  if (consumers.some((consumer) => consumer.buildsPathDynamically)) return "E";
  if (consumers.some((consumer) => consumer.usesSharedMap)) return "C";
  if (usesHardcodedPath) return "B";
  return "G";
}

// This audit answers one question: does every cataloged slot reach a runtime
// consumer *in apps/web*? Slots owned by a sibling app (root !== "web") have
// their consumers outside SRC_DIR by construction, so scanning for them here
// would report a hole that isn't one. They are covered by their own
// disk-presence test instead.
const slots = parseRegistry().filter((slot) => slot.root === "web");
const registeredPaths = new Set(
  slots.flatMap((slot) => [slot.default.path, slot.pro.path]).filter(Boolean),
);
const sourceFiles = walk(SRC_DIR);
const { byPath, allLiterals } = literalOccurrences(sourceFiles, registeredPaths);
const resolverFilesBySlot = resolverFiles(
  sourceFiles,
  new Set(slots.map((slot) => slot.slotId)),
);

const inventory = slots.map((slot) => {
  const occurrences = [slot.default.path, slot.pro.path]
    .filter(Boolean)
    .flatMap((assetPath) => byPath.get(assetPath) ?? []);
  const occurrencesByFile = groupBy(occurrences, (item) => item.file);
  const locatedFiles = slot.usedIn.map(usedInFile).filter(Boolean);
  const composedFiles = composedFamilyFiles(slot, sourceFiles);
  const resolvedFiles = resolverFilesBySlot.get(slot.slotId) ?? [];
  const forcedCategory = initialCategory(slot.slotId);
  const consumerFiles = [...new Set([
    ...occurrencesByFile.keys(),
    ...locatedFiles,
    ...composedFiles,
    ...resolvedFiles,
  ])].sort();
  const consumers = consumerFiles
    .map((file) => fileSignals(
      file,
      occurrencesByFile.get(file) ?? [],
      slot.slotId,
      composedFiles.includes(file) ? forcedCategory : undefined,
    ))
    .filter(Boolean);
  const usesResolver = consumers.some((consumer) => consumer.usesResolver);
  const usesHardcodedPath = consumers.some((consumer) => consumer.usesHardcodedPath);
  const category = classify(slot, consumers);
  const patterns = [
    consumers.some((consumer) => consumer.usesImg) && "img",
    consumers.some((consumer) => consumer.usesPicture) && "picture",
    consumers.some((consumer) => consumer.usesCssBackground) && "css-background",
    consumers.some((consumer) => consumer.usesSharedMap) && "shared-map",
    consumers.some((consumer) => consumer.buildsPathDynamically) && "dynamic-path",
  ].filter(Boolean);
  return {
    ...slot,
    initialCategory: forcedCategory,
    category,
    documentedFiles: locatedFiles,
    currentConsumerState: usesResolver
      ? usesHardcodedPath
        ? "mixed"
        : "resolver"
      : consumers.length
        ? "hardcoded"
        : "none",
    consumerCount: consumers.length,
    consumers,
    patterns,
    usesResolver,
    usesHardcodedPath,
    usesImg: patterns.includes("img"),
    usesPicture: patterns.includes("picture"),
    usesCssBackground: patterns.includes("css-background"),
    usesSharedMap: patterns.includes("shared-map"),
    buildsPathDynamically: patterns.includes("dynamic-path"),
    noActiveConsumer: consumers.length === 0,
  };
});

const categoryCounts = Object.fromEntries(
  ["A", "B", "C", "D", "E", "F", "G"].map((category) => [
    category,
    inventory.filter((slot) => slot.category === category).length,
  ]),
);
const initialCategoryCounts = Object.fromEntries(
  ["A", "B", "C", "D", "E", "F", "G"].map((category) => [
    category,
    inventory.filter((slot) => slot.initialCategory === category).length,
  ]),
);
const unregisteredLiterals = [...allLiterals.entries()]
  .filter(([basename]) => !registeredPaths.has(basename) && assetExists(basename))
  .map(([basename, occurrences]) => ({ basename, occurrences }))
  .sort((a, b) => a.basename.localeCompare(b.basename));

const report = {
  generatedAt: "2026-07-18",
  source: "apps/web/src/lib/themes/theme-registry.ts#candy-forest",
  totalSlots: inventory.length,
  categoryCounts,
  initialCategoryCounts,
  resolverSlots: inventory.filter((slot) => slot.usesResolver).length,
  fullyConnectedSlots: inventory.filter((slot) => slot.currentConsumerState === "resolver").length,
  mixedSlots: inventory.filter((slot) => slot.currentConsumerState === "mixed").length,
  hardcodedSlots: inventory.filter((slot) => slot.currentConsumerState === "hardcoded").length,
  slotsWithHardcodedConsumers: inventory.filter((slot) => slot.usesHardcodedPath).length,
  deprecatedSlots: inventory.filter((slot) => slot.deprecated).length,
  noActiveConsumerSlots: inventory.filter((slot) => slot.noActiveConsumer).length,
  connectedSlots: inventory.filter((slot) => slot.category === "A").length,
  excludedSlots: inventory.filter((slot) => slot.category === "F").length,
  exceptions: [...ALLOWED_UNREGISTERED_LITERALS.entries()].map(([basename, reason]) => ({
    basename,
    reason,
    detected: unregisteredLiterals.some((literal) => literal.basename === basename),
  })),
  literalDiff: {
    registeredBasenames: registeredPaths.size,
    discoveredBasenames: allLiterals.size,
    unregisteredExistingAssets: unregisteredLiterals,
  },
  slots: inventory,
};

writeFileSync(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  output: path.relative(path.resolve(APP_DIR, "../.."), OUTPUT_FILE),
  totalSlots: report.totalSlots,
  categoryCounts,
  initialCategoryCounts,
  resolverSlots: report.resolverSlots,
  fullyConnectedSlots: report.fullyConnectedSlots,
  mixedSlots: report.mixedSlots,
  hardcodedSlots: report.hardcodedSlots,
  slotsWithHardcodedConsumers: report.slotsWithHardcodedConsumers,
  deprecatedSlots: report.deprecatedSlots,
  noActiveConsumerSlots: report.noActiveConsumerSlots,
  literalDiffGap: unregisteredLiterals.length,
}, null, 2));

if (CHECK_MODE) {
  const activeFailures = inventory.filter(
    (slot) => slot.category !== "F" &&
      (slot.category !== "A" || slot.currentConsumerState !== "resolver"),
  );
  const unexpectedLiterals = unregisteredLiterals.filter(
    ({ basename }) => !ALLOWED_UNREGISTERED_LITERALS.has(basename),
  );
  const requiredLiteralExceptions = [];
  const missingExceptions = requiredLiteralExceptions.filter(
    (basename) => !unregisteredLiterals.some((literal) => literal.basename === basename),
  );
  // 162 web-owned slots: the original 162 minus the 3 landing.* ones (whose
  // consumer lives in apps/landing, out of this audit's scope) plus the 3
  // former exceptions now cataloged (arena.rival-mara, shop.pro,
  // shared.close-candy).
  // +4 (B: 66 → 70), all on 2026-07-22: the Focus Passport flames
  // (shared.flame-color/blue/gray), which were always runtime art but whose
  // consumers composed the path from a basename so this audit never saw them,
  // plus season.story-arrow, new art for the Season Pass offer.
  // +1 (B: 70 → 71) 2026-07-22: coach.share-trophy, the dedicated Match Review
  // share icon split off shared.trophy-epic.
  // +1 (B: 71 → 72) 2026-07-23: payments.offer-bg, the dedicated Season Pass
  // offer sheet background (panel-bg2), so the shared panel-bg stays panel-bg1
  // everywhere else. Consumed as a CSS background, so it lands in the excluded
  // bucket (excludedSlots 12 → 13); totalSlots 167 → 168.
  // +1 (B: 72 → 73) 2026-07-23: board.blocker.stone, the exercise obstacle art.
  // Consumed via the resolver (useCurrentThemeAsset) in board.tsx +
  // diagonal-run-board.tsx, so it lands in category A (connectedSlots 155 →
  // 156); totalSlots 168 → 169.
  // +2 (B: 73 → 75) 2026-07-25: bg.login-learn / bg.login-play, the web access
  // gate wallpapers. Consumed via the resolver (WebAccessThemeVariables emits
  // --theme-bg-login-*), so both land in category A (connectedSlots 156 → 158);
  // totalSlots 169 → 171.
  const expectedInitial = { A: 2, B: 75, C: 26, D: 38, E: 19, F: 11, G: 0 };
  const initialCountsMatch = Object.entries(expectedInitial).every(
    ([category, count]) => initialCategoryCounts[category] === count,
  );
  if (
    inventory.length !== 171 ||
    !initialCountsMatch ||
    activeFailures.length > 0 ||
    unexpectedLiterals.length > 0 ||
    missingExceptions.length > 0
  ) {
    console.error(JSON.stringify({
      activeFailures: activeFailures.map(({ slotId, category, currentConsumerState }) => ({ slotId, category, currentConsumerState })),
      unexpectedLiterals: unexpectedLiterals.map(({ basename }) => basename),
      missingExceptions,
      initialCategoryCounts,
    }, null, 2));
    process.exitCode = 1;
  }
}
