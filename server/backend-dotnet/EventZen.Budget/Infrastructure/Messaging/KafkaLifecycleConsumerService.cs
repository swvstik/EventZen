using System.Text.Json;
using Confluent.Kafka;
using Microsoft.Extensions.Options;

namespace EventZen.Budget.Infrastructure.Messaging;

public class KafkaLifecycleConsumerService : BackgroundService
{
    private readonly KafkaMessagingOptions _options;
    private readonly ILogger<KafkaLifecycleConsumerService> _logger;
    private readonly KafkaRuntimeState _runtimeState;

    public KafkaLifecycleConsumerService(
        IOptions<KafkaMessagingOptions> options,
        ILogger<KafkaLifecycleConsumerService> logger,
        KafkaRuntimeState runtimeState)
    {
        _options = options.Value;
        _logger = logger;
        _runtimeState = runtimeState;
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

        using var consumer = new ConsumerBuilder<string, string>(config).Build();
        consumer.Subscribe(new[] { _options.PaymentTopic, _options.RegistrationTopic });
        _runtimeState.MarkConsumerConnected(_options.PaymentTopic);
        _runtimeState.MarkConsumerConnected(_options.RegistrationTopic);

        _logger.LogInformation("Kafka lifecycle consumer started for topics: {PaymentTopic}, {RegistrationTopic}",
            _options.PaymentTopic,
            _options.RegistrationTopic);

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var result = consumer.Consume(stoppingToken);
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
}
