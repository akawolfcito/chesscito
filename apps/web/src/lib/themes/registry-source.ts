import ts from "typescript";
import type { AssetVariant } from "./asset-variant";

function propertyName(node: ts.PropertyName): string | null {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return null;
}

function property(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.PropertyAssignment | undefined {
  return object.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) && propertyName(candidate.name) === name,
  );
}

function objectInitializer(
  assignment: ts.PropertyAssignment | undefined,
  label: string,
): ts.ObjectLiteralExpression {
  if (!assignment || !ts.isObjectLiteralExpression(assignment.initializer)) {
    throw new Error(`Could not locate ${label} in theme registry`);
  }
  return assignment.initializer;
}

function serializedVariant(value: AssetVariant): string {
  if (value.mode === "asset") {
    return `{ mode: "asset", path: ${JSON.stringify(value.path)} }`;
  }
  return `{ mode: ${JSON.stringify(value.mode)} }`;
}

export function updateRegistrySource(
  source: string,
  themeId: string,
  key: string,
  variant: "default" | "pro",
  value: AssetVariant,
): string {
  if (variant === "default" && value.mode === "inherit") {
    throw new Error("DEFAULT cannot inherit");
  }

  const file = ts.createSourceFile(
    "theme-registry.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let themes: ts.ObjectLiteralExpression | null = null;

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
  if (!themes) throw new Error("Could not locate THEMES in theme registry");

  const theme = objectInitializer(property(themes, themeId), `theme ${themeId}`);
  const assets = objectInitializer(property(theme, "assets"), `assets for ${themeId}`);
  const entry = objectInitializer(property(assets, key), `slot ${key}`);
  const existing = property(entry, variant);
  const serialized = serializedVariant(value);

  if (existing) {
    const start = existing.initializer.getStart(file);
    return source.slice(0, start) + serialized + source.slice(existing.initializer.end);
  }

  const insertAt = entry.getStart(file) + 1;
  return source.slice(0, insertAt) + ` ${variant}: ${serialized},` + source.slice(insertAt);
}
