# EventZen — Node.js Service

Auth · Attendees/Waitlist/QR · Payments · Notifications · Uploads · Reviews · Vendor Applications

- **Port:** `8081`
- **Database:** MongoDB `eventzen_node`

## Quick Start (Standalone Dev)

> [!NOTE]
> When running via **Docker Compose** from the repo root, environment variables are injected automatically from Vault. The `.env.example` below is only needed if running this service standalone, outside of Compose.

```bash
cp .env.example .env
# Fill in .env values (see Environment Variables section below)
npm install
npm run dev
```

| Endpoint | URL |
|---|---|
| Health | `GET http://localhost:8081/health` |
| Metrics | `GET http://localhost:8081/metrics` |
| Swagger UI | `GET http://localhost:8081/swagger` |
| OpenAPI YAML | `GET http://localhost:8081/openapi.yaml` |

## Test User Seeding

When running via Docker Compose, test users are seeded automatically by the one-shot `user-seed` service before `node-service` starts. Seeding is idempotent.

Default users:

| Email | Role | Password |
|---|---|---|
| `admin@ez.local` | ADMIN | `Eventzen@2026!` |
| `vendor@ez.local` | VENDOR | `Eventzen@2026!` |
| `user@ez.local` | CUSTOMER | `Eventzen@2026!` |

Password can be overridden via the `TEST_USER_PASSWORD` environment variable.

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

See `TESTING.md` for the full backend testing checklist.

## Environment Variables

> These values apply to **standalone dev** mode. Docker Compose overrides most of these automatically via Vault-injected secrets.

```env
PORT=8081
MONGO_URI=mongodb://localhost:27017/eventzen_node
JWT_SECRET=your_secret_here          # must match Spring and .NET jwt secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
SPRING_BASE_URL=http://localhost:8082
INTERNAL_SERVICE_SECRET=eventzen_internal_secret_change_me
TOKEN_HASH_SECRET=your_hash_secret_here
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
POLAR_ACCESS_TOKEN=your_polar_token
POLAR_PRODUCT_ID=your_polar_product_id
```

## Kafka Topics

| Topic | Direction | Description |
|---|---|---|
| `eventzen.event.lifecycle` | **Consume** | Receives event status events — triggers notification delivery |
| `eventzen.registration.lifecycle` | **Produce** | Emits registration completed events — consumed by .NET for budget auto-allocation |
| `eventzen.payment.lifecycle` | **Produce** | Emits payment completed events — consumed by .NET for expense auto-allocation |
| `eventzen.dlq` | Produce | Dead-letter queue for unprocessable messages |

## API Routes

### Auth
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

### Users (Admin)
| Method | Path | Auth |
|--------|------|------|
| GET | `/api/users` | JWT + ADMIN |
| DELETE | `/api/users/:id` | JWT + ADMIN |
| PATCH | `/api/users/:id/role` | JWT + ADMIN |

### Attendees
| Method | Path | Auth |
|--------|------|------|
| POST | `/api/attendees/register` | JWT |
| DELETE | `/api/attendees/:id` | JWT |
| GET | `/api/attendees/my` | JWT |
| GET | `/api/attendees/event/:eventId` | JWT + ORG/ADMIN |
| GET | `/api/attendees/event/:eventId/count` | None |
| GET | `/api/attendees/event/:eventId/export` | JWT + ORG/ADMIN |
| POST | `/api/attendees/checkin` | JWT + ORG/ADMIN |

### Payments
| Method | Path | Auth |
|--------|------|------|
| GET | `/api/payments/status/:orderId` | JWT |
| POST | `/api/payments/status/:orderId/invoice` | JWT |
| GET | `/api/payments/status/:orderId/invoice` | JWT |
| POST | `/api/payments/webhook/polar` | None (Polar webhook) |

### Notifications
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

### Reviews
| Method | Path | Auth |
|--------|------|------|
| GET | `/api/reviews/event/:eventId` | None |
| GET | `/api/reviews/event/:eventId/rating/mine` | JWT |
| PUT | `/api/reviews/event/:eventId/rating` | JWT |
| POST | `/api/reviews/comments` | JWT |
| POST | `/api/reviews` | JWT |
| PUT | `/api/reviews/:id` | JWT |
| DELETE | `/api/reviews/:id` | JWT |

### Vendor Applications
| Method | Path | Auth |
|--------|------|------|
| POST | `/api/vendor-applications` | JWT |
| GET | `/api/vendor-applications/me` | JWT |
| GET | `/api/admin/vendor-applications` | JWT + ADMIN |
| PATCH | `/api/admin/vendor-applications/:id/status` | JWT + ADMIN |

### Internal (Service-to-Service)
| Method | Path | Auth |
|--------|------|------|
| POST | `/api/internal/events/:eventId/cancel-registrations` | `X-Internal-Secret` header |

Called by Spring when an event transitions to `CANCELLED` — bulk-cancels active registrations for that event.

## Structure

```
src/
├── config/         database.js
├── controllers/    AuthController, AttendeeController, NotificationController,
│                   PaymentController, ReviewController, UploadController,
│                   VendorApplicationController
├── messaging/      kafkaBus.js, notificationEventConsumer.js, topics.js
├── middleware/     auth.js (authenticate, requireRole), errorHandler.js
├── models/         User, EmailOtp, RefreshToken, PasswordResetToken,
│                   Registration, Notification, Payment, Review,
│                   VendorApplication
├── repositories/   UserRepository, RefreshTokenRepository,
│                   PasswordResetTokenRepository, RegistrationRepository,
│                   NotificationRepository, PaymentRepository, ReviewRepository
├── routes/         authRoutes, userRoutes, attendeeRoutes, notificationRoutes,
│                   paymentRoutes, reviewRoutes, uploadRoutes,
│                   vendorApplicationRoutes, adminVendorApplicationRoutes,
│                   internalRoutes
├── scripts/        seed-users.js
├── services/       AuthService, OtpService, TokenService,
│                   RegistrationService, NotificationService,
│                   PaymentService, ReviewService, UploadService,
│                   VendorApplicationService
└── utils/          AppError, emailTemplates, mailer, qrGenerator
```
