# Security — ISO 27001 Controls

## Mandatory Checks Before Every Commit
- [ ] No hardcoded secrets (API keys, passwords, tokens, private keys)
- [ ] All user inputs validated at system boundaries
- [ ] SQL: parameterized queries only — no string concatenation
- [ ] Every endpoint has auth/authz verified
- [ ] Error messages do not leak: stack traces, paths, PII, DB details
- [ ] Sensitive data not written to logs
- [ ] Rate limiting considered for public-facing endpoints

## ISO 27001 Control Mapping

| OWASP Risk | ISO 27001 Control | Requirement |
|------------|-------------------|-------------|
| Injection | A.14.2.5 | Parameterized queries; never string-concat SQL |
| Broken Auth | A.9.4.2 | JWT/session validation on all protected routes |
| Sensitive Data | A.10.1.1 | Encrypt PII at rest and in transit (HTTPS always) |
| Access Control | A.9.4.1 | Principle of least privilege on all resources |
| Logging | A.12.4.1 | Audit trail for all data modification events |

## Audit Trail (A.12.4)
Log for every data modification: timestamp, user ID, action, resource ID.
Logs must be retained and not deletable by the application.

## Secret Management
- NEVER hardcode secrets in source code
- Use environment variables; validate required secrets at startup
- Rotate any exposed secret immediately
- Add .env to .gitignore before first commit
