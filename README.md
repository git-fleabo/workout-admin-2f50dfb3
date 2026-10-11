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

For offline workout/climbing logging, open the app and Log while online first to cache the shell and logger references. Finished offline workouts appear as pending saves on the original browser/device and account until confirmed by sync. Keep browser storage until they sync. Older saves made before operation IDs need review against history before retrying. See [save and recovery verification](docs/save-recovery-verification-2026-10-11.md) for the current contract and validation.

Manage offers a versioned JSON backup of server profile data and required catalogue references; CSV contains session-analysis rows. The JSON manifest lists counts, external references and exclusions. `readProfileBackup` validates the supported format; reconstruction is tested in an isolated database, with generated columns recomputed and foreign keys checked before commit. Auth/access setup, server schema and device-only work/preferences are separate. See [backup contract and verification](docs/review-progress-backup-verification-2026-10-11.md).
