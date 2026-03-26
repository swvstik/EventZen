using EventZen.Budget.Models;
using FluentValidation;

namespace EventZen.Budget.DTOs.Requests;

// -- Budget ---------------------------------------------------------------------

public record CreateBudgetRequest(decimal TotalAllocated, string Currency = "INR");

public class CreateBudgetRequestValidator : AbstractValidator<CreateBudgetRequest>
{
    public CreateBudgetRequestValidator()
    {
        RuleFor(x => x.TotalAllocated)
            .GreaterThan(0).WithMessage("TotalAllocated must be greater than 0.");
        RuleFor(x => x.Currency)
            .NotEmpty()
            .Length(3).WithMessage("Currency must be a 3-letter code (e.g. INR, USD).")
            .Matches("^[A-Z]{3}$").WithMessage("Currency must use uppercase ISO format (e.g. INR, USD).");
    }
}

public record UpdateBudgetRequest(decimal? TotalAllocated, string? Currency);

public class UpdateBudgetRequestValidator : AbstractValidator<UpdateBudgetRequest>
{
    public UpdateBudgetRequestValidator()
    {
        When(x => x.TotalAllocated.HasValue, () =>
            RuleFor(x => x.TotalAllocated!.Value)
                .GreaterThan(0).WithMessage("TotalAllocated must be greater than 0."));
        When(x => x.Currency is not null, () =>
            RuleFor(x => x.Currency!)
                .Length(3).WithMessage("Currency must be a 3-letter code.")
                .Matches("^[A-Z]{3}$").WithMessage("Currency must use uppercase ISO format (e.g. INR, USD)."));
    }
}

// -- Expense --------------------------------------------------------------------

public record CreateExpenseRequest(
    ExpenseCategory Category,
    string          Description,
    decimal         Amount,
    string?         VendorId,
    DateTime        ExpenseDate
);

public class CreateExpenseRequestValidator : AbstractValidator<CreateExpenseRequest>
{
    public CreateExpenseRequestValidator()
    {
        RuleFor(x => x.Description).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be greater than 0.");
        RuleFor(x => x.ExpenseDate)
            .NotEmpty()
            .LessThanOrEqualTo(_ => DateTime.UtcNow.AddMinutes(5))
            .WithMessage("ExpenseDate cannot be in the future.");
    }
}

public record UpdateExpenseRequest(
    ExpenseCategory? Category,
    string?          Description,
    decimal?         Amount,
    string?          VendorId,
    DateTime?        ExpenseDate
);

public class UpdateExpenseRequestValidator : AbstractValidator<UpdateExpenseRequest>
{
    public UpdateExpenseRequestValidator()
    {
        When(x => x.Description is not null, () =>
            RuleFor(x => x.Description!).NotEmpty().MaximumLength(500));
        When(x => x.Amount.HasValue, () =>
            RuleFor(x => x.Amount!.Value).GreaterThan(0));
        When(x => x.ExpenseDate.HasValue, () =>
            RuleFor(x => x.ExpenseDate!.Value)
                .LessThanOrEqualTo(_ => DateTime.UtcNow.AddMinutes(5))
                .WithMessage("ExpenseDate cannot be in the future."));
    }
}
