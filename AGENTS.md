<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# contributor-conclave

Secure mentorship platform for Students, Mentors, and Administrators around GitHub contribution and pull-request review. Canonical rules: `ENGINEERING.md`. Cursor copies: `.cursor/rules/`.

Do not recreate the app. Do not target Vercel for production. Google Cloud is mandatory: Cloud Run, Cloud Build (`cloudbuild.yml`), Artifact Registry, Cloud SQL for PostgreSQL. Local development uses Docker PostgreSQL, Prisma, and the Next.js dev server.

## Stack

Next.js 16, React, TypeScript (strict), Tailwind CSS, PostgreSQL, Prisma, GitHub API with server-side GitHub PAT integration.

## Roles

`STUDENT`, `MENTOR`, `ADMIN`. Authorize every mutation. For each resource, verify ownership or an explicit role permission.

## Rules that must not be weakened

- Server Components by default. Client Components only when interactivity requires them.
- Server-side validation on every input. Prefer server data fetching over client fetching.
- No secrets in source. No secrets in `NEXT_PUBLIC_*`. No plaintext passwords. No GitHub token, or token material, in browser code.
- Database changes require Prisma migrations.
- One implementation of each business rule. Small modules, reusable components, centralized errors, structured logs without secrets.
- Accessible, responsive UI: semantic HTML, labels, keyboard access, visible focus.
- Tests: unit, integration, and end-to-end.
