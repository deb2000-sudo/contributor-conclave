# Contributor Conclave

## Overview

Contributor Conclave is a mentorship platform for GitHub contribution and pull-request review. Students submit real pull requests, administrators assign an approved mentor, and the mentor reviews the change and talks with the student beside that pull request.

The product keeps the student, the assigned mentor, and the administrator on one record of the work: who owns the pull request, who is allowed to see it, what the review decided, and what was said.

## Problem

Open-source practice often splits across tools that do not share a permission model.

Students submit a link in chat or email, then lose track of whether anyone is reviewing it. They cannot tell which comments belong to their pull request, and they have no single place that shows their repositories, submissions, and mentor.

Mentors receive requests for people they do not supervise. Private repository details, review notes, and messages leak when access is a shared document instead of an assignment.

Administrators approve mentors, match them to a tech stack, and close or reassign work without an audit trail. Account status, queue order, and who changed a decision are hard to reconstruct later.

## Solution

Contributor Conclave stores the pull request, the active mentor assignment, the review, and the conversation in PostgreSQL. Every read and write checks the signed-in user.

A student sees only their own submissions. A mentor sees a student only while an active assignment links them. An administrator manages the queue, mentor approval, tech stacks, and account status. GitHub data is fetched on the server. The browser receives public profile and pull-request fields, not a GitHub credential.

## Core Users

### Student

A student registers with a name, email, NIAT ID, batch, university, and GitHub username. After login they use a workspace for their profile, contribution activity, repositories, pull requests, submissions, reviews, assigned mentors, and messages.

### Mentor

A mentor registers with a NxtWave email and an employee ID. The account stays pending until an administrator approves it. An approved mentor sees assigned students, opens the pull requests they were given, starts and posts reviews, and messages those students.

### Admin

An administrator is not created through public registration. Admins approve or reject mentors, maintain tech stacks, assign and reassign mentors, manage students and submissions, and read the audit log.

## Core Features

### Authentication

Students and mentors register and log in with email and password. Passwords are stored as Argon2id hashes. A session is a random token in an `HttpOnly` cookie; the database stores only a hash of that token. Logout deletes the session. Login and registration are rate limited per account and per client address.

### Student Dashboard

The student home shows the signed-in profile, recent submissions, and GitHub contribution statistics. Related pages list submissions, repositories, pull requests, reviews, activity, mentors, and messages. Lists are paged on the server.

### GitHub Integration

The server calls the GitHub API with a personal access token read from the environment. It loads the student's public profile, contribution calendar, repositories, and pull-request details. Responses are cached briefly in the server process. Tests use a fixture and do not call GitHub.

### PR Submission

A student submits a GitHub pull-request URL. The server validates the URL, confirms it belongs to the student's GitHub account, and stores the submission as pending. Duplicate submissions of the same pull request are rejected.

### Mentor Assignment

An administrator assigns an approved mentor who is linked to the submission's tech stack. A submission has at most one active assignment. Reassignment and cancellation are recorded. Mentors cannot be assigned while their account is pending or rejected.

### Mentor Dashboard

The mentor workspace lists assigned students, pull requests, reviews, messages, and profile details. Opening a student or a pull request requires that mentor's active assignment.

### PR Review

A mentor starts a review on an assigned submission and posts a decision of approved or changes requested, with a comment. The submission status follows that decision. Another mentor cannot review the same submission.

### Student-Mentor Chat

The student and the active mentor share one conversation per submission. Message bodies are encrypted at rest with an application key. That storage encryption is not end-to-end encryption. Sending is rate limited. A message cursor must belong to that conversation.

### Admin Dashboard

Administrators work a queue of pending submissions, approve mentors, edit tech stacks, inspect students and mentors, and update submission state. Each mutation checks that the caller is an active administrator.

### Audit Logging

Assignment, review, submission, mentor approval, tech-stack, and account changes write an audit row with the actor, action, and target. Audit details store decisions and identifiers. They do not store passwords or message bodies.

## Technology Stack

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- GitHub API
- Docker
- Google Cloud Run
- Google Cloud Build
- Artifact Registry
- Cloud SQL

## Architecture

The App Router renders pages as Server Components. Client Components are used where the screen needs a form, a menu, or other browser interaction. Route handlers cover login, registration, logout, and the current session. Mutations from the workspace use server actions.

Domain rules live in `src/lib`: authentication, student submissions, GitHub access, mentor review, admin assignment, and messaging. Pages call those modules with the session user. They do not trust an id supplied by the browser as the actor.

Prisma talks to PostgreSQL through a small connection pool. The pool opens on the first query. `DATABASE_URL` selects the database: Docker on a laptop, Cloud SQL in production. One pool is kept per process.

Production is a container. Cloud Run listens on `0.0.0.0` and the platform `PORT`. A separate migrate image runs `prisma migrate deploy` once per release, before the new web revision takes traffic.

## Local Development

Prerequisites:

- Node.js 22 and npm
- Docker, with host port 5432 free

Setup:

1. Copy the environment template: `cp .env.example .env`. `.env` is gitignored.
2. Start PostgreSQL: `npm run db:up`. Data stays in the named volume `contributor_conclave_postgres_data`.
3. Check the schema: `npm run db:validate`.
4. Generate the Prisma Client: `npm run db:generate`. Output goes to `src/generated`.
5. Apply migrations: `npm run db:deploy`.
6. Start the app: `npm run dev`.
7. Open `http://localhost:3000`.

`npm run db:down` stops the container and keeps the volume. `npm run db:studio` opens Prisma Studio. `npm run db:migrate` creates a new migration from the schema and applies it locally. Use that only while authoring a schema change. Production applies migrations that are already committed.

Set `GITHUB_TOKEN` in `.env` when you want live GitHub data, then restart the dev server. Leave it empty to run without calling GitHub. Generate a local `MESSAGE_ENCRYPTION_KEY` before using chat. The command is in `.env.example`.

## Environment Variables

Names only. Values belong in `.env` locally and in Secret Manager in production. Do not commit them, and do not prefix them with `NEXT_PUBLIC_`.

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Local development uses the Docker database. Production uses the Cloud SQL socket URL. |
| `DATABASE_POOL_MAX` | Optional pool size for one process. Default 5. Allowed range 1–10. |
| `GITHUB_TOKEN` | Server-only GitHub personal access token used to read GitHub data. |
| `MESSAGE_ENCRYPTION_KEY` | 32-byte key, base64-encoded, used to encrypt message bodies at rest. |
| `AUTHOR_NAME` | Name shown in the footer. Public display text, not a credential. Leave empty until it is known. |
| `AUTHOR_GITHUB_URL` | Author GitHub profile, `https://github.com/USERNAME`. The footer omits the link when this is empty or not a profile URL. |
| `AUTHOR_LINKEDIN_URL` | Author LinkedIn profile, `https://www.linkedin.com/in/PROFILE`. The footer omits the link when this is empty or not a profile URL. |

`.env.example` is the local template. It matches Docker Compose and is not a production credential. A Cloud SQL password does not belong in that file.

## Database

Local development uses PostgreSQL 17 from `docker-compose.yml`, database name `contributor_conclave`, published on port 5432. Do not point a laptop at Cloud SQL.

Production uses one Cloud SQL for PostgreSQL 17 instance in the same region as Cloud Run. The application user is not the database superuser. Cloud Run reaches the instance through the Cloud SQL unix socket. The web service and the migration job both attach to that instance.

Schema changes are SQL files in `prisma/migrations`. Author them locally. Cloud Build runs the migrate image once, then deploys the web service. Migrations that ship while the previous revision is still running must stay compatible with that revision.

The connection budget is `(Cloud Run max instances × DATABASE_POOL_MAX) + 3`, which must stay below Cloud SQL `max_connections`. Enable automated backups and point-in-time recovery on the instance. The Docker volume is not a production backup.

## Authentication and Authorization

Roles are `STUDENT`, `MENTOR`, and `ADMIN`. The role is loaded from the database with the session. It is not stored in the cookie and not accepted from the client.

Public registration creates students and pending mentors. It rejects an admin role. A mentor cannot be assigned until an administrator approves the account. Deactivated users cannot sign in.

Protected pages require the matching role. Services check again before a read or write:

- A student can open only their own submissions, dashboard, and conversations.
- A mentor can open a student or a pull request only with an active assignment for that mentor.
- Admin operations require an active administrator.

Changing an id in the URL does not grant access. The service returns a denial and does not include the other person's private fields.

The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production. It expires after seven days. Expired and deactivated sessions are removed. Login failures and registration attempts are limited for 15 minutes. Unknown emails still run a password comparison so the response time does not reveal whether the account exists.

## GitHub Integration

`GITHUB_TOKEN` is read on the server. The browser never receives the token, a prefix, or a response field that contains it. Do not rename it to a `NEXT_PUBLIC_` variable.

The token is sent only on the outbound GitHub request. Logs record the path with the token redacted, plus the status and error code. They do not record the `Authorization` header. Cached entries are keyed by whether a token is present, not by the token value. Cache entries expire after a short interval and the cache is capped.

A fine-grained token with read access to public repositories is enough for public data. Add private-repository access only when the deployment must read private repositories. Production stores the token in Secret Manager. Local development stores it in `.env`. Tests set the token empty and use a fixture.

## Testing

Tests are deterministic. They use the `contributor_conclave_test` database and a GitHub fixture. They do not use production credentials or the development database.

| Command | What it runs |
| --- | --- |
| `npm run test:unit` | Validators, authorization helpers, GitHub parsing, contrast, and other pure logic. |
| `npm run test:integration` | Database access, registration, sessions, submissions, assignments, messaging, and cross-role access. |
| `npm run test:e2e` | Playwright flows for student, mentor, and admin on `http://localhost:3100`. |
| `npm test` | Unit, integration, and end-to-end. |
| `npm run test:coverage` | Coverage for unit and integration. |

Accessibility checks run with the unit tests. They use axe-core on rendered components and check contrast for the colors used in the interface. End-to-end tests sign in through the real forms and follow the main workspace paths.

Integration tests expect the local Docker database to be running, unless `TEST_DATABASE_URL` points at a database you have already migrated. Playwright starts its own Next.js server against the test database.

## Deployment

Production path:

GitHub → Cloud Build → Artifact Registry → Cloud Run → Cloud SQL

A push to the production branch starts Cloud Build. The build publishes two images to Artifact Registry: the web server and a migrate image. The migrate job attaches to Cloud SQL, applies committed migrations, and finishes before the new Cloud Run revision receives traffic. The web service listens on port 8080, uses the same Cloud SQL instance, and reads `DATABASE_URL`, `GITHUB_TOKEN`, and `MESSAGE_ENCRYPTION_KEY` from Secret Manager.

Cloud Run accepts unauthenticated HTTP so visitors can open the login page. Application sessions still authorize every protected page and mutation. That is separate from the runtime service account, which can use the Cloud SQL client role and read only those three secrets.

The container runs as a non-root user. The image does not contain a database URL or a GitHub token. Roll back by deploying the previous web revision when the schema is still compatible. Do not run a down migration as part of deploy.

## CI/CD

`cloudbuild.yml` is the pipeline. The Google Cloud project id comes from Cloud Build. Resource names are substitutions with defaults, not hard-coded project ids. Secret values are not stored in the file.

1. Install dependencies and generate the Prisma Client.
2. Lint and typecheck.
3. Run unit tests.
4. Start an ephemeral PostgreSQL 17 container and run integration tests. That database is not Cloud SQL.
5. Build the Next.js app.
6. Build the web image and the migrate image, tagged with the commit SHA.
7. Push both images to Artifact Registry.
8. Update and run the Cloud Run migration job.
9. Deploy the Cloud Run web service with the Cloud SQL attachment and Secret Manager mounts.
10. Request `/` and require HTTP 200.

The pipeline stops if lint, typecheck, or tests fail. The Cloud Build service account can push images and deploy Cloud Run. It does not read secret values and it does not connect to Cloud SQL. The runtime service account does.

## Security

- Passwords are Argon2id hashes. Plaintext passwords are not stored or logged.
- Session tokens are random. Only the SHA-256 hash is stored. The cookie is `HttpOnly` and `SameSite=Lax`, and `Secure` when `NODE_ENV` is production.
- Authorization uses the database role and, where required, ownership or an active mentor assignment.
- Input is validated on the server with Zod. Prisma sends parameterized queries.
- React renders text as text. Error pages show a generic message and do not return stack traces.
- Login and registration return a generic limit response. They do not say whether an email is registered.
- Message bodies are encrypted before they are written. Chat participants are the submission's student and the active mentor.
- GitHub credentials and the message key stay on the server.
- Responses send `X-Content-Type-Options: nosniff`, a strict referrer policy, `X-Frame-Options: DENY`, a locked-down permissions policy, and a content security policy that blocks framing. Production also sends HSTS.
- Duplicate-registration logs record an event name, not the database error text.
- Audit logs omit passwords and message bodies.

The login limit is counted in each Cloud Run process. It slows guessing on that instance. It is not one counter shared by every instance.

## Accessibility

Pages use semantic regions, headings, and form labels. Controls are reachable from the keyboard, and focus is visible. After navigation, focus moves to the page heading. Status is text as well as color. Layouts adapt from small screens to wide ones. Component tests run axe-core, and contrast tests check the palette against WCAG contrast ratios.

## Performance

Pages load data in Server Components and stream the slower sections, including GitHub statistics, behind Suspense. Student lists page on the server instead of loading every submission into the first response. Dashboard counts use grouped queries, and the overview shows a short recent list.

The GitHub client caches successful reads for a short time, caps the cache, and does not store the token in the cache key. User data is not cached across requests. The database pool is small, idle connections close quickly, and queries use a statement timeout. Indexes cover the role lookup and the student's submissions by time.

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/app` | Routes, layouts, and route handlers for the public site, student, mentor, and admin workspaces. |
| `src/components` | Shared UI, the workspace shell, and forms for each role. |
| `src/lib` | Authentication, database access, GitHub, submissions, mentor review, admin workflow, and messaging. |
| `src/test` | Test database setup, fixtures, and seed data. |
| `prisma` | Schema and committed migrations. |
| `e2e` | Playwright tests. |
| `Dockerfile` | Multi-stage web image and the migrate image. |
| `docker-compose.yml` | Local PostgreSQL only. |
| `cloudbuild.yml` | Cloud Build pipeline. |
| `.env.example` | Local environment template. |

## Future Improvements

- Share the login and registration limit across Cloud Run instances, so the cap does not reset on each process.
- Offer a GitHub App or per-user authorization for private repositories, so production does not depend on one server token.
- Add end-to-end message encryption. The schema can record that mode; current messages use server-side encryption.
- Raise Cloud SQL capacity before raising Cloud Run's maximum instances, using the connection budget above.
