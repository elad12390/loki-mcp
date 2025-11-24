# Agent Guidelines for Loki MCP

## Build & Test
- **Build**: `npm run build` (compiles TypeScript to `dist/`)
- **Type check**: `npm test` or `npm run lint` (runs `tsc --noEmit`)
- **No unit tests**: This project uses type checking as validation

## Code Style

**Imports**: Use `.js` extensions for local imports (ES modules): `import { x } from "./file.js"`

**Types**: TypeScript strict mode enabled. Use explicit types for function parameters. `any` is acceptable for complex external types (e.g., `axios`, MCP SDK) with inline comments.

**Naming**: 
- Functions: camelCase (`handleSearchLogs`, `parseDurationToNs`)
- Classes: PascalCase (`LokiClient`, `MetricsManager`)
- Constants/exports: camelCase for instances (`lokiClient`, `metrics`), PascalCase for classes/types

**Error Handling**: Catch errors in handlers, return `{ content: [{ type: "text", text: "Error: ..." }], isError: true }`

**Tool Descriptions**: MUST include explicit trigger phrases. Format: `"🔍 Use when user asks: 'phrase1', 'phrase2'. Description of what it does."` This is critical for AI discoverability.

**Files**: Tools go in `src/tools/`, lib code in `src/lib/`. Register new tools in `src/tools/index.ts` (add to `tools` array and `handlers` object).

**Console**: Use `console.error()` for logging (stdout is reserved for MCP protocol).
