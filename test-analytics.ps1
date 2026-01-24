# Test script for Analytics Engine
# Make sure the API server is running on http://localhost:3001

$baseUrl = "http://localhost:3001"
$headers = @{}

Write-Host "=== Testing Analytics Engine ===" -ForegroundColor Green
Write-Host ""

# Step 1: Login to get JWT token
Write-Host "1. Logging in..." -ForegroundColor Yellow
$loginBody = @{
    email = "admin@waterways.com"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.token
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    Write-Host "✓ Login successful" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "✗ Login failed: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Test Competition Trends
Write-Host "2. Testing Competition Trends..." -ForegroundColor Yellow
try {
    $trends = Invoke-RestMethod -Uri "$baseUrl/api/analytics/competition-trends" -Method GET -Headers $headers
    Write-Host "✓ Competition Trends: Found $($trends.Count) competitions" -ForegroundColor Green
    if ($trends.Count -gt 0) {
        Write-Host "   First competition: $($trends[0].competitionName) - Median Clean Time: $($trends[0].medianCleanTime)s" -ForegroundColor Cyan
    }
    Write-Host ""
} catch {
    Write-Host "✗ Competition Trends failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Step 3: Test Run Diagnostics
Write-Host "3. Testing Run Diagnostics..." -ForegroundColor Yellow
try {
    $diagnostics = Invoke-RestMethod -Uri "$baseUrl/api/analytics/run-diagnostics?runTypeCode=A1" -Method GET -Headers $headers
    Write-Host "✓ Run Diagnostics: $($diagnostics.runTypeCode) - $($diagnostics.dataPoints.Count) data points" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "✗ Run Diagnostics failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Step 4: Test Drivers Analysis
Write-Host "4. Testing Drivers Analysis..." -ForegroundColor Yellow
try {
    $drivers = Invoke-RestMethod -Uri "$baseUrl/api/analytics/drivers" -Method GET -Headers $headers
    Write-Host "✓ Drivers Analysis: Found $($drivers.Count) run types" -ForegroundColor Green
    if ($drivers.Count -gt 0) {
        Write-Host "   Top driver: $($drivers[0].runTypeCode) - $($drivers[0].totalPenaltySeconds)s penalty time" -ForegroundColor Cyan
    }
    Write-Host ""
} catch {
    Write-Host "✗ Drivers Analysis failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Step 5: Create a Scenario
Write-Host "5. Creating a Test Scenario..." -ForegroundColor Yellow
$scenarioId = $null
try {
    $scenarioBody = @{
        name = "Test Scenario - No Order Violations"
        notes = "Remove all ORDER_VIOLATION penalties for testing"
    } | ConvertTo-Json

    $scenario = Invoke-RestMethod -Uri "$baseUrl/api/scenarios" -Method POST -Body $scenarioBody -ContentType "application/json" -Headers $headers
    Write-Host "✓ Scenario created: $($scenario.id)" -ForegroundColor Green
    $scenarioId = $scenario.id
    Write-Host ""
} catch {
    Write-Host "✗ Scenario creation failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Step 6: Add adjustment if scenario was created
if ($scenarioId) {
    Write-Host "6. Adding adjustment to scenario..." -ForegroundColor Yellow
    try {
        $adjustmentBody = @{
            scopeType = "SEASON"
            scopeId = $null
            adjustmentType = "REMOVE_PENALTY_TAXONOMY"
            payloadJson = @{
                taxonomyCode = "ORDER_VIOLATION"
            }
        }
        $adjustmentBodyJson = $adjustmentBody | ConvertTo-Json -Depth 3

        $adjustment = Invoke-RestMethod -Uri "$baseUrl/api/scenarios/$scenarioId/adjustments" -Method POST -Body $adjustmentBodyJson -ContentType "application/json" -Headers $headers
        Write-Host "✓ Adjustment added: $($adjustment.id)" -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Host "✗ Adjustment failed: $_" -ForegroundColor Red
        Write-Host ""
    }
    
    # Step 7: Test analytics with scenario
    Write-Host "7. Testing Competition Trends with Scenario..." -ForegroundColor Yellow
    try {
        $trendsWithScenario = Invoke-RestMethod -Uri "$baseUrl/api/analytics/competition-trends?scenarioId=$scenarioId" -Method GET -Headers $headers
        Write-Host "✓ Competition Trends with Scenario: Found $($trendsWithScenario.Count) competitions" -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Host "✗ Competition Trends with Scenario failed: $_" -ForegroundColor Red
        Write-Host ""
    }
}

# Step 8: List all scenarios
Write-Host "8. Listing all scenarios..." -ForegroundColor Yellow
try {
    $scenarios = Invoke-RestMethod -Uri "$baseUrl/api/scenarios" -Method GET -Headers $headers
    Write-Host "✓ Found $($scenarios.Count) scenarios" -ForegroundColor Green
    foreach ($s in $scenarios) {
        Write-Host "   - $($s.name) (ID: $($s.id))" -ForegroundColor Cyan
    }
    Write-Host ""
} catch {
    Write-Host "✗ List scenarios failed: $_" -ForegroundColor Red
    Write-Host ""
}

Write-Host "=== Testing Complete ===" -ForegroundColor Green
