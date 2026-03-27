using EventZen.Budget.DTOs.Requests;
using EventZen.Budget.Infrastructure.Middleware;
using EventZen.Budget.Models;
using EventZen.Budget.Repositories;
using EventZen.Budget.Services;
using MongoDB.Driver;
using Xunit;

namespace EventZen.Budget.Tests;

public class BudgetServiceTests
{
    [Fact]
    public async Task GetSummaryAsync_SetsOverspendWarning_WhenSpentExceedsNinetyPercent()
    {
        var budget = new EventBudget
        {
            Id = "b-1",
            EventId = "event-1",
            TotalAllocated = 1000m,
            Currency = "INR",
            CreatedByUserId = "vendor-1",
            OwnerVendorUserId = "vendor-1",
        };

        var expenses = new List<Expense>
        {
            new() { Id = "e-1", BudgetId = "b-1", Amount = 700m, Category = ExpenseCategory.VENUE, Description = "Venue", AddedByUserId = "vendor-1", ExpenseDate = DateTime.UtcNow },
            new() { Id = "e-2", BudgetId = "b-1", Amount = 250m, Category = ExpenseCategory.CATERING, Description = "Food", AddedByUserId = "vendor-1", ExpenseDate = DateTime.UtcNow },
        };

        var service = new BudgetService(
            new FakeBudgetRepository(budget),
            new FakeExpenseRepository(expenses),
            new FakeEventOwnershipService(),
            new FakePaymentMetricsService());

        var summary = await service.GetSummaryAsync("event-1", "vendor-1", "VENDOR");

        Assert.Equal(950m, summary.TotalSpent);
        Assert.Equal(50m, summary.Remaining);
        Assert.True(summary.OverspendWarning);
        Assert.Equal(95.0, summary.PercentUsed);
    }

    [Fact]
    public async Task CreateBudgetAsync_RejectsVendor_WhenEventBelongsToDifferentVendor()
    {
        var service = new BudgetService(
            new FakeBudgetRepository(existingByEventId: null),
            new FakeExpenseRepository(),
            new FakeEventOwnershipService(new EventOwnershipInfo("event-9", "vendor-owner", "Owned Event", "PUBLISHED")),
            new FakePaymentMetricsService());

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateBudgetAsync(
                "event-9",
                new CreateBudgetRequest(1200m, "INR"),
                userId: "vendor-other",
                role: "VENDOR"));

        Assert.Contains("own events", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    private sealed class FakeBudgetRepository : IBudgetRepository
    {
        private readonly EventBudget? _existingByEventId;

        public FakeBudgetRepository(EventBudget? existingByEventId = null)
        {
            _existingByEventId = existingByEventId;
        }

        public Task<EventBudget?> FindByIdAsync(string id, CancellationToken ct = default)
            => Task.FromResult(_existingByEventId != null && _existingByEventId.Id == id ? _existingByEventId : null);

        public Task<EventBudget?> FindByEventIdAsync(string eventId, CancellationToken ct = default)
            => Task.FromResult(_existingByEventId != null && _existingByEventId.EventId == eventId ? _existingByEventId : null);

        public Task<List<EventBudget>> ListAllAsync(CancellationToken ct = default)
            => Task.FromResult(_existingByEventId is null ? new List<EventBudget>() : new List<EventBudget> { _existingByEventId });

        public Task<List<EventBudget>> ListByOwnerVendorUserIdAsync(string ownerVendorUserId, CancellationToken ct = default)
        {
            if (_existingByEventId is null || _existingByEventId.OwnerVendorUserId != ownerVendorUserId) {
                return Task.FromResult(new List<EventBudget>());
            }
            return Task.FromResult(new List<EventBudget> { _existingByEventId });
        }

        public Task<EventBudget> CreateAsync(EventBudget budget, CancellationToken ct = default)
        {
            budget.Id ??= "new-budget-id";
            return Task.FromResult(budget);
        }

        public Task<EventBudget?> UpdateAsync(string eventId, UpdateDefinition<EventBudget> update, CancellationToken ct = default)
            => Task.FromResult(_existingByEventId != null && _existingByEventId.EventId == eventId ? _existingByEventId : null);
    }

    private sealed class FakeExpenseRepository : IExpenseRepository
    {
        private readonly List<Expense> _seed;

        public FakeExpenseRepository(List<Expense>? seed = null)
        {
            _seed = seed ?? new List<Expense>();
        }

        public Task<List<Expense>> FindByBudgetIdAsync(string budgetId, CancellationToken ct = default)
            => Task.FromResult(_seed.Where(e => e.BudgetId == budgetId).ToList());

        public Task<List<Expense>> FindByBudgetIdsAsync(IReadOnlyCollection<string> budgetIds, CancellationToken ct = default)
            => Task.FromResult(_seed.Where(e => budgetIds.Contains(e.BudgetId)).ToList());

        public Task<Expense?> FindByIdAsync(string id, CancellationToken ct = default)
            => Task.FromResult(_seed.FirstOrDefault(e => e.Id == id));

        public Task<Expense> CreateAsync(Expense expense, CancellationToken ct = default)
        {
            _seed.Add(expense);
            return Task.FromResult(expense);
        }

        public Task<Expense?> UpdateAsync(string id, UpdateDefinition<Expense> update, CancellationToken ct = default)
            => Task.FromResult(_seed.FirstOrDefault(e => e.Id == id));

        public Task<bool> DeleteAsync(string id, CancellationToken ct = default)
            => Task.FromResult(_seed.RemoveAll(e => e.Id == id) > 0);
    }

    private sealed class FakeEventOwnershipService : IEventOwnershipService
    {
        private readonly EventOwnershipInfo _owned;

        public FakeEventOwnershipService(EventOwnershipInfo? owned = null)
        {
            _owned = owned ?? new EventOwnershipInfo("event-1", "vendor-1", "Event 1", "PUBLISHED");
        }

        public Task<EventOwnershipInfo> GetEventOwnershipAsync(string eventId, CancellationToken ct = default)
            => Task.FromResult(_owned with { EventId = eventId });

        public Task<EventOwnershipInfo?> TryGetEventOwnershipAsync(string eventId, CancellationToken ct = default)
            => Task.FromResult<EventOwnershipInfo?>(_owned with { EventId = eventId });
    }

    private sealed class FakePaymentMetricsService : IPaymentMetricsService
    {
        public Task<IReadOnlyDictionary<string, PlatformFeeMetrics>> GetPlatformFeeTotalsByEventAsync(
            IReadOnlyCollection<string> eventIds,
            CancellationToken ct = default)
        {
            IReadOnlyDictionary<string, PlatformFeeMetrics> result = eventIds
                .Distinct(StringComparer.Ordinal)
                .ToDictionary(id => id, _ => PlatformFeeMetrics.Zero);
            return Task.FromResult(result);
        }
    }
}
