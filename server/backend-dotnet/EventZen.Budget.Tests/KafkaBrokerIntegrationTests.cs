using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Xunit;

namespace EventZen.Budget.Tests;

public class KafkaBrokerIntegrationTests
{
    [Fact]
    public async Task PublishAndConsumeThroughBroker()
    {
        var runIntegration = Environment.GetEnvironmentVariable("RUN_KAFKA_INTEGRATION");
        if (!string.Equals(runIntegration, "true", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var bootstrapServers = Environment.GetEnvironmentVariable("KAFKA_BOOTSTRAP_SERVERS") ?? "localhost:9094";
        var topic = $"eventzen.dotnet.integration.{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

        var adminConfig = new AdminClientConfig
        {
            BootstrapServers = bootstrapServers,
        };

        using (var admin = new AdminClientBuilder(adminConfig).Build())
        {
            await admin.CreateTopicsAsync(new[]
            {
                new TopicSpecification
                {
                    Name = topic,
                    NumPartitions = 1,
                    ReplicationFactor = 1,
                }
            });
        }

        var consumerConfig = new ConsumerConfig
        {
            BootstrapServers = bootstrapServers,
            GroupId = $"eventzen-dotnet-it-{Guid.NewGuid():N}",
            AutoOffsetReset = AutoOffsetReset.Earliest,
        };

        var producerConfig = new ProducerConfig
        {
            BootstrapServers = bootstrapServers,
        };

        using var consumer = new ConsumerBuilder<string, string>(consumerConfig).Build();
        using var producer = new ProducerBuilder<string, string>(producerConfig).Build();

        consumer.Subscribe(topic);
        consumer.Consume(TimeSpan.FromMilliseconds(250));

        await producer.ProduceAsync(topic, new Message<string, string>
        {
            Key = "dotnet-it-key",
            Value = "dotnet-it-value",
        });

        ConsumeResult<string, string>? found = null;
        var deadline = DateTimeOffset.UtcNow.AddSeconds(10);

        while (DateTimeOffset.UtcNow < deadline && found is null)
        {
            var record = consumer.Consume(TimeSpan.FromMilliseconds(500));
            if (record?.Message?.Key == "dotnet-it-key")
            {
                found = record;
            }
        }

        Assert.NotNull(found);
        Assert.Equal("dotnet-it-value", found!.Message.Value);
    }
}
