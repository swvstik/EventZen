using EventZen.Budget.Infrastructure.Extensions;
using EventZen.Budget.Infrastructure.Middleware;
using EventZen.Budget.Infrastructure.Messaging;
using EventZen.Budget.Infrastructure.Persistence;
using Microsoft.Extensions.Options;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);

// -- Startup validation - fail fast before binding to a port ------------------
// These are checked again inside AddMongoDB and AddJwtAuthentication, but
// checking here first gives a clearer error message at the top of the log.
var requiredEnvVars = new[]
{
    ("JWT:Secret",              "JWT__Secret"),
    ("MongoDB:ConnectionString","MongoDB__ConnectionString"),
    ("Spring:BaseUrl",          "Spring__BaseUrl"),
    ("Spring:InternalSecret",   "Spring__InternalSecret"),
    ("Node:BaseUrl",            "Node__BaseUrl"),
    ("Node:InternalSecret",     "Node__InternalSecret"),
};

foreach (var (configKey, envVar) in requiredEnvVars)
{
    var value = builder.Configuration[configKey];
    if (string.IsNullOrWhiteSpace(value))
        throw new InvalidOperationException(
            $"Required configuration '{configKey}' is not set. " +
            $"Set the '{envVar}' environment variable.");
}

var springBaseUrl = builder.Configuration["Spring:BaseUrl"];
if (!Uri.TryCreate(springBaseUrl, UriKind.Absolute, out var springUri)
    || (springUri.Scheme != Uri.UriSchemeHttp && springUri.Scheme != Uri.UriSchemeHttps))
{
    throw new InvalidOperationException(
        "Required configuration 'Spring:BaseUrl' must be a valid absolute HTTP/HTTPS URL.");
}

var nodeBaseUrl = builder.Configuration["Node:BaseUrl"];
if (!Uri.TryCreate(nodeBaseUrl, UriKind.Absolute, out var nodeUri)
    || (nodeUri.Scheme != Uri.UriSchemeHttp && nodeUri.Scheme != Uri.UriSchemeHttps))
{
    throw new InvalidOperationException(
        "Required configuration 'Node:BaseUrl' must be a valid absolute HTTP/HTTPS URL.");
}

// -- Services ------------------------------------------------------------------
builder.Services
    .AddMongoDB(builder.Configuration)
    .AddKafkaMessaging(builder.Configuration)
    .AddRepositories()
    .AddApplicationServices()
    .AddJwtAuthentication(builder.Configuration)
    .AddFluentValidation();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // camelCase JSON to match JavaScript conventions (totalAllocated, not TotalAllocated)
        options.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
        // Serialize enums as strings not ints (e.g. "VENUE" not 0)
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// Use the built-in IExceptionHandler interface - cleaner than middleware
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "EventZen Budget API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new()
    {
        Name         = "Authorization",
        Type         = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT",
        In           = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description  = "Paste your JWT access token here (issued by the Node.js auth service).",
    });
    c.AddSecurityRequirement(new()
    {
        [new() { Reference = new() { Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme, Id = "Bearer" } }] = []
    });
});

var corsOrigins = (builder.Configuration["Cors:AllowedOrigins"]
        ?? "http://localhost:3000,http://localhost:8080")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

// CORS - allow Nginx gateway and Vite dev server
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy
            .WithOrigins(corsOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()
    )
);

// -- Build app -----------------------------------------------------------------
var app = builder.Build();

// -- Ensure MongoDB indexes are created before accepting traffic ---------------
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<MongoDbContext>();
    await dbContext.EnsureIndexesAsync();
    app.Logger.LogInformation("MongoDB indexes ensured.");
}

// -- Middleware pipeline - ORDER MATTERS ---------------------------------------
app.UseExceptionHandler();   // Must be first to catch exceptions from all middleware
app.UseCors();               // Before auth so preflight OPTIONS requests pass
app.UseHttpMetrics();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Swagger only in development
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "EventZen Budget v1"));
}

// Health check - no auth required (Nginx uses this for healthchecks)
app.MapGet("/health", (IOptions<KafkaMessagingOptions> kafkaOptions, KafkaRuntimeState kafkaState) => Results.Ok(new
{
    status    = "ok",
    service   = "eventzen-dotnet",
    kafka     = new
    {
        enabled          = kafkaOptions.Value.Enabled,
        bootstrapServers = kafkaOptions.Value.BootstrapServers,
        runtime          = kafkaState.ToHealthPayload(),
    },
    timestamp = DateTime.UtcNow,
})).AllowAnonymous();

app.MapMetrics().AllowAnonymous();

app.Run();

// Expose Program for integration testing
public partial class Program { }
