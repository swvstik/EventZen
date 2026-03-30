# EventZen Endpoint Inventory

This file lists all API endpoints currently implemented across all backend services.

Notes:
- Paths are shown as externally reachable through the gateway on `http://localhost:8080`.
- Auth labels:
	- `Public`: no JWT required
	- `JWT`: authenticated user
	- `Admin`: JWT with admin role
	- `Vendor/Admin`: JWT with vendor or admin role
	- `Internal`: requires `X-Internal-Secret`
- Some documentation endpoints are framework-provided (Swagger/OpenAPI) and are included explicitly.

## Node Backend (server/backend-node)

### Service and Docs
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Node service health and Kafka runtime state. |
| GET | `/swagger` | Public | Unified Swagger UI for all gateway-exposed services. |
| GET | `/openapi/eventzen-aggregated.yaml` | Public | Unified OpenAPI spec for all gateway-exposed services. |
| GET | `/metrics` | Public (internal scrape target) | Node Prometheus metrics endpoint. |
| GET | `/openapi.yaml` | Public | Raw OpenAPI YAML served by Node app. |

### Auth (`/api/auth`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register a new user account. |
| POST | `/api/auth/verify-email` | Public | Verify OTP and activate account. |
| POST | `/api/auth/resend-otp` | Public | Resend verification OTP. |
| POST | `/api/auth/login` | Public | Login and issue tokens. |
| POST | `/api/auth/refresh` | Public | Refresh access token using refresh token. |
| POST | `/api/auth/forgot-password` | Public | Request password reset email. |
| POST | `/api/auth/reset-password` | Public | Reset password with token. |
| DELETE | `/api/auth/logout` | Public | Logout by invalidating refresh token. |
| GET | `/api/auth/me` | JWT | Get current user profile. |
| PUT | `/api/auth/me` | JWT | Update current user profile. |
| POST | `/api/auth/me/email-change/request` | JWT | Start email change OTP flow. |
| POST | `/api/auth/me/email-change/confirm` | JWT | Confirm email change with OTP. |

### Users (`/api/users`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/users` | Admin | List users. |
| DELETE | `/api/users/{id}` | Admin | Delete user. |
| PATCH | `/api/users/{id}/role` | Admin | Change user role. |

### Attendees (`/api/attendees`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/attendees/event/{eventId}/count` | Public | Tier-wise attendee counts for event. |
| GET | `/api/attendees/event/{eventId}/waitlist-count` | Public | Tier-wise waitlist counts for event. |
| POST | `/api/attendees/register` | JWT | Register attendee/tickets for event tier. |
| GET | `/api/attendees/my` | JWT | Get my registrations. |
| DELETE | `/api/attendees/{id}` | JWT | Cancel my registration. |
| GET | `/api/attendees/event/{eventId}` | Vendor/Admin | Get attendees for event. |
| GET | `/api/attendees/event/{eventId}/export` | Vendor/Admin | Export event attendees CSV. |
| POST | `/api/attendees/events/counts` | Vendor/Admin | Bulk attendee counts for event IDs. |
| POST | `/api/attendees/checkin` | Vendor/Admin | Check in attendee. |

### Notifications (`/api/notifications`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/notifications` | JWT | List my notifications. |
| GET | `/api/notifications/unread-count` | JWT | Get unread notification count. |
| GET | `/api/notifications/stream` | JWT | Server-sent events stream for notifications. |
| PATCH | `/api/notifications/read-all` | JWT | Mark all my notifications as read. |
| PATCH | `/api/notifications/{id}/read` | JWT | Mark one notification as read. |

### Internal (`/api/internal`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/internal/events/{eventId}/cancel-registrations` | Internal | Cancel registrations when event is cancelled. |
| POST | `/api/internal/payments/platform-fee-aggregates` | Internal | Return platform-fee aggregates per event. |
| POST | `/api/internal/notifications/events/{eventId}/pending-approval` | Internal | Emit pending-approval notifications. |
| POST | `/api/internal/notifications/events/{eventId}/status` | Internal | Emit status-change notifications. |
| GET | `/api/internal/vendors/{userId}/profile` | Internal | Get vendor display profile. |

### Vendor Applications
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/vendor-applications` | JWT | Submit vendor application. |
| GET | `/api/vendor-applications/me` | JWT | Get my vendor applications/status. |
| GET | `/api/admin/vendor-applications` | Admin | List all vendor applications for review. |
| PATCH | `/api/admin/vendor-applications/{id}/status` | Admin | Approve/reject vendor application. |

### Uploads (`/api/uploads`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/uploads/config` | Public | Get upload config (bucket/base URL/max size). |
| POST | `/api/uploads/image` | JWT | Upload image (normalized to WebP). |
| DELETE | `/api/uploads/delete` | JWT | Delete uploaded image by objectName or URL. |

### Reviews (`/api/reviews`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/reviews/event/{eventId}` | Public | List public comments for event. |
| GET | `/api/reviews/event/{eventId}/rating/summary` | Public | Get event average rating and unique rater count. |
| POST | `/api/reviews/comments` | JWT | Create comment for event. |
| GET | `/api/reviews/event/{eventId}/rating/mine` | JWT | Get my rating for event. |
| PUT | `/api/reviews/event/{eventId}/rating` | JWT | Upsert my single rating for event. |
| POST | `/api/reviews` | JWT | Legacy mixed create (rating and/or comment). |
| GET | `/api/reviews/event/{eventId}/mine` | JWT | Backward-compatible alias for my rating entry. |
| PUT | `/api/reviews/{id}` | JWT | Update my comment entry. |
| DELETE | `/api/reviews/{id}` | JWT | Delete my comment/rating entry (admin can moderate). |

### Payments (`/api/payments`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/payments/status/{orderId}` | JWT | Get payment status for order. |
| POST | `/api/payments/status/{orderId}/invoice` | JWT | Generate invoice for order. |
| GET | `/api/payments/status/{orderId}/invoice` | JWT | Fetch generated invoice. |
| POST | `/api/payments/webhook/polar` | Public | Polar payment webhook callback. |

## Spring Backend (server/backend-spring)

### Service and Docs
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Spring service health and Kafka bootstrap info. |
| GET | `/actuator/prometheus` | Public (internal scrape target) | Spring Boot Prometheus metrics endpoint. |
| GET | `/swagger-ui/index.html` | Public | Springdoc Swagger UI (framework endpoint). |
| GET | `/swagger-ui.html` | Public | Springdoc UI alias (framework endpoint). |
| GET | `/v3/api-docs` | Public | Spring OpenAPI JSON (framework endpoint). |

### Events (`/api/events`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/events` | Public/JWT context-aware | List events with filters/pagination. |
| GET | `/api/events/{id}` | Public/JWT context-aware | Get full event details. |
| POST | `/api/events` | Vendor/Admin | Create event. |
| PUT | `/api/events/{id}` | Vendor/Admin | Update event. |
| DELETE | `/api/events/{id}` | Vendor/Admin | Soft-cancel event. |
| POST | `/api/events/{id}/submit` | Vendor | Submit event for approval. |
| PATCH | `/api/events/{id}/status` | Admin | Change event status. |

### Venues (`/api/venues`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/venues` | Public | List venues (city/capacity filters). |
| GET | `/api/venues/{id}` | Public | Get venue details. |
| GET | `/api/venues/{id}/availability` | Public | Get confirmed booking slots for venue. |
| GET | `/api/venues/availability/bulk` | Public | Get availability for multiple venues. |
| POST | `/api/venues` | Admin | Create venue. |
| PUT | `/api/venues/{id}` | Admin | Update venue. |
| DELETE | `/api/venues/{id}` | Admin | Delete venue. |
| POST | `/api/venues/{id}/bookings` | Vendor/Admin | Create venue booking. |
| GET | `/api/venues/{id}/bookings` | Vendor/Admin | List venue bookings. |
| DELETE | `/api/venues/bookings/{id}` | Vendor/Admin | Cancel venue booking. |

### Schedule (`/api/schedule`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/schedule/{eventId}` | Public | List agenda slots for event. |
| POST | `/api/schedule/{eventId}` | Vendor/Admin | Add schedule slot. |
| PUT | `/api/schedule/slot/{slotId}` | Vendor/Admin | Update schedule slot. |
| DELETE | `/api/schedule/slot/{slotId}` | Vendor/Admin | Delete schedule slot. |

### Internal Spring Endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| PATCH | `/api/internal/events/{id}/rating` | Internal | Update denormalized event avg rating. |
| GET | `/api/internal/events/{id}/ownership` | Internal | Get event ownership metadata. |
| GET | `/api/internal/venue-bookings/events/{eventId}/latest-confirmed` | Internal | Get latest confirmed booking allocation for event. |

## .NET Backend (server/backend-dotnet)

### Service and Docs
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | .NET service health and Kafka runtime payload. |
| GET | `/metrics` | Public (internal scrape target) | ASP.NET Core Prometheus metrics endpoint. |
| GET | `/swagger` | Public (Development) | Swagger UI root (framework endpoint). |
| GET | `/swagger/v1/swagger.json` | Public (Development) | OpenAPI JSON (framework endpoint). |

### Budget (`/api/budget`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/budget/events/{eventId}` | Vendor/Admin | Create budget for event. |
| GET | `/api/budget/events/{eventId}` | Vendor/Admin | Get budget summary. |
| PUT | `/api/budget/events/{eventId}` | Vendor/Admin | Update budget allocation/currency. |
| POST | `/api/budget/events/{eventId}/expenses` | Vendor/Admin | Add expense. |
| GET | `/api/budget/events/{eventId}/expenses` | Vendor/Admin | List expenses for event budget. |
| PUT | `/api/budget/expenses/{id}` | Vendor/Admin | Update expense. |
| DELETE | `/api/budget/expenses/{id}` | Vendor/Admin | Delete expense. |

### Reports (`/api/reports`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/reports/events/{eventId}` | Vendor/Admin | Get full financial report for event. |
| GET | `/api/reports/vendor/events` | Vendor | Vendor report overview for owned events. |
| GET | `/api/reports/admin/events` | Admin | Admin report overview across events. |
| POST | `/api/reports/admin/events/{eventId}/reconcile-venue-allocation` | Admin | Reconcile auto venue allocation for event budget. |

## Cross-check Summary

Controller-defined endpoints discovered:
- Node: 57
- Spring: 28
- .NET: 14

Framework-provided docs/metadata endpoints included:
- Node Swagger/OpenAPI endpoints
- Spring Springdoc endpoints
- .NET Swagger endpoints (development mode)

## Database Schema Inventory (ERD Ready)

This section summarizes current database structures used by all backends.

## MongoDB Schema (eventzen_node)

Collections from Node models in server/backend-node/src/models:

### users
- Primary key: `_id` (ObjectId)
- Key fields: `name`, `email`, `passwordHash`, `phoneNumber`, `role`, `isEmailVerified`, `avatarUrl`, `avatarObjectName`, `createdAt`, `updatedAt`
- Constraints/indexes:
	- `email` unique + indexed

### emailotps
- Primary key: `_id`
- Key fields: `email`, `otpHash`, legacy `otp`, `expiresAt`, timestamps
- Constraints/indexes:
	- TTL index on `expiresAt`
	- indexes on `email`, `otpHash`

### passwordresettokens
- Primary key: `_id`
- Key fields: `userId` (ObjectId ref User), `tokenHash`, legacy `token`, `expiresAt`
- Constraints/indexes:
	- `tokenHash` unique
	- legacy `token` unique sparse
	- TTL index on `expiresAt`

### refreshtokens
- Primary key: `_id`
- Key fields: `userId` (ObjectId ref User), `tokenHash`, legacy `token`, `expiresAt`, timestamps
- Constraints/indexes:
	- `tokenHash` unique
	- legacy `token` unique sparse
	- index on `userId`
	- TTL index on `expiresAt`

### registrations
- Primary key: `_id`
- Key fields: `userId`, `eventId`, `tierId`, `tierName`, `ticketUnitPrice`, `ticketCurrency`, `quantity`, `status`, `waitlistPosition`, `qrToken`, `qrDataUri`, `registeredAt`
- Constraints/indexes:
	- index `{ eventId, tierId, status }`
	- unique partial index `unique_waitlist_position` on `{ eventId, tierId, waitlistPosition }` for WAITLISTED
	- index `{ userId, registeredAt }`
	- unique partial index `qrToken_1` on `qrToken`

### reviews
- Primary key: `_id`
- Key fields: `userId`, `userName`, `userAvatarUrl`, `eventId`, optional `rating`, `comment`, `createdAt`
- Constraints/indexes:
	- index `{ eventId, createdAt }`
	- index `{ userId, eventId, createdAt }`
	- note: legacy unique `{ userId, eventId }` is removed during startup normalization

### notifications
- Primary key: `_id`
- Key fields: `userId`, `eventId`, `type`, `message`, `isRead`, `sentAt`
- Constraints/indexes:
	- index `{ userId, sentAt }`
	- index `{ userId, isRead }`

### payments
- Primary key: `_id`
- Key fields: `userId`, `userEmail`, `eventId`, `tierId`, `quantity`, money fields (`subtotalMinor`, `platformFeeMinor`, `amountMinor`), Polar IDs/status fields, `status`, `registrations[]`, `completedAt`, `rawLastPayload`, timestamps
- Constraints/indexes:
	- index `{ userId, createdAt }`
	- unique index `payment_idempotency_key` on `idempotencyKey`
	- unique sparse partial index `payment_order_id` on `polarOrderId`
	- unique sparse partial index `payment_checkout_id` on `polarCheckoutId`

### vendorapplications
- Primary key: `_id`
- Key fields: `userId`, `businessName`, `serviceTypes[]`, `portfolioUrl`, `notes`, `status`, review fields, timestamps
- Constraints/indexes:
	- index `{ userId, createdAt }`
	- unique partial index `unique_pending_vendor_application` on `{ userId, status }` when status=PENDING

## MongoDB Schema (eventzen_budget)

Collections from .NET Mongo context in server/backend-dotnet/EventZen.Budget/Infrastructure/Persistence/MongoDbContext.cs:

### eventBudgets
- Primary key: `_id`
- Key fields: `eventId`, `totalAllocated`, `currency`, `createdAt`, `createdByUserId`, `ownerVendorUserId`
- Constraints/indexes:
	- unique index `unique_eventId` on `eventId`
	- index `idx_ownerVendorUserId` on `ownerVendorUserId`

### expenses
- Primary key: `_id`
- Key fields: `budgetId`, `category`, `description`, `amount`, `vendorId`, `expenseDate`, `addedByUserId`, `createdAt`, allocation fields (`isAutoAllocated`, `allocationSource`, `sourceBookingId`, `allocationTimestamp`)
- Constraints/indexes:
	- index `idx_budgetId` on `budgetId`
	- unique partial composite index `uq_budget_category_sourceBooking` on `{ budgetId, category, sourceBookingId }` when `sourceBookingId` is string

## MySQL Schema (eventzen)

Entities from Spring models in server/backend-spring/src/main/java/com/eventzen/model:

### venues
- Primary key: `id`
- Columns: `name`, `address`, `city`, `capacity`, `facilities`, `contact_name`, `contact_email`, `contact_phone`, `daily_rate`, `rate_currency`
- Indexes:
	- `idx_venues_city` on `city`

### events
- Primary key: `id`
- Columns: `title`, `description`, `banner_image_url`, `event_date`, `end_date`, `start_time`, `end_time`, `venue_id` (nullable FK), `own_venue_name`, `own_venue_address`, `category`, `tags` (JSON), `status`, `allow_waitlist`, `organiser_user_id`, `avg_rating`, `created_at`
- Indexes:
	- `idx_events_status` on `status`
	- `idx_events_category` on `category`
	- `idx_events_event_date` on `event_date`
	- `idx_events_vendor` on `organiser_user_id`
- Relationships:
	- many events to one venue via `venue_id`

### ticket_tiers
- Primary key: `id`
- Columns: `event_id` (FK), `name`, `price`, `currency`, `capacity`, `maxPerOrder`, `description`
- Relationships:
	- many ticket_tiers to one event via `event_id`

### event_schedule_slots
- Primary key: `id`
- Columns: `event_id` (FK), `session_title`, `session_date`, `start_time`, `end_time`, `speaker_name`, `location_note`
- Indexes:
	- `idx_schedule_event_id` on `event_id`
- Relationships:
	- many schedule slots to one event via `event_id`

### venue_bookings
- Primary key: `id`
- Columns: `venue_id` (FK), `event_id` (FK), `start_time`, `end_time`, `status` (CONFIRMED/CANCELLED), `booked_by_user_id`, `venue_daily_rate`, `booking_days`, `total_venue_cost`, `cost_currency`, `created_at`
- Indexes:
	- `idx_booking_venue_id` on `venue_id`
	- `idx_booking_event_id` on `event_id`
- Relationships:
	- many venue_bookings to one venue via `venue_id`
	- many venue_bookings to one event via `event_id`

## Cross-Service Relationship Map (for system-level ERD)

These are application-level references (not DB-enforced foreign keys):
- Node Mongo `registrations.eventId` -> Spring MySQL `events.id`
- Node Mongo `registrations.tierId` -> Spring MySQL `ticket_tiers.id`
- Node Mongo `reviews.eventId` -> Spring MySQL `events.id`
- Node Mongo `payments.eventId` -> Spring MySQL `events.id`
- Node Mongo `payments.tierId` -> Spring MySQL `ticket_tiers.id`
- Spring MySQL `events.organiser_user_id` -> Node Mongo `users._id` (stored as string)
- Spring MySQL `venue_bookings.booked_by_user_id` -> Node Mongo `users._id` (stored as string)
- .NET Mongo `eventBudgets.eventId` -> Spring MySQL `events.id`
- .NET Mongo `expenses.vendorId` -> vendor domain identifier (cross-service string reference)

## ER Diagram Readiness Checklist

- Endpoint coverage: complete across Node, Spring, .NET controllers and mapped routes.
- Mongo schema coverage: complete for both eventzen_node and eventzen_budget collections.
- MySQL schema coverage: complete for current Spring JPA entities/tables.
- Indexes and uniqueness constraints: included for major integrity/performance paths.
- Cross-service pseudo-FKs: explicitly listed for architecture-level ERDs.


