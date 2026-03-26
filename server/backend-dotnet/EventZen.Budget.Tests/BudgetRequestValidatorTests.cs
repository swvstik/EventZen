using EventZen.Budget.DTOs.Requests;
using EventZen.Budget.Models;
using Xunit;

namespace EventZen.Budget.Tests;

public class BudgetRequestValidatorTests
{
    [Fact]
    public void CreateBudgetRequest_ShouldFail_WhenAllocatedIsNotPositive()
    {
        var validator = new CreateBudgetRequestValidator();
        var result = validator.Validate(new CreateBudgetRequest(0, "INR"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage.Contains("greater than 0"));
    }

    [Fact]
    public void CreateBudgetRequest_ShouldPass_WhenPayloadIsValid()
    {
        var validator = new CreateBudgetRequestValidator();
        var result = validator.Validate(new CreateBudgetRequest(1000, "INR"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void CreateBudgetRequest_ShouldFail_WhenCurrencyIsNotUppercaseIso()
    {
        var validator = new CreateBudgetRequestValidator();
        var result = validator.Validate(new CreateBudgetRequest(1000, "usd"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage.Contains("uppercase ISO format"));
    }

    [Fact]
    public void UpdateBudgetRequest_ShouldFail_WhenCurrencyIsNotUppercaseIso()
    {
        var validator = new UpdateBudgetRequestValidator();
        var result = validator.Validate(new UpdateBudgetRequest(null, "Usd"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage.Contains("uppercase ISO format"));
    }

    [Fact]
    public void CreateExpenseRequest_ShouldFail_WhenExpenseDateIsInFuture()
    {
        var validator = new CreateExpenseRequestValidator();
        var request = new CreateExpenseRequest(
            ExpenseCategory.MARKETING,
            "Future expense",
            1200,
            null,
            DateTime.UtcNow.AddHours(1)
        );

        var result = validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage.Contains("cannot be in the future"));
    }

    [Fact]
    public void UpdateExpenseRequest_ShouldFail_WhenExpenseDateIsInFuture()
    {
        var validator = new UpdateExpenseRequestValidator();
        var request = new UpdateExpenseRequest(
            ExpenseCategory.MARKETING,
            "Updated future expense",
            500,
            null,
            DateTime.UtcNow.AddHours(1)
        );

        var result = validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage.Contains("cannot be in the future"));
    }
}
