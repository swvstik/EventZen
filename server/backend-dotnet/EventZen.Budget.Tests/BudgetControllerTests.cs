using EventZen.Budget.Controllers;
using EventZen.Budget.DTOs.Responses;
using EventZen.Budget.Infrastructure.Middleware;
using EventZen.Budget.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Xunit;

namespace EventZen.Budget.Tests;

public class BudgetControllerTests
{
    [Fact]
    public async Task GetAdminReportsOverview_ReturnsOk_ForAdminRole()
    {
        var service = new FakeBudgetService
        {
            AdminOverview = new List<FinancialReportListItemResponse>
            {
                new(
                    EventId: "event-1",
                    EventTitle: "Demo",
                    EventStatus: "PUBLISHED",
                    OwnerVendorUserId: "vendor-1",
                    TotalAllocated: 1000m,
                    TotalSpent: 500m,
                    Remaining: 500m,
                    PercentUsed: 50.0,
                    OverspendWarning: false,
                    Currency: "INR",
                    ExpenseCount: 1,
                    PlatformFeeCollected: 0m,
                    TicketSubtotalCollected: 0m,
                    ChargedTotalCollected: 0m,
                    PaidOrderCount: 0,
                    PaidTicketCount: 0)
            }
        };

        var controller = CreateController(service, userId: "admin-1", role: "ADMIN");

        var action = await controller.GetAdminReportsOverview(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(action);
        var payload = Assert.IsType<ApiResponse<List<FinancialReportListItemResponse>>>(ok.Value);
        Assert.True(payload.Success);
        Assert.NotNull(payload.Data);
        Assert.Single(payload.Data!);
    }

    [Fact]
    public async Task GetVendorReportsOverview_RejectsAdminRole()
    {
        var service = new FakeBudgetService();
        var controller = CreateController(service, userId: "admin-1", role: "ADMIN");

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            controller.GetVendorReportsOverview(CancellationToken.None));
    }

    private static BudgetController CreateController(IBudgetService service, string userId, string role)
    {
        var controller = new BudgetController(service, new DummyServiceProvider());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim("userId", userId),
                    new Claim("role", role),
                }, "test"))
            }
        };
        return controller;
    }

    private sealed class DummyServiceProvider : IServiceProvider
    {
        public object? GetService(Type serviceType) => null;
    }

    private sealed class FakeBudgetService : IBudgetService
    {
        public List<FinancialReportListItemResponse> AdminOverview { get; set; } = new();

        public Task<BudgetResponse> CreateBudgetAsync(string eventId, DTOs.Requests.CreateBudgetRequest req, string userId, string role, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<BudgetSummaryResponse> GetSummaryAsync(string eventId, string userId, string role, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<BudgetResponse> UpdateBudgetAsync(string eventId, DTOs.Requests.UpdateBudgetRequest req, string userId, string role, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<ExpenseResponse> AddExpenseAsync(string eventId, DTOs.Requests.CreateExpenseRequest req, string userId, string role, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<List<ExpenseResponse>> GetExpensesAsync(string eventId, string userId, string role, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<ExpenseResponse> UpdateExpenseAsync(string id, DTOs.Requests.UpdateExpenseRequest req, string userId, string role, CancellationToken ct = default) => throw new NotImplementedException();
        public Task DeleteExpenseAsync(string id, string userId, string role, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<FinancialReportResponse> GetReportAsync(string eventId, string userId, string role, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<List<FinancialReportListItemResponse>> GetVendorReportOverviewAsync(string vendorUserId, CancellationToken ct = default) =>
            Task.FromResult(new List<FinancialReportListItemResponse>());
        public Task<List<FinancialReportListItemResponse>> GetAdminReportOverviewAsync(CancellationToken ct = default) =>
            Task.FromResult(AdminOverview);
        public Task<VenueAllocationReconciliationResponse> ReconcileVenueAllocationAsync(string eventId, string userId, string role, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> TryAutoAllocateVenueExpenseAsync(string eventId, string sourceBookingId, decimal totalVenueCost, decimal venueDailyRate, int bookingDays, string currency, string vendorUserId, DateTime expenseDateUtc, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> RemoveAutoAllocatedVenueExpenseAsync(string eventId, string sourceBookingId, CancellationToken ct = default) => throw new NotImplementedException();
    }
}
