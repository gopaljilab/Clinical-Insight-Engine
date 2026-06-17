# ESLint & TypeScript Standards

## Core Philosophy
We enforce strict static analysis to prevent runtime errors in clinical logic. Bypassing TypeScript checks or ESLint rules is strictly prohibited without explicit team lead approval.

## Key TypeScript Rules
- `noImplicitAny`: Enabled. All variables and parameters must be explicitly typed.
- `strictNullChecks`: Enabled. Prevents accessing properties of `undefined` or `null`.

## Key ESLint Rules
- `@typescript-eslint/no-explicit-any`: Throws an error. Use `unknown` and type narrowing instead.
- `react-hooks/exhaustive-deps`: Throws a warning. Ensure all React `useEffect` dependencies are declared.
- `no-console`: Warning in development, Error in CI. Prevents accidental leakage of patient data into standard browser consoles.

## Pre-commit Hooks
We use Husky and lint-staged to automatically format code with Prettier and run ESLint on staged files before every commit.
```bash
# Manual check
npm run lint
```
