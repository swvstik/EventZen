using System.Text.Json.Serialization;

namespace EventZen.Budget.Infrastructure.Messaging;

public class VenueBookingCreatedEvent
{
    [JsonPropertyName("eventType")]
    public string EventType { get; set; } = string.Empty;

    [JsonPropertyName("venueBookingId")]
    public string VenueBookingId { get; set; } = string.Empty;

    [JsonPropertyName("venueId")]
    public string VenueId { get; set; } = string.Empty;

    [JsonPropertyName("eventId")]
    public string EventId { get; set; } = string.Empty;

    [JsonPropertyName("vendorUserId")]
    public string VendorUserId { get; set; } = string.Empty;

    [JsonPropertyName("totalVenueCost")]
    public decimal TotalVenueCost { get; set; }

    [JsonPropertyName("venueDailyRate")]
    public decimal VenueDailyRate { get; set; }

    [JsonPropertyName("bookingDays")]
    public int BookingDays { get; set; }

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = "INR";

    [JsonPropertyName("startTime")]
    public DateTime StartTime { get; set; }

    [JsonPropertyName("endTime")]
    public DateTime EndTime { get; set; }

    [JsonPropertyName("bookedAt")]
    public DateTime? BookedAt { get; set; }

    [JsonPropertyName("cancelledAt")]
    public DateTime? CancelledAt { get; set; }
}
