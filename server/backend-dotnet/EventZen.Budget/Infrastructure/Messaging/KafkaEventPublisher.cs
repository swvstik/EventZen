using System.Text.Json;
using Confluent.Kafka;
using Microsoft.Extensions.Options;

namespace EventZen.Budget.Infrastructure.Messaging;

public interface IKafkaEventPublisher
{
    Task PublishAsync(string topic, string key, object payload, CancellationToken ct = default);
}

public class KafkaEventPublisher : IKafkaEventPublisher, IDisposable
{
    private readonly KafkaMessagingOptions _options;
    private readonly ILogger<KafkaEventPublisher> _logger;
    private readonly KafkaRuntimeState _runtimeState;
    private readonly IProducer<string, string>? _producer;

    public KafkaEventPublisher(
        IOptions<KafkaMessagingOptions> options,
        ILogger<KafkaEventPublisher> logger,
        KafkaRuntimeState runtimeState)
    {
        _options = options.Value;
        _logger = logger;
        _runtimeState = runtimeState;

        if (!_options.Enabled)
            return;

        var config = new ProducerConfig
        {
            BootstrapServers = _options.BootstrapServers,
            ClientId = _options.ClientId,
            Acks = Acks.All,
            EnableIdempotence = true,
        };

        _producer = new ProducerBuilder<string, string>(config).Build();
        _runtimeState.MarkProducerConnected();
    }

    public async Task PublishAsync(string topic, string key, object payload, CancellationToken ct = default)
    {
        if (!_options.Enabled || _producer is null)
            return;

        var message = JsonSerializer.Serialize(payload);

        try
        {
            await _producer.ProduceAsync(
                topic,
                new Message<string, string> { Key = key, Value = message },
                ct);
            _runtimeState.MarkPublishSuccess(topic);
        }
        catch (ProduceException<string, string> ex)
        {
            _runtimeState.MarkPublishError(ex.Error.Reason);
            _logger.LogWarning(ex, "Kafka publish failed for topic {Topic}: {Reason}", topic, ex.Error.Reason);
        }
    }

    public void Dispose()
    {
        _producer?.Flush(TimeSpan.FromSeconds(2));
        _producer?.Dispose();
    }
}
