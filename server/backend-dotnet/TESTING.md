# EventZen Budget Service — M6 Testing Guide
## ASP.NET Core (.NET 10) + MongoDB

## Automated Tests

Run baseline tests:

```bash
dotnet test EventZen.Budget.Tests/EventZen.Budget.Tests.csproj
```

Run broker-backed Kafka integration test (requires broker at localhost:9094):

```bash
RUN_KAFKA_INTEGRATION=true KAFKA_BOOTSTRAP_SERVERS=localhost:9094 dotnet test EventZen.Budget.Tests/EventZen.Budget.Tests.csproj
```

> Port: 8083 | Database: eventzen_budget (MongoDB)

---

## Prerequisites

- [ ] MongoDB running on port 27017
- [ ] Spring Boot running on port 8082 (you need a real eventId from it)
- [ ] Node.js running on port 8081 (for fresh tokens)
- [ ] .NET 10 SDK installed: `dotnet --version` should show `10.x.x`

### Run the service
```bash
cd server/backend-dotnet/EventZen.Budget
dotnet run
```
Should print: `Now listening on: http://localhost:8083`

### Add to Postman environment
| Variable | Value |
|---|---|
| `base_url_dotnet` | `http://localhost:8083` |
| `budget_id` | *(leave blank)* |
| `expense_id` | *(leave blank)* |

---

## Part 1 — Health Check

```
GET http://localhost:8083/health
```
→ `200` with `{ status: "ok", service: "eventzen-dotnet" }`

Swagger UI is also available at: `http://localhost:8083/swagger`

---

## Part 2 — Budget CRUD

### 2.1 Create budget (ORGANIZER or ADMIN)
```
POST {{base_url_dotnet}}/api/budget/events/{{event_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json

{
  "totalAllocated": 500000.00,
  "currency": "INR"
}
```
→ `201` with budget object. Note the `id` — this is the MongoDB budget ID.

**Try to create again for same event:**
→ **Must return `409`** `"A budget already exists for event X."`

**Try with totalAllocated = 0:**
→ **Must return `400`** `"TotalAllocated must be greater than 0."`

**Try without auth:**
→ **Must return `401`**

**Try as USER role:**
→ **Must return `403`** `"Access denied. Requires ORGANIZER or ADMIN role."`

### 2.2 Get budget summary
```
GET {{base_url_dotnet}}/api/budget/events/{{event_id}}
Authorization: Bearer {{organizer_token}}
```
→ `200` with:
```json
{
  "success": true,
  "data": {
    "eventId": "1",
    "totalAllocated": 500000.00,
    "totalSpent": 0.00,
    "remaining": 500000.00,
    "percentUsed": 0.0,
    "overspendWarning": false,
    "currency": "INR"
  }
}
```

### 2.3 Update budget
```
PUT {{base_url_dotnet}}/api/budget/events/{{event_id}}
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "totalAllocated": 750000.00
}
```
→ `200` with updated budget.

---

## Part 3 — Expense CRUD

### 3.1 Add expenses
```
POST {{base_url_dotnet}}/api/budget/events/{{event_id}}/expenses
Authorization: Bearer {{organizer_token}}
Content-Type: application/json

{
  "category": "VENUE",
  "description": "Venue booking — BICC main hall",
  "amount": 150000.00,
  "expenseDate": "2025-10-01T00:00:00Z"
}
```
→ `201`. Save the `id` as `expense_id`.

Add more expenses to test the report:
```json
{
  "category": "CATERING",
  "description": "Lunch for 500 attendees",
  "amount": 125000.00,
  "expenseDate": "2025-11-01T00:00:00Z"
}
```
```json
{
  "category": "CATERING",
  "description": "Evening snacks",
  "amount": 50000.00,
  "expenseDate": "2025-11-01T00:00:00Z"
}
```
```json
{
  "category": "MARKETING",
  "description": "Social media ads",
  "amount": 75000.00,
  "expenseDate": "2025-10-15T00:00:00Z"
}
```

### 3.2 Get all expenses
```
GET {{base_url_dotnet}}/api/budget/events/{{event_id}}/expenses
Authorization: Bearer {{organizer_token}}
```
→ `200` with array of expenses, sorted by expenseDate desc.

### 3.3 Update an expense
```
PUT {{base_url_dotnet}}/api/budget/expenses/{{expense_id}}
Authorization: Bearer {{organizer_token}}
Content-Type: application/json

{
  "description": "Venue booking — BICC main hall (updated)",
  "amount": 160000.00
}
```
→ `200` with updated expense.

### 3.4 Delete an expense
```
DELETE {{base_url_dotnet}}/api/budget/expenses/{{expense_id}}
Authorization: Bearer {{organizer_token}}
```
→ `200` `"Expense deleted."`

**Try again:**
→ **Must return `404`**

---

## Part 4 — Budget Summary with Overspend Warning ⭐

The overspend warning triggers when `totalSpent > 90% of totalAllocated`.

With `totalAllocated = 750000` and current expenses ~400000 (~53%) — no warning yet.

Add a big expense to push past 90%:
```json
{
  "category": "STAFF",
  "description": "Event staff and security",
  "amount": 350000.00,
  "expenseDate": "2025-11-10T00:00:00Z"
}
```

Now get the summary:
```
GET {{base_url_dotnet}}/api/budget/events/{{event_id}}
Authorization: Bearer {{organizer_token}}
```
→ `overspendWarning: true` ⭐ (total spent > 90% of 750000)

---

## Part 5 — Financial Report ⭐

```
GET {{base_url_dotnet}}/api/reports/events/{{event_id}}
Authorization: Bearer {{organizer_token}}
```

Expected response shape:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalAllocated": 750000.00,
      "totalSpent": 725000.00,
      "percentUsed": 96.67,
      "overspendWarning": true
    },
    "expenses": [...],
    "byCategory": [
      { "category": "CATERING",  "total": 175000.00, "count": 2 },
      { "category": "STAFF",     "total": 350000.00, "count": 1 },
      { "category": "VENUE",     "total": 160000.00, "count": 1 },
      { "category": "MARKETING", "total": 75000.00,  "count": 1 }
    ]
  }
}
```

**What to check:**
- `byCategory` is sorted by `total` descending ✅
- `overspendWarning` is `true` when > 90% ✅
- `percentUsed` is calculated correctly ✅

---

## Troubleshooting

### `401 Unauthorized`
- Token expired — re-login and get a fresh token
- JWT secret in `appsettings.json` doesn't match `JWT_SECRET` in Node.js `.env`

### `MongoDB connection refused`
- MongoDB isn't running. Start it: `mongod` or via MongoDB Compass

### `dotnet: command not found`
- .NET 10 SDK isn't installed: https://dotnet.microsoft.com/download/dotnet/10.0

### Category enum error `400`
Valid values are: `VENUE`, `CATERING`, `MARKETING`, `STAFF`, `AV_EQUIPMENT`, `DECORATION`, `TRANSPORT`, `MISCELLANEOUS`

---

## Quick Reference

| Method | URL | Auth |
|---|---|---|
| POST | `/api/budget/events/:eventId` | ORG/ADMIN |
| GET | `/api/budget/events/:eventId` | ORG/ADMIN |
| PUT | `/api/budget/events/:eventId` | ORG/ADMIN |
| POST | `/api/budget/events/:eventId/expenses` | ORG/ADMIN |
| GET | `/api/budget/events/:eventId/expenses` | ORG/ADMIN |
| PUT | `/api/budget/expenses/:id` | ORG/ADMIN |
| DELETE | `/api/budget/expenses/:id` | ORG/ADMIN |
| GET | `/api/reports/events/:eventId` | ORG/ADMIN |
| GET | `/health` | Public |
