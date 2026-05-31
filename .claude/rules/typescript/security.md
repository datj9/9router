# TypeScript Security

> Extends common/rules/security.md for saturn and jupiter.

## XSS Prevention (jupiter)
- Never render user-provided HTML without sanitizing first (DOMPurify)
- Never construct URLs from user input without validation
- React's unsafe HTML rendering prop must never receive unsanitized content

## CSRF (saturn)
- Include CSRF tokens on all state-changing requests
- Verify Origin or Referer headers server-side

## Input Validation (saturn)
- Yup schemas for ALL DTO validation at API boundary
- Server-side validation is mandatory regardless of client validation
- Reject requests with unexpected fields (Yup noUnknown())

## API Security (saturn)
- JWT: validate with signature verification — never skip signature check
- Never expose stack traces or internal errors to API clients
- HTTPS in all environments
- 401 for unauthenticated, 403 for unauthorized

## Dependency Security
- Run `npm audit --audit-level=high` before merging to main
- No HIGH or CRITICAL vulnerabilities in dependencies
