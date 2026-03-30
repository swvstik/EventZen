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
    public async Task CreateBudgetAsync_RejectsUserRole()
    {
        var service = new BudgetService(
            new FakeBudgetRepository(existingByEventId: null),
            new FakeExpenseRepository(),
            new FakeEventOwnershipService(new EventOwnershipInfo("event-1", "vendor-1", "Owned Event", "PUBLISHED")),
            new FakePaymentMetricsService(),
            new FakeVenueBookingAllocationService());

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateBudgetAsync(
                "event-1",
                new CreateBudgetRequest(1000m, "INR"),
                userId: "user-1",
                role: "USER"));

        Assert.Contains("VENDOR or ADMIN", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

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
            new FakePaymentMetricsService(),
            new FakeVenueBookingAllocationService());

        var summary = await service.GetSummaryAsync("event-1", "vendor-1", "VENDOR");

        Assert.Equal(950m, summary.TotalSpent);
        Assert.Equal(50m, summary.Remaining);
        Assert.True(summary.OverspendWarning);
        Assert.Equal(95.0, summary.PercentUsed);
    }

    [Fact]
    public async Task GetSummaryAsync_DoesNotSetOverspendWarning_WhenSpentIsExactlyNinetyPercent()
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
            new() { Id = "e-1", BudgetId = "b-1", Amount = 900m, Category = ExpenseCategory.VENUE, Description = "Venue", AddedByUserId = "vendor-1", ExpenseDate = DateTime.UtcNow },
        };

        var service = new BudgetService(
            new FakeBudgetRepository(budget),
            new FakeExpenseRepository(expenses),
            new FakeEventOwnershipService(),
            new FakePaymentMetricsService(),
            new FakeVenueBookingAllocationService());

        var summary = await service.GetSummaryAsync("event-1", "vendor-1", "VENDOR");

        Assert.Equal(90.0, summary.PercentUsed);
        Assert.False(summary.OverspendWarning);
    }

    [Fact]
    public async Task CreateBudgetAsync_RejectsVendor_WhenEventBelongsToDifferentVendor()
    {
        var service = new BudgetService(
            new FakeBudgetRepository(existingByEventId: null),
            new FakeExpenseRepository(),
            new FakeEventOwnershipService(new EventOwnershipInfo("event-9", "vendor-owner", "Owned Event", "PUBLISHED")),
            new FakePaymentMetricsService(),
            new FakeVenueBookingAllocationService());

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateBudgetAsync(
                "event-9",
                new CreateBudgetRequest(1200m, "INR"),
                userId: "vendor-other",
                role: "VENDOR"));

        Assert.Contains("own events", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task TryAutoAllocateVenueExpenseAsync_IsIdempotent_BySourceBookingId()
    {
        var budget = new EventBudget
        {
            Id = "b-1",
            EventId = "event-1",
            TotalAllocated = 2000m,
            Currency = "INR",
            CreatedByUserId = "vendor-1",
            OwnerVendorUserId = "vendor-1",
        };

        var service = new BudgetService(
            new FakeBudgetRepository(budget),
            new FakeExpenseRepository(),
            new FakeEventOwnershipService(),
            new FakePaymentMetricsService(),
            new FakeVenueBookingAllocationService());

        var first = await service.TryAutoAllocateVenueExpenseAsync(
            eventId: "event-1",
            sourceBookingId: "booking-1",
            totalVenueCost: 1500m,
            venueDailyRate: 500m,
            bookingDays: 3,
            currency: "INR",
            vendorUserId: "vendor-1",
            expenseDateUtc: DateTime.UtcNow);

        var second = await service.TryAutoAllocateVenueExpenseAsync(
            eventId: "event-1",
            sourceBookingId: "booking-1",
            totalVenueCost: 1500m,
            venueDailyRate: 500m,
            bookingDays: 3,
            currency: "INR",
            vendorUserId: "vendor-1",
            expenseDateUtc: DateTime.UtcNow);

        Assert.True(first);
        Assert.False(second);
    }

    [Fact]
    public async Task UpdateExpenseAsync_RejectsAutoAllocatedExpense()
    {
        var budget = new EventBudget
        {
            Id = "b-1",
            EventId = "event-1",
            TotalAllocated = 2000m,
            Currency = "INR",
            CreatedByUserId = "vendor-1",
            OwnerVendorUserId = "vendor-1",
        };

        var autoExpense = new Expense
        {
            Id = "e-1",
            BudgetId = "b-1",
            Category = ExpenseCategory.VENUE,
            Description = "Auto expense",
            Amount = 700m,
            AddedByUserId = "system:kafka:venue-booking",
            ExpenseDate = DateTime.UtcNow,
            IsAutoAllocated = true,
            AllocationSource = "AUTO_VENUE_BOOKING",
            SourceBookingId = "booking-1",
            AllocationTimestamp = DateTime.UtcNow,
        };

        var service = new BudgetService(
            new FakeBudgetRepository(budget),
            new FakeExpenseRepository(new List<Expense> { autoExpense }),
            new FakeEventOwnershipService(),
            new FakePaymentMetricsService(),
            new FakeVenueBookingAllocationService());

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.UpdateExpenseAsync(
                id: "e-1",
                req: new UpdateExpenseRequest(null, "try edit", null, null, null),
                userId: "vendor-1",
                role: "VENDOR"));
    }

    [Fact]
    public async Task ReconcileVenueAllocationAsync_CreatesExpense_WhenMissing()
    {
        var budget = new EventBudget
        {
            Id = "b-1",
            EventId = "event-1",
            TotalAllocated = 2000m,
            Currency = "INR",
            CreatedByUserId = "admin-1",
            OwnerVendorUserId = "vendor-1",
        };

        var service = new BudgetService(
            new FakeBudgetRepository(budget),
            new FakeExpenseRepository(),
            new FakeEventOwnershipService(),
            new FakePaymentMetricsService(),
            new FakeVenueBookingAllocationService(new VenueBookingAllocationInfo(
                VenueBookingId: "booking-9",
                EventId: "event-1",
                VenueId: "44",
                VendorUserId: "vendor-1",
                VenueDailyRate: 500m,
                BookingDays: 2,
                TotalVenueCost: 1000m,
                Currency: "INR",
                StartTime: DateTime.UtcNow.AddDays(-1),
                EndTime: DateTime.UtcNow,
                BookedAt: DateTime.UtcNow.AddDays(-1))));

        var result = await service.ReconcileVenueAllocationAsync("event-1", "admin-1", "ADMIN");

        Assert.Equal("ALLOCATED", result.Status);
        Assert.True(result.ExpenseCreated);
        Assert.Equal("booking-9", result.SourceBookingId);
    }

    [Fact]
    public async Task ReconcileVenueAllocationAsync_PrunesStaleAutoExpenses_WhenBookingChanges()
    {
        var budget = new EventBudget
        {
            Id = "b-1",
            EventId = "event-1",
            TotalAllocated = 3000m,
            Currency = "INR",
            CreatedByUserId = "admin-1",
            OwnerVendorUserId = "vendor-1",
        };

        var seededExpenses = new List<Expense>
        {
            new()
            {
                Id = "e-old",
                BudgetId = "b-1",
                Category = ExpenseCategory.VENUE,
                Description = "Old auto venue",
                Amount = 1000m,
                AddedByUserId = "system:kafka:venue-booking",
                ExpenseDate = DateTime.UtcNow.AddDays(-2),
                IsAutoAllocated = true,
                AllocationSource = "AUTO_VENUE_BOOKING",
                SourceBookingId = "booking-old",
                AllocationTimestamp = DateTime.UtcNow.AddDays(-2),
            },
        };

        var service = new BudgetService(
            new FakeBudgetRepository(budget),
            new FakeExpenseRepository(seededExpenses),
            new FakeEventOwnershipService(),
            new FakePaymentMetricsService(),
            new FakeVenueBookingAllocationService(new VenueBookingAllocationInfo(
                VenueBookingId: "booking-new",
                EventId: "event-1",
                VenueId: "44",
                VendorUserId: "vendor-1",
                VenueDailyRate: 700m,
                BookingDays: 2,
                TotalVenueCost: 1400m,
                Currency: "INR",
                StartTime: DateTime.UtcNow.AddDays(-1),
                EndTime: DateTime.UtcNow,
                BookedAt: DateTime.UtcNow.AddDays(-1))));

        var result = await service.ReconcileVenueAllocationAsync("event-1", "admin-1", "ADMIN");

        Assert.Equal("ALLOCATED", result.Status);
        Assert.True(result.ExpenseCreated);
        Assert.Equal("booking-new", result.SourceBookingId);
        Assert.Single(seededExpenses);
        Assert.Equal("booking-new", seededExpenses[0].SourceBookingId);
    }

    [Fact]
    public async Task ReconcileVenueAllocationAsync_RemovesAutoVenueExpenses_WhenNoConfirmedBooking()
    {
        var budget = new EventBudget
        {
            Id = "b-1",
            EventId = "event-1",
            TotalAllocated = 2000m,
            Currency = "INR",
            CreatedByUserId = "admin-1",
            OwnerVendorUserId = "vendor-1",
        };

        var seededExpenses = new List<Expense>
        {
            new()
            {
                Id = "e-auto",
                BudgetId = "b-1",
                Category = ExpenseCategory.VENUE,
                Description = "Auto venue",
                Amount = 900m,
                AddedByUserId = "system:kafka:venue-booking",
                ExpenseDate = DateTime.UtcNow.AddDays(-3),
                IsAutoAllocated = true,
                AllocationSource = "AUTO_VENUE_BOOKING",
                SourceBookingId = "booking-z",
                AllocationTimestamp = DateTime.UtcNow.AddDays(-3),
            },
            new()
            {
                Id = "e-manual",
                BudgetId = "b-1",
                Category = ExpenseCategory.CATERING,
                Description = "Manual catering",
                Amount = 300m,
                AddedByUserId = "vendor-1",
                ExpenseDate = DateTime.UtcNow.AddDays(-1),
                IsAutoAllocated = false,
            },
        };

        var service = new BudgetService(
            new FakeBudgetRepository(budget),
            new FakeExpenseRepository(seededExpenses),
            new FakeEventOwnershipService(),
            new FakePaymentMetricsService(),
            new FakeVenueBookingAllocationService(value: null));

        var result = await service.ReconcileVenueAllocationAsync("event-1", "admin-1", "ADMIN");

        Assert.Equal("NO_CONFIRMED_BOOKING", result.Status);
        Assert.False(result.ExpenseCreated);
        Assert.Single(seededExpenses);
        Assert.Equal("e-manual", seededExpenses[0].Id);
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

        public Task<Expense?> FindBySourceBookingAsync(string budgetId, string sourceBookingId, CancellationToken ct = default)
            => Task.FromResult(_seed.FirstOrDefault(e => e.BudgetId == budgetId && e.SourceBookingId == sourceBookingId));

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

    private sealed class FakeVenueBookingAllocationService : IVenueBookingAllocationService
    {
        private readonly VenueBookingAllocationInfo? _value;

        public FakeVenueBookingAllocationService(VenueBookingAllocationInfo? value = null)
        {
            _value = value;
        }

        public Task<VenueBookingAllocationInfo?> TryGetLatestConfirmedAsync(string eventId, CancellationToken ct = default)
        {
            if (_value is null)
                return Task.FromResult<VenueBookingAllocationInfo?>(null);
            return Task.FromResult<VenueBookingAllocationInfo?>(_value with { EventId = eventId });
        }
    }
}
