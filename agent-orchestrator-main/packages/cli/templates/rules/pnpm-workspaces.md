This is a pnpm monorepo with workspaces.
Run commands from root with pnpm -r (recursive) or from specific package directories.
Before pushing: pnpm build && pnpm typecheck && pnpm lint && pnpm test.
Always build packages before running dependent packages.
