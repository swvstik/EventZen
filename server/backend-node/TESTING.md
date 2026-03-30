# EventZen Node Service Testing Guide
## Modules: M0 (Auth) · M4 (Attendees) · M5 (Notifications) · Reviews · Payments

## Automated Tests

Run unit tests:

```bash
npm test
```

Run unit tests with coverage threshold check:

```bash
npm run test:coverage
```

Run integration tests (Kafka-backed test requires broker at localhost:9094):

```bash
RUN_KAFKA_INTEGRATION=true npm run test:integration
```

Without `RUN_KAFKA_INTEGRATION=true`, the broker-dependent integration test is skipped.

## Runtime API Documentation

In this repository's default Docker Compose setup, only the gateway port is
published externally (`localhost:8080`). Node's container port `8081` is
internal-only, so direct links like `http://localhost:8081/swagger` usually do
not open from the host.

Use this rule:

- If running Node directly on your host (outside compose), docs are at:
   - `http://localhost:8081/swagger`
   - `http://localhost:8081/openapi.yaml`
- If running full stack via compose (recommended), use Postman through gateway:
   - `http://localhost:8080/api/...`
   - Swagger UI is not exposed by the gateway in this mode.

## Compose Auto-Seeding (Test Users)

When using `docker compose up --build` from repository root, users are seeded
automatically by `user-seed` before Node service starts.

Default credentials:

- `admin@ez.local`
- `vendor@ez.local`
- `user@ez.local`
- password: `Eventzen@2026!` (or `TEST_USER_PASSWORD` if configured)

Manual reseed:

```bash
docker compose run --rm user-seed
```

## Manual API Smoke Checklist

1. Health endpoint:
   - `GET /health` returns `200` and `service: eventzen-node`.
2. Auth flow:
   - register, verify email OTP, login, refresh token, logout.
3. Attendee flow:
   - register attendee, verify event attendee count endpoint, organizer export endpoint.
   - when Spring sets an event to `CANCELLED`, verify registrations are auto-cancelled via internal endpoint.
4. Notification flow:
   - list notifications, unread count, mark one read, mark all read.
5. Review flow:
   - set rating once, update the same rating, add multiple comments, edit/delete own comments.
6. Payment flow:
   - create payment intent/session (if enabled), confirm callback path, verify event financial aggregate endpoint.

## Coverage Notes

Current automated tests include:
- Auth service validation and refresh flow
- JWT auth middleware behavior
- Kafka bus and notification event consumer behavior
- Token lifecycle integration behavior
- Review service permissions and multi-review acceptance
- Review service single-rating upsert and multi-comment behavior

Recommended next additions:
- Integration tests for attendee registration conflict, waitlist transitions, and event-cancellation bulk updates
- Controller-level tests for review and payment routes
- Contract tests for internal APIs consumed by Spring/.NET services
