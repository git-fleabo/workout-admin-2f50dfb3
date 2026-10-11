# Train & Track

Use **Bun 1.4.3** to install dependencies. `bun.lock` is the authoritative lockfile; commit changes to it alongside `package.json`. Do not generate a competing npm lockfile.

```sh
bun install --frozen-lockfile
bun run dev
```

Node.js 22 is also required by the existing unit/database test runner. Validation uses the same frozen dependency installation:

```sh
bun run test
bun run test:components --maxWorkers=2
bunx tsc --noEmit
bun run lint
bun run build
bun audit
```

Database tests create isolated local PostgreSQL clusters with Unix sockets. They cannot connect to production. Make `initdb`, `pg_ctl` and `psql` available on `PATH`, or set `PERSONAL_PROGRAMME_PG_BIN` to their directory. Check that database tests execute rather than skip before merging a migration.

Supabase changes belong in `supabase/migrations/`. Apply a tested migration before publishing the frontend that calls a new RPC. Local builds and repository commits do not confirm Lovable publication; verify the published build and signed-in flow independently.
