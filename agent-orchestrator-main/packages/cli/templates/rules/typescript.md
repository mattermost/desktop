Use TypeScript strict mode.
Use ESM modules with .js extensions in imports (e.g., import { foo } from "./bar.js").
Use node: prefix for built-in modules (e.g., import { readFile } from "node:fs").
Prefer const over let, never use var.
Use type imports for type-only imports: import type { Foo } from "./bar.js".
No any types - use unknown with type guards instead.
