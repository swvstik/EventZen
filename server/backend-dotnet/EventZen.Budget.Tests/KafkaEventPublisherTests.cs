using EventZen.Budget.Infrastructure.Messaging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace EventZen.Budget.Tests;

public class KafkaEventPublisherTests
{
    [Fact]
    public async Task PublishAsync_ShouldNoOp_WhenKafkaDisabled()
    {
        var options = Options.Create(new KafkaMessagingOptions
        {
            Enabled = false,
            BootstrapServers = "localhost:9094",
            ClientId = "test-client"
        });
        var runtimeState = new KafkaRuntimeState();

        var publisher = new KafkaEventPublisher(options, NullLogger<KafkaEventPublisher>.Instance, runtimeState);

        var ex = await Record.ExceptionAsync(async () =>
            await publisher.PublishAsync("eventzen.test", "k-1", new { ok = true }));

        Assert.Null(ex);
    }
}
