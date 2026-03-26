using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EventZen.Budget.Infrastructure.Middleware;

namespace EventZen.Budget.Services;

public interface IPaymentMetricsService
{
    Task<IReadOnlyDictionary<string, PlatformFeeMetrics>> GetPlatformFeeTotalsByEventAsync(
        IReadOnlyCollection<string> eventIds,
        CancellationToken ct = default);
}

public record PlatformFeeMetrics(
    decimal PlatformFeeCollected,
    decimal TicketSubtotalCollected,
    decimal ChargedTotalCollected,
    int PaidOrderCount,
    int PaidTicketCount
)
{
    public static PlatformFeeMetrics Zero { get; } = new(0m, 0m, 0m, 0, 0);
}

public class PaymentMetricsService : IPaymentMetricsService
{
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public PaymentMetricsService(HttpClient http)
    {
        _http = http;
    }

    public async Task<IReadOnlyDictionary<string, PlatformFeeMetrics>> GetPlatformFeeTotalsByEventAsync(
        IReadOnlyCollection<string> eventIds,
        CancellationToken ct = default)
    {
        var normalizedEventIds = eventIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        if (normalizedEventIds.Length == 0)
            return new Dictionary<string, PlatformFeeMetrics>(StringComparer.Ordinal);

        using var response = await _http.PostAsJsonAsync(
            "/api/internal/payments/platform-fee-aggregates",
            new { eventIds = normalizedEventIds },
            ct);

        if (response.StatusCode == HttpStatusCode.NotFound)
            return new Dictionary<string, PlatformFeeMetrics>(StringComparer.Ordinal);

        if (!response.IsSuccessStatusCode)
            throw new BadRequestException(
                $"Could not fetch payment aggregates from node service. Status {(int)response.StatusCode}.");

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        var envelope = await JsonSerializer.DeserializeAsync<PaymentAggregateEnvelope>(stream, JsonOptions, ct);
        var rows = envelope?.Data ?? [];

        var result = new Dictionary<string, PlatformFeeMetrics>(StringComparer.Ordinal);

        foreach (var row in rows)
        {
            if (row is null) continue;

            var eventId = row.EventId?.Trim();
            if (string.IsNullOrWhiteSpace(eventId)) continue;

            var platformFee = MinorToMajor(row.PlatformFeeMinor);
            var subtotal = MinorToMajor(row.SubtotalMinor);
            var chargedTotal = MinorToMajor(row.ChargedMinor);

            result[eventId] = new PlatformFeeMetrics(
                PlatformFeeCollected: platformFee,
                TicketSubtotalCollected: subtotal,
                ChargedTotalCollected: chargedTotal,
                PaidOrderCount: row.PaidOrderCount,
                PaidTicketCount: row.PaidTicketCount
            );
        }

        return result;
    }

    private static decimal MinorToMajor(long minor) => minor / 100m;

    private sealed class PaymentAggregateEnvelope
    {
        public List<PaymentAggregateRow>? Data { get; set; }
    }

    private sealed class PaymentAggregateRow
    {
        public string? EventId { get; set; }
        public long SubtotalMinor { get; set; }
        public long PlatformFeeMinor { get; set; }
        public long ChargedMinor { get; set; }
        public int PaidOrderCount { get; set; }
        public int PaidTicketCount { get; set; }
    }
}
