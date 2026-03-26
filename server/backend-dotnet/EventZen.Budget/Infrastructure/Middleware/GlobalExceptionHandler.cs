using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;

namespace EventZen.Budget.Infrastructure.Middleware;

/// <summary>
/// .NET 8 global exception handler using IExceptionHandler.
/// Registered via app.UseExceptionHandler() in Program.cs.
/// Maps domain exceptions to HTTP responses consistently.
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext context,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (statusCode, message) = exception switch
        {
            NotFoundException e    => (StatusCodes.Status404NotFound,       e.Message),
            ConflictException e    => (StatusCodes.Status409Conflict,        e.Message),
            ForbiddenException e   => (StatusCodes.Status403Forbidden,       e.Message),
            BadRequestException e  => (StatusCodes.Status400BadRequest,      e.Message),
            ValidationException e  => (StatusCodes.Status400BadRequest,      e.Message),
            MongoWriteException e when e.WriteError?.Category == ServerErrorCategory.DuplicateKey
                                => (StatusCodes.Status409Conflict, "A duplicate resource already exists."),
            MongoBulkWriteException e when e.WriteErrors.Any(w => w.Category == ServerErrorCategory.DuplicateKey)
                                => (StatusCodes.Status409Conflict, "A duplicate resource already exists."),
            _                      => (StatusCodes.Status500InternalServerError,
                                       "An unexpected error occurred. Please try again.")
        };

        if (statusCode == StatusCodes.Status500InternalServerError)
            _logger.LogError(exception, "Unhandled exception");

        context.Response.StatusCode = statusCode;

        await context.Response.WriteAsJsonAsync(new
        {
            success = false,
            message
        }, cancellationToken);

        return true;
    }
}

// -- Domain Exceptions ----------------------------------------------------------

public class NotFoundException    : Exception { public NotFoundException(string m)   : base(m) {} }
public class ConflictException    : Exception { public ConflictException(string m)   : base(m) {} }
public class ForbiddenException   : Exception { public ForbiddenException(string m)  : base(m) {} }
public class BadRequestException  : Exception { public BadRequestException(string m) : base(m) {} }
public class ValidationException  : Exception { public ValidationException(string m) : base(m) {} }
