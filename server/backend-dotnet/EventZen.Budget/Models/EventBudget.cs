using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace EventZen.Budget.Models;

/// <summary>
/// One budget document per event.
/// eventId is a unique index - enforces one budget per event (409 if duplicate).
/// </summary>
public class EventBudget
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    /// <summary>MySQL events.id stored as string - cross-service reference, no FK.</summary>
    [BsonElement("eventId")]
    public string EventId { get; set; } = null!;

    [BsonElement("totalAllocated")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal TotalAllocated { get; set; }

    [BsonElement("currency")]
    public string Currency { get; set; } = "INR";

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("createdByUserId")]
    public string CreatedByUserId { get; set; } = null!;

    [BsonElement("ownerVendorUserId")]
    public string OwnerVendorUserId { get; set; } = null!;
}
