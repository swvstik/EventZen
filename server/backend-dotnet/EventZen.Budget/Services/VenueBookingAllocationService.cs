using System.Net;
using System.Text.Json;
using EventZen.Budget.Infrastructure.Middleware;

namespace EventZen.Budget.Services;

public interface IVenueBookingAllocationService
{
    Task<VenueBookingAllocationInfo?> TryGetLatestConfirmedAsync(string eventId, CancellationToken ct = default);
}

public record VenueBookingAllocationInfo(
    string VenueBookingId,
    string EventId,
    string VenueId,
    string VendorUserId,
    decimal VenueDailyRate,
    int BookingDays,
    decimal TotalVenueCost,
    string Currency,
    DateTime StartTime,
    DateTime EndTime,
    DateTime? BookedAt
);

public class VenueBookingAllocationService : IVenueBookingAllocationService
{
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public VenueBookingAllocationService(HttpClient http)
    {
        _http = http;
    }

    public async Task<VenueBookingAllocationInfo?> TryGetLatestConfirmedAsync(string eventId, CancellationToken ct = default)
    {
        using var response = await _http.GetAsync($"/api/internal/venue-bookings/events/{eventId}/latest-confirmed", ct);

        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;

        if (!response.IsSuccessStatusCode)
            throw new BadRequestException(
                $"Could not read venue booking allocation from event service. Status {(int)response.StatusCode}.");

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        var envelope = await JsonSerializer.DeserializeAsync<VenueBookingEnvelope>(stream, JsonOptions, ct);
        var data = envelope?.Data;

        if (data?.VenueBookingId is null || data.EventId is null)
            throw new BadRequestException("Event service response missing venue booking allocation data.");

        return new VenueBookingAllocationInfo(
            VenueBookingId: data.VenueBookingId.Value.ToString(),
            EventId: data.EventId.Value.ToString(),
            VenueId: data.VenueId?.ToString() ?? string.Empty,
            VendorUserId: data.VendorUserId ?? string.Empty,
            VenueDailyRate: data.VenueDailyRate ?? 0m,
            BookingDays: data.BookingDays ?? 0,
            TotalVenueCost: data.TotalVenueCost ?? 0m,
            Currency: data.Currency ?? "INR",
            StartTime: data.StartTime ?? DateTime.UtcNow,
            EndTime: data.EndTime ?? DateTime.UtcNow,
            BookedAt: data.BookedAt
        );
    }

    private sealed class VenueBookingEnvelope
    {
        public VenueBookingPayload? Data { get; set; }
    }

    private sealed class VenueBookingPayload
    {
        public long? VenueBookingId { get; set; }
        public long? EventId { get; set; }
        public long? VenueId { get; set; }
        public string? VendorUserId { get; set; }
        public decimal? VenueDailyRate { get; set; }
        public int? BookingDays { get; set; }
        public decimal? TotalVenueCost { get; set; }
        public string? Currency { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public DateTime? BookedAt { get; set; }
    }
}
