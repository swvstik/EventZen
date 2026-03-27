using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace EventZen.Budget.Models;

public enum ExpenseCategory
{
    VENUE, CATERING, MARKETING, STAFF, AV_EQUIPMENT, DECORATION, TRANSPORT, MISCELLANEOUS
}

/// <summary>
/// Individual expense line item linked to a budget.
/// </summary>
public class Expense
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    /// <summary>References EventBudget._id as string.</summary>
    [BsonElement("budgetId")]
    public string BudgetId { get; set; } = null!;

    [BsonElement("category")]
    [BsonRepresentation(BsonType.String)]
    public ExpenseCategory Category { get; set; }

    [BsonElement("description")]
    public string Description { get; set; } = null!;

    [BsonElement("amount")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Amount { get; set; }

    /// <summary>Optional - MySQL vendors.id as string. Cross-service reference.</summary>
    [BsonElement("vendorId")]
    public string? VendorId { get; set; }

    [BsonElement("expenseDate")]
    public DateTime ExpenseDate { get; set; }

    /// <summary>User ID from JWT - who added this expense.</summary>
    [BsonElement("addedByUserId")]
    public string AddedByUserId { get; set; } = null!;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("isAutoAllocated")]
    public bool IsAutoAllocated { get; set; }

    [BsonElement("allocationSource")]
    public string? AllocationSource { get; set; }

    [BsonElement("sourceBookingId")]
    public string? SourceBookingId { get; set; }

    [BsonElement("allocationTimestamp")]
    public DateTime? AllocationTimestamp { get; set; }
}
