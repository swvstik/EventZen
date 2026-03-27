using EventZen.Budget.Models;
using MongoDB.Bson;
using MongoDB.Driver;

namespace EventZen.Budget.Infrastructure.Persistence;

/// <summary>
/// Central access point for all MongoDB collections.
/// IMongoClient is registered as a singleton in DI (thread-safe, connection-pooled).
/// MongoDbContext itself is also singleton - collections are lightweight wrappers.
/// Indexes are created once at startup via EnsureIndexesAsync called from Program.cs.
/// </summary>
public class MongoDbContext
{
    private readonly IMongoDatabase _db;

    public MongoDbContext(IMongoClient client, IConfiguration configuration)
    {
        var databaseName = configuration["MongoDB:DatabaseName"]
            ?? throw new InvalidOperationException("MongoDB:DatabaseName is not configured.");

        _db = client.GetDatabase(databaseName);
    }

    public IMongoCollection<EventBudget> Budgets =>
        _db.GetCollection<EventBudget>("eventBudgets");

    public IMongoCollection<Expense> Expenses =>
        _db.GetCollection<Expense>("expenses");

    /// <summary>
    /// Called once at startup from Program.cs.
    /// Idempotent - safe to call multiple times (MongoDB ignores duplicate index creation).
    /// </summary>
    public async Task EnsureIndexesAsync()
    {
        // Unique index on eventId - enforces one budget per event (409 on duplicate)
        await Budgets.Indexes.CreateOneAsync(
            new CreateIndexModel<EventBudget>(
                Builders<EventBudget>.IndexKeys.Ascending(b => b.EventId),
                new CreateIndexOptions { Unique = true, Name = "unique_eventId" }
            )
        );

        // Index ownerVendorUserId for vendor-scoped report queries
        await Budgets.Indexes.CreateOneAsync(
            new CreateIndexModel<EventBudget>(
                Builders<EventBudget>.IndexKeys.Ascending(b => b.OwnerVendorUserId),
                new CreateIndexOptions { Name = "idx_ownerVendorUserId" }
            )
        );

        // Index on budgetId for fast expense lookups
        await Expenses.Indexes.CreateOneAsync(
            new CreateIndexModel<Expense>(
                Builders<Expense>.IndexKeys.Ascending(e => e.BudgetId),
                new CreateIndexOptions { Name = "idx_budgetId" }
            )
        );

        // Unique allocation key for auto-generated venue expenses.
        await Expenses.Indexes.CreateOneAsync(
            new CreateIndexModel<Expense>(
                Builders<Expense>.IndexKeys
                    .Ascending(e => e.BudgetId)
                    .Ascending(e => e.Category)
                    .Ascending(e => e.SourceBookingId),
                new CreateIndexOptions<Expense>
                {
                    Name = "uq_budget_category_sourceBooking",
                    Unique = true,
                    PartialFilterExpression = Builders<Expense>.Filter.And(
                        Builders<Expense>.Filter.Exists(e => e.SourceBookingId, true),
                        Builders<Expense>.Filter.Type(e => e.SourceBookingId, BsonType.String)
                    )
                }
            )
        );
    }
}
