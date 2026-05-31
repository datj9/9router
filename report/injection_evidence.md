# Injection Evidence

### INJ-TEST-01: Request Details SQL Probe

- Status: false-positive
- Target: `GET /api/usage/request-details?provider=' OR 1=1--&page=1&pageSize=1`
- Code pointer: `src/app/api/usage/request-details/route.js:40` -> `src/lib/db/repos/requestDetailsRepo.js:151`
- Proof:

```http
HTTP/1.1 200 OK
{"details":[],"pagination":{"page":1,"pageSize":1,"totalItems":0,"totalPages":0,"hasNext":false,"hasPrev":false}}
```

- Impact: no injection impact proven. Bound parameters handled witness input as data.
- Limits: focused on reachable authenticated query filters.
- Cleanup: not applicable.

