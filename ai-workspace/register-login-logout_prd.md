Date created: 2026-08-26
Date last modified: 2026-08-26

# Register / Login / Logout - Technical PRD

## Overview/Problem

Greenfield Quiz Maker will eventually let multiple teachers collaborate on a shared bank of multiple-choice questions (MCQs). Before any MCQ features exist, the application must support independent teacher accounts. Without registration, login, and logout, there is no way to distinguish teachers or persist who is using the app. Sprint 1 delivers only this authentication foundation so later sprints can build collaborative MCQ workflows on top of it.

---

## Hypothesis

We believe that enabling teachers to register, log in, and log out with hashed passwords and a simple User Service will establish the multi-teacher identity layer needed for collaborative Quiz Maker usage in future sprints.

---

## Business Goal

Enable multiple teachers to create accounts and authenticate so the application can support collaborative usage in future sprints.

---

## Scope

### In Scope

#### User Database

- Create a Users table via database migration.
- Users table columns:
  - Id (Primary Key)
  - FirstName
  - LastName
  - Username
  - Email
  - PasswordHash
  - CreatedAt
  - UpdatedAt

#### Authentication

- Support user registration.
- Support user login.
- Support user logout.
- Users may use username and email independently, or username may be the same as email.
- Passwords must never be stored in plain text.
- Passwords must be hashed before being stored.
- During login, the submitted password must be hashed and compared against the stored hash.
- Authentication requests must be submitted through HTTP POST endpoints.

#### User Service

- Implement a User Service responsible for:
  - Create User
  - Read User
  - Update User
  - Delete User
- Registration and Login endpoints must use the User Service for all database interactions.

#### API Endpoints

At minimum:

- `POST /register`
- `POST /login`
- `POST /logout`

#### Validation

- Basic validation for required fields.
- Prevent duplicate username registrations.
- Prevent duplicate email registrations.
- Return meaningful validation and authentication error messages.

#### Post-Authentication Navigation

- After successful registration or login, redirect the user to a placeholder MCQ page.
- The page is only a stub and contains no MCQ functionality.
- The stub exists solely as a landing page after authentication.

### Out of Scope

The following are **not** included in this phase:

- MCQ creation functionality
- MCQ editing functionality
- Test bank management
- Social login providers (Google, Microsoft, Facebook, etc.)
- JWT authentication
- Token-based authentication of any kind
- Cookies
- Session management
- Server-side sessions
- Refresh tokens
- Password reset
- Forgot password
- Email verification
- Role-based access control
- Admin users
- Permissions system
- User profile screens/UI
- Advanced security features beyond password hashing

### Cut

- Persistent authenticated state (cookies, sessions, tokens) — intentionally deferred; this sprint only gets users into the application.
- MCQ management — deferred to the next sprint.

---

## Architecture Notes

- This is intentionally a simple authentication system.
- No token strategy should be described or implemented.
- No session strategy should be described or implemented.
- No cookie management should be described or implemented.
- Authentication is only intended to get users into the application.
- The next sprint will introduce the actual MCQ functionality.

---

## Technical Requirements

### Database Schema

Create the Users table via a D1 migration. Column names match the product requirements; types follow SQLite/D1 conventions.

```sql
CREATE TABLE Users (
  Id TEXT NOT NULL PRIMARY KEY,
  FirstName TEXT NOT NULL,
  LastName TEXT NOT NULL,
  Username TEXT NOT NULL UNIQUE,
  Email TEXT NOT NULL UNIQUE,
  PasswordHash TEXT NOT NULL,
  CreatedAt TEXT NOT NULL,
  UpdatedAt TEXT NOT NULL
);
```

Notes:

- `Username` and `Email` are unique to prevent duplicate registrations.
- `PasswordHash` stores only the hashed password; never store plain text.
- Username and email are independent fields; username may equal email.

### API Endpoints

#### POST /register

**Purpose**: Create a new teacher account via the User Service.

**Request Body:**

```json
{
  "firstName": "string",
  "lastName": "string",
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Behavior:**

- Validate required fields.
- Reject duplicate username or email with a meaningful error.
- Hash the password before persistence.
- Create the user through the User Service.
- On success, redirect to the MCQ stub page.

**Responses:**

- Success: redirect to MCQ stub (or success payload that the client uses to redirect)
- Error (400): validation failure (missing/invalid fields)
- Error (409): username or email already registered
- Error (500): unexpected server error

#### POST /login

**Purpose**: Authenticate an existing teacher via the User Service.

**Request Body:**

```json
{
  "usernameOrEmail": "string",
  "password": "string"
}
```

**Behavior:**

- Validate required fields.
- Look up the user by username or email through the User Service.
- Hash the submitted password and compare it to the stored `PasswordHash`.
- On success, redirect to the MCQ stub page.
- On failure, return a meaningful authentication error (do not reveal whether username/email or password was wrong in a way that aids attackers beyond a clear auth failure message).

**Responses:**

- Success: redirect to MCQ stub (or success payload that the client uses to redirect)
- Error (400): validation failure
- Error (401): invalid credentials
- Error (500): unexpected server error

#### POST /logout

**Purpose**: Log the user out of the application.

**Behavior:**

- Accept a POST request.
- Perform logout without cookies, sessions, JWTs, or other token strategies.
- Redirect the user away from the authenticated landing experience (e.g., back to login/register).

**Responses:**

- Success: redirect to login/register (or success payload that the client uses to redirect)
- Error (500): unexpected server error

### User Service

Centralize all Users table access in a User Service used by registration and login:

| Operation | Responsibility |
|-----------|----------------|
| Create User | Insert a new user with hashed password and timestamps |
| Read User | Fetch by id, username, and/or email |
| Update User | Update mutable user fields and `UpdatedAt` |
| Delete User | Remove a user record |

Registration and Login **must** call this service for database interactions; endpoints must not query the database directly.

### User Interface Requirements

#### Registration page

- Fields: FirstName, LastName, Username, Email, Password (all required).
- Submit via `POST /register`.
- Show meaningful validation and duplicate-username/email errors.
- On success, redirect to the MCQ stub page.

#### Login page

- Fields sufficient to identify the user (username and/or email) and Password.
- Submit via `POST /login`.
- Show meaningful authentication errors.
- On success, redirect to the MCQ stub page.

#### Logout control

- Available after authentication (e.g., on the MCQ stub).
- Submits `POST /logout`.
- On success, return the user to login/register.

#### MCQ stub page (placeholder)

- Landing page after successful registration or login.
- Contains no MCQ creation, editing, or test-bank functionality.
- Exists solely as a post-authentication destination for Sprint 1.

---

## Implementation Phases

**TDD convention (all phases):** Use Vitest. For each behavior: write a failing test first → implement the minimum code to pass → refactor while keeping tests green. Colocate tests as `*.test.ts` / `*.test.tsx`. Mock Cloudflare/D1 at module boundaries (do not hit a real remote database in unit tests). Ask before adding Vitest or related test dependencies if they are not yet installed.

### Phase 1: Database - COMPLETED

**Objective**: Persist users via a migration-backed Users table.

**TDD (Vitest):**

1. Write failing tests that describe the expected Users schema contract (required columns, primary key, unique Username/Email).
2. Implement migration/schema until those tests pass.
3. Refactor migration/helpers only while tests stay green.

**Tasks**:

1. Set up Vitest if not already configured (`test` / `test:watch` scripts).
2. Add D1 (if not already configured).
3. Create a migration for the Users table with all required columns.
4. Apply the migration locally and verify the schema.
5. Keep Phase 1 Vitest suite green before moving on.

**Deliverables**:

- D1 configuration (local binding `DB` in `wrangler.jsonc`; placeholder `database_id` until remote `wrangler d1 create`)
- Users migration: `migrations/0001_create_users.sql`
- Canonical schema: `src/lib/db/users-schema.ts`
- Vitest tests: `src/lib/db/users-schema.test.ts` (6 passing)

### Phase 2: User Service - COMPLETED

**Objective**: Centralize Users table CRUD behind a User Service.

**TDD (Vitest):**

1. Write failing tests for Create, Read, Update, Delete (happy paths and failures: missing user, duplicate username/email).
2. Write failing tests that Create stores a hash (not plain text) and that password comparison uses the hash.
3. Implement User Service until tests pass; mock D1 / DB access at the module boundary.
4. Refactor while keeping the suite green.

**Tasks**:

1. Implement User Service: Create, Read, Update, Delete (driven by the failing tests above).
2. Ensure password hashing is applied before Create (and available for login comparison later).
3. Route all user database interactions through this service (no direct DB access from endpoints later).
4. Keep Phase 2 Vitest suite green before moving on.

**Deliverables**:

- Password helpers (Web Crypto PBKDF2): `src/lib/password.ts` + `src/lib/password.test.ts`
- D1 accessor: `src/lib/db/client.ts` (`getDb`)
- User Service: `src/lib/services/user-service.ts` (Create/Read/Update/Delete + login lookup helpers)
- Vitest tests: `src/lib/services/user-service.test.ts` (in-memory D1 mock at the DB boundary)

### Phase 3: Auth API Endpoints - COMPLETED

**Objective**: Expose registration, login, and logout over HTTP POST.

**TDD (Vitest):**

1. Write failing tests for `POST /register` (required fields, duplicate username/email, success path).
2. Write failing tests for `POST /login` (validation, invalid credentials, successful hash comparison).
3. Write failing tests for `POST /logout` (accepts POST; no cookies/sessions/tokens required).
4. Implement endpoints via User Service until tests pass; mock the User Service at the boundary.
5. Refactor while keeping the suite green.

**Tasks**:

1. Implement `POST /register` using User Service + validation + duplicate checks.
2. Implement `POST /login` using User Service + hash comparison.
3. Implement `POST /logout` without cookies, sessions, or tokens.
4. Return meaningful validation and authentication errors.
5. Keep Phase 3 Vitest suite green before moving on.

**Deliverables**:

- `POST /register` — `src/app/api/register/route.ts` (POST rewritten from `/register` via middleware)
- `POST /login` — `src/app/api/login/route.ts` (POST rewritten from `/login` via middleware)
- `POST /logout` — `src/app/api/logout/route.ts` (POST rewritten from `/logout` via middleware)
- Shared auth helpers — `src/lib/auth/` (Zod schemas, HTTP helpers, paths)
- Vitest tests — `src/lib/auth/auth-routes.test.ts` (User Service mocked at the boundary)

### Phase 4: UI and Post-Auth Navigation - COMPLETED

**Objective**: Let teachers register/login/logout and land on the MCQ stub.

**TDD (Vitest):**

1. Write failing UI tests (Testing Library + Vitest) for register/login required-field validation messaging.
2. Write failing tests for successful submit redirecting to the MCQ stub.
3. Write failing tests for logout control submitting `POST /logout` and returning to login/register.
4. Write a failing stub-page assertion that the MCQ page has no MCQ management UI.
5. Implement UI until tests pass; mock network/endpoint calls in unit tests.
6. Refactor while keeping the suite green.

**Tasks**:

1. Build registration and login UI with required-field validation messaging.
2. Wire forms to the POST endpoints.
3. Add MCQ stub page as the post-auth landing page.
4. Add logout control that POSTs to `/logout`.
5. Keep Phase 4 Vitest suite green before moving on.

**Deliverables**:

- shadcn-based `SignupForm` and `LoginForm` (`src/components/signup-form.tsx`, `src/components/login-form.tsx`)
- Pages: `/register`, `/login`, `/mcq` (+ home links)
- MCQ stub with logout form (`src/components/mcq-stub-page.tsx`)
- Auth submit helper (`src/lib/auth/submit-auth.ts`)
- Vitest + Testing Library tests (`src/components/auth-forms.test.tsx`, `src/lib/auth/submit-auth.test.ts`)

### Phase 5: Verification of Application - COMPLETED

**Objective**: Prove the full Sprint 1 flow meets success criteria with automated Vitest coverage plus end-to-end manual verification.

**TDD / verification (Vitest):**

1. Add or extend Vitest coverage for any remaining acceptance gaps discovered during verification (write failing test → fix → green).
2. Run the full Vitest suite (`npm test`) and confirm all phase tests pass.
3. Manually verify the integrated application flow against Success Criteria.

**Tasks**:

1. Run full Vitest suite; fix any regressions using TDD (failing test first when a bug is found).
2. Run `npm run lint` and `npm run build`; resolve failures before claiming done.
3. Manually verify: register → land on MCQ stub; login → land on MCQ stub; logout; multiple independent users; passwords stored as hashes; no JWT/cookies/sessions/tokens introduced.
4. Confirm MCQ stub has no MCQ functionality.
5. Update acceptance criteria checkboxes and Current Status when verification passes.

**Deliverables**:

- Green full Vitest suite: **41 tests** across Phases 1–4 (added multi-teacher registration test)
- `npm run lint` — passed
- `npm run build` — passed
- No JWT/cookies/sessions/tokens in `src/` (grep verified; logout test asserts no `Set-Cookie`)
- **Local smoke test (recommended):** `npm run preview` → register at `/register` → land on `/mcq` → logout → login again with a second user

---

## Acceptance Criteria

- [x] Teachers can register with FirstName, LastName, Username, Email, and Password.
- [x] Teachers can log in.
- [x] Teachers can log out.
- [x] User records are persisted in the Users table via migration-backed schema.
- [x] Passwords are stored only as hashes (never plain text).
- [x] Login hashes the submitted password and compares it to the stored hash.
- [x] Duplicate username registration is rejected with a meaningful error.
- [x] Duplicate email registration is rejected with a meaningful error.
- [x] Required-field validation returns meaningful errors.
- [x] Registration and Login use the User Service for database interactions.
- [x] `POST /register`, `POST /login`, and `POST /logout` are available.
- [x] After successful registration or login, users are redirected to the MCQ stub page.
- [x] The MCQ stub page contains no MCQ functionality.
- [x] Multiple users can independently register and access the application.
- [x] No JWT, cookies, sessions, refresh tokens, or other token-based auth are introduced.
- [x] Vitest tests cover each phase’s behaviors (schema/service/endpoints/UI) and the full suite passes in Phase 5.
- [x] `npm run lint` and `npm run build` pass during Phase 5 verification.

---

## Success Criteria

- Teachers can register.
- Teachers can log in.
- Teachers can log out.
- User records are persisted in the database.
- Passwords are stored as hashes.
- Users are redirected to the MCQ stub page after authentication.
- Multiple users can independently register and access the application.

---

## Dependencies

### External Dependencies

- Cloudflare D1 — Users table persistence
- Password hashing — Web Crypto API PBKDF2 (no extra package)
- Zod — request body validation for auth route handlers
- Vitest (and Testing Library for UI) — TDD / automated tests; propose before adding if not installed

### Internal Dependencies

- User Service — all user database interactions
- Database migration for Users

---

## Risks and Mitigation

### Technical Risks

- **Risk**: Accidentally introducing cookies, sessions, or JWTs while implementing “logout.”
- **Mitigation**: Keep logout as a simple POST + redirect; do not add auth state stores beyond what this PRD allows.

- **Risk**: Storing or logging plain-text passwords.
- **Mitigation**: Hash before any persistence; never log password fields.

### User Experience Risks

- **Risk**: Teachers expect a full quiz product after login.
- **Mitigation**: MCQ page is clearly a stub; MCQ work is explicitly next sprint.

---

## Troubleshooting Guide

_Populate during implementation as issues are found and fixed._

---

## Notes for AI Agents

1. Read Overview, Business Goal, and Hypothesis first.
2. Treat Scope (In / Out / Cut) and Architecture Notes as hard boundaries — do not implement out-of-scope items (especially cookies, sessions, JWTs, tokens, password reset, email verification, roles, or MCQ features).
3. Do not invent a token, cookie, or session strategy in docs or code.
4. Registration and Login must go through the User Service.
5. Follow TDD with Vitest in every phase: failing test → implementation → refactor; keep the suite green before advancing phases.
6. Update phase status markers as work progresses.
7. Add implementation details under Technical Requirements as code is written.
8. Mark acceptance criteria complete when verified (Phase 5).
9. Keep this document current; remove outdated or conflicting content.
10. Ask before adding any new dependency (including hashing libraries and Vitest).

---

## Current Status

**Last Updated**: 2026-08-26
**Current Phase**: Sprint 1 complete (Phases 1–5)
**Status**: COMPLETED
**Next Steps**: Sprint 2 — MCQ functionality (out of scope for this PRD)
