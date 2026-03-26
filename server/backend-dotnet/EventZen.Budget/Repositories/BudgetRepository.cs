using EventZen.Budget.Infrastructure.Persistence;
using EventZen.Budget.Models;
using MongoDB.Driver;

namespace EventZen.Budget.Repositories;

public interface IBudgetRepository
{
    Task<EventBudget?> FindByIdAsync(string id, CancellationToken ct = default);
    Task<EventBudget?> FindByEventIdAsync(string eventId, CancellationToken ct = default);
    Task<List<EventBudget>> ListAllAsync(CancellationToken ct = default);
    Task<List<EventBudget>> ListByOwnerVendorUserIdAsync(string ownerVendorUserId, CancellationToken ct = default);
    Task<EventBudget>  CreateAsync(EventBudget budget,    CancellationToken ct = default);
    Task<EventBudget?> UpdateAsync(string eventId, UpdateDefinition<EventBudget> update, CancellationToken ct = default);
}

public class BudgetRepository : IBudgetRepository
{
    private readonly MongoDbContext _ctx;

    public BudgetRepository(MongoDbContext ctx) => _ctx = ctx;

    public async Task<EventBudget?> FindByIdAsync(string id, CancellationToken ct = default)
        => await _ctx.Budgets
            .Find(b => b.Id == id)
            .FirstOrDefaultAsync(ct);

    public async Task<EventBudget?> FindByEventIdAsync(string eventId, CancellationToken ct = default)
        => await _ctx.Budgets
            .Find(b => b.EventId == eventId)
            .FirstOrDefaultAsync(ct);

    public async Task<List<EventBudget>> ListAllAsync(CancellationToken ct = default)
        => await _ctx.Budgets
            .Find(Builders<EventBudget>.Filter.Empty)
            .SortByDescending(b => b.CreatedAt)
            .ToListAsync(ct);

    public async Task<List<EventBudget>> ListByOwnerVendorUserIdAsync(
        string ownerVendorUserId,
        CancellationToken ct = default)
        => await _ctx.Budgets
            .Find(b => b.OwnerVendorUserId == ownerVendorUserId)
            .SortByDescending(b => b.CreatedAt)
            .ToListAsync(ct);

    public async Task<EventBudget> CreateAsync(EventBudget budget, CancellationToken ct = default)
    {
        await _ctx.Budgets.InsertOneAsync(budget, cancellationToken: ct);
        return budget;
    }

    public async Task<EventBudget?> UpdateAsync(
        string eventId,
        UpdateDefinition<EventBudget> update,
        CancellationToken ct = default)
    {
        return await _ctx.Budgets.FindOneAndUpdateAsync(
            b => b.EventId == eventId,
            update,
            new FindOneAndUpdateOptions<EventBudget> { ReturnDocument = ReturnDocument.After },
            ct);
    }
}
