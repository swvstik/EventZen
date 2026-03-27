# EventZen Node Service Testing Guide
## Modules: M0 (Auth) · M4 (Attendees) · M5 (Notifications) · Reviews · Payments

## Automated Tests

Run unit tests:

```bash
npm test
```

Run integration tests (Kafka-backed test requires broker at localhost:9094):

```bash
RUN_KAFKA_INTEGRATION=true npm run test:integration
```

Without `RUN_KAFKA_INTEGRATION=true`, the broker-dependent integration test is skipped.

## Runtime API Documentation

- Swagger UI: `http://localhost:8081/swagger`
- OpenAPI YAML: `http://localhost:8081/openapi.yaml`

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
- Integration tests for attendee registration conflict and waitlist transitions
- Controller-level tests for review and payment routes
- Contract tests for internal APIs consumed by Spring/.NET services
