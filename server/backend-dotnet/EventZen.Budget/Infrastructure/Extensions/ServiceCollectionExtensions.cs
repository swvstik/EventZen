using System.Net;
using System.Text;
using EventZen.Budget.Infrastructure.Messaging;
using EventZen.Budget.Infrastructure.Persistence;
using EventZen.Budget.Repositories;
using EventZen.Budget.Services;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;

namespace EventZen.Budget.Infrastructure.Extensions;

/// <summary>
/// Extension methods that keep Program.cs clean and readable.
/// Each AddX method groups related DI registrations.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers IMongoClient as a singleton (thread-safe, connection-pooled)
    /// and MongoDbContext as a singleton wrapper around it.
    /// IMongoClient must be singleton - creating multiple clients wastes connections.
    /// </summary>
    public static IServiceCollection AddMongoDB(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration["MongoDB:ConnectionString"];
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "MongoDB:ConnectionString is not configured. " +
                "Set MongoDB__ConnectionString environment variable.");
        }

        // Singleton - MongoClient is thread-safe and manages its own connection pool
        services.AddSingleton<IMongoClient>(_ => new MongoClient(connectionString));
        services.AddSingleton<MongoDbContext>();
        return services;
    }

    public static IServiceCollection AddRepositories(this IServiceCollection services)
    {
        services.AddScoped<IBudgetRepository,  BudgetRepository>();
        services.AddScoped<IExpenseRepository, ExpenseRepository>();
        return services;
    }

    public static IServiceCollection AddKafkaMessaging(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<KafkaMessagingOptions>(configuration.GetSection("Kafka"));
        services.AddSingleton<KafkaRuntimeState>();
        services.AddSingleton<IKafkaEventPublisher, KafkaEventPublisher>();
        services.AddHostedService<KafkaLifecycleConsumerService>();
        return services;
    }

    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddHttpClient<IEventOwnershipService, EventOwnershipService>((sp, client) =>
        {
            var configuration = sp.GetRequiredService<IConfiguration>();
            var baseUrl = configuration["Spring:BaseUrl"];
            var internalSecret = configuration["Spring:InternalSecret"];

            if (string.IsNullOrWhiteSpace(baseUrl)
                || !Uri.TryCreate(baseUrl.TrimEnd('/'), UriKind.Absolute, out var parsedBaseUrl)
                || (parsedBaseUrl.Scheme != Uri.UriSchemeHttp && parsedBaseUrl.Scheme != Uri.UriSchemeHttps))
            {
                throw new InvalidOperationException(
                    "Spring:BaseUrl must be configured as a valid absolute HTTP/HTTPS URL.");
            }

            if (string.IsNullOrWhiteSpace(internalSecret))
            {
                throw new InvalidOperationException(
                    "Spring:InternalSecret must be configured for internal ownership checks.");
            }

            client.BaseAddress = parsedBaseUrl;
            client.Timeout = TimeSpan.FromSeconds(10);
            client.DefaultRequestHeaders.Remove("X-Internal-Secret");
            client.DefaultRequestHeaders.Add("X-Internal-Secret", internalSecret);
        });

        services.AddHttpClient<IPaymentMetricsService, PaymentMetricsService>((sp, client) =>
        {
            var configuration = sp.GetRequiredService<IConfiguration>();
            var baseUrl = configuration["Node:BaseUrl"];
            var internalSecret = configuration["Node:InternalSecret"];

            if (string.IsNullOrWhiteSpace(baseUrl)
                || !Uri.TryCreate(baseUrl.TrimEnd('/'), UriKind.Absolute, out var parsedBaseUrl)
                || (parsedBaseUrl.Scheme != Uri.UriSchemeHttp && parsedBaseUrl.Scheme != Uri.UriSchemeHttps))
            {
                throw new InvalidOperationException(
                    "Node:BaseUrl must be configured as a valid absolute HTTP/HTTPS URL.");
            }

            if (string.IsNullOrWhiteSpace(internalSecret))
            {
                throw new InvalidOperationException(
                    "Node:InternalSecret must be configured for internal payment metrics checks.");
            }

            client.BaseAddress = parsedBaseUrl;
            client.Timeout = TimeSpan.FromSeconds(10);
            client.DefaultRequestHeaders.Remove("X-Internal-Secret");
            client.DefaultRequestHeaders.Add("X-Internal-Secret", internalSecret);
        });

        services.AddScoped<IBudgetService, BudgetService>();
        return services;
    }

    /// <summary>
    /// JWT Bearer authentication.
    /// Tokens are issued by the Node.js service - we only verify them here.
    /// ValidateIssuer/ValidateAudience = false because Node.js doesn't set those claims.
    /// OnChallenge override ensures 401 returns JSON (not an empty 401 body).
    /// </summary>
    public static IServiceCollection AddJwtAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var secret = configuration["JWT:Secret"];

        // Fail fast at startup if secret is missing - better than a cryptic 500 later
        if (string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException(
                "JWT:Secret is not configured. " +
                "Set JWT__Secret environment variable.");

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer           = false,
                    ValidateAudience         = false,
                    ValidateLifetime         = true,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey         = new SymmetricSecurityKey(
                                                  Encoding.UTF8.GetBytes(secret)),
                    ClockSkew                = TimeSpan.Zero,
                };

                // Return JSON on 401 - ASP.NET's default is an empty 401 body
                options.Events = new JwtBearerEvents
                {
                    OnChallenge = async context =>
                    {
                        // Suppress the default response
                        context.HandleResponse();
                        context.Response.StatusCode  = (int)HttpStatusCode.Unauthorized;
                        context.Response.ContentType = "application/json";
                        await context.Response.WriteAsync(
                            """{"success":false,"message":"Authentication required. Please provide a valid Bearer token."}"""
                        );
                    },
                    OnForbidden = async context =>
                    {
                        context.Response.StatusCode  = (int)HttpStatusCode.Forbidden;
                        context.Response.ContentType = "application/json";
                        await context.Response.WriteAsync(
                            """{"success":false,"message":"Access denied. Insufficient permissions."}"""
                        );
                    },
                };
            });

        return services;
    }

    /// <summary>
    /// Registers all FluentValidation validators discovered in this assembly.
    /// Validators are auto-discovered - just create a class inheriting AbstractValidator.
    /// </summary>
    public static IServiceCollection AddFluentValidation(this IServiceCollection services)
    {
        services.AddValidatorsFromAssemblyContaining<Program>();
        return services;
    }
}
