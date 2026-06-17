import { Project, SyntaxKind, TypeNode, Node } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const sourceFiles = project.getSourceFiles(["server/**/*.ts", "client/src/**/*.{ts,tsx}"]);

console.log(`Found ${sourceFiles.length} files.`);

let replacedCount = 0;

for (const sourceFile of sourceFiles) {
  let fileChanged = false;

  // Replace `catch (error: any)` with `catch (error: unknown)`
  const catchClauses = sourceFile.getDescendantsOfKind(SyntaxKind.CatchClause);
  for (const catchClause of catchClauses) {
    const varDecl = catchClause.getVariableDeclaration();
    if (varDecl) {
      const typeNode = varDecl.getTypeNode();
      if (typeNode && typeNode.getKind() === SyntaxKind.AnyKeyword) {
        varDecl.setType("unknown");
        fileChanged = true;
        replacedCount++;

        // Find property accesses on the error object (e.g. error.message)
        const errorName = varDecl.getName();
        const block = catchClause.getBlock();
        
        const propertyAccesses = block.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
        for (const access of propertyAccesses) {
            const expression = access.getExpression();
            if (expression.getText() === errorName) {
                // E.g. error.message -> (error instanceof Error ? error.message : String(error))
                const propName = access.getName();
                access.replaceWithText(`(${errorName} instanceof Error ? ${errorName}.${propName} : String(${errorName}))`);
            }
        }
      }
    }
  }

  if (fileChanged) {
    sourceFile.saveSync();
  }
}

console.log(`Replaced ${replacedCount} catch clauses and narrowed properties.`);
