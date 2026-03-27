using System.Net;
using System.Text;
using EventZen.Budget.Infrastructure.Middleware;
using EventZen.Budget.Services;
using Xunit;

namespace EventZen.Budget.Tests;

public class EventOwnershipServiceTests
{
    [Fact]
    public async Task TryGetEventOwnershipAsync_ReturnsParsedOwnership_WhenServiceReturnsValidPayload()
    {
        using var http = new HttpClient(new FakeHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    "{" +
                    "\"data\":{" +
                    "\"eventId\":101," +
                    "\"vendorUserId\":\"vendor-9\"," +
                    "\"title\":\"Expo Night\"," +
                    "\"status\":\"DRAFT\"" +
                    "}}",
                    Encoding.UTF8,
                    "application/json")
            }))
        {
            BaseAddress = new Uri("http://localhost")
        };

        var service = new EventOwnershipService(http);

        var result = await service.TryGetEventOwnershipAsync("101");

        Assert.NotNull(result);
        Assert.Equal("101", result!.EventId);
        Assert.Equal("vendor-9", result.VendorUserId);
        Assert.Equal("Expo Night", result.EventTitle);
        Assert.Equal("DRAFT", result.EventStatus);
    }

    [Fact]
    public async Task TryGetEventOwnershipAsync_ReturnsNull_WhenServiceReturnsNotFound()
    {
        using var http = new HttpClient(new FakeHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.NotFound)))
        {
            BaseAddress = new Uri("http://localhost")
        };

        var service = new EventOwnershipService(http);

        var result = await service.TryGetEventOwnershipAsync("missing-event");

        Assert.Null(result);
    }

    [Fact]
    public async Task TryGetEventOwnershipAsync_ThrowsBadRequest_WhenPayloadMissingVendor()
    {
        using var http = new HttpClient(new FakeHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    "{\"data\":{\"eventId\":77}}",
                    Encoding.UTF8,
                    "application/json")
            }))
        {
            BaseAddress = new Uri("http://localhost")
        };

        var service = new EventOwnershipService(http);

        var ex = await Assert.ThrowsAsync<BadRequestException>(() => service.TryGetEventOwnershipAsync("77"));
        Assert.Contains("missing vendor ownership data", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    private sealed class FakeHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;

        public FakeHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responder)
        {
            _responder = responder;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(_responder(request));
    }
}
