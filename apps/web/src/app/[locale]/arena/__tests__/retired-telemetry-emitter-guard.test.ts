import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const RETIRED_EVENTS = new Set([
  "dock_tap",
  "dock_center_close",
  "arena_mount",
  "arena_fresh_reset_fired",
  "arena_select_view",
]);

type Emitter = { event: string; line: number };

function stringValue(node: ts.Expression | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function telemetryTrackBindings(sourceFile: ts.SourceFile, sourcePath: string) {
  const named = new Set<string>();
  const namespaces = new Set<string>();
  const srcMarker = `${sep}src${sep}`;
  const markerIndex = sourcePath.lastIndexOf(srcMarker);
  const sourceRoot = markerIndex >= 0
    ? sourcePath.slice(0, markerIndex + srcMarker.length - 1)
    : resolve(process.cwd(), "src");
  const telemetryPath = resolve(sourceRoot, "lib/telemetry");

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    const specifier = statement.moduleSpecifier.text;
    const importedPath = specifier.startsWith("@/")
      ? resolve(sourceRoot, specifier.slice(2))
      : resolve(dirname(sourcePath), specifier);
    const normalizedPath = importedPath.replace(/\.(tsx?|jsx?)$/, "");
    if (normalizedPath !== telemetryPath) continue;

    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (element.propertyName?.text === "track" || (!element.propertyName && element.name.text === "track")) {
          named.add(element.name.text);
        }
      }
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text);
    }
  }

  return { named, namespaces };
}

function findRetiredEmitters(source: string, sourcePath: string): Emitter[] {
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const { named, namespaces } = telemetryTrackBindings(sourceFile, sourcePath);
  const constantEvents = new Map<string, string>();
  const emitters: Emitter[] = [];

  function collectConstants(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const value = stringValue(node.initializer);
      if (value && RETIRED_EVENTS.has(value)) constantEvents.set(node.name.text, value);
    }
    ts.forEachChild(node, collectConstants);
  }

  function eventFromExpression(expression: ts.Expression): string | undefined {
    const direct = stringValue(expression);
    if (direct) return direct;
    if (ts.isIdentifier(expression)) return constantEvents.get(expression.text);
    return undefined;
  }

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isImportedTrack =
        (ts.isIdentifier(callee) && named.has(callee.text)) ||
        (ts.isPropertyAccessExpression(callee) &&
          callee.name.text === "track" &&
          ts.isIdentifier(callee.expression) &&
          namespaces.has(callee.expression.text));

      if (isImportedTrack && node.arguments.length > 0) {
        const event = eventFromExpression(node.arguments[0]);
        if (event && RETIRED_EVENTS.has(event)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          emitters.push({ event, line: line + 1 });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  collectConstants(sourceFile);
  visit(sourceFile);
  return emitters;
}

function runtimeFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "__mocks__") continue;
      files.push(...runtimeFiles(join(directory, entry.name)));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      files.push(join(directory, entry.name));
    }
  }
  return files;
}

function runtimeSourceFiles(): string[] {
  const appsRoot = resolve(process.cwd(), "..");
  return readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(appsRoot, entry.name, "src"))
    .filter((src) => existsSync(src))
    .flatMap((src) => runtimeFiles(src));
}

describe("retired analytics event emitter guard", () => {
  it("ignores historical mentions in comments and ordinary string declarations", () => {
    const source = `
      // Historical: track("arena_mount") was removed.
      const previousEventName = "arena_mount";
      const note = "arena_fresh_reset_fired";
      void previousEventName;
      void note;
    `;
    expect(findRetiredEmitters(source, "/fixture/runtime.ts")).toEqual([]);
  });

  it("detects direct, aliased, namespace, and constant-name track calls", () => {
    const source = `
      import { track as emit } from "@/lib/telemetry";
      import * as telemetry from "@/lib/telemetry";
      const oldName = "arena_mount";
      emit(oldName);
      telemetry.track("arena_fresh_reset_fired");
    `;
    expect(findRetiredEmitters(source, resolve(process.cwd(), "src/fixture.ts"))).toEqual([
      { event: "arena_mount", line: 5 },
      { event: "arena_fresh_reset_fired", line: 6 },
    ]);
  });

  it("keeps all five retired event names out of runtime track() calls", () => {
    const offenders = runtimeSourceFiles().flatMap((file) =>
      findRetiredEmitters(readFileSync(file, "utf8"), file).map(({ event, line }) =>
        `${relative(resolve(process.cwd(), ".."), file)}:${line} emits ${event}`,
      ),
    );

    expect(offenders).toEqual([]);
  });
});
