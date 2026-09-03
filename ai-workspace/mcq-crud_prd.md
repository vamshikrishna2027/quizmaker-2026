Date created: 2026-09-03
Date last modified: 2026-09-03

# MCQ CRUD - Technical PRD

## Overview/Problem

Sprint 1 delivered teacher registration, login, logout, and a placeholder MCQ landing page at `/mcq` with no question-bank behavior. Teachers still cannot create, edit, delete, list, or practice multiple-choice questions. This sprint replaces that stub with a real MCQ workspace at `/mcqs`: a shadcn table of questions, create/edit/delete flows, and a preview that records one or more graded attempts against the same question.

This document is the implementation contract. Implement **one phase at a time**, using TDD (Vitest) in every phase, and keep this PRD current as work lands.

---

## Hypothesis

We believe that giving teachers a shared MCQ bank — list, create, edit, delete, and preview-with-attempts — on top of the existing Users foundation will turn the post-login stub into a usable question workspace for later collaborative quiz features.

---

## Business Goal

Let a signed-in teacher manage multiple-choice questions (create, update, delete, list) and practice a question in preview, with each submit recorded as an attempt (selected choice + correct/incorrect).

---

## Scope

### In Scope

#### Database (three tables)

- `Mcqs` — the question itself.
- `McqChoices` — answer choices for a question (FK to `Mcqs`).
- `McqAttempts` — one row per preview submit (FK to the question, selected choice, and whether it was correct).
- Multiple attempts are allowed against the same question.
- Deleting an MCQ also deletes its choices and attempts.

#### MCQ Service

- Single service layer (same role as User Service in Sprint 1).
- Endpoints and pages must not query D1 directly.
- Operations: create/read/update/delete MCQs (with choices), list MCQs, create an attempt, load one MCQ with choices for edit/preview.

#### API Endpoints

- JSON route handlers under `/api/mcqs` for list, create, read, update, delete, and attempt submit.

#### List page (`/mcqs`) — replaces the Sprint 1 stub

- Route is **`/mcqs`** (plural), not `/mcq`.
- shadcn **Table** with columns **Name**, **Question**, **Actions**.
- Top right: **Create question** and **Log out**.
- Actions column: a **three-vertical-dots** button per row. Click opens a dropdown: **Edit**, **Preview**, **Delete**.
- Early conversation used “course” for the first column; that means the teacher-given **question name**. There is **no Course entity** in this sprint.

#### Create (`/mcqs/new`)

- Name text box, Question text box, **two** choice text boxes by default.
- A radio beside each choice marks the **correct** choice (exactly one).
- **Add choice** appends another choice row.
- Once there are more than two choices, every choice row shows **Remove**. Removing must not go below two choices.
- **Save** validates, then persists and returns to `/mcqs`.

#### Edit (`/mcqs/{id}/edit`)

- Same form as create, values prefilled for that question.
- Same validation and save rules. Save updates the existing question and its choices.

#### Delete

- From the row dropdown, **Delete** opens a confirmation popup.
- Confirm deletes that MCQ row **and** its linked choices (and attempts).
- Cancel leaves the table unchanged.

#### Preview (`/mcqs/{id}/preview`)

- Shows question name, question text, choices as radios (the teacher selects an answer), **Submit**, and **Back to questions** (to `/mcqs`).
- Submit with no radio selected: show **answer not selected** (do not write an attempt).
- Submit with a selection: grade it, show correct/incorrect below the choices, and persist an attempt (selected choice + whether correct).

#### Validation (create/edit save)

Save only when all of these pass:

1. No text box is empty (name, question, every choice).
2. No other MCQ has the same **name**.
3. No other MCQ has the same **question** text.
4. At least one correct-answer radio is checked.

On failure, show a popup with an **OK** button. Message rules:

- Empty field(s) → `text box is empty`
- No correct radio → `none of answer is selected`
- Both problems → **both** sentences in the same popup
- Duplicate name / duplicate question → include a clear sentence in the same popup (for example `question name already exists` and/or `question already exists`)

#### Auth landing path

- After login/register, land on **`/mcqs`**.
- Keep `/mcq` as a redirect to `/mcqs` so Sprint 1 bookmarks still work.
- Log out remains `POST /logout` and returns to login.

#### TDD and documentation

- Vitest for every phase: failing test → implement → refactor; keep the suite green before the next phase.
- Update this PRD after each phase (status markers, file paths, troubleshooting).

### Out of Scope

- AI-generated questions or any AI SDK usage
- Course, class, or curriculum entities
- Assembling quizzes, timers, or publishing a test to students
- Attempt-history UI (attempts are **recorded**; there is no history page this sprint)
- Role-based access, admin users, or per-teacher private banks
- Cookies, JWTs, server sessions, refresh tokens (same boundary as Sprint 1, with the actor-id note below)
- Password reset, email verification, social login
- Images, rich text, or markdown in questions
- Remote D1 migrations or `npm run deploy`

### Cut

- **Per-user filtered lists** — the table shows the shared bank (all MCQs). `CreatedByUserId` is stored for attribution, not for hiding other teachers’ questions.
- **Multiple correct answers** — one radio means exactly one correct choice.
- **Drag-and-drop choice reorder** — store `Position` internally; no reorder UI this sprint.
- **Persistent server auth** — still not introduced; see Architecture Notes.

---

## Architecture Notes

Follow the Sprint 1 stack, bottom-up:

```
D1 tables (Mcqs, McqChoices, McqAttempts)
        ↑
   MCQ Service   (only module that talks to D1 for MCQ data)
        ↑
   /api/mcqs*    (Zod-validated route handlers)
        ↑
   App Router UI (/mcqs, /mcqs/new, /mcqs/[id]/edit, /mcqs/[id]/preview)
```

- Mirror User Service: pass `D1Database` in, return mapped records, throw typed errors (`McqNotFoundError`, `McqConflictError`, `McqValidationError`).
- Prepared statements with numbered placeholders (`?1`, `?2`). Never concatenate SQL.
- `getDb()` stays in `src/lib/db/client.ts`. Never import DB modules into `'use client'` components.
- Apply migrations **locally only** (`npx wrangler d1 migrations apply quizmaker-2026 --local`).
- Ask before adding npm packages. shadcn components are copied source files (`npx shadcn@latest add @shadcn/<name>`), not new runtime dependencies.

### Actor identity (CreatedBy / AttemptedBy)

Sprint 1 has **no cookies, sessions, or JWTs**. Login/register currently 303-redirect and the browser `fetch` often yields an `opaqueredirect`, so the client never receives a user id.

This sprint still does **not** add cookies, JWTs, or server sessions. To populate `CreatedByUserId` and `AttemptedByUserId`:

1. Change login/register **success** from a 303 redirect to **`200 JSON`**: `{ "userId": "<uuid>", "redirectTo": "/mcqs" }`.
2. Client stores `userId` in `sessionStorage` (key: `quizmaker.actorUserId`) and then `window.location.assign(redirectTo)`.
3. Logout clears that key, then continues to `/login`.
4. MCQ API requests send `actorUserId` in the JSON body (mutations) or as a query/header the handler documents. The MCQ Service verifies the user exists via User Service (`getUserById`). If missing or unknown, fail with 401.

This is attribution only, not a security boundary. Do not invent tokens to “fix” that in this sprint.

### Existing code this sprint extends

| Area | Current location | Change |
|------|------------------|--------|
| Post-auth path | `MCQ_STUB_PATH = "/mcq"` in `src/lib/auth/paths.ts` | Become `/mcqs`; keep `/mcq` → `/mcqs` redirect |
| Stub UI | `src/components/mcq-stub-page.tsx`, `src/app/mcq/page.tsx` | Replace stub content; list lives at `/mcqs` |
| Auth success | `src/app/api/register/route.ts`, `src/app/api/login/route.ts`, `src/lib/auth/submit-auth.ts` | 200 JSON + `sessionStorage` actor id (see above) |
| shadcn already installed | `table`, `button`, `dialog`, `input`, `field`, `label`, `card` | Reuse these |
| shadcn to propose | — | `@shadcn/dropdown-menu`, `@shadcn/radio-group` (ask first) |
| Users / User Service | `migrations/0001_create_users.sql`, `src/lib/services/user-service.ts` | Do not redesign; only call `getUserById` for actor checks |

---

## Technical Requirements

### Database Schema

Match the Users style: PascalCase table names, PascalCase columns, `TEXT` ids (`crypto.randomUUID()`), ISO-8601 timestamps as `TEXT`. SQLite has no boolean: store `IsCorrect` as `INTEGER` `0` or `1`.

Create **one new migration** (Wrangler will name it; expected logical name `0002_create_mcqs.sql`). Keep a canonical SQL module in `src/lib/db/mcqs-schema.ts` in sync with that migration, the same way `src/lib/db/users-schema.ts` matches `0001_create_users.sql`.

```sql
CREATE TABLE Mcqs (
  Id TEXT NOT NULL PRIMARY KEY,
  Name TEXT NOT NULL UNIQUE,
  Question TEXT NOT NULL UNIQUE,
  CreatedByUserId TEXT NOT NULL,
  CreatedAt TEXT NOT NULL,
  UpdatedAt TEXT NOT NULL,
  FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id)
);

CREATE TABLE McqChoices (
  Id TEXT NOT NULL PRIMARY KEY,
  McqId TEXT NOT NULL,
  Text TEXT NOT NULL,
  IsCorrect INTEGER NOT NULL CHECK (IsCorrect IN (0, 1)),
  Position INTEGER NOT NULL,
  FOREIGN KEY (McqId) REFERENCES Mcqs(Id) ON DELETE CASCADE
);

CREATE INDEX McqChoices_McqId_idx ON McqChoices (McqId);

CREATE TABLE McqAttempts (
  Id TEXT NOT NULL PRIMARY KEY,
  McqId TEXT NOT NULL,
  ChoiceId TEXT,
  AttemptedByUserId TEXT NOT NULL,
  IsCorrect INTEGER NOT NULL CHECK (IsCorrect IN (0, 1)),
  CreatedAt TEXT NOT NULL,
  FOREIGN KEY (McqId) REFERENCES Mcqs(Id) ON DELETE CASCADE,
  FOREIGN KEY (ChoiceId) REFERENCES McqChoices(Id) ON DELETE SET NULL,
  FOREIGN KEY (AttemptedByUserId) REFERENCES Users(Id)
);

CREATE INDEX McqAttempts_McqId_idx ON McqAttempts (McqId);
```

Notes:

- `Name` is the teacher-given title (list column **Name**).
- `Question` is the prompt shown to the person taking the question.
- `Name` and `Question` are unique across the bank (trimmed before compare/insert).
- `McqChoices.Position` is `0..n-1` in display order.
- Exactly one choice per MCQ must have `IsCorrect = 1` (enforced in the service, not only in SQL).
- Minimum two choices per MCQ (enforced in the service).
- `McqAttempts.IsCorrect` is a **snapshot** at submit time so later edits do not rewrite history.
- `ChoiceId` is `ON DELETE SET NULL` so replacing choices on edit does not delete attempt rows. `McqId` cascade still removes attempts when the question is deleted.
- D1 foreign keys: enable/enforce in the usual D1 way; do not rely on ad-hoc SQL outside a migration.

### API Endpoints

All handlers: `getDb()` → MCQ Service. Validate with Zod. Do not put `page.tsx` and `route.ts` in the same segment (Sprint 1 lesson). UI stays at `/mcqs...`; JSON stays at `/api/mcqs...`.

Actor: every mutating request includes `actorUserId`. List/get may omit it (shared bank). Attempt create requires it.

#### GET /api/mcqs

**Purpose**: List all MCQs for the table (id, name, question, timestamps). Choices are not required on this payload.

**Response:**

- Success (200): `{ "mcqs": [ { "id", "name", "question", "createdAt", "updatedAt" } ] }`
- Error (500): unexpected server error

#### POST /api/mcqs

**Purpose**: Create an MCQ and its choices.

**Request Body:**

```json
{
  "actorUserId": "string",
  "name": "string",
  "question": "string",
  "choices": [
    { "text": "string", "isCorrect": true },
    { "text": "string", "isCorrect": false }
  ]
}
```

**Behavior:**

- Trim name, question, and choice texts.
- Reject empty fields, fewer than two choices, zero or multiple `isCorrect: true`, duplicate name, duplicate question, unknown actor.

**Responses:**

- Success (201): created MCQ including `id` and choices
- Error (400): validation (`text box is empty`, `none of answer is selected`, or service validation message)
- Error (401): missing/unknown `actorUserId`
- Error (409): name or question already exists
- Error (500): unexpected server error

#### GET /api/mcqs/:id

**Purpose**: Load one MCQ with choices for edit or preview.

**Responses:**

- Success (200): `{ "id", "name", "question", "choices": [ { "id", "text", "isCorrect", "position" } ], "createdAt", "updatedAt" }`
- Error (404): MCQ not found
- Error (500): unexpected server error

Do **not** include `isCorrect` on the **preview page** payload if that would reveal the answer in the client before submit. Prefer either:

- a dedicated `GET /api/mcqs/:id/preview` that returns `{ id, name, question, choices: [{ id, text }] }` (no `isCorrect`), or
- the full GET for edit only, and a preview-safe DTO for the preview page.

Use the preview-safe DTO for `/mcqs/{id}/preview`. Grading happens on `POST .../attempts`.

#### PUT /api/mcqs/:id

**Purpose**: Update name, question, and the full choice set.

**Request Body:** Same shape as create (`actorUserId`, `name`, `question`, `choices`).

**Behavior:**

- Same validation as create.
- Unique name/question ignore the row being edited.
- Replace choices in a transaction-like batch (`db.batch` if needed): delete existing choices, insert the new set (attempt `ChoiceId`s become null via `ON DELETE SET NULL`).
- Set `UpdatedAt`.

**Responses:**

- Success (200): updated MCQ with choices
- Error (400 / 401 / 404 / 409 / 500): same meanings as create, plus 404 if missing

#### DELETE /api/mcqs/:id

**Purpose**: Delete the MCQ. Choices and attempts cascade.

**Request Body (or query):** `{ "actorUserId": "string" }` if the handler reads JSON on DELETE; otherwise a query param is acceptable if documented in the route test. Prefer JSON body for consistency if the runtime allows it; if not, use `?actorUserId=`.

**Responses:**

- Success (204): empty
- Error (401): missing/unknown actor
- Error (404): MCQ not found
- Error (500): unexpected server error

#### POST /api/mcqs/:id/attempts

**Purpose**: Record a preview attempt.

**Request Body:**

```json
{
  "actorUserId": "string",
  "choiceId": "string"
}
```

**Behavior:**

- 400 if `choiceId` is missing (UI shows `answer not selected` **before** calling this when nothing is selected; the API still rejects a missing/invalid choice).
- Load the choice; it must belong to this MCQ.
- `isCorrect` = that choice’s `IsCorrect`.
- Insert `McqAttempts` (allow many rows for the same `McqId` + user).

**Responses:**

- Success (201): `{ "id", "mcqId", "choiceId", "isCorrect", "createdAt" }`
- Error (400): missing/invalid choice
- Error (401): missing/unknown actor
- Error (404): MCQ or choice not found
- Error (500): unexpected server error

### MCQ Service

Centralize all Mcqs / McqChoices / McqAttempts access. Suggested functions:

| Operation | Responsibility |
|-----------|----------------|
| `listMcqs` | All questions, newest `UpdatedAt` first (implemented) |
| `getMcqById` | Question + choices ordered by `Position`; `null` if missing |
| `createMcq` | Validate, insert Mcq + choices, return the created aggregate |
| `updateMcq` | Validate, update Mcq, replace choices, return aggregate |
| `deleteMcq` | Delete Mcq (cascade choices + attempts); throw if missing |
| `createAttempt` | Validate choice belongs to MCQ, snapshot `IsCorrect`, insert attempt |

Typed errors (same idea as `UserConflictError` / `UserNotFoundError`):

- `McqNotFoundError`
- `McqConflictError` (`field`: `"name"` \| `"question"`)
- `McqValidationError` (empty fields, choice count, correct-radio count)
- `McqUnauthorizedError` (actor missing or not a user)

Uniqueness: check before insert/update **and** map SQLite `UNIQUE constraint failed` as a fallback, like User Service.

### User Interface Requirements

Use shadcn. Prefer `Table`, `Button`, `Dialog`, `Input`, `Field*` for forms. Propose **dropdown-menu** for the 3-dot actions and **radio-group** for correct-answer and preview selection. Lucide `EllipsisVertical` (or `MoreVertical`) for the actions trigger.

#### MCQ list (`/mcqs`)

- Full-width workspace (not the centered Sprint 1 stub card).
- Header row: title on the left; **Create question** and **Log out** on the top right.
- Create question → `/mcqs/new`.
- Log out → existing `POST /logout` (clear `sessionStorage` actor id first).
- Table columns: **Name**, **Question**, **Actions**.
- Empty bank: table (or empty state) with no rows; Create question still available.
- Actions: icon button (3 vertical dots, accessible name like “Actions”). Dropdown: Edit, Preview, Delete.
  - Edit → `/mcqs/{id}/edit`
  - Preview → `/mcqs/{id}/preview`
  - Delete → confirmation dialog; confirm calls `DELETE /api/mcqs/{id}`; remove the row on success.

#### Create question (`/mcqs/new`)

- Fields: Name, Question, two choice rows (text + radio for correct).
- Buttons: **Add choice**, **Save**. Include a way back to `/mcqs` (link or button).
- Add choice: extra text + radio + **Remove** on **every** choice row while count > 2. At 2 choices, hide Remove.
- Save: client-side checks first (empty, radio). If those fail, **Dialog** + **OK** with the specified sentences. Then `POST /api/mcqs`. Map 409 uniqueness into the same dialog style. On success, go to `/mcqs`.

#### Edit question (`/mcqs/{id}/edit`)

- Same UI as create, prefilled from `GET /api/mcqs/{id}`.
- Unknown id: show not-found and a link back to `/mcqs`.
- Save → `PUT /api/mcqs/{id}`, then `/mcqs`.

#### Preview (`/mcqs/{id}/preview`)

- Name, question, choice radios (answer selection — not the authoring “correct” radios).
- **Submit** and **Back to questions** (`/mcqs`).
- No selection + Submit → show `answer not selected` below the choices (no API call).
- Selection + Submit → `POST /api/mcqs/{id}/attempts` → show **correct** or **incorrect** below the choices.
- Teacher may change the radio and submit again (another attempt).

#### Validation dialog (create/edit)

- Modal popup, **OK** dismisses.
- Copy:
  - `text box is empty`
  - `none of answer is selected`
  - both lines when both apply
  - uniqueness lines when the server returns 409

---

## Implementation Phases

**TDD convention (all phases):** Use Vitest. Write a failing test first → implement the minimum to pass → refactor while green. Colocate `*.test.ts` / `*.test.tsx`. Mock D1 / Cloudflare / `fetch` at module boundaries. Never hit the remote database in unit tests. Ask before adding a test dependency that is not already in `package.json` (Vitest and Testing Library are already installed).

Do not start Phase N+1 until Phase N’s suite is green and this PRD’s phase marker is updated.

### Phase 1: Database - COMPLETED

**Objective**: Persist MCQs, choices, and attempts via a migration-backed schema, following the Users migration pattern.

**TDD (Vitest):**

1. Wrote failing schema-contract tests (table names, required columns, PK/FK, UNIQUE Name/Question, CHECK on `IsCorrect`, cascade/set-null behavior described in SQL).
2. Added `src/lib/db/mcqs-schema.ts` and the migration until tests passed.
3. Applied the migration locally; full suite stayed green.

**Tasks**:

1. Created D1 migration with `npx wrangler d1 migrations create quizmaker-2026 create_mcqs`. Not applied remotely.
2. Put the three `CREATE TABLE` statements (and indexes) in that migration and in `src/lib/db/mcqs-schema.ts`.
3. Applied **locally**: `npx wrangler d1 migrations apply quizmaker-2026 --local` (CI non-interactive). Local DB now has `Users`, `Mcqs`, `McqChoices`, `McqAttempts` plus the two McqId indexes.
4. Phase 1 Vitest suite green (25 schema tests). Full suite: **67 passed**.

**Deliverables**:

- `migrations/0002_create_mcqs.sql`
- `src/lib/db/mcqs-schema.ts`
- `src/lib/db/mcqs-schema.test.ts` (25 tests)
- `npm test` — 67 passed; `npm run lint` — passed; `npm run build` — passed
- This PRD: Phase 1 → COMPLETED

### Phase 2: MCQ Service - COMPLETED

**Objective**: All MCQ / choice / attempt persistence goes through one service, the same way Users go through User Service.

**TDD (Vitest):**

1. Wrote failing tests for create (happy path, empty fields, < 2 choices, no correct choice, two correct choices, duplicate name, duplicate question, unknown actor).
2. Wrote failing tests for list, get-by-id (found / missing), update (including uniqueness excluding self), delete (cascades choices; missing id throws).
3. Wrote failing tests for `createAttempt` (correct snapshot, incorrect snapshot, multiple attempts on one MCQ, choice from another MCQ rejected, missing MCQ).
4. Implemented with an in-memory D1 mock at the DB boundary (`src/lib/services/mcq-service.test.ts`).
5. Suite green.

**Tasks**:

1. Implemented `src/lib/services/mcq-service.ts` + typed errors (`McqNotFoundError`, `McqConflictError`, `McqValidationError`, `McqUnauthorizedError`).
2. Actor is verified via `getUserById` from User Service.
3. Numbered placeholders; choice insert is sequential; update deletes existing choices then inserts the new set (`ChoiceId` SET NULL on attempts in the mock).
4. Phase 2 Vitest suite green (23 tests). Full suite: **90 passed**. `npm run lint` and `npm run build` passed.

**Deliverables**:

- `src/lib/services/mcq-service.ts` — `listMcqs` (UpdatedAt DESC), `getMcqById`, `createMcq`, `updateMcq`, `deleteMcq`, `createAttempt`
- `src/lib/services/mcq-service.test.ts` (23 tests, in-memory D1)
- This PRD: Phase 2 → COMPLETED

### Phase 3: API Endpoints + actor handoff - PLANNED

**Objective**: HTTP JSON API for MCQ CRUD and attempts; login/register can hand the client a `userId` without cookies/JWT.

**TDD (Vitest):**

1. Failing tests for `GET/POST /api/mcqs` and `GET/PUT/DELETE /api/mcqs/:id` (validation, 401, 404, 409, success). Mock MCQ Service.
2. Failing tests for `POST /api/mcqs/:id/attempts`.
3. Failing tests that login/register success bodies include `userId` and `redirectTo: "/mcqs"` (update existing `src/lib/auth/auth-routes.test.ts`).
4. Failing tests that `submitAuthRequest` stores `quizmaker.actorUserId` and navigates to `/mcqs`; logout clears it.
5. Implement until green.

**Tasks**:

1. Add Zod schemas in `src/lib/mcq/schemas.ts`.
2. Implement:
   - `src/app/api/mcqs/route.ts` — GET list, POST create
   - `src/app/api/mcqs/[id]/route.ts` — GET, PUT, DELETE
   - `src/app/api/mcqs/[id]/attempts/route.ts` — POST
   - optional preview GET if you split the DTO
3. Switch register/login success to 200 JSON; update `submit-auth.ts` and its tests.
4. Point `MCQ_STUB_PATH` (or a new `MCQS_PATH`) at `/mcqs`.
5. Keep Phase 3 tests green.

**Deliverables**:

- API routes above
- Auth success / path updates
- Route tests (new `src/lib/mcq/mcq-routes.test.ts` and updated auth tests)
- This PRD updated

### Phase 4: UI (list, create, edit, delete, preview) - PLANNED

**Objective**: Replace the Sprint 1 stub with the full MCQ workspace: list table, create, edit, delete confirmation, and preview-with-attempts.

**TDD (Vitest + Testing Library):** Write failing tests first for each surface, then implement. Mock `fetch`. Keep the suite green before Phase 5.

**List (`/mcqs`):**

1. Table headers Name, Question, Actions; Create question and Log out present.
2. Rows render name + question; 3-dot button opens Edit, Preview, Delete.
3. Edit/Preview navigate to the right hrefs; Delete asks for confirmation and calls DELETE on confirm, not on cancel.
4. `/mcq` redirects to `/mcqs`.

**Create / Edit:**

5. `/mcqs/new`: default two choices, no Remove; Add choice shows Remove on all rows; cannot go below two.
6. Save: empty → dialog `text box is empty`; no radio → `none of answer is selected`; both → both sentences; OK closes the dialog and does not POST.
7. Valid Save POSTs and navigates to `/mcqs`; 409 surfaces uniqueness in the dialog.
8. Edit: fields prefilled from `GET /api/mcqs/{id}`; Save PUTs to `/api/mcqs/{id}`.

**Preview / Attempts:**

9. Preview shows name, question, radios, Submit, Back to questions (`href` `/mcqs`).
10. Submit with no radio shows `answer not selected` and does not POST.
11. Submit with a choice POSTs `/api/mcqs/{id}/attempts` and shows `correct` or `incorrect` from the response.
12. A second submit is allowed (second POST).

**Tasks**:

1. Propose adding `@shadcn/dropdown-menu` (3-dot actions) and `@shadcn/radio-group` (correct-answer and preview radios). Do not add them silently; ask first. Prefer these once approved.
2. Build list: `src/app/mcqs/page.tsx` + list client component under `src/components/mcq/`.
3. Redirect `src/app/mcq/page.tsx` → `/mcqs`. Remove stub-only copy (“placeholder landing page”, “features will arrive in a future sprint”).
4. Shared create/edit form (`src/components/mcq/mcq-question-form.tsx`) and pages: `src/app/mcqs/new/page.tsx`, `src/app/mcqs/[id]/edit/page.tsx`.
5. Preview: `src/app/mcqs/[id]/preview/page.tsx` + preview client component. Load preview-safe choices (no `isCorrect` in the client for this page).
6. Keep Phase 4 tests green.

**Deliverables**:

- `/mcqs` list UI using shadcn Table (Create question, Log out, 3-dot Edit/Preview/Delete)
- Redirect from `/mcq`
- Create and edit pages + shared form + validation Dialog with the specified copy
- Preview page + attempt submit (including `answer not selected` / correct / incorrect)
- `src/components/mcq/*.test.tsx` covering list, form, delete, and preview
- This PRD updated

### Phase 5: Verification - PLANNED

**Objective**: Prove the sprint against acceptance criteria with the full Vitest suite plus lint/build and a local smoke path.

**TDD / verification:**

1. Fill any acceptance gaps with a failing test first, then fix.
2. `npm test` — full suite green (Sprint 1 tests must still pass).
3. `npm run lint` and `npm run build` — report the real result.
4. Manual smoke (local): register/login → `/mcqs` → create (validation popups + success) → table row → edit → preview (no selection, then correct, then incorrect) → multiple attempts → delete confirm/cancel → logout.

**Tasks**:

1. Fix regressions with TDD.
2. Confirm no cookies/JWT/session libraries were added.
3. Confirm `/mcq` redirects and logout still works.
4. Mark acceptance criteria and Current Status.

**Deliverables**:

- Green `npm test`, `npm run lint`, `npm run build` (actual output recorded here)
- Acceptance checkboxes updated
- Current Status → COMPLETED when done

---

## Technical Implementation Details

Fill this in as code is written. Phase 1 schema is in place.

### Key files (current, Sprint 1)

- `src/lib/db/client.ts` — `getDb()`
- `src/lib/db/users-schema.ts` — Users schema contract pattern to copy
- `src/lib/services/user-service.ts` — service + typed-error pattern to copy
- `src/lib/auth/paths.ts` — `MCQ_STUB_PATH` (update to `/mcqs`)
- `src/lib/auth/submit-auth.ts` — auth client submit (extend for `userId`)
- `src/components/mcq-stub-page.tsx` — replace / stop using for `/mcqs`
- `src/components/ui/table.tsx` — shadcn Table
- `src/components/ui/dialog.tsx` — confirmation and validation popups
- `migrations/0001_create_users.sql` — do not modify

### Key files (Phase 1 — done)

- `migrations/0002_create_mcqs.sql` — Mcqs, McqChoices, McqAttempts + McqId indexes (applied locally only)
- `src/lib/db/mcqs-schema.ts` — canonical CREATE SQL and column/table name contracts
- `src/lib/db/mcqs-schema.test.ts` — 25 schema-contract tests (module + migration must stay in sync)

### Key files (Phase 2 — done)

- `src/lib/services/mcq-service.ts` — only module that talks to D1 for Mcqs / McqChoices / McqAttempts
- `src/lib/services/mcq-service.test.ts` — 23 tests; in-memory D1 + seeded Users row for `getUserById`

### Key files (to add — update paths if names differ)

- `src/lib/mcq/schemas.ts`, `src/lib/mcq/paths.ts`
- `src/app/api/mcqs/route.ts`
- `src/app/api/mcqs/[id]/route.ts`
- `src/app/api/mcqs/[id]/attempts/route.ts`
- `src/app/mcqs/page.tsx`
- `src/app/mcqs/new/page.tsx`
- `src/app/mcqs/[id]/edit/page.tsx`
- `src/app/mcqs/[id]/preview/page.tsx`
- `src/components/mcq/` — list, form, preview, dialogs, tests

### Implementation patterns

```ts
// Service functions take D1Database, never getCloudflareContext themselves.
// Implemented in src/lib/services/mcq-service.ts:
// createMcq → requireActor → normalize/validate → unique name/question → insert Mcqs + choices
// updateMcq → same validation → UPDATE Mcqs → DELETE choices → insert replacements
// createAttempt → requireActor → choice must belong to MCQ → snapshot IsCorrect

// Route handlers (Phase 3):
const db = await getDb();
const mcq = await createMcq(db, parsed.data);
```

```ts
// Numbered placeholders only
await db
  .prepare(`INSERT INTO Mcqs (Id, Name, Question, CreatedByUserId, CreatedAt, UpdatedAt)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
  .bind(id, name, question, actorUserId, timestamp, timestamp)
  .run();
```

### Important notes

- Do not hand-edit `src/components/ui/*` generated shadcn files.
- Server Components fetch data; `'use client'` only for table actions, dialogs, radios, and forms.
- Unique name/question: trim whitespace; compare/store trimmed values.
- Preview must not reveal the correct choice in the DOM before submit.
- Keep Sprint 1 auth tests passing when changing login/register success shape.

---

## Acceptance Criteria

- [x] `Mcqs`, `McqChoices`, and `McqAttempts` exist via a local D1 migration and match `mcqs-schema.ts`.
- [x] All MCQ database access goes through the MCQ Service.
- [ ] Teachers can list all MCQs at `/mcqs` in a shadcn table (Name, Question, Actions).
- [ ] `/mcqs` has **Create question** and **Log out** at the top right.
- [ ] Each row’s Actions control is a 3-dot button whose dropdown offers Edit, Preview, Delete.
- [ ] Create question navigates to `/mcqs/new` with name, question, two choices, correct-answer radios, Add choice, and Save.
- [ ] Add choice adds a row; Remove appears when there are more than two choices and cannot reduce below two.
- [ ] Save rejects empty text boxes and a missing correct radio via a popup + OK, using the specified sentences (both shown when both apply).
- [ ] Save rejects duplicate name and duplicate question.
- [ ] Successful create adds the row to the table.
- [ ] Edit navigates to `/mcqs/{id}/edit` with prefilled values and can update the question.
- [ ] Delete asks for confirmation and, on confirm, removes the MCQ, its choices, and its attempts.
- [ ] Preview is `/mcqs/{id}/preview` with name, question, answer radios, Submit, and Back to questions (`/mcqs`).
- [ ] Preview Submit with no selection shows `answer not selected` and writes no attempt.
- [ ] Preview Submit with a selection records an attempt and shows correct or incorrect.
- [ ] The same question can receive multiple attempts.
- [ ] Login/register land on `/mcqs`; `/mcq` redirects to `/mcqs`.
- [ ] Logout still returns to login and clears the client actor id.
- [ ] No cookies, JWTs, or server sessions are introduced.
- [ ] Vitest covers schema, service, endpoints, and UI per phase; full suite passes in Phase 5.
- [ ] `npm run lint` and `npm run build` pass in Phase 5.

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Teacher can complete create → list → edit → preview → delete | One uninterrupted local smoke path | Manual Phase 5 smoke + UI tests |
| Invalid create/edit never writes a row | 100% of listed validation failures | Service + form tests |
| Preview grades match the stored correct choice | Snapshot `IsCorrect` equals the choice flag | Attempt service tests |
| Sprint 1 auth still works | Existing auth Vitest suite stays green | `npm test` |

---

## Dependencies

### External Dependencies

- Cloudflare D1 — `Mcqs`, `McqChoices`, `McqAttempts` (binding `DB`, database `quizmaker-2026`)
- Zod — already installed; request validation
- Vitest + Testing Library — already installed
- shadcn/ui (Base UI, `base-nova`) — Table, Dialog, Button, Field, Input; propose dropdown-menu and radio-group

### Internal Dependencies

- Users table + User Service — `CreatedByUserId` / `AttemptedByUserId` must reference an existing user
- Auth paths and logout — post-login destination becomes `/mcqs`
- `getDb()` — server-only D1 accessor

---

## Risks and Mitigation

### Technical Risks

- **Risk**: Page and `route.ts` conflict on `/mcqs` (Sprint 1 `/login` lesson).
- **Mitigation**: Pages under `/mcqs`; JSON under `/api/mcqs`.

- **Risk**: Preview payload leaks `isCorrect` so the client can highlight the answer before submit.
- **Mitigation**: Preview-safe DTO without `isCorrect`; grade only in `createAttempt`.

- **Risk**: Editing choices deletes attempt history.
- **Mitigation**: `ChoiceId ON DELETE SET NULL`; store `IsCorrect` snapshot on the attempt; cascade attempts only when the **question** is deleted.

- **Risk**: Adding cookies/JWT “to do CreatedBy properly.”
- **Mitigation**: Use `sessionStorage` actor id + 200 JSON login/register. Document the limitation; do not expand auth scope.

- **Risk**: Remote migration applied by accident.
- **Mitigation**: Local apply only. Never `migrations apply --remote` unless the user explicitly asks.

### User Experience Risks

- **Risk**: Teachers look for a “course” field because of earlier wording.
- **Mitigation**: Column label is **Name**. No Course table.

- **Risk**: Validation popup is vague when several things are wrong.
- **Mitigation**: Show every applicable sentence (`text box is empty`, `none of answer is selected`, uniqueness).

---

## Troubleshooting Guide

Add entries when bugs are found and fixed.

### Next.js conflict: route and page at the same path

**Problem**: Build fails because `page.tsx` and `route.ts` share `/mcqs` or `/mcqs/[id]/...`.
**Cause**: App Router does not allow both in the same segment.
**Solution**: Keep UI pages at `/mcqs...`; put handlers under `/api/mcqs...`.
**Code Reference**: `src/middleware.ts` (Sprint 1 auth rewrite pattern — do not reuse it unless a page+POST must share a path)

### wrangler d1 migrations apply --yes is unknown

**Problem**: `npx wrangler d1 migrations apply quizmaker-2026 --local --yes` fails with `Unknown argument: yes`.
**Cause**: Wrangler 4.118.0 does not accept `--yes` on this command.
**Solution**: Run with `CI=true` so the confirmation uses the non-interactive fallback (`yes`). Still pass `--local`. Never add `--remote`.
**Code Reference**: `migrations/0002_create_mcqs.sql`

### Login no longer reaches `/mcqs` after switching to JSON success

**Problem**: Client stays on `/login` or shows a generic error.
**Cause**: `submitAuthRequest` still treats only 303/`opaqueredirect` as success.
**Solution**: Treat `200` + `{ userId, redirectTo }` as success; write `sessionStorage`; then assign `redirectTo`.
**Code Reference**: `src/lib/auth/submit-auth.ts`

---

## Notes for AI Agents

1. Read Overview, Business Goal, Hypothesis, and Scope first. Scope (In / Out / Cut) is a hard boundary.
2. Implement **one phase only** unless the user asks for more. Update this file when that phase finishes.
3. TDD every phase: failing Vitest → code → green. Do not “add tests after” as a substitute.
4. Do not add cookies, JWTs, server sessions, AI SDK calls, Course tables, or deploy/remote migrations.
5. Ask before new npm dependencies and before `npx shadcn@latest add @shadcn/dropdown-menu` / `@shadcn/radio-group`.
6. Reuse User Service patterns (`getDb`, numbered placeholders, typed errors, colocated tests).
7. Do not query D1 from route handlers or client components.
8. When citing code in later updates, use `filepath:line-number`.
9. Keep Sprint 1 behavior: register, login, logout still work; passwords stay hashed.
10. If actor identity or FK enforcement on D1 is unclear in this environment, **say you are unsure** rather than inventing a token system.
11. After implementation details change, update Technical Implementation Details and Current Status; delete stale claims.

---

## Current Status

**Last Updated**: 2026-09-03
**Current Phase**: Phase 3 — API Endpoints + actor handoff
**Status**: Phase 2 COMPLETED. MCQ Service covers list/get/create/update/delete and attempts. No HTTP routes yet.
**Next Steps**: Phase 3 TDD — `/api/mcqs*` handlers and login/register `userId` handoff. Branch: `feature/mcq-crud-v2`.
