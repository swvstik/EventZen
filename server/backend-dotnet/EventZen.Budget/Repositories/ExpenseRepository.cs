using EventZen.Budget.Infrastructure.Persistence;
using EventZen.Budget.Models;
using MongoDB.Driver;

namespace EventZen.Budget.Repositories;

public interface IExpenseRepository
{
    Task<List<Expense>> FindByBudgetIdAsync(string budgetId,  CancellationToken ct = default);
    Task<List<Expense>> FindByBudgetIdsAsync(IReadOnlyCollection<string> budgetIds, CancellationToken ct = default);
    Task<Expense?>      FindByIdAsync(string id,              CancellationToken ct = default);
    Task<Expense>       CreateAsync(Expense expense,          CancellationToken ct = default);
    Task<Expense?>      UpdateAsync(string id, UpdateDefinition<Expense> update, CancellationToken ct = default);
    Task<bool>          DeleteAsync(string id,                CancellationToken ct = default);
}

public class ExpenseRepository : IExpenseRepository
{
    private readonly MongoDbContext _ctx;

    public ExpenseRepository(MongoDbContext ctx) => _ctx = ctx;

    public async Task<List<Expense>> FindByBudgetIdAsync(string budgetId, CancellationToken ct = default)
        => await _ctx.Expenses
            .Find(e => e.BudgetId == budgetId)
            .SortByDescending(e => e.ExpenseDate)
            .ToListAsync(ct);

    public async Task<List<Expense>> FindByBudgetIdsAsync(IReadOnlyCollection<string> budgetIds, CancellationToken ct = default)
    {
        if (budgetIds.Count == 0) return [];

        var filter = Builders<Expense>.Filter.In(e => e.BudgetId, budgetIds);
        return await _ctx.Expenses
            .Find(filter)
            .SortByDescending(e => e.ExpenseDate)
            .ToListAsync(ct);
    }

    public async Task<Expense?> FindByIdAsync(string id, CancellationToken ct = default)
        => await _ctx.Expenses.Find(e => e.Id == id).FirstOrDefaultAsync(ct);

    public async Task<Expense> CreateAsync(Expense expense, CancellationToken ct = default)
    {
        await _ctx.Expenses.InsertOneAsync(expense, cancellationToken: ct);
        return expense;
    }

    public async Task<Expense?> UpdateAsync(
        string id,
        UpdateDefinition<Expense> update,
        CancellationToken ct = default)
    {
        return await _ctx.Expenses.FindOneAndUpdateAsync(
            e => e.Id == id,
            update,
            new FindOneAndUpdateOptions<Expense> { ReturnDocument = ReturnDocument.After },
            ct);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken ct = default)
    {
        var result = await _ctx.Expenses.DeleteOneAsync(e => e.Id == id, ct);
        return result.DeletedCount > 0;
    }
}
