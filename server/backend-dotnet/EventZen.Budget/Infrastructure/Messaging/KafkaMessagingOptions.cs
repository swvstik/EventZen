namespace EventZen.Budget.Infrastructure.Messaging;

public class KafkaMessagingOptions
{
    public bool Enabled { get; set; } = true;
    public string BootstrapServers { get; set; } = "localhost:9094";
    public string ClientId { get; set; } = "eventzen-dotnet-budget";
    public string EventLifecycleTopic { get; set; } = "eventzen.event.lifecycle";
    public string PaymentTopic { get; set; } = "eventzen.payment.lifecycle";
    public string RegistrationTopic { get; set; } = "eventzen.registration.lifecycle";
    public string VenueBookingsTopic { get; set; } = "eventzen.venue.bookings";
}
