import { Project, SyntaxKind, TypeNode, Node } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const sourceFiles = project.getSourceFiles(["server/**/*.ts", "client/src/**/*.{ts,tsx}"]);

let replacedCount = 0;

for (const sourceFile of sourceFiles) {
  let fileChanged = false;

  const propertyAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  for (const access of propertyAccesses) {
    const expression = access.getExpression();
    const text = expression.getText();
    const propName = access.getName();
    
    // Check if expression is 'err' or 'error' or 'parseErr' and is typed as unknown
    if (["err", "error", "parseErr", "previewErr"].includes(text)) {
      if (propName === "message" || propName === "name" || propName === "stack") {
         access.replaceWithText(`(${text} as Error).${propName}`);
         fileChanged = true;
         replacedCount++;
      }
    }
  }

  if (fileChanged) {
    sourceFile.saveSync();
  }
}

console.log(`Replaced ${replacedCount} error property accesses.`);
