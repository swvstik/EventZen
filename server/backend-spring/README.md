# EventZen — Spring Boot Service (M1 + M2)

Spring Boot 3 microservice handling **Events, Venues, and Schedules** for the EventZen platform.

- **Port:** `8082`
- **Database:** MySQL `eventzen`
- **Auth:** JWT validated via shared secret with Node.js auth service

## Modules

| Module | What it covers |
|--------|---------------|
| M1 | Events, TicketTiers, EventScheduleSlots, status lifecycle, full-text search |
| M2 | Venues, VenueBookings, conflict detection |

> [!NOTE]
> The supplier/vendor registry and event-supplier assignment APIs were retired from this service.
> Vendor flows are handled through event ownership and the Vendor Application APIs on the Node service.

## Quick Start (Standalone Dev)

```bash
# 1. Create MySQL database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS eventzen;"

# 2. Set environment variables (see Required Variables below)
# 3. Run
./mvnw spring-boot:run
```

Hibernate auto-creates all tables on first run — no manual schema execution needed.

| Endpoint | URL |
|---|---|
| Health | `GET http://localhost:8082/health` |
| Prometheus metrics | `GET http://localhost:8082/actuator/prometheus` |
| Swagger UI | `GET http://localhost:8082/swagger-ui/index.html` |
| OpenAPI JSON | `GET http://localhost:8082/v3/api-docs` |

## Required Environment Variables

| Variable | Description |
|---|---|
| `SPRING_DATASOURCE_PASSWORD` | MySQL root/user password |
| `JWT_SECRET` | **Must match** `JWT_SECRET` in root `.env` and Node service |
| `INTERNAL_SERVICE_SECRET` | Shared secret for internal service-to-service endpoints |

All other variables have working local defaults for standalone dev.

**Ways to set these:**

- **IntelliJ:** Run → Edit Configurations → Environment variables
- **EnvFile plugin (recommended):** Enable EnvFile → point to `.env`
- **Terminal:**

```bash
export JWT_SECRET=your_secret_here
export SPRING_DATASOURCE_PASSWORD=your_db_password
./mvnw spring-boot:run
```

## Kafka Topics

| Topic | Direction | Description |
|---|---|---|
| `eventzen.event.lifecycle` | **Produce** | Emits event status changes (e.g. `EVENT_PENDING_APPROVAL`, `EVENT_STATUS_DECISION`) |
| `eventzen.registration.lifecycle` | Consume | Receives registration events (for notification triggers) |

## API Endpoints

### M1 — Events

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/events` | None | Paginated list; supports `?q=`, `?category=`, `?status=`, `?date=` |
| GET | `/api/events/:id` | None | Full event detail with ticket tiers and schedule |
| POST | `/api/events` | VENDOR/ADMIN | Creates event as `DRAFT` |
| PUT | `/api/events/:id` | VENDOR/ADMIN | Partial update; owner or admin only |
| DELETE | `/api/events/:id` | VENDOR/ADMIN | Soft delete → sets status to `CANCELLED` |
| POST | `/api/events/:id/submit` | VENDOR | Submits `DRAFT` event for admin approval → `PENDING_APPROVAL` |
| PATCH | `/api/events/:id/status` | ADMIN | Status transitions; `CANCELLED` also triggers attendee registration cancellation in Node via internal API |
| PATCH | `/api/internal/events/:id/rating` | Internal (`X-Internal-Secret`) | Updates `avgRating` — called by Node after a review is submitted |
| GET | `/api/internal/events/:id/ownership` | Internal (`X-Internal-Secret`) | Returns event owner lookup — used by .NET for budget auth checks |

### M1 — Schedule Slots

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/schedule/:eventId` | None |
| POST | `/api/schedule/:eventId` | VENDOR/ADMIN |
| PUT | `/api/schedule/slot/:slotId` | VENDOR/ADMIN |
| DELETE | `/api/schedule/slot/:slotId` | VENDOR/ADMIN |

### M2 — Venues

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/venues` | None | Filter by `?city=` and `?capacity=` |
| GET | `/api/venues/:id` | None | |
| GET | `/api/venues/:id/availability` | None | Returns confirmed bookings for calendar display |
| POST | `/api/venues` | ADMIN | |
| PUT | `/api/venues/:id` | ADMIN | |
| DELETE | `/api/venues/:id` | ADMIN | |

### M2 — Venue Bookings

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/venues/:id/bookings` | ADMIN | `409` returned on any time overlap with existing confirmed booking |
| GET | `/api/venues/:id/bookings` | ADMIN | Full booking history |
| DELETE | `/api/venues/bookings/:id` | ADMIN | Cancels booking — slot becomes available again |

## Cross-Service Integrations

| Trigger | Action |
|---|---|
| Admin sets event status → `CANCELLED` | Spring calls Node `/api/internal/events/:eventId/cancel-registrations` to bulk-cancel active registrations |
| Node submits a review | Node calls Spring `/api/internal/events/:eventId/rating` to sync `avgRating` |
| .NET checks budget ownership | .NET calls Spring `/api/internal/events/:eventId/ownership` to verify event-owner relationship |

## Project Structure

```
src/main/java/com/eventzen/
├── config/         SecurityConfig, WebConfig
├── controller/     EventController, ScheduleController, VenueController, HealthController
├── dto/
│   ├── request/    CreateEventRequest, UpdateEventRequest, ScheduleSlotRequest,
│   │               VenueRequest, BookVenueRequest,
│   │               StatusPatchRequest, RatingPatchRequest, TicketTierRequest
│   └── response/   EventResponse, EventSummaryResponse, ScheduleSlotResponse,
│                   VenueResponse, VenueBookingResponse,
│                   TicketTierResponse, PagedResponse, ApiResponse
├── exception/      EventZenException, ConflictException, GlobalExceptionHandler
├── model/          Event, TicketTier, EventScheduleSlot, Venue, VenueBooking + enums
├── repository/     One JpaRepository per entity, custom @Query methods
├── security/       JwtUtil, JwtAuthFilter, AuthenticatedUser
└── service/        EventService, ScheduleService, VenueService
```

## Testing

See [`TESTING.md`](TESTING.md) for the full step-by-step Postman guide covering all endpoints, conflict detection tests, and the full event lifecycle flow.
