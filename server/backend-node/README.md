# EventZen — Node.js Service (M0 + M4 + M5)

Auth, Attendee Registration, and Notifications service.

- **Port:** `8081`
- **Database:** MongoDB `eventzen_node`
- **Modules:** Auth (M0) · Attendees + Waitlist + QR (M4) · Notifications (M5)

## Quick Start

```bash
cp .env.example .env
# Fill in .env values (see below)
npm install
npm run dev
```

Health check: `GET http://localhost:8081/health`
Swagger UI: `GET http://localhost:8081/swagger`
OpenAPI file: `GET http://localhost:8081/openapi.yaml`

## Test User Seeding

When running via Docker Compose from repository root, test users are seeded
automatically by the one-shot `user-seed` service before `node-service` starts.
Seeding is idempotent and uses email-based upsert to avoid duplicates.

Default users:

- `admin@ez.local` (ADMIN)
- `vendor@ez.local` (VENDOR)
- `user@ez.local` (CUSTOMER)
- Password: `Eventzen@2026!` (or `TEST_USER_PASSWORD` if set)

Manual run:

```bash
npm run seed:users
```

From repo root through Compose:

```bash
docker compose run --rm user-seed
```

## Testing

```bash
npm test
```

Kafka broker-backed integration test (requires reachable broker and explicit opt-in):

```bash
RUN_KAFKA_INTEGRATION=true npm run test:integration
```

By default, the integration test is skipped unless `RUN_KAFKA_INTEGRATION=true`.

See `TESTING.md` for the full backend testing checklist.

## Environment Variables

```env
PORT=8081
MONGO_URI=mongodb://localhost:27017/eventzen_node
JWT_SECRET=your_secret_here          # must match Spring Boot jwt.secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
SPRING_BASE_URL=http://localhost:8082 # for tier capacity checks
INTERNAL_SERVICE_SECRET=eventzen_internal_secret_change_me
KAFKA_ENABLED=true
KAFKA_BROKERS=localhost:9094
KAFKA_CLIENT_ID=eventzen-node
KAFKA_EVENT_LIFECYCLE_TOPIC=eventzen.event.lifecycle
KAFKA_REGISTRATION_TOPIC=eventzen.registration.lifecycle
KAFKA_PAYMENT_TOPIC=eventzen.payment.lifecycle
SMTP_HOST=smtp.gmail.com
SMTP_USER=your.email@gmail.com
SMTP_PASS=your_gmail_app_password
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=eventzen-media
MINIO_PUBLIC_BASE_URL=http://localhost:8080/media
```

## API Routes

### Auth (M0)
| Method | Path | Auth |
|--------|------|------|
| POST | `/api/auth/register` | None |
| POST | `/api/auth/verify-email` | None |
| POST | `/api/auth/resend-otp` | None |
| POST | `/api/auth/login` | None |
| POST | `/api/auth/refresh` | None |
| DELETE | `/api/auth/logout` | JWT |
| POST | `/api/auth/forgot-password` | None |
| POST | `/api/auth/reset-password` | None |
| GET | `/api/auth/me` | JWT |
| PUT | `/api/auth/me` | JWT |
| GET | `/api/users` | JWT+ADMIN |
| DELETE | `/api/users/:id` | JWT+ADMIN |
| PATCH | `/api/users/:id/role` | JWT+ADMIN |

### Attendees (M4)
| Method | Path | Auth |
|--------|------|------|
| POST | `/api/attendees/register` | JWT |
| DELETE | `/api/attendees/:id` | JWT |
| GET | `/api/attendees/my` | JWT |
| GET | `/api/attendees/event/:eventId` | JWT+ORG/ADMIN |
| GET | `/api/attendees/event/:eventId/count` | None |
| GET | `/api/attendees/event/:eventId/export` | JWT+ORG/ADMIN |
| POST | `/api/attendees/checkin` | JWT+ORG/ADMIN |

### Notifications (M5)
| Method | Path | Auth |
|--------|------|------|
| GET | `/api/notifications` | JWT |
| GET | `/api/notifications/unread-count` | JWT |
| PATCH | `/api/notifications/:id/read` | JWT |
| PATCH | `/api/notifications/read-all` | JWT |

### Uploads (MinIO-backed)
| Method | Path | Auth |
|--------|------|------|
| GET | `/api/uploads/config` | None |
| POST | `/api/uploads/image` | JWT |
| DELETE | `/api/uploads/delete` | JWT |

### Reviews (Rating + Comments)
| Method | Path | Auth |
|--------|------|------|
| GET | `/api/reviews/event/:eventId` | None (public comments) |
| GET | `/api/reviews/event/:eventId/rating/mine` | JWT |
| PUT | `/api/reviews/event/:eventId/rating` | JWT |
| POST | `/api/reviews/comments` | JWT |
| POST | `/api/reviews` | JWT (legacy mixed create) |
| PUT | `/api/reviews/:id` | JWT (comment update) |
| DELETE | `/api/reviews/:id` | JWT |

## Structure

```
src/
├── config/         database.js
├── controllers/    AuthController, AttendeeController, NotificationController
├── middleware/     auth.js (authenticate, requireRole), errorHandler.js
├── models/         User, EmailOtp, RefreshToken, PasswordResetToken,
│                   Registration, Notification
├── repositories/   UserRepository, RefreshTokenRepository,
│                   PasswordResetTokenRepository, RegistrationRepository,
│                   NotificationRepository
├── routes/         authRoutes, userRoutes, attendeeRoutes, notificationRoutes
├── services/       AuthService, OtpService, TokenService,
│                   RegistrationService, NotificationService
└── utils/          AppError, emailTemplates, mailer
```
