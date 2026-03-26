using System.Collections.Concurrent;

namespace EventZen.Budget.Infrastructure.Messaging;

public class KafkaRuntimeState
{
    private readonly ConcurrentDictionary<string, bool> _consumerConnections = new();

    public bool ProducerConnected { get; private set; }
    public DateTimeOffset? LastPublishAtUtc { get; private set; }
    public string? LastPublishTopic { get; private set; }
    public string? LastError { get; private set; }

    public void MarkProducerConnected()
    {
        ProducerConnected = true;
        LastError = null;
    }

    public void MarkPublishSuccess(string topic)
    {
        ProducerConnected = true;
        LastPublishTopic = topic;
        LastPublishAtUtc = DateTimeOffset.UtcNow;
        LastError = null;
    }

    public void MarkPublishError(string reason)
    {
        ProducerConnected = false;
        LastError = reason;
    }

    public void MarkConsumerConnected(string topic)
    {
        _consumerConnections[topic] = true;
        LastError = null;
    }

    public void MarkConsumerError(string topic, string reason)
    {
        _consumerConnections[topic] = false;
        LastError = $"{topic}: {reason}";
    }

    public object ToHealthPayload()
    {
        return new
        {
            producerConnected = ProducerConnected,
            consumerConnections = _consumerConnections,
            lastPublishAtUtc = LastPublishAtUtc,
            lastPublishTopic = LastPublishTopic,
            lastError = LastError,
        };
    }
}
