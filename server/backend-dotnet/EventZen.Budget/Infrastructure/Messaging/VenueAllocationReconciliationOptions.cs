namespace EventZen.Budget.Infrastructure.Messaging;

public class VenueAllocationReconciliationOptions
{
    public bool Enabled { get; set; } = true;
    public int IntervalMinutes { get; set; } = 30;
}
