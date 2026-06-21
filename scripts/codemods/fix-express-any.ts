import { Project, SyntaxKind, TypeNode, Node } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const sourceFiles = project.getSourceFiles(["server/**/*.ts", "client/src/**/*.{ts,tsx}"]);

let replacedCount = 0;

for (const sourceFile of sourceFiles) {
  let fileChanged = false;

  const asExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression);
  for (const asExpr of asExpressions) {
    if (asExpr.wasForgotten()) continue;
    const typeNode = asExpr.getTypeNode();
    if (typeNode && typeNode.getKind() === SyntaxKind.AnyKeyword) {
      const exprText = asExpr.getExpression().getText();
      if (exprText === "req" || exprText === "user" || exprText.includes("req.session.user") || exprText === "file" || exprText === "cb" || exprText === "error" || exprText === "err" || exprText === "parseErr" || exprText === "original" || exprText === "p" || exprText === "a" || exprText === "f" || exprText === "factor" || exprText === "item" || exprText === "entry" || exprText === "record" || exprText === "comp") {
        asExpr.replaceWithText(exprText);
        fileChanged = true;
        replacedCount++;
      } else if (exprText === "getRedisConnection()") {
        asExpr.replaceWithText(`${exprText} as unknown`);
        fileChanged = true;
        replacedCount++;
      }
    }
  }

  // Find explicit `any` types in parameters
  const params = sourceFile.getDescendantsOfKind(SyntaxKind.Parameter);
  for (const param of params) {
    if (param.wasForgotten()) continue;
    const typeNode = param.getTypeNode();
    if (typeNode && typeNode.getKind() === SyntaxKind.AnyKeyword) {
        const name = param.getName();
        if (name === "req" || name === "res" || name === "next") {
            param.setType("Parameters<RequestHandler>[0]");
            fileChanged = true;
            replacedCount++;
        } else if (name === "file" || name === "cb" || name === "error" || name === "err") {
            param.setType("unknown");
            fileChanged = true;
            replacedCount++;
        }
    }
  }
  
  if (fileChanged) {
    sourceFile.saveSync();
  }
}

console.log(`Replaced ${replacedCount} express and variable 'any' casts.`);
