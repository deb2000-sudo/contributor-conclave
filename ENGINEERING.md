# contributor-conclave engineering rules

Secure contributor mentorship platform. Students, Mentors, and Administrators work together around GitHub contribution and pull-request review.

This document is the canonical engineering spec. Application code must follow it. Production runs on Google Cloud. Do not target Vercel for production.

## Technology

| Concern | Choice |
| --- | --- |
| Application | Next.js 16, React, TypeScript, Tailwind CSS |
| Local database | PostgreSQL via Docker |
| ORM | Prisma; schema changes ship as migrations |
| Production database | Google Cloud SQL for PostgreSQL |
| Runtime | Google Cloud Run |
| CI/CD | Google Cloud Build (`cloudbuild.yml`) |
| Images | Artifact Registry |
| External API | GitHub API, with GitHub PAT integration |

## Roles

- `STUDENT`
- `MENTOR`
- `ADMIN`

Every protected action checks the caller's role. Resource access also checks ownership when the role does not grant broader access.

## Application architecture

- TypeScript strict mode stays on.
- Server Components are the default.
- Add `"use client"` only when the UI needs browser interactivity (event handlers, local state, browser APIs).
- Fetch data on the server when the page can render it there. Avoid client fetches that only reimplement a server read.
- Validate every input on the server. Client checks are a convenience, not the security boundary.
- Keep modules small and focused. Share business rules in one place; do not copy them into routes, actions, and clients.
- Build reusable UI components instead of duplicating markup.
- Handle errors in one place. Return safe messages to users and log the underlying failure.
- Use structured logs (event name plus stable fields such as request id, user id, and role). Do not log secrets, passwords, or GitHub tokens.

## Security

- Authenticate users with a secure server-side mechanism.
- Authorize every API mutation. Unauthenticated or under-privileged callers receive a denial, not a partial write.
- Before reading or changing a resource, verify ownership or an explicit role permission.
- Store passwords only as a strong one-way hash. Never store or log plaintext passwords.
- Keep secrets in environment variables or the platform secret store. Never commit them.
- Do not put secrets in `NEXT_PUBLIC_*` variables. Those values are shipped to the browser.
- GitHub PATs and other GitHub credentials stay on the server. Browser code must not receive the token, a token prefix, or a response field that contains it.

## Accessibility and UI

- Use semantic HTML.
- Label every form control.
- Support keyboard navigation and visible focus states.
- Layouts work on small and large viewports.
- Prefer Tailwind utilities already used by the app. Do not add a second styling system.

## Testing

- Unit tests for pure logic and validators. `npm run test:unit`
- Integration tests for database access, authorization, and mutations. `npm run test:integration`
- End-to-end tests for the main student, mentor, and admin flows. `npm run test:e2e`
- `npm test` runs all three. `npm run test:coverage` reports unit and integration coverage.

Tests are deterministic. They use the local `contributor_conclave_test` database and a GitHub fixture. They do not use production credentials or the development database.

## Deployment

| Environment | Database | How it runs |
| --- | --- | --- |
| Local development | PostgreSQL 17 in Docker | Next.js dev server |
| Production | Cloud SQL for PostgreSQL | Cloud Run |

Cloud Build (`cloudbuild.yml`) builds the image from `Dockerfile`, pushes it to Artifact Registry, applies migrations, and deploys to Cloud Run. The container listens on `0.0.0.0` and the platform `PORT`. Database and GitHub credentials are runtime environment variables, not image contents.

Do not add Vercel project config, Vercel-only deploy docs, or a production path that depends on Vercel.

## Continuous delivery

A Cloud Build trigger runs `cloudbuild.yml` on a push to the production branch. The file uses the built-in `$PROJECT_ID` and the substitutions below. It does not name a Google Cloud project. Change the substitution values to match the resources you create. Do not commit secret values into the trigger or the file.

| Substitution | Default | Meaning |
| --- | --- | --- |
| `_REGION` | `us-central1` | Region for Artifact Registry, Cloud Run, and Cloud SQL |
| `_AR_REPOSITORY` | `contributor-conclave` | Artifact Registry Docker repository |
| `_SERVICE` | `contributor-conclave` | Cloud Run web service |
| `_MIGRATION_JOB` | `contributor-conclave-migrate` | Cloud Run job that runs `prisma migrate deploy` |
| `_SQL_INSTANCE` | `contributor-conclave` | Cloud SQL instance id. Connection name is `$PROJECT_ID:_REGION:_SQL_INSTANCE` |
| `_RUN_SERVICE_ACCOUNT` | `contributor-conclave-run` | Runtime service account id, without the domain |
| `_DATABASE_SECRET` | `contributor-conclave-database-url` | Secret Manager id for the Cloud SQL URL |
| `_GITHUB_TOKEN_SECRET` | `contributor-conclave-github-token` | Secret Manager id for the GitHub token |
| `_MESSAGE_KEY_SECRET` | `contributor-conclave-message-key` | Secret Manager id for message encryption |
| `_MIN_INSTANCES` | `0` | Cloud Run minimum instances |
| `_MAX_INSTANCES` | `10` | Cloud Run maximum instances. Keep this inside the Cloud SQL connection budget |
| `_CONCURRENCY` | `40` | Requests accepted per instance |
| `_MEMORY` | `1Gi` | Web service memory |

The pipeline fails if lint, typecheck, or tests fail. It does not continue to push or deploy.

1. `npm ci` and `prisma generate`
2. Lint and typecheck
3. Unit tests
4. Integration tests against an ephemeral Postgres 17 container on the Cloud Build network. That database is not Cloud SQL and is not the production `DATABASE_URL`.
5. `next build`
6. Build the web image and the `migrate` image, tagged with the commit SHA
7. Push both images to Artifact Registry
8. Update and execute the migration job, attached to Cloud SQL, before the new web revision receives traffic
9. Deploy the web service on port 8080, attached to the same Cloud SQL instance, with secrets mounted from Secret Manager
10. Request `/` and require HTTP 200

Cloud Run sets `PORT`. The pipeline passes `--port=8080` and does not put a database URL or GitHub token in `--set-env-vars`. `--set-secrets` passes secret resource names only. The build service account does not read those secret values.

Images are deployed by commit SHA (or the Cloud Build id when a manual build has no SHA). Do not retag an existing SHA.

### Resources to create before the first build

These examples use placeholders. They are not run by this repository. Create each resource once.

```bash
gcloud artifacts repositories create contributor-conclave \
  --project=PROJECT_ID \
  --location=REGION \
  --repository-format=docker

gcloud iam service-accounts create contributor-conclave-run \
  --project=PROJECT_ID \
  --display-name="contributor-conclave Cloud Run runtime"
```

Create three Secret Manager secrets and add a version to each outside this repository: the Cloud SQL `DATABASE_URL` (socket form in the Cloud SQL section), the GitHub token, and the message encryption key. Do not pass those values as Cloud Build substitutions.

Create a Cloud Build trigger on the production branch of this repository, pointing at `cloudbuild.yml`. Use a dedicated Cloud Build service account rather than a project owner.

Cloud SQL creation is in the next section. The instance id must match `_SQL_INSTANCE`, and the instance region must match `_REGION`.

### IAM

Runtime service account `contributor-conclave-run@PROJECT_ID.iam.gserviceaccount.com`. This is the Cloud Run service identity. Grant only:

| Role | Scope |
| --- | --- |
| `roles/cloudsql.client` | The Cloud SQL instance |
| `roles/secretmanager.secretAccessor` | The three secrets above, not the whole project |

Do not grant this account Cloud SQL admin, Secret Manager admin, or project owner.

Cloud Build service account. Grant only:

| Role | Scope |
| --- | --- |
| `roles/artifactregistry.writer` | The Docker repository |
| `roles/run.developer` | Deploy the service and job, and execute the job |
| `roles/iam.serviceAccountUser` | The runtime service account only |
| `roles/logging.logWriter` | The project, so the build can write logs |

Do not grant the Cloud Build account `roles/secretmanager.secretAccessor` or `roles/cloudsql.client`. It references secrets by name. The runtime account reads them when Cloud Run starts.

The public web service allows unauthenticated Cloud Run invocations so students and mentors can open the login page. Application sessions still authorize every protected action. That is separate from the runtime service account.

## Cloud SQL

PostgreSQL is the only database. Local development uses the Docker Compose database. Production uses Cloud SQL for PostgreSQL. `DATABASE_URL` is the only connection setting that chooses between them. Do not add another database engine, and do not point local development at Cloud SQL.

```text
Local
  next dev  --DATABASE_URL-->  localhost:5432  -->  Docker PostgreSQL 17

Production
  Cloud Run service  --unix socket-->  Cloud SQL for PostgreSQL
  Cloud Run migrate job (once per release)  --same socket, same instance-->
```

Placeholders such as `PROJECT_ID`, `REGION`, and `INSTANCE_ID` are not real project identifiers. Replace them when creating resources. Do not commit those values or any password.

### Database creation

Create one Cloud SQL for PostgreSQL instance, major version 17, in the same region as the Cloud Run service. Use a private path: attach the instance to Cloud Run with its connection name. A public IP is not required for that path.

1. Create the instance. Record the connection name `PROJECT_ID:REGION:INSTANCE_ID`.
2. Create a database named `contributor_conclave`.
3. Create an application user that is not the `postgres` superuser. Store the password in Secret Manager.
4. Give the Cloud Run runtime service account `roles/cloudsql.client` on that instance.
5. Enable automated backups and point-in-time recovery on the instance.
6. Read `max_connections` for the chosen machine size before setting Cloud Run's maximum instances.

The machine size below is an example. Check that tier's `max_connections` before choosing Cloud Run's maximum instances. These commands are documentation. They are not run by this repository.

```bash
gcloud sql instances create INSTANCE_ID \
  --project=PROJECT_ID \
  --region=REGION \
  --database-version=POSTGRES_17 \
  --edition=ENTERPRISE \
  --tier=db-custom-1-3840

gcloud sql databases create contributor_conclave \
  --project=PROJECT_ID \
  --instance=INSTANCE_ID
```

Create the application user and its password in Secret Manager. Do not pass a production password on a command line that is logged, and do not write it into git.

### Connection configuration

The web process and Prisma CLI both read `DATABASE_URL`.

Local (`.env`, gitignored; the template is `.env.example`):

```text
postgresql://postgres:postgres@localhost:5432/contributor_conclave
```

Production, injected into Cloud Run from Secret Manager. The host is the Cloud SQL socket directory that Cloud Run mounts when the service or job is attached to the instance. The connector encrypts the path, so this URL does not use a public IP and does not set `sslmode=require` (that setting breaks the unix socket).

```text
postgresql://DB_USER:URL_ENCODED_PASSWORD@localhost/contributor_conclave?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_ID
```

Percent-encode reserved characters in the password. Attach the instance on both the web service and the migration job:

```text
--add-cloudsql-instances=PROJECT_ID:REGION:INSTANCE_ID
```

The Next.js server does not open the pool until the first query, and it keeps one pool per process. Cloud Run runs one process per instance. The pool is capped so instance count, not an unbounded client, controls connection use:

| Setting | Value |
| --- | --- |
| `DATABASE_POOL_MAX` | Default 5. Allowed 1–10. Each instance opens at most this many connections. |
| Idle timeout | 10 seconds. Idle instances release connections. |
| Connect timeout | 10 seconds. A saturated pool fails the request instead of waiting forever. |
| Statement timeout | 15 seconds on application queries. |
| Idle transaction timeout | 15 seconds. |
| Connection lifetime | 10 minutes, then the pool replaces the connection. |
| Application name | `contributor-conclave`, visible in Cloud SQL sessions. |

Size the instance before raising scale:

```text
(Cloud Run max instances × DATABASE_POOL_MAX) + 3 < Cloud SQL max_connections
```

The extra 3 leaves room for the migration job and an operator session. Start with a modest maximum instance count. Raise Cloud SQL `max_connections` (by choosing a larger machine) before raising Cloud Run's maximum instances or `DATABASE_POOL_MAX`. Do not set the pool minimum above 0.

`prisma migrate deploy` uses its own connection. It does not use this pool, and the 15-second statement timeout does not apply to it.

### Migration strategy

Schema changes are Prisma migrations in `prisma/migrations`. Author them against Docker PostgreSQL with `npm run db:migrate`. Production applies the committed SQL only.

| Step | Where | Command |
| --- | --- | --- |
| Author | Local Docker | `npm run db:migrate` |
| Apply in production | Cloud Run job, once | `prisma migrate deploy` |

Build the job image with `docker build --target migrate`. The default image remains the web server. Run the job with the production `DATABASE_URL` secret and the Cloud SQL attachment, then deploy the web revision. Do not run migrations inside the Next.js process and do not run them on every container start. Those patterns race across instances and open extra connections.

A migration that ships while the previous revision is still serving must be backward compatible: add nullable columns or new tables first, deploy the code that uses them, then enforce or drop in a later release. Do not drop or rename a column in the same release as the code that still reads it.

Partial unique indexes in the existing SQL must stay in the committed migrations. Production uses `migrate deploy`, which applies those files as written.

### Backups

Turn on Cloud SQL automated backups and point-in-time recovery, and keep the backups in the same region as the instance. The Docker named volume is local development data. It is not a production backup.

A restore replaces database contents. Practice a restore into a separate instance, not by overwriting production as part of a deploy. This repository does not script backup deletion or an in-place restore.

### Production secrets

Store these in Secret Manager and mount them as Cloud Run environment variables (`--set-secrets`). Do not commit them, do not pass them as image build arguments, and do not put them in `NEXT_PUBLIC_*`.

| Secret | Who reads it |
| --- | --- |
| `DATABASE_URL` | Web service and the one-shot migration job |
| `GITHUB_TOKEN` | Web service |
| `MESSAGE_ENCRYPTION_KEY` | Web service |

Local values live only in `.env`. `.env.example` documents the variable names and the local Docker URL. A Cloud SQL URL does not belong in that file.

Use a different message-encryption key and GitHub token in production than on a laptop. Rotating `MESSAGE_ENCRYPTION_KEY` makes existing message bodies unreadable until they are re-encrypted with the new key, so treat that rotation as its own change.

### Rollback

Roll back the Cloud Run web revision to the previous image when the schema change is still compatible with that image. That is the normal rollback. It does not undo a migration that has already been applied.

Do not automate `prisma migrate down` against Cloud SQL. If a migration must be undone and the data change is reversible, add a new forward migration and deploy that. If the data itself must return to an earlier time, use Cloud SQL point-in-time recovery as a deliberate operator action. That restore replaces the database. It is not part of the deploy pipeline.
