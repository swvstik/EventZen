# EventZen — Spring Boot Service (M1 + M2)

Spring Boot 3 microservice handling **Events and Venues** for the EventZen polyglot capstone.

- **Port:** `8082`  
- **Database:** MySQL `eventzen`  
- **Auth:** JWT verified via shared secret with Node.js auth service (port 8081)

## Modules
| Module | What it covers |
|--------|---------------|
| M1 | Events, TicketTiers, EventScheduleSlots, status lifecycle, search |
| M2 | Venues, VenueBookings, conflict detection (⭐ star feature) |

Notes:
- Supplier registry and event-supplier assignment APIs were retired.
- Organizer ownership is still enforced through event ownership fields and role checks.
- Admin status transitions to `CANCELLED` trigger attendee registration cancellation via Node internal APIs.

## Quick Start

```bash
# 1. Create MySQL database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS eventzen;"

# 2. Set application.properties (see src/main/resources/application.properties)
#    jwt.secret must match JWT_SECRET in ../../.env

# 3. Run
./mvnw spring-boot:run
```

Hibernate auto-creates all tables. Health check: `GET http://localhost:8082/health`
Prometheus metrics: `GET http://localhost:8082/actuator/prometheus`
Swagger UI: `GET http://localhost:8082/swagger-ui/index.html`
OpenAPI JSON: `GET http://localhost:8082/v3/api-docs`

## Testing
See **TESTING.md** for the full step-by-step Postman guide.

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
