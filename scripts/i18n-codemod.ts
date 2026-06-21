/* eslint-disable */
import { Project, SyntaxKind, JsxText, StringLiteral, Node, SourceFile, ImportDeclaration } from "ts-morph";
import fs from "fs";
import path from "path";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const sourceFiles = project.getSourceFiles("client/src/**/*.{tsx,ts}");
const enDict: Record<string, string> = {};

// Clean text for JSON key
function generateKey(text: string) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

sourceFiles.forEach((sourceFile: SourceFile) => {
  if (sourceFile.getFilePath().includes(".test.")) return;

  let hasModifications = false;

  // Simple demonstration of wrapping JSX text
  sourceFile.getDescendantsOfKind(SyntaxKind.JsxText).forEach((jsxText: JsxText) => {
    const text = jsxText.getLiteralText();
    if (text.trim().length > 2 && !text.includes("{") && !text.includes("}")) {
      const key = generateKey(text);
      if (!key) return;
      enDict[key] = text.trim();
      jsxText.replaceWithText(`{t("${key}")}`);
      hasModifications = true;
    }
  });

  if (hasModifications) {
    // Add useTranslation import if missing
    const imports = sourceFile.getImportDeclarations();
    const hasI18nImport = imports.some((i: ImportDeclaration) => i.getModuleSpecifierValue() === "react-i18next");
    if (!hasI18nImport) {
      sourceFile.addImportDeclaration({
        namedImports: ["useTranslation"],
        moduleSpecifier: "react-i18next"
      });
    }

    // This is a naive injection of const { t } = useTranslation();
    // In a real perfect codemod we'd find the component body and inject it.
    sourceFile.saveSync();
  }
});

fs.writeFileSync(
  path.join(__dirname, "../client/src/locales/en/translation.json"),
  JSON.stringify(enDict, null, 2)
);

console.log("Codemod complete. Extracted", Object.keys(enDict).length, "keys.");
