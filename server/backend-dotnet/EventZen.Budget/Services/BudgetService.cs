using EventZen.Budget.DTOs.Requests;
using EventZen.Budget.DTOs.Responses;
using EventZen.Budget.Infrastructure.Middleware;
using EventZen.Budget.Models;
using EventZen.Budget.Repositories;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;

namespace EventZen.Budget.Services;

public interface IBudgetService
{
    Task<BudgetResponse> CreateBudgetAsync(
        string eventId,
        CreateBudgetRequest req,
        string userId,
        string role,
        CancellationToken ct = default);

    Task<BudgetSummaryResponse> GetSummaryAsync(
        string eventId,
        string userId,
        string role,
        CancellationToken ct = default);

    Task<BudgetResponse> UpdateBudgetAsync(
        string eventId,
        UpdateBudgetRequest req,
        string userId,
        string role,
        CancellationToken ct = default);

    Task<ExpenseResponse> AddExpenseAsync(
        string eventId,
        CreateExpenseRequest req,
        string userId,
        string role,
        CancellationToken ct = default);

    Task<List<ExpenseResponse>> GetExpensesAsync(
        string eventId,
        string userId,
        string role,
        CancellationToken ct = default);

    Task<ExpenseResponse> UpdateExpenseAsync(
        string id,
        UpdateExpenseRequest req,
        string userId,
        string role,
        CancellationToken ct = default);

    Task DeleteExpenseAsync(
        string id,
        string userId,
        string role,
        CancellationToken ct = default);

    Task<FinancialReportResponse> GetReportAsync(
        string eventId,
        string userId,
        string role,
        CancellationToken ct = default);

    Task<List<FinancialReportListItemResponse>> GetVendorReportOverviewAsync(
        string vendorUserId,
        CancellationToken ct = default);

    Task<List<FinancialReportListItemResponse>> GetAdminReportOverviewAsync(
        CancellationToken ct = default);

    Task<VenueAllocationReconciliationResponse> ReconcileVenueAllocationAsync(
        string eventId,
        string userId,
        string role,
        CancellationToken ct = default);

    Task<bool> TryAutoAllocateVenueExpenseAsync(
        string eventId,
        string sourceBookingId,
        decimal totalVenueCost,
        decimal venueDailyRate,
        int bookingDays,
        string currency,
        string vendorUserId,
        DateTime expenseDateUtc,
        CancellationToken ct = default);

    Task<bool> RemoveAutoAllocatedVenueExpenseAsync(
        string eventId,
        string sourceBookingId,
        CancellationToken ct = default);
}

public class BudgetService : IBudgetService
{
    private readonly IBudgetRepository  _budgets;
    private readonly IExpenseRepository _expenses;
    private readonly IEventOwnershipService _eventOwnership;
    private readonly IPaymentMetricsService _paymentMetrics;
    private readonly IVenueBookingAllocationService _venueBookingAllocation;
    private readonly ILogger<BudgetService> _logger;

    public BudgetService(
        IBudgetRepository budgets,
        IExpenseRepository expenses,
        IEventOwnershipService eventOwnership,
        IPaymentMetricsService paymentMetrics,
        IVenueBookingAllocationService venueBookingAllocation,
        ILogger<BudgetService>? logger = null)
    {
        _budgets = budgets;
        _expenses = expenses;
        _eventOwnership = eventOwnership;
        _paymentMetrics = paymentMetrics;
        _venueBookingAllocation = venueBookingAllocation;
        _logger = logger ?? NullLogger<BudgetService>.Instance;
    }

    // -- Create budget ---------------------------------------------------------

    public async Task<BudgetResponse> CreateBudgetAsync(
        string eventId,
        CreateBudgetRequest req,
        string userId,
        string role,
        CancellationToken ct = default)
    {
        AssertVendorOrAdmin(role);

        // 409 if a budget already exists for this eventId
        var existing = await _budgets.FindByEventIdAsync(eventId, ct);
        if (existing is not null)
            throw new ConflictException($"A budget already exists for event {eventId}.");

        var eventInfo = await _eventOwnership.GetEventOwnershipAsync(eventId, ct);
        if (IsVendor(role) && eventInfo.VendorUserId != userId)
            throw new ForbiddenException("Vendors can only create budgets for their own events.");

        var budget = new EventBudget
        {
            EventId = eventId,
            TotalAllocated = req.TotalAllocated,
            Currency = req.Currency,
            CreatedByUserId = userId,
            OwnerVendorUserId = eventInfo.VendorUserId,
        };

        try
        {
            var created = await _budgets.CreateAsync(budget, ct);
            await EnsureVenueAllocationForBudgetAsync(created, ct);
            return MapBudget(created);
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            throw new ConflictException($"A budget already exists for event {eventId}.");
        }
    }

    // -- Get summary -----------------------------------------------------------

    public async Task<BudgetSummaryResponse> GetSummaryAsync(
        string eventId,
        string userId,
        string role,
        CancellationToken ct = default)
    {
        AssertVendorOrAdmin(role);
        var budget = await GetBudgetOrThrowAsync(eventId, ct);
        await AssertCanAccessBudgetAsync(budget, userId, role, ct);
        await EnsureVenueAllocationForBudgetAsync(budget, ct);
        var expenses = await _expenses.FindByBudgetIdAsync(budget.Id, ct);

        return BuildSummary(budget, expenses);
    }

    // -- Update budget ---------------------------------------------------------

    public async Task<BudgetResponse> UpdateBudgetAsync(
        string eventId,
        UpdateBudgetRequest req,
        string userId,
        string role,
        CancellationToken ct = default)
    {
        AssertVendorOrAdmin(role);
        var budget = await GetBudgetOrThrowAsync(eventId, ct); // ensure exists
        await AssertCanAccessBudgetAsync(budget, userId, role, ct);

        var updates = new List<UpdateDefinition<EventBudget>>();
        if (req.TotalAllocated.HasValue)
            updates.Add(Builders<EventBudget>.Update.Set(b => b.TotalAllocated, req.TotalAllocated.Value));
        if (req.Currency is not null)
            updates.Add(Builders<EventBudget>.Update.Set(b => b.Currency, req.Currency));

        if (updates.Count == 0)
            throw new BadRequestException("No fields to update.");

        var combined = Builders<EventBudget>.Update.Combine(updates);
        var updated  = await _budgets.UpdateAsync(eventId, combined, ct);

        return MapBudget(updated!);
    }

    // -- Add expense -----------------------------------------------------------

    public async Task<ExpenseResponse> AddExpenseAsync(
        string eventId,
        CreateExpenseRequest req,
        string userId,
        string role,
        CancellationToken ct = default)
    {
        AssertVendorOrAdmin(role);
        var budget = await GetBudgetOrThrowAsync(eventId, ct);
        await AssertCanAccessBudgetAsync(budget, userId, role, ct);

        var expense = new Expense
        {
            BudgetId = budget.Id,
            Category = req.Category,
            Description = req.Description,
            Amount = req.Amount,
            VendorId = req.VendorId,
            ExpenseDate = req.ExpenseDate.ToUniversalTime(),
            AddedByUserId = userId,
        };

        var created = await _expenses.CreateAsync(expense, ct);
        return MapExpense(created);
    }

    // -- Get expenses ----------------------------------------------------------

    public async Task<List<ExpenseResponse>> GetExpensesAsync(
        string eventId,
        string userId,
        string role,
        CancellationToken ct = default)
    {
        AssertVendorOrAdmin(role);
        var budget = await GetBudgetOrThrowAsync(eventId, ct);
        await AssertCanAccessBudgetAsync(budget, userId, role, ct);
        await EnsureVenueAllocationForBudgetAsync(budget, ct);
        var expenses = await _expenses.FindByBudgetIdAsync(budget.Id, ct);
        return expenses.Select(MapExpense).ToList();
    }

    // -- Update expense --------------------------------------------------------

    public async Task<ExpenseResponse> UpdateExpenseAsync(
        string id,
        UpdateExpenseRequest req,
        string userId,
        string role,
        CancellationToken ct = default)
    {
        AssertVendorOrAdmin(role);
        var existing = await _expenses.FindByIdAsync(id, ct)
            ?? throw new NotFoundException($"Expense {id} not found.");

        var budget = await _budgets.FindByIdAsync(existing.BudgetId, ct)
            ?? throw new NotFoundException($"Budget {existing.BudgetId} not found.");
        await AssertCanAccessBudgetAsync(budget, userId, role, ct);

        if (existing.IsAutoAllocated)
            throw new ForbiddenException("Auto-allocated expenses are system-locked and cannot be edited.");

        var updates = new List<UpdateDefinition<Expense>>();
        if (req.Category.HasValue)    updates.Add(Builders<Expense>.Update.Set(e => e.Category,    req.Category.Value));
        if (req.Description is not null) updates.Add(Builders<Expense>.Update.Set(e => e.Description, req.Description));
        if (req.Amount.HasValue)      updates.Add(Builders<Expense>.Update.Set(e => e.Amount,      req.Amount.Value));
        if (req.VendorId is not null) updates.Add(Builders<Expense>.Update.Set(e => e.VendorId,    req.VendorId));
        if (req.ExpenseDate.HasValue) updates.Add(Builders<Expense>.Update.Set(e => e.ExpenseDate, req.ExpenseDate.Value.ToUniversalTime()));

        if (updates.Count == 0) throw new BadRequestException("No fields to update.");

        var combined = Builders<Expense>.Update.Combine(updates);
        var updated  = await _expenses.UpdateAsync(id, combined, ct);
        return MapExpense(updated!);
    }

    // -- Delete expense --------------------------------------------------------

    public async Task DeleteExpenseAsync(
        string id,
        string userId,
        string role,
        CancellationToken ct = default)
    {
        AssertVendorOrAdmin(role);
        var existing = await _expenses.FindByIdAsync(id, ct)
            ?? throw new NotFoundException($"Expense {id} not found.");

        var budget = await _budgets.FindByIdAsync(existing.BudgetId, ct)
            ?? throw new NotFoundException($"Budget {existing.BudgetId} not found.");
        await AssertCanAccessBudgetAsync(budget, userId, role, ct);

        if (existing.IsAutoAllocated)
            throw new ForbiddenException("Auto-allocated expenses are system-locked and cannot be deleted.");

        var deleted = await _expenses.DeleteAsync(id, ct);
        if (!deleted) throw new NotFoundException($"Expense {id} not found.");
    }

    public async Task<bool> TryAutoAllocateVenueExpenseAsync(
        string eventId,
        string sourceBookingId,
        decimal totalVenueCost,
        decimal venueDailyRate,
        int bookingDays,
        string currency,
        string vendorUserId,
        DateTime expenseDateUtc,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(eventId) || string.IsNullOrWhiteSpace(sourceBookingId))
            return false;
        if (totalVenueCost <= 0)
            return false;

        var budget = await _budgets.FindByEventIdAsync(eventId, ct);
        if (budget is null)
            return false;

        var existing = await _expenses.FindBySourceBookingAsync(budget.Id, sourceBookingId, ct);
        if (existing is not null)
            return false;

        var ownerVendorUserId = await ResolveOwnerVendorUserIdAsync(budget, ct);
        if (!string.IsNullOrWhiteSpace(vendorUserId) && ownerVendorUserId != vendorUserId)
            return false;

        var normalizedCurrency = string.IsNullOrWhiteSpace(currency)
            ? budget.Currency
            : currency.Trim().ToUpperInvariant();

        var created = new Expense
        {
            BudgetId = budget.Id,
            Category = ExpenseCategory.VENUE,
            Description = $"Auto-allocated venue rent ({bookingDays} day(s) x {venueDailyRate:0.00} {normalizedCurrency})",
            Amount = totalVenueCost,
            VendorId = null,
            ExpenseDate = expenseDateUtc,
            AddedByUserId = "system:kafka:venue-booking",
            IsAutoAllocated = true,
            AllocationSource = "AUTO_VENUE_BOOKING",
            SourceBookingId = sourceBookingId,
            AllocationTimestamp = DateTime.UtcNow,
        };

        try
        {
            await _expenses.CreateAsync(created, ct);
            return true;
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            return false;
        }
    }

    public async Task<bool> RemoveAutoAllocatedVenueExpenseAsync(
        string eventId,
        string sourceBookingId,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(eventId) || string.IsNullOrWhiteSpace(sourceBookingId))
            return false;

        var budget = await _budgets.FindByEventIdAsync(eventId, ct);
        if (budget is null)
            return false;

        var existing = await _expenses.FindBySourceBookingAsync(budget.Id, sourceBookingId, ct);
        if (existing is null || !existing.IsAutoAllocated)
            return false;

        return await _expenses.DeleteAsync(existing.Id, ct);
    }

    // -- Financial report ------------------------------------------------------

    public async Task<FinancialReportResponse> GetReportAsync(
        string eventId,
        string userId,
        string role,
        CancellationToken ct = default)
    {
        AssertVendorOrAdmin(role);
        var budget = await GetBudgetOrThrowAsync(eventId, ct);
        await AssertCanAccessBudgetAsync(budget, userId, role, ct);
        await EnsureVenueAllocationForBudgetAsync(budget, ct);

        var expenses = await _expenses.FindByBudgetIdAsync(budget.Id, ct);
        var summary = BuildSummary(budget, expenses);

        // LINQ grouping by category - sorted by total descending
        var byCategory = expenses
            .GroupBy(e => e.Category)
            .Select(g => new CategorySubtotal(
                Category: g.Key.ToString(),
                Total:    g.Sum(e => e.Amount),
                Count:    g.Count()
            ))
            .OrderByDescending(g => g.Total)
            .ToList();

        return new FinancialReportResponse(
            Summary: summary,
            Expenses: expenses.Select(MapExpense).ToList(),
            ByCategory: byCategory
        );
    }

    public async Task<List<FinancialReportListItemResponse>> GetVendorReportOverviewAsync(
        string vendorUserId,
        CancellationToken ct = default)
    {
        var budgets = await _budgets.ListByOwnerVendorUserIdAsync(vendorUserId, ct);
        return await BuildReportOverviewAsync(budgets, ct);
    }

    public async Task<List<FinancialReportListItemResponse>> GetAdminReportOverviewAsync(
        CancellationToken ct = default)
    {
        var budgets = await _budgets.ListAllAsync(ct);
        return await BuildReportOverviewAsync(budgets, ct);
    }

    public async Task<VenueAllocationReconciliationResponse> ReconcileVenueAllocationAsync(
        string eventId,
        string userId,
        string role,
        CancellationToken ct = default)
    {
        if (!IsAdmin(role))
            throw new ForbiddenException("Access denied. Requires ADMIN role.");

        var budget = await _budgets.FindByEventIdAsync(eventId, ct);
        if (budget is null)
        {
            return new VenueAllocationReconciliationResponse(
                EventId: eventId,
                Status: "MISSING_BUDGET",
                Message: "No budget exists for this event.",
                ExpenseCreated: false,
                SourceBookingId: null,
                Amount: null,
                Currency: null);
        }

        var allocation = await _venueBookingAllocation.TryGetLatestConfirmedAsync(eventId, ct);
        await PruneStaleAutoAllocatedVenueExpensesAsync(budget.Id, allocation?.VenueBookingId, ct);
        if (allocation is null)
        {
            return new VenueAllocationReconciliationResponse(
                EventId: eventId,
                Status: "NO_CONFIRMED_BOOKING",
                Message: "No confirmed venue booking snapshot was found for this event.",
                ExpenseCreated: false,
                SourceBookingId: null,
                Amount: null,
                Currency: null);
        }

        var existing = await _expenses.FindBySourceBookingAsync(budget.Id, allocation.VenueBookingId, ct);
        if (existing is not null)
        {
            return new VenueAllocationReconciliationResponse(
                EventId: eventId,
                Status: "ALREADY_ALLOCATED",
                Message: "Venue allocation already exists for this booking.",
                ExpenseCreated: false,
                SourceBookingId: allocation.VenueBookingId,
                Amount: existing.Amount,
                Currency: allocation.Currency);
        }

        var created = await TryAutoAllocateVenueExpenseAsync(
            eventId: eventId,
            sourceBookingId: allocation.VenueBookingId,
            totalVenueCost: allocation.TotalVenueCost,
            venueDailyRate: allocation.VenueDailyRate,
            bookingDays: allocation.BookingDays,
            currency: allocation.Currency,
            vendorUserId: allocation.VendorUserId,
            expenseDateUtc: (allocation.BookedAt ?? allocation.StartTime).ToUniversalTime(),
            ct: ct
        );

        return new VenueAllocationReconciliationResponse(
            EventId: eventId,
            Status: created ? "ALLOCATED" : "SKIPPED",
            Message: created
                ? "Venue allocation was successfully created."
                : "Venue allocation was skipped because an equivalent allocation already exists or constraints did not match.",
            ExpenseCreated: created,
            SourceBookingId: allocation.VenueBookingId,
            Amount: allocation.TotalVenueCost,
            Currency: allocation.Currency);
    }

    // -- Private helpers -------------------------------------------------------

    private async Task<EventBudget> GetBudgetOrThrowAsync(string eventId, CancellationToken ct)
        => await _budgets.FindByEventIdAsync(eventId, ct)
           ?? throw new NotFoundException($"No budget found for event {eventId}.");

    private async Task EnsureVenueAllocationForBudgetAsync(EventBudget budget, CancellationToken ct)
    {
        VenueBookingAllocationInfo? allocation;
        try
        {
            allocation = await _venueBookingAllocation.TryGetLatestConfirmedAsync(budget.EventId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to resolve latest confirmed venue booking while ensuring allocation for event {EventId}, budget {BudgetId}.",
                budget.EventId,
                budget.Id
            );
            return;
        }

        await PruneStaleAutoAllocatedVenueExpensesAsync(budget.Id, allocation?.VenueBookingId, ct);

        if (allocation is null)
            return;

        await TryAutoAllocateVenueExpenseAsync(
            eventId: budget.EventId,
            sourceBookingId: allocation.VenueBookingId,
            totalVenueCost: allocation.TotalVenueCost,
            venueDailyRate: allocation.VenueDailyRate,
            bookingDays: allocation.BookingDays,
            currency: allocation.Currency,
            vendorUserId: allocation.VendorUserId,
            expenseDateUtc: (allocation.BookedAt ?? allocation.StartTime).ToUniversalTime(),
            ct: ct
        );
    }

    private async Task PruneStaleAutoAllocatedVenueExpensesAsync(
        string budgetId,
        string? currentVenueBookingId,
        CancellationToken ct)
    {
        var allExpenses = await _expenses.FindByBudgetIdAsync(budgetId, ct);
        var stale = allExpenses.Where(e =>
            e.IsAutoAllocated
            && e.AllocationSource == "AUTO_VENUE_BOOKING"
            && (string.IsNullOrWhiteSpace(currentVenueBookingId) || e.SourceBookingId != currentVenueBookingId)
        );

        foreach (var expense in stale)
        {
            await _expenses.DeleteAsync(expense.Id, ct);
        }
    }

    private static BudgetSummaryResponse BuildSummary(EventBudget budget, List<Expense> expenses)
    {
        var totalSpent   = expenses.Sum(e => e.Amount);
        var remaining    = budget.TotalAllocated - totalSpent;
        var percentUsed  = budget.TotalAllocated > 0
            ? Math.Round((double)(totalSpent / budget.TotalAllocated) * 100, 2)
            : 0.0;
        // Overspend warning when spent > 90% of allocated
        var overspend    = totalSpent > 0.9m * budget.TotalAllocated;

        return new BudgetSummaryResponse(
            EventId: budget.EventId,
            TotalAllocated: budget.TotalAllocated,
            TotalSpent: totalSpent,
            Remaining: remaining,
            PercentUsed: percentUsed,
            OverspendWarning: overspend,
            Currency: budget.Currency
        );
    }

    private async Task AssertCanAccessBudgetAsync(
        EventBudget budget,
        string userId,
        string role,
        CancellationToken ct)
    {
        if (IsAdmin(role)) return;

        if (!IsVendor(role))
            throw new ForbiddenException("Access denied. Requires VENDOR or ADMIN role.");

        var ownerVendorUserId = await ResolveOwnerVendorUserIdAsync(budget, ct);
        if (ownerVendorUserId != userId)
            throw new ForbiddenException("Vendors can only access finance data for their own events.");
    }

    private async Task<string> ResolveOwnerVendorUserIdAsync(EventBudget budget, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(budget.OwnerVendorUserId))
            return budget.OwnerVendorUserId;

        var eventInfo = await _eventOwnership.TryGetEventOwnershipAsync(budget.EventId, ct);
        var owner = eventInfo?.VendorUserId ?? budget.CreatedByUserId;

        var update = Builders<EventBudget>.Update.Set(b => b.OwnerVendorUserId, owner);
        await _budgets.UpdateAsync(budget.EventId, update, ct);

        budget.OwnerVendorUserId = owner;
        return owner;
    }

    private async Task<List<FinancialReportListItemResponse>> BuildReportOverviewAsync(
        IReadOnlyCollection<EventBudget> budgets,
        CancellationToken ct)
    {
        if (budgets.Count == 0) return [];

        // Keep report overview self-healing for venue auto allocations so totals are current
        // even if the budget detail page was never opened.
        foreach (var budget in budgets)
        {
            await EnsureVenueAllocationForBudgetAsync(budget, ct);
        }

        var budgetIds = budgets.Select(b => b.Id).ToList();
        var allExpenses = await _expenses.FindByBudgetIdsAsync(budgetIds, ct);
        var expensesByBudgetId = allExpenses
            .GroupBy(e => e.BudgetId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var ownerTasks = budgets.ToDictionary(
            b => b.Id,
            b => ResolveOwnerVendorUserIdAsync(b, ct)
        );

        var eventInfoTasks = budgets.ToDictionary(
            b => b.EventId,
            b => _eventOwnership.TryGetEventOwnershipAsync(b.EventId, ct)
        );

        var paymentMetricsByEvent = await _paymentMetrics.GetPlatformFeeTotalsByEventAsync(
            budgets.Select(b => b.EventId).Distinct().ToList(),
            ct
        );

        await Task.WhenAll(ownerTasks.Values);
        await Task.WhenAll(eventInfoTasks.Values);

        var items = new List<FinancialReportListItemResponse>();

        foreach (var budget in budgets)
        {
            var ownerVendorUserId = ownerTasks[budget.Id].Result;
            var expenses = expensesByBudgetId.TryGetValue(budget.Id, out var found)
                ? found
                : [];
            var summary = BuildSummary(budget, expenses);
            var eventInfo = eventInfoTasks[budget.EventId].Result;
            var paymentMetrics = paymentMetricsByEvent.TryGetValue(budget.EventId, out var foundMetrics)
                ? foundMetrics
                : PlatformFeeMetrics.Zero;

            items.Add(new FinancialReportListItemResponse(
                EventId: budget.EventId,
                EventTitle: eventInfo?.EventTitle,
                EventStatus: eventInfo?.EventStatus,
                OwnerVendorUserId: ownerVendorUserId,
                TotalAllocated: budget.TotalAllocated,
                TotalSpent: summary.TotalSpent,
                Remaining: summary.Remaining,
                PercentUsed: summary.PercentUsed,
                OverspendWarning: summary.OverspendWarning,
                Currency: budget.Currency,
                ExpenseCount: expenses.Count,
                PlatformFeeCollected: paymentMetrics.PlatformFeeCollected,
                TicketSubtotalCollected: paymentMetrics.TicketSubtotalCollected,
                ChargedTotalCollected: paymentMetrics.ChargedTotalCollected,
                PaidOrderCount: paymentMetrics.PaidOrderCount,
                PaidTicketCount: paymentMetrics.PaidTicketCount
            ));
        }

        return items
            .OrderByDescending(i => i.OverspendWarning)
            .ThenByDescending(i => i.PercentUsed)
            .ThenBy(i => i.EventId)
            .ToList();
    }

    private static void AssertVendorOrAdmin(string role)
    {
        if (!IsVendor(role) && !IsAdmin(role))
            throw new ForbiddenException("Access denied. Requires VENDOR or ADMIN role.");
    }

    private static bool IsVendor(string role) => role == "VENDOR";
    private static bool IsAdmin(string role) => role == "ADMIN";

    private static BudgetResponse MapBudget(EventBudget b) => new(
        b.Id, b.EventId, b.OwnerVendorUserId, b.TotalAllocated, b.Currency, b.CreatedAt);

    private static ExpenseResponse MapExpense(Expense e) => new(
        e.Id, e.BudgetId, e.Category, e.Description,
        e.Amount, e.VendorId, e.ExpenseDate, e.AddedByUserId, e.CreatedAt,
        e.IsAutoAllocated, e.AllocationSource, e.SourceBookingId, e.AllocationTimestamp);
}
