# EventZen — ASP.NET Core Budget Service (M6)

Budget & Finance service. Handles per-event budgets, expense tracking, and financial reports.

- **Port:** `8083`
- **Database:** MongoDB `eventzen_budget`
- **Framework:** ASP.NET Core (.NET 10) — Web API, no Entity Framework

## Quick Start

```bash
# Set required environment variables (see .env.example)
export JWT__Secret=your_secret_here
export MongoDB__ConnectionString=mongodb://localhost:27017

cd EventZen.Budget
dotnet restore
dotnet run
```

Health check: `GET http://localhost:8083/health`  
Prometheus metrics: `GET http://localhost:8083/metrics`  
Swagger UI: `http://localhost:8083/swagger` (Development only)

## Environment Variables

All secrets come from environment variables. Copy `.env.example` to understand what's needed.

| Variable | Required | Description |
|---|---|---|
| `JWT__Secret` | ✅ | Must match `JWT_SECRET` in Node.js and `JWT_SECRET` in Spring Boot |
| `MongoDB__ConnectionString` | ✅ | MongoDB URI. In Docker: `mongodb://mongo-db:27017` |
| `Spring__BaseUrl` | ✅ | Spring service base URL used for event ownership checks |
| `Spring__InternalSecret` | ✅ | Internal shared secret sent to Spring internal endpoints |
| `Node__BaseUrl` | ✅ | Node service base URL used for payment fee aggregates |
| `Node__InternalSecret` | ✅ | Internal shared secret sent to Node internal endpoints |
| `MongoDB__DatabaseName` | — | Default: `eventzen_budget` |
| `ASPNETCORE_ENVIRONMENT` | — | `Development` enables Swagger UI |
| `ASPNETCORE_URLS` | — | Default: `http://+:8083` |

> **Note on double underscore:** ASP.NET Core maps `MongoDB__ConnectionString` → `MongoDB:ConnectionString` in config. Use `__` (double underscore) in environment variables for nested config keys.

## API Endpoints

All endpoints require `Authorization: Bearer <token>` (JWT issued by Node.js).  
All endpoints require `VENDOR` or `ADMIN` role unless explicitly marked otherwise.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/budget/events/:eventId` | Create budget. 409 if exists. |
| `GET` | `/api/budget/events/:eventId` | Summary: allocated, spent, remaining, overspend flag |
| `PUT` | `/api/budget/events/:eventId` | Update totalAllocated or currency |
| `POST` | `/api/budget/events/:eventId/expenses` | Add expense |
| `GET` | `/api/budget/events/:eventId/expenses` | All expenses, sorted by date desc |
| `PUT` | `/api/budget/expenses/:id` | Update expense fields |
| `DELETE` | `/api/budget/expenses/:id` | Delete expense |
| `GET` | `/api/reports/events/:eventId` | Full report: summary + grouped by category |
| `GET` | `/api/reports/vendor/events` | Vendor overview for own event budgets only (`VENDOR` only) |
| `GET` | `/api/reports/admin/events` | Admin overview across all event budgets (`ADMIN` only) |

## Project Structure

```
EventZen.Budget/
├── Controllers/         BudgetController.cs
├── DTOs/
│   ├── Requests/        CreateBudgetRequest, UpdateBudgetRequest,
│   │                    CreateExpenseRequest, UpdateExpenseRequest + validators
│   └── Responses/       ApiResponse<T>, BudgetResponse, BudgetSummaryResponse,
│                        ExpenseResponse, FinancialReportResponse, CategorySubtotal
├── Infrastructure/
│   ├── Extensions/      ServiceCollectionExtensions (DI setup)
│   ├── Middleware/       GlobalExceptionHandler + domain exceptions
│   └── Persistence/     MongoDbContext
├── Models/              EventBudget, Expense, ExpenseCategory enum
├── Repositories/        IBudgetRepository, IExpenseRepository + implementations
├── Services/            IBudgetService, BudgetService
├── Program.cs           App bootstrap + startup validation
├── appsettings.json     Non-secret config only
└── Dockerfile           Multi-stage build for Docker
```

## Docker

```bash
# From the EventZen.Budget directory:
docker build -t eventzen-dotnet .
docker run -p 8083:8083 \
  -e JWT__Secret=your_secret_here \
  -e MongoDB__ConnectionString=mongodb://host.docker.internal:27017 \
  eventzen-dotnet
```
