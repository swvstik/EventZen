using System.Text.Json;
using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Microsoft.Extensions.Options;
using EventZen.Budget.Services;
using System.Linq;

namespace EventZen.Budget.Infrastructure.Messaging;

public class KafkaLifecycleConsumerService : BackgroundService
{
    private readonly KafkaMessagingOptions _options;
    private readonly ILogger<KafkaLifecycleConsumerService> _logger;
    private readonly KafkaRuntimeState _runtimeState;
    private readonly IServiceScopeFactory _scopeFactory;

    public KafkaLifecycleConsumerService(
        IOptions<KafkaMessagingOptions> options,
        ILogger<KafkaLifecycleConsumerService> logger,
        KafkaRuntimeState runtimeState,
        IServiceScopeFactory scopeFactory)
    {
        _options = options.Value;
        _logger = logger;
        _runtimeState = runtimeState;
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("Kafka lifecycle consumer is disabled.");
            return;
        }

        var config = new ConsumerConfig
        {
            BootstrapServers = _options.BootstrapServers,
            GroupId = "eventzen-dotnet-budget-lifecycle-v1",
            AutoOffsetReset = AutoOffsetReset.Latest,
            EnableAutoCommit = true,
        };

        await EnsureTopicsAsync(stoppingToken);

        using var consumer = new ConsumerBuilder<string, string>(config).Build();
        consumer.Subscribe(new[] { _options.PaymentTopic, _options.RegistrationTopic, _options.VenueBookingsTopic });
        _runtimeState.MarkConsumerConnected(_options.PaymentTopic);
        _runtimeState.MarkConsumerConnected(_options.RegistrationTopic);
        _runtimeState.MarkConsumerConnected(_options.VenueBookingsTopic);

        _logger.LogInformation("Kafka lifecycle consumer started for topics: {PaymentTopic}, {RegistrationTopic}, {VenueBookingsTopic}",
            _options.PaymentTopic,
            _options.RegistrationTopic,
            _options.VenueBookingsTopic);

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                ConsumeResult<string, string>? result;
                try
                {
                    result = consumer.Consume(stoppingToken);
                }
                catch (ConsumeException ex)
                {
                    _runtimeState.MarkConsumerError("lifecycle", ex.Error.Reason);
                    _logger.LogWarning(ex, "Kafka consume failed; will retry.");
                    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
                    continue;
                }

                if (result?.Message?.Value is null)
                    continue;

                try
                {
                    using var _ = JsonDocument.Parse(result.Message.Value);
                }
                catch
                {
                    _logger.LogWarning("Received non-JSON Kafka message on topic {Topic}.", result.Topic);
                    continue;
                }

                if (string.Equals(result.Topic, _options.VenueBookingsTopic, StringComparison.Ordinal))
                {
                    await HandleVenueBookingLifecycleAsync(result.Message.Value, stoppingToken);
                }

                _logger.LogDebug("Kafka lifecycle message consumed on {Topic} with key {Key}",
                    result.Topic,
                    result.Message.Key ?? string.Empty);
            }
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown
        }
        catch (Exception ex)
        {
            _runtimeState.MarkConsumerError("lifecycle", ex.Message);
            _logger.LogWarning(ex, "Kafka lifecycle consumer stopped due to an error.");
        }
        finally
        {
            consumer.Close();
            await Task.CompletedTask;
        }
    }

    private async Task EnsureTopicsAsync(CancellationToken ct)
    {
        try
        {
            var adminConfig = new AdminClientConfig
            {
                BootstrapServers = _options.BootstrapServers,
            };

            using var admin = new AdminClientBuilder(adminConfig).Build();
            var topics = new[]
            {
                _options.PaymentTopic,
                _options.RegistrationTopic,
                _options.VenueBookingsTopic,
            }
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Distinct(StringComparer.Ordinal)
            .Select(t => new TopicSpecification
            {
                Name = t,
                NumPartitions = 1,
                ReplicationFactor = 1,
            })
            .ToList();

            if (topics.Count == 0)
                return;

            await admin.CreateTopicsAsync(topics, new CreateTopicsOptions { RequestTimeout = TimeSpan.FromSeconds(10) });
            _logger.LogInformation("Kafka lifecycle topics ensured: {Topics}", string.Join(", ", topics.Select(t => t.Name)));
        }
        catch (CreateTopicsException ex)
        {
            var nonIgnorable = ex.Results.Any(r =>
                r.Error.Code != ErrorCode.TopicAlreadyExists &&
                r.Error.Code != ErrorCode.NoError);

            if (nonIgnorable)
            {
                _logger.LogWarning(ex, "Kafka topic ensure failed for one or more topics.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Kafka topic ensure skipped due to admin client failure.");
        }
    }

    private async Task HandleVenueBookingLifecycleAsync(string payload, CancellationToken ct)
    {
        VenueBookingCreatedEvent? evt;
        try
        {
            evt = JsonSerializer.Deserialize<VenueBookingCreatedEvent>(payload, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            });
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Invalid venue booking payload received.");
            return;
        }

        if (evt is null ||
            string.IsNullOrWhiteSpace(evt.EventId) ||
            string.IsNullOrWhiteSpace(evt.VenueBookingId))
        {
            return;
        }

        using var scope = _scopeFactory.CreateScope();
        var budgetService = scope.ServiceProvider.GetRequiredService<IBudgetService>();

        if (string.Equals(evt.EventType, "VENUE_BOOKING_CANCELLED", StringComparison.OrdinalIgnoreCase))
        {
            var removed = await budgetService.RemoveAutoAllocatedVenueExpenseAsync(
                evt.EventId,
                evt.VenueBookingId,
                ct
            );

            if (removed)
            {
                _logger.LogInformation(
                    "Removed auto-allocated venue expense for event {EventId} from cancelled booking {VenueBookingId}.",
                    evt.EventId,
                    evt.VenueBookingId);
            }
            return;
        }

        if (!string.Equals(evt.EventType, "VENUE_BOOKING_CREATED", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var expenseDateUtc = (evt.BookedAt ?? evt.StartTime).ToUniversalTime();

        var created = await budgetService.TryAutoAllocateVenueExpenseAsync(
            evt.EventId,
            evt.VenueBookingId,
            evt.TotalVenueCost,
            evt.VenueDailyRate,
            evt.BookingDays,
            evt.Currency,
            evt.VendorUserId,
            expenseDateUtc,
            ct
        );

        if (created)
        {
            _logger.LogInformation(
                "Auto-allocated venue expense for event {EventId} from booking {VenueBookingId}.",
                evt.EventId,
                evt.VenueBookingId);
        }
    }
}
