# AI Security Rules & Defensive Coding Standards

These rules apply to all code generated, edited, or reviewed in this project (`ota-robot-system`). They are non-negotiable and follow the OWASP Top 10, Industrial Zero Trust, and the `vibe-check` security framework.

---

## 1. Secrets and Environment Variables

- NEVER hardcode secrets, private keys, passwords, or connection strings in source code.
- NEVER expose secrets in frontend client code (`frontend/src/app/`, `frontend/src/components/`, `frontend/src/lib/`).
- NEVER prefix sensitive variables with `NEXT_PUBLIC_` in Next.js (anything with `NEXT_PUBLIC_` is baked into the browser JS bundle).
- Private cryptographic signing keys (e.g., `keys/private.pem`) must NEVER be committed to Git. Ensure `.gitignore` ignores all private key variants.
- In production, load sensitive secrets (database credentials, private keys, JWT secrets) via secure cloud environment variables or secret vaults.

---

## 2. API Authentication & Authorization (Broken Object Level Authorization / IDOR)

- Every mutating endpoint (`POST`, `PATCH`, `DELETE`) and fleet command endpoint (`/deployments`, `/rollback`, `/firmware/upload`, `/firmware/resign`) MUST require authentication middleware.
- Unauthenticated requests to protected endpoints MUST be rejected immediately with HTTP `401 Unauthorized`.
- Endpoints taking a resource ID (e.g., `/deployments/:id`, `/devices/:id`) MUST verify tenant or role authorization before performing any action.
- Administrative operations (such as firmware resignation or user creation) MUST enforce role-based access control (`admin` role) and return HTTP `403 Forbidden` for non-admin accounts.

---

## 3. Session & Token Management

- Session / Refresh tokens MUST be stored strictly in `HttpOnly; Secure; SameSite=Strict` cookies.
- NEVER store access tokens or sensitive credentials in `localStorage` or `sessionStorage` (vulnerable to Cross-Site Scripting / XSS).
- Access tokens (JWT) must have a short lifespan (maximum 15 minutes).
- Refresh tokens must be rotatable and stored hashed in the database.

---

## 4. Password Security & Storage

- Passwords MUST be hashed using Argon2id or bcrypt with a work cost factor >= 12.
- NEVER use MD5, SHA-1, SHA-256, or unsalted hashing for passwords.
- Login endpoints MUST enforce rate limiting to mitigate brute-force and credential-stuffing attacks (maximum 5 attempts per minute per IP).
- Implement an account lockout or cooldown period after repeated failed attempts.

---

## 5. Network, CORS, and Security Headers

- CORS MUST NOT use wildcards (`*`) in production. Explicitly configure `AllowOrigins` with known domains (e.g., the production Vercel domain and local development origin).
- Enable `AllowCredentials: true` only when explicit origins are defined.
- Enforce standard security headers on both Fiber and Next.js responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

---

## 6. Input Validation & Database Security

- NEVER concatenate user input into raw SQL queries. Always use parameterized queries (e.g. pgx / sqlc) or ORM parameter binding.
- All incoming payloads MUST be validated server-side for structure, type, and bounds before processing.
- Error messages returned to clients MUST NOT expose internal stack traces, database schema details, or underlying server paths.

---

## 7. File Uploads (Firmware Distribution)

- Validate uploaded firmware binary files on the server side by checking magic bytes and size constraints, not merely file extension names.
- Store uploaded files on segregated object storage (MinIO / S3 / Cloudflare R2), never directly executing them on the API host.
- Always calculate cryptographic SHA-256 digests and ECDSA signatures server-side upon successful upload before distribution.
