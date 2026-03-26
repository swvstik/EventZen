using EventZen.Budget.Models;

namespace EventZen.Budget.DTOs.Responses;

// -- Generic API envelope - mirrors Node.js { success, message, data } ----------

public record ApiResponse<T>(bool Success, string? Message, T? Data)
{
    public static ApiResponse<T> Ok(T data)                      => new(true,  null,    data);
    public static ApiResponse<T> Ok(string message, T data)      => new(true,  message, data);
    public static ApiResponse<object> Fail(string message)       => new ApiResponse<object>(false, message, null);
}

// -- Budget responses -----------------------------------------------------------

public record BudgetResponse(
    string   Id,
    string   EventId,
    string   OwnerVendorUserId,
    decimal  TotalAllocated,
    string   Currency,
    DateTime CreatedAt
);

public record BudgetSummaryResponse(
    string   EventId,
    decimal  TotalAllocated,
    decimal  TotalSpent,
    decimal  Remaining,
    double   PercentUsed,
    bool     OverspendWarning,   // true when totalSpent > 90% of totalAllocated
    string   Currency
);

// -- Expense responses ----------------------------------------------------------

public record ExpenseResponse(
    string          Id,
    string          BudgetId,
    ExpenseCategory Category,
    string          Description,
    decimal         Amount,
    string?         VendorId,
    DateTime        ExpenseDate,
    string          AddedByUserId,
    DateTime        CreatedAt
);

// -- Financial report -----------------------------------------------------------

public record CategorySubtotal(
    string          Category,
    decimal         Total,
    int             Count
);

public record FinancialReportResponse(
    BudgetSummaryResponse         Summary,
    IReadOnlyList<ExpenseResponse> Expenses,
    IReadOnlyList<CategorySubtotal> ByCategory
);

public record FinancialReportListItemResponse(
    string   EventId,
    string?  EventTitle,
    string?  EventStatus,
    string   OwnerVendorUserId,
    decimal  TotalAllocated,
    decimal  TotalSpent,
    decimal  Remaining,
    double   PercentUsed,
    bool     OverspendWarning,
    string   Currency,
    int      ExpenseCount,
    decimal  PlatformFeeCollected,
    decimal  TicketSubtotalCollected,
    decimal  ChargedTotalCollected,
    int      PaidOrderCount,
    int      PaidTicketCount
);
