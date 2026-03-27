using EventZen.Budget.DTOs.Requests;
using EventZen.Budget.DTOs.Responses;
using EventZen.Budget.Infrastructure.Middleware;
using EventZen.Budget.Services;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using DomainValidationException = EventZen.Budget.Infrastructure.Middleware.ValidationException;

namespace EventZen.Budget.Controllers;

[ApiController]
[Authorize]
[Produces("application/json")]
public class BudgetController : ControllerBase
{
    private readonly IBudgetService      _budgetService;
    private readonly IServiceProvider    _serviceProvider;

    /// <summary>
    /// IServiceProvider is injected instead of individual validators.
    /// This avoids bloating the constructor as more request types are added -
    /// validators are resolved on-demand via IValidator&lt;T&gt; from DI.
    /// </summary>
    public BudgetController(IBudgetService budgetService, IServiceProvider serviceProvider)
    {
        _budgetService   = budgetService;
        _serviceProvider = serviceProvider;
    }

    // -- JWT claim helpers -----------------------------------------------------

    private string UserId => User.FindFirstValue("userId")
        ?? throw new BadRequestException("userId claim missing from token.");

    private string Role => User.FindFirstValue("role")
        ?? User.FindFirstValue(ClaimTypes.Role)
        ?? throw new BadRequestException("role claim missing from token.");

    private void AssertVendorOrAdmin()
    {
        if (Role is not ("VENDOR" or "ADMIN"))
            throw new ForbiddenException("Access denied. Requires VENDOR or ADMIN role.");
    }

    private void AssertVendorOnly()
    {
        if (Role is not "VENDOR")
            throw new ForbiddenException("Access denied. Requires VENDOR role.");
    }

    private void AssertAdminOnly()
    {
        if (Role is not "ADMIN")
            throw new ForbiddenException("Access denied. Requires ADMIN role.");
    }

    /// <summary>
    /// Resolves the appropriate IValidator&lt;T&gt; from DI and validates the request.
    /// Throws ValidationException with the first error message on failure.
    /// </summary>
    private async Task ValidateAsync<T>(T request, CancellationToken ct)
    {
        var validator = _serviceProvider.GetRequiredService<IValidator<T>>();
        var result    = await validator.ValidateAsync(request, ct);
        if (!result.IsValid)
            throw new DomainValidationException(result.Errors.First().ErrorMessage);
    }

    // -- Budget CRUD -----------------------------------------------------------

    /// POST /api/budget/events/:eventId - Create budget (409 if exists)
    [HttpPost("api/budget/events/{eventId}")]
    public async Task<IActionResult> CreateBudget(
        string eventId, [FromBody] CreateBudgetRequest req, CancellationToken ct)
    {
        AssertVendorOrAdmin();
        await ValidateAsync(req, ct);
        var result = await _budgetService.CreateBudgetAsync(eventId, req, UserId, Role, ct);
        return StatusCode(201, ApiResponse<BudgetResponse>.Ok("Budget created.", result));
    }

    /// GET /api/budget/events/:eventId - Summary with overspend warning
    [HttpGet("api/budget/events/{eventId}")]
    public async Task<IActionResult> GetSummary(string eventId, CancellationToken ct)
    {
        AssertVendorOrAdmin();
        var result = await _budgetService.GetSummaryAsync(eventId, UserId, Role, ct);
        return Ok(ApiResponse<BudgetSummaryResponse>.Ok(result));
    }

    /// PUT /api/budget/events/:eventId - Update totalAllocated or currency
    [HttpPut("api/budget/events/{eventId}")]
    public async Task<IActionResult> UpdateBudget(
        string eventId, [FromBody] UpdateBudgetRequest req, CancellationToken ct)
    {
        AssertVendorOrAdmin();
        await ValidateAsync(req, ct);
        var result = await _budgetService.UpdateBudgetAsync(eventId, req, UserId, Role, ct);
        return Ok(ApiResponse<BudgetResponse>.Ok("Budget updated.", result));
    }

    // -- Expense CRUD ----------------------------------------------------------

    /// POST /api/budget/events/:eventId/expenses - Add expense
    [HttpPost("api/budget/events/{eventId}/expenses")]
    public async Task<IActionResult> AddExpense(
        string eventId, [FromBody] CreateExpenseRequest req, CancellationToken ct)
    {
        AssertVendorOrAdmin();
        await ValidateAsync(req, ct);
        var result = await _budgetService.AddExpenseAsync(eventId, req, UserId, Role, ct);
        return StatusCode(201, ApiResponse<ExpenseResponse>.Ok("Expense added.", result));
    }

    /// GET /api/budget/events/:eventId/expenses - All expenses sorted by date desc
    [HttpGet("api/budget/events/{eventId}/expenses")]
    public async Task<IActionResult> GetExpenses(string eventId, CancellationToken ct)
    {
        AssertVendorOrAdmin();
        var result = await _budgetService.GetExpensesAsync(eventId, UserId, Role, ct);
        return Ok(ApiResponse<List<ExpenseResponse>>.Ok(result));
    }

    /// PUT /api/budget/expenses/:id - Update expense fields
    [HttpPut("api/budget/expenses/{id}")]
    public async Task<IActionResult> UpdateExpense(
        string id, [FromBody] UpdateExpenseRequest req, CancellationToken ct)
    {
        AssertVendorOrAdmin();
        await ValidateAsync(req, ct);
        var result = await _budgetService.UpdateExpenseAsync(id, req, UserId, Role, ct);
        return Ok(ApiResponse<ExpenseResponse>.Ok("Expense updated.", result));
    }

    /// DELETE /api/budget/expenses/:id - Delete expense
    [HttpDelete("api/budget/expenses/{id}")]
    public async Task<IActionResult> DeleteExpense(string id, CancellationToken ct)
    {
        AssertVendorOrAdmin();
        await _budgetService.DeleteExpenseAsync(id, UserId, Role, ct);
        // Consistent ApiResponse envelope - matches every other endpoint in the service
        return Ok(ApiResponse<object>.Ok("Expense deleted.", new { }));
    }

    // -- Report ----------------------------------------------------------------

    /// GET /api/reports/events/:eventId - Full financial report
    [HttpGet("api/reports/events/{eventId}")]
    public async Task<IActionResult> GetReport(string eventId, CancellationToken ct)
    {
        AssertVendorOrAdmin();
        var result = await _budgetService.GetReportAsync(eventId, UserId, Role, ct);
        return Ok(ApiResponse<FinancialReportResponse>.Ok(result));
    }

    /// GET /api/reports/vendor/events - Vendor dashboard overview (own events only)
    [HttpGet("api/reports/vendor/events")]
    public async Task<IActionResult> GetVendorReportsOverview(CancellationToken ct)
    {
        AssertVendorOnly();
        var result = await _budgetService.GetVendorReportOverviewAsync(UserId, ct);
        return Ok(ApiResponse<List<FinancialReportListItemResponse>>.Ok(result));
    }

    /// GET /api/reports/admin/events - Admin overview across all event budgets
    [HttpGet("api/reports/admin/events")]
    public async Task<IActionResult> GetAdminReportsOverview(CancellationToken ct)
    {
        AssertAdminOnly();
        var result = await _budgetService.GetAdminReportOverviewAsync(ct);
        return Ok(ApiResponse<List<FinancialReportListItemResponse>>.Ok(result));
    }

    /// POST /api/reports/admin/events/:eventId/reconcile-venue-allocation
    [HttpPost("api/reports/admin/events/{eventId}/reconcile-venue-allocation")]
    public async Task<IActionResult> ReconcileVenueAllocation(string eventId, CancellationToken ct)
    {
        AssertAdminOnly();
        var result = await _budgetService.ReconcileVenueAllocationAsync(eventId, UserId, Role, ct);
        return Ok(ApiResponse<VenueAllocationReconciliationResponse>.Ok(result));
    }
}
