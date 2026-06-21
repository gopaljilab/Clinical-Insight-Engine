import { Project, SyntaxKind } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const sourceFiles = project.getSourceFiles("server/routes/**/*.ts");

let replacedCount = 0;

for (const sourceFile of sourceFiles) {
  let fileChanged = false;

  // Add imports if they don't exist
  const hasAsyncHandler = sourceFile.getImportDeclaration(decl => decl.getModuleSpecifierValue() === "../utils/asyncHandler");
  if (!hasAsyncHandler) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: "../utils/asyncHandler",
      namedImports: ["asyncHandler"],
    });
    fileChanged = true;
  }

  const hasErrors = sourceFile.getImportDeclaration(decl => decl.getModuleSpecifierValue() === "../utils/AppError");
  if (!hasErrors) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: "../utils/AppError",
      namedImports: ["AppError", "ValidationError", "NotFoundError", "ForbiddenError", "UnauthorizedError"],
    });
    fileChanged = true;
  }

  // Find router methods: router.post, router.get, etc.
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const callExpr of callExpressions) {
    if (callExpr.wasForgotten()) continue;
    
    const expression = callExpr.getExpression();
    if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = expression.asKind(SyntaxKind.PropertyAccessExpression);
      if (propAccess && propAccess.getExpression().getText().includes("router")) {
        const args = callExpr.getArguments();
        
        // Find the async callback argument (usually the last one)
        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          if (arg.getKind() === SyntaxKind.ArrowFunction || arg.getKind() === SyntaxKind.FunctionExpression) {
            const func = arg.asKind(SyntaxKind.ArrowFunction) || arg.asKind(SyntaxKind.FunctionExpression);
            if (!func) continue;

            // Check if already wrapped in asyncHandler
            const parent = func.getParentIfKind(SyntaxKind.CallExpression);
            if (parent && parent.getExpression().getText() === "asyncHandler") {
              continue;
            }

            // Wrap with asyncHandler
            func.replaceWithText(`asyncHandler(${func.getText()})`);
            fileChanged = true;
            replacedCount++;
          }
        }
      }
    }
  }

  // Replace manual res.status(400).json or res.status(404).json with throws
  const resStatusCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const resCall of resStatusCalls) {
    if (resCall.wasForgotten()) continue;
    const text = resCall.getText();
    if (text.startsWith("res.status(400).json") || text.startsWith("res.status(400).send")) {
       const args = resCall.getArguments();
       if (args.length > 0) {
           resCall.replaceWithText(`throw new ValidationError(String(${args[0].getText()}))`);
           fileChanged = true;
       }
    } else if (text.startsWith("res.status(404).json") || text.startsWith("res.status(404).send")) {
       const args = resCall.getArguments();
       if (args.length > 0) {
           resCall.replaceWithText(`throw new NotFoundError(String(${args[0].getText()}))`);
           fileChanged = true;
       }
    } else if (text.startsWith("res.status(500).json") || text.startsWith("res.status(500).send")) {
       const args = resCall.getArguments();
       if (args.length > 0) {
           resCall.replaceWithText(`throw new AppError(String(${args[0].getText()}), 500)`);
           fileChanged = true;
       }
    }
  }

  if (fileChanged) {
    sourceFile.saveSync();
  }
}

console.log(`Refactored ${replacedCount} routes with asyncHandler and AppError throws.`);
