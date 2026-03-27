using EventZen.Budget.Repositories;
using EventZen.Budget.Services;
using Microsoft.Extensions.Options;

namespace EventZen.Budget.Infrastructure.Messaging;

public class VenueAllocationReconciliationService : BackgroundService
{
    private readonly VenueAllocationReconciliationOptions _options;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<VenueAllocationReconciliationService> _logger;

    public VenueAllocationReconciliationService(
        IOptions<VenueAllocationReconciliationOptions> options,
        IServiceScopeFactory scopeFactory,
        ILogger<VenueAllocationReconciliationService> logger)
    {
        _options = options.Value;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("Venue allocation reconciliation worker is disabled.");
            return;
        }

        var intervalMinutes = Math.Max(5, _options.IntervalMinutes);
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(intervalMinutes));

        _logger.LogInformation("Venue allocation reconciliation worker started. Interval: {Minutes} minute(s).", intervalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Venue allocation reconciliation cycle failed.");
            }

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken))
                    break;
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var budgets = scope.ServiceProvider.GetRequiredService<IBudgetRepository>();
        var budgetService = scope.ServiceProvider.GetRequiredService<IBudgetService>();

        var rows = await budgets.ListAllAsync(ct);
        if (rows.Count == 0)
            return;

        foreach (var budget in rows)
        {
            if (ct.IsCancellationRequested)
                return;

            try
            {
                var result = await budgetService.ReconcileVenueAllocationAsync(
                    budget.EventId,
                    userId: "system:reconciliation",
                    role: "ADMIN",
                    ct: ct);

                if (result.ExpenseCreated)
                {
                    _logger.LogInformation(
                        "Reconciliation created venue allocation for event {EventId} from booking {BookingId}.",
                        result.EventId,
                        result.SourceBookingId ?? "unknown");
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to reconcile venue allocation for event {EventId}.", budget.EventId);
            }
        }
    }
}
