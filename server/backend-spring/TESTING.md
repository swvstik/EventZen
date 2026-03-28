# EventZen Spring Boot Service — Postman Testing Guide
## Modules: M1 (Events + Schedule) · M2 (Venues + Bookings)

## Automated Tests

Run unit and service tests:

```bash
mvn test -DskipITs
```

Run broker-backed Kafka integration test (requires broker at localhost:9094):

```bash
RUN_KAFKA_INTEGRATION=true KAFKA_BOOTSTRAP_SERVERS=localhost:9094 mvn test -DskipITs
```

Run only the admin cancellation cascade regression test:

```bash
mvn -Dtest=EventServiceStatusCascadeTest test
```

> 👋 **This guide assumes you are a beginner.** Every step is spelled out.  
> If something returns an unexpected error, the Troubleshooting section at the bottom covers the most common causes.

---

## Table of Contents
1. [Prerequisites — get everything running](#1-prerequisites)
2. [Set up Postman Environment](#2-postman-environment-setup)
3. [Get a JWT token from Node.js](#3-get-a-jwt-token)
4. [Module 1 — Events](#4-module-1--events)
5. [Module 1 — Schedule Slots](#5-module-1--schedule-slots)
6. [Module 2 — Venues](#6-module-2--venues)
7. [Module 2 — Venue Bookings & Conflict Detection ⭐](#7-module-2--venue-bookings--conflict-detection)
8. [Full Flow Test (end-to-end)](#8-full-flow-test)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

Before opening Postman, make sure:

### Node.js service is running (port 8081)
```bash
cd server/backend-node
npm install
npm run dev
```
You need this to get JWT tokens. Spring Boot validates those same tokens.

### MySQL is running (port 3306)
If you're running locally (not Docker):
```bash
# Make sure MySQL is started, then create the database:
mysql -u root -p
# Inside MySQL shell:
CREATE DATABASE IF NOT EXISTS eventzen;
exit;
```

### Spring Boot service is running (port 8082)
```bash
cd server/backend-spring
./mvnw spring-boot:run
```
Wait for the line: `🚀 Tomcat started on port 8082`  
Hibernate will auto-create all tables on first startup — you don't need to run schema.sql manually.

### Verify both services are healthy
Open your browser or Postman and hit:
- `GET http://localhost:8081/health` → should return `{ "status": "ok", "service": "eventzen-node" }`
- `GET http://localhost:8082/health` → should return `{ "status": "ok", "service": "eventzen-spring" }`

---

## 2. Postman Environment Setup

Setting up an **Environment** in Postman means you type your base URL and token once, and every request uses it automatically.

### Step-by-step:
1. Open Postman
2. Click **Environments** in the left sidebar
3. Click **+** to create a new environment
4. Name it: `EventZen Local`
5. Add these variables:

| Variable | Initial Value | Current Value |
|----------|--------------|---------------|
| `base_url_node` | `http://localhost:8081` | `http://localhost:8081` |
| `base_url_spring` | `http://localhost:8082` | `http://localhost:8082` |
| `admin_token` | *(leave blank for now)* | *(leave blank for now)* |
| `organizer_token` | *(leave blank for now)* | *(leave blank for now)* |
| `user_token` | *(leave blank for now)* | *(leave blank for now)* |
| `event_id` | *(leave blank)* | *(leave blank)* |
| `venue_id` | *(leave blank)* | *(leave blank)* |
| `slot_id` | *(leave blank)* | *(leave blank)* |
| `booking_id` | *(leave blank)* | *(leave blank)* |

6. Click **Save**
7. In the top-right dropdown, select **EventZen Local** as the active environment

### How to use variables in Postman:
Anywhere in a URL or header, write `{{variable_name}}` — Postman replaces it automatically.  
Example: `{{base_url_spring}}/api/events` becomes `http://localhost:8082/api/events`

---

## 3. Get a JWT Token

Spring Boot doesn't issue tokens — it only validates tokens issued by Node.js.  
You need **three tokens**: one for each role.

### 3a. Register + verify three accounts (if you haven't already)

> Skip this if you already have verified accounts from testing the auth module.

**Register an ADMIN user:**
```
POST {{base_url_node}}/api/auth/register
Content-Type: application/json

{
  "name": "Admin User",
  "email": "admin@eventzen.com",
  "password": "Admin1234!"
}
```
→ Check your email for the OTP, then:
```
POST {{base_url_node}}/api/auth/verify-email
Content-Type: application/json

{
  "email": "admin@eventzen.com",
  "otp": "YOUR_OTP_HERE"
}
```

**Then promote to ADMIN** (you'll need to do this directly in MongoDB for the first admin, since there's no admin yet to promote you):
```
# In MongoDB shell or Compass:
use eventzen_node
db.users.updateOne({ email: "admin@eventzen.com" }, { $set: { role: "ADMIN" } })
```

**Register an ORGANIZER user:**
```
POST {{base_url_node}}/api/auth/register
{
  "name": "Organizer User",
  "email": "organizer@eventzen.com",
  "password": "Org1234!"
}
```
After verifying email, promote via the admin endpoint:
```
PATCH {{base_url_node}}/api/users/ORGANIZER_USER_ID/role
Authorization: Bearer {{admin_token}}
{ "role": "ORGANIZER" }
```

**Register a regular USER:**
```
POST {{base_url_node}}/api/auth/register
{
  "name": "Regular User",
  "email": "user@eventzen.com",
  "password": "User1234!"
}
```

### 3b. Login and save tokens

**Login as ADMIN:**
```
POST {{base_url_node}}/api/auth/login
Content-Type: application/json

{
  "email": "admin@eventzen.com",
  "password": "Admin1234!"
}
```
Response will include `accessToken`. Copy it and paste into the `admin_token` **Current Value** in your Postman environment.

Repeat for organizer → `organizer_token` and user → `user_token`.

### 3c. Set up Authorization header in Postman
For every protected request, go to the **Authorization** tab → Type: **Bearer Token** → Token: `{{admin_token}}` (or whichever role you need).

---

## 4. Module 1 — Events

> ✅ Expected result for each request is shown after the →

### 4.1 List events (public — no token needed)
```
GET {{base_url_spring}}/api/events
```
→ `200` with `{ "success": true, "data": { "events": [], "totalCount": 0, "totalPages": 0, "currentPage": 0 } }`

### 4.2 List events with filters
```
GET {{base_url_spring}}/api/events?q=tech&category=TECH&page=0&limit=12
GET {{base_url_spring}}/api/events?status=PUBLISHED
GET {{base_url_spring}}/api/events?date=2025-11-15
```
→ All return `200`. Results will be empty until you create events below.

### 4.3 Create an event (as ORGANIZER)
```
POST {{base_url_spring}}/api/events
Authorization: Bearer {{organizer_token}}
Content-Type: application/json

{
  "title": "TechConf India 2025",
  "description": "India's biggest technology conference with workshops and keynotes",
  "eventDate": "2025-11-15",
  "startTime": "09:00:00",
  "endTime": "18:00:00",
  "category": "TECH",
  "tags": ["networking", "workshops", "keynotes"],
  "bannerImageUrl": "https://example.com/banner.jpg",
  "ticketTiers": [
    {
      "name": "General Admission",
      "price": 999.00,
      "currency": "INR",
      "capacity": 500,
      "description": "Full day access to all sessions"
    },
    {
      "name": "VIP",
      "price": 4999.00,
      "currency": "INR",
      "capacity": 50,
      "description": "Includes lunch, front-row seating, and speaker meetup"
    }
  ]
}
```
→ `201` with the created event. **Copy the `id` field from the response and save it as `event_id` in your Postman environment.**

**Check the status** — it must be `"DRAFT"` (organizer cannot self-publish).

### 4.4 Get single event (public)
```
GET {{base_url_spring}}/api/events/{{event_id}}
```
→ `200` with full event including `ticketTiers` array and empty `scheduleSlots`

### 4.5 Create another event as a DIFFERENT organizer (to test ownership)
If you only have one organizer account, skip to 4.6. Otherwise create a second event with a different organizer token.

### 4.6 Test ORGANIZER ownership — try to edit another organizer's event
```
PUT {{base_url_spring}}/api/events/{{event_id}}
Authorization: Bearer {{organizer_token_2}}   ← a DIFFERENT organizer
Content-Type: application/json

{ "title": "Hacked Title" }
```
→ **Must return `403`** `"You do not have permission to modify this event."`

### 4.7 Update event (as the owning ORGANIZER)
```
PUT {{base_url_spring}}/api/events/{{event_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json

{
  "title": "TechConf India 2025 — Updated",
  "tags": ["networking", "workshops", "keynotes", "updated"]
}
```
→ `200` with updated event. Only the fields you sent are changed — other fields stay the same.

### 4.8 Submit for approval (ORGANIZER)
```
POST {{base_url_spring}}/api/events/{{event_id}}/submit
Authorization: Bearer {{organizer_token}}
```
→ `200` with event, status now `"PENDING_APPROVAL"`

**Try submitting again:**
```
POST {{base_url_spring}}/api/events/{{event_id}}/submit
Authorization: Bearer {{organizer_token}}
```
→ **Must return `400`** `"Only DRAFT events can be submitted..."`

### 4.9 Approve and publish (ADMIN only)
```
PATCH {{base_url_spring}}/api/events/{{event_id}}/status
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{ "status": "PUBLISHED" }
```
→ `200` with event, status now `"PUBLISHED"`

**Try as organizer (should fail):**
```
PATCH {{base_url_spring}}/api/events/{{event_id}}/status
Authorization: Bearer {{organizer_token}}
Content-Type: application/json

{ "status": "PUBLISHED" }
```
→ **Must return `403`** `"Only admins can change event status."`

### 4.10 Test full status lifecycle
```
# Move through lifecycle as ADMIN:
PATCH .../status  →  { "status": "ONGOING" }     → 200
PATCH .../status  →  { "status": "COMPLETED" }   → 200
```

### 4.11 Admin cancellation cascade check (status PATCH)
```
PATCH {{base_url_spring}}/api/events/{{event_id}}/status
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{ "status": "CANCELLED" }
```
→ `200` and event status is now `"CANCELLED"`.

Cross-service expectation:
- Spring triggers Node internal endpoint `/api/internal/events/:eventId/cancel-registrations`.
- Active registrations for this event are marked `CANCELLED` in attendee records.
- If sync fails, Spring logs a warning for investigation.

### 4.12 Soft delete event
```
DELETE {{base_url_spring}}/api/events/{{event_id}}
Authorization: Bearer {{organizer_token}}
```
→ `200`. Now fetch the event — status is `"CANCELLED"`, it's not truly deleted.

> 🔁 **Recreate the event** for testing the next sections — use step 4.3 again and save the new `event_id`.

### 4.13 Internal rating update
```
PATCH {{base_url_spring}}/api/internal/events/{{event_id}}/rating
X-Internal-Secret: eventzen_internal_secret_change_me
Content-Type: application/json

{ "avgRating": 4.35 }
```
→ `200`. Fetch the event and confirm `avgRating` is `4.35`.

**With wrong secret:**
```
X-Internal-Secret: wrong_secret
```
→ **Must return `401`**

---

## 5. Module 1 — Schedule Slots

### 5.1 Get schedule (public, starts empty)
```
GET {{base_url_spring}}/api/schedule/{{event_id}}
```
→ `200` with empty array `[]`

### 5.2 Add agenda slots
```
POST {{base_url_spring}}/api/schedule/{{event_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json

{
  "sessionTitle": "Opening Keynote",
  "startTime": "09:00:00",
  "endTime": "10:00:00",
  "speakerName": "Sundar Pichai",
  "locationNote": "Main Auditorium"
}
```
→ `201`. **Save the `id` from the response as `slot_id`.**

Add a second slot:
```
POST {{base_url_spring}}/api/schedule/{{event_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json

{
  "sessionTitle": "AI in 2025 Workshop",
  "startTime": "10:30:00",
  "endTime": "12:00:00",
  "speakerName": "Demis Hassabis",
  "locationNote": "Room B"
}
```

### 5.3 Get schedule — should now be sorted by startTime
```
GET {{base_url_spring}}/api/schedule/{{event_id}}
```
→ `200` with both slots, ordered earliest first.

### 5.4 Update a slot
```
PUT {{base_url_spring}}/api/schedule/slot/{{slot_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json

{
  "speakerName": "Updated Speaker Name",
  "locationNote": "Main Stage (Updated)"
}
```
→ `200` with updated slot.

### 5.5 Delete a slot
```
DELETE {{base_url_spring}}/api/schedule/slot/{{slot_id}}
Authorization: Bearer {{organizer_token}}
```
→ `200`. Fetch the schedule again — that slot is gone.

---

## 6. Module 2 — Venues

### 6.1 Create a venue (ADMIN only)
```
POST {{base_url_spring}}/api/venues
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "name": "Bangalore International Convention Centre",
  "address": "Tumkur Road, Yeshwanthpur",
  "city": "Bangalore",
  "capacity": 5000,
  "facilities": "AC, Projector, Stage, Parking, WiFi",
  "contactName": "Rajesh Kumar",
  "contactEmail": "rajesh@bicc.in",
  "contactPhone": "+91-9876543210"
}
```
→ `201`. **Save the `id` as `venue_id`.**

**Try as ORGANIZER (should fail):**
```
POST {{base_url_spring}}/api/venues
Authorization: Bearer {{organizer_token}}
...
```
→ **Must return `403`**

### 6.2 List venues (public)
```
GET {{base_url_spring}}/api/venues
GET {{base_url_spring}}/api/venues?city=Bangalore
GET {{base_url_spring}}/api/venues?capacity=1000
GET {{base_url_spring}}/api/venues?city=Mumbai
```
→ Filter by city/capacity works. The Mumbai query returns empty (no venues there yet).

### 6.3 Get single venue
```
GET {{base_url_spring}}/api/venues/{{venue_id}}
```
→ `200` with full venue details.

### 6.4 Update venue (ADMIN only)
```
PUT {{base_url_spring}}/api/venues/{{venue_id}}
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "facilities": "AC, Projector, Stage, Parking, WiFi, Catering Kitchen"
}
```
→ `200` with updated venue.

### 6.5 Check availability (public — no bookings yet)
```
GET {{base_url_spring}}/api/venues/{{venue_id}}/availability
```
→ `200` with empty array `[]`

---

## 7. Module 2 — Venue Bookings & Conflict Detection

> ⭐ This is the most important section. The conflict detection is the star algorithmic feature of the project.

Make sure you have:
- `{{venue_id}}` set
- `{{event_id}}` set (from an event you created in section 4)
- Admin token ready

### 7.1 Book the venue (first booking)
```
POST {{base_url_spring}}/api/venues/{{venue_id}}/bookings
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "eventId": {{event_id}},
  "startTime": "2025-11-15T09:00:00",
  "endTime": "2025-11-15T18:00:00"
}
```
→ `201` with booking, status `"CONFIRMED"`. **Save the `id` as `booking_id`.**

### 7.2 ⭐ Try to book overlapping time — MUST return 409
```
POST {{base_url_spring}}/api/venues/{{venue_id}}/bookings
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "eventId": {{event_id}},
  "startTime": "2025-11-15T15:00:00",
  "endTime": "2025-11-15T20:00:00"
}
```
→ **MUST return `409 Conflict`** with message about the venue being already booked.

This is the critical test. If you get `409`, the conflict detection is working correctly. 🎉

### 7.3 Try other overlapping patterns — all should return 409

**Booking that starts before and ends inside:**
```json
{ "eventId": {{event_id}}, "startTime": "2025-11-15T06:00:00", "endTime": "2025-11-15T12:00:00" }
```
→ `409`

**Booking completely inside the existing one:**
```json
{ "eventId": {{event_id}}, "startTime": "2025-11-15T10:00:00", "endTime": "2025-11-15T14:00:00" }
```
→ `409`

**Booking that completely wraps around:**
```json
{ "eventId": {{event_id}}, "startTime": "2025-11-15T07:00:00", "endTime": "2025-11-15T22:00:00" }
```
→ `409`

### 7.4 Book adjacent time — should succeed (no overlap)
```
POST {{base_url_spring}}/api/venues/{{venue_id}}/bookings
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "eventId": {{event_id}},
  "startTime": "2025-11-15T18:00:00",
  "endTime": "2025-11-15T22:00:00"
}
```
→ `201` — adjacent (starts exactly when the first one ends) is NOT an overlap. This is correct behaviour.

### 7.5 Check availability — should now show confirmed bookings
```
GET {{base_url_spring}}/api/venues/{{venue_id}}/availability
```
→ `200` with array of confirmed bookings (used by the frontend booking calendar).

### 7.6 Get all bookings for a venue (admin history)
```
GET {{base_url_spring}}/api/venues/{{venue_id}}/bookings
Authorization: Bearer {{admin_token}}
```
→ `200` with all bookings including their status.

### 7.7 Cancel a booking — slot becomes available again
```
DELETE {{base_url_spring}}/api/venues/bookings/{{booking_id}}
Authorization: Bearer {{admin_token}}
```
→ `200` with booking, status now `"CANCELLED"`.

### 7.8 Book the same time again — should now succeed (slot freed up)
```
POST {{base_url_spring}}/api/venues/{{venue_id}}/bookings
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "eventId": {{event_id}},
  "startTime": "2025-11-15T09:00:00",
  "endTime": "2025-11-15T18:00:00"
}
```
→ `201` — the cancelled booking no longer blocks this slot. ✅

### 7.9 Attach venue to event (update the event with a venueId)
```
PUT {{base_url_spring}}/api/events/{{event_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json

{ "venueId": {{venue_id}} }
```
→ `200`. Now fetch the event — the `venue` field should contain full venue details.

---

## 8. Full Flow Test

This simulates the complete happy path an ORGANIZER would go through:

```
1.  POST   /api/events                          (create event as ORGANIZER → DRAFT)
2.  POST   /api/schedule/{{event_id}}           (add 3 agenda slots)
3.  POST   /api/venues                          (ADMIN creates a venue)
4.  POST   /api/venues/{{venue_id}}/bookings    (ADMIN books venue for the event → CONFIRMED)
5.  PUT    /api/events/{{event_id}}             (ORGANIZER links venueId to event)
6.  POST   /api/events/{{event_id}}/submit      (ORGANIZER submits → PENDING_APPROVAL)
7.  PATCH  /api/events/{{event_id}}/status      (ADMIN approves → PUBLISHED)
8.  GET    /api/events                          (PUBLIC — event now appears in list)
9.  GET    /api/events/{{event_id}}             (PUBLIC — full event with venue, tiers, schedule)
```

At step 11 and 12, a completely unauthenticated request should return the published event with all its details. This is what the React frontend will call.

---

## 9. Troubleshooting

### `401 Unauthorized` on a protected route
- Check your token is not expired (Node.js access tokens last 15 minutes — log in again)
- Make sure you set `Authorization: Bearer {{admin_token}}` in the **Authorization** tab
- Confirm `jwt.secret` in `application.properties` matches `JWT_SECRET` in your Node.js `.env`

### `403 Forbidden` when you expect success
- You're using the wrong role token. Check which role the endpoint requires.
- For ORGANIZER routes: make sure `organiser_user_id` on the event matches the `userId` in your token.

### `500 Internal Server Error`
- Check the Spring Boot terminal logs — there will be a full stack trace.
- Most common causes: MySQL not running, or a field name mismatch.

### Spring Boot fails to start — `Communications link failure`
- MySQL is not running. Start it and try again.
- Check `spring.datasource.url` in `application.properties` — the database name and port must match.

### `409 Conflict` when you expect a booking to succeed
- Check your start/end times. Even a 1-second overlap triggers the conflict check.
- A CANCELLED booking does NOT block new bookings — only CONFIRMED ones do.

### Tables don't exist in MySQL
- Hibernate creates them automatically on startup when `spring.jpa.hibernate.ddl-auto=update`.
- If you see `Table 'eventzen.events' doesn't exist`, it means Spring Boot either didn't connect to MySQL or crashed before Hibernate ran. Check startup logs.

### `400 Bad Request` with message about validation
- You're missing a required field. Read the error message — it tells you exactly which field: e.g., `"title: Title is required"`
- Date format must be `"2025-11-15"` (not `"15/11/2025"`)
- Time format must be `"09:00:00"` (not `"9am"`)
- DateTime format for bookings must be `"2025-11-15T09:00:00"` (ISO 8601 with T separator)

### Event not appearing in public list
- Check its status. Only... actually all statuses appear in the public list (filtered by the `?status=` query param). If you want to see only PUBLISHED events: `GET /api/events?status=PUBLISHED`

---

## Quick Reference — All Endpoints

### M1 — Events
| Method | URL | Auth | What it does |
|--------|-----|------|-------------|
| GET | `/api/events` | None | Paginated list with filters |
| GET | `/api/events/:id` | None | Single event detail |
| POST | `/api/events` | ORG/ADMIN | Create event |
| PUT | `/api/events/:id` | ORG/ADMIN | Update event |
| DELETE | `/api/events/:id` | ORG/ADMIN | Soft delete → CANCELLED |
| POST | `/api/events/:id/submit` | ORG | Submit for approval |
| PATCH | `/api/events/:id/status` | ADMIN | Change status (`CANCELLED` transition also cancels attendee registrations) |
| PATCH | `/api/internal/events/:id/rating` | Internal (X-Internal-Secret header) | Update avg rating |
| GET | `/api/internal/events/:id/ownership` | Internal (X-Internal-Secret header) | Event owner lookup for trusted services |

### M1 — Schedule
| Method | URL | Auth | What it does |
|--------|-----|------|-------------|
| GET | `/api/schedule/:eventId` | None | List slots ordered by time |
| POST | `/api/schedule/:eventId` | ORG/ADMIN | Add slot |
| PUT | `/api/schedule/slot/:slotId` | ORG/ADMIN | Update slot |
| DELETE | `/api/schedule/slot/:slotId` | ORG/ADMIN | Delete slot |

### M2 — Venues
| Method | URL | Auth | What it does |
|--------|-----|------|-------------|
| GET | `/api/venues` | None | List venues (filter: ?city=&capacity=) |
| GET | `/api/venues/:id` | None | Venue detail |
| GET | `/api/venues/:id/availability` | None | Confirmed bookings for calendar |
| POST | `/api/venues` | ADMIN | Create venue |
| PUT | `/api/venues/:id` | ADMIN | Update venue |
| DELETE | `/api/venues/:id` | ADMIN | Delete venue |
| POST | `/api/venues/:id/bookings` | ADMIN | Book venue (409 on overlap) |
| GET | `/api/venues/:id/bookings` | ADMIN | All bookings for venue |
| DELETE | `/api/venues/bookings/:id` | ADMIN | Cancel booking |

### Retired Supplier Registry
- `/api/vendors` and assignment endpoints were retired from Spring service.
- Organizer flows continue through event ownership (`vendorUserId`) and vendor-application APIs on Node service.


---

## Environment Variables Setup

Spring Boot reads all secrets from environment variables. **Never hardcode credentials.**

### Option A — Set in IntelliJ Run Configuration
1. Run → Edit Configurations → your Spring Boot config
2. Click "Modify options" → "Environment variables"
3. Add each variable from `.env.example`

### Option B — Use the EnvFile plugin (recommended)
1. Install "EnvFile" plugin in IntelliJ (Settings → Plugins)
2. Run → Edit Configurations → Enable EnvFile → add `.env`
3. Copy `.env.example` to `.env`, fill in your values

### Option C — Terminal
```bash
export JWT_SECRET=your_secret_here
export SPRING_DATASOURCE_PASSWORD=your_db_password
./mvnw spring-boot:run
```

### Required variables
| Variable | Description |
|---|---|
| `SPRING_DATASOURCE_PASSWORD` | Your MySQL root password |
| `JWT_SECRET` | **Must match** `JWT_SECRET` in root `.env` |
| `INTERNAL_SERVICE_SECRET` | Protects `/api/internal/events/:id/rating` and `/api/internal/events/:id/ownership` |

All other variables have working local defaults — only the above three need setting for local dev.
