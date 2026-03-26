using System.Net;
using System.Text.Json;
using EventZen.Budget.Infrastructure.Middleware;

namespace EventZen.Budget.Services;

public interface IEventOwnershipService
{
    Task<EventOwnershipInfo> GetEventOwnershipAsync(string eventId, CancellationToken ct = default);
    Task<EventOwnershipInfo?> TryGetEventOwnershipAsync(string eventId, CancellationToken ct = default);
}

public record EventOwnershipInfo(
    string EventId,
    string VendorUserId,
    string? EventTitle,
    string? EventStatus
);

public class EventOwnershipService : IEventOwnershipService
{
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public EventOwnershipService(HttpClient http)
    {
        _http = http;
    }

    public async Task<EventOwnershipInfo> GetEventOwnershipAsync(string eventId, CancellationToken ct = default)
    {
        var info = await TryGetEventOwnershipAsync(eventId, ct);
        return info ?? throw new NotFoundException($"Event {eventId} not found in event service.");
    }

    public async Task<EventOwnershipInfo?> TryGetEventOwnershipAsync(string eventId, CancellationToken ct = default)
    {
        using var response = await _http.GetAsync($"/api/internal/events/{eventId}/ownership", ct);

        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;

        if (!response.IsSuccessStatusCode)
            throw new BadRequestException(
                $"Could not verify event ownership from event service. Status {(int)response.StatusCode}.");

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        var envelope = await JsonSerializer.DeserializeAsync<EventEnvelope>(stream, JsonOptions, ct);
        var payload = envelope?.Data;

        if (payload?.EventId is null || string.IsNullOrWhiteSpace(payload.VendorUserId))
            throw new BadRequestException("Event service response missing vendor ownership data.");

        return new EventOwnershipInfo(
            EventId: payload.EventId.Value.ToString(),
            VendorUserId: payload.VendorUserId,
            EventTitle: payload.Title,
            EventStatus: payload.Status
        );
    }

    private sealed class EventEnvelope
    {
        public EventPayload? Data { get; set; }
    }

    private sealed class EventPayload
    {
        public long? EventId { get; set; }
        public string? VendorUserId { get; set; }
        public string? Title { get; set; }
        public string? Status { get; set; }
    }
}
