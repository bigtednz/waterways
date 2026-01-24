# Testing the Analytics Engine

## Quick Test Guide

### 1. Login First

```powershell
# Login to get JWT token
$loginBody = @{ email = "admin@waterways.com"; password = "admin123" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$token = $response.token
$headers = @{ "Authorization" = "Bearer $token" }
```

### 2. Test Analytics Endpoints

#### Competition Trends
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/analytics/competition-trends" -Method GET -Headers $headers
```

#### Run Diagnostics
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/analytics/run-diagnostics?runTypeCode=A1" -Method GET -Headers $headers
```

#### Drivers Analysis
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/analytics/drivers" -Method GET -Headers $headers
```

### 3. Test Scenarios

#### Create Scenario
```powershell
$scenario = @{
    name = "No Order Violations"
    notes = "Remove all ORDER_VIOLATION penalties"
} | ConvertTo-Json

$scenarioResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/scenarios" -Method POST -Body $scenario -ContentType "application/json" -Headers $headers
$scenarioId = $scenarioResponse.id
```

#### Add Adjustment
```powershell
$adjustment = @{
    scopeType = "SEASON"
    scopeId = $null
    adjustmentType = "REMOVE_PENALTY_TAXONOMY"
    payloadJson = @{ taxonomyCode = "ORDER_VIOLATION" }
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:3001/api/scenarios/$scenarioId/adjustments" -Method POST -Body $adjustment -ContentType "application/json" -Headers $headers
```

#### Test Analytics with Scenario
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/analytics/competition-trends?scenarioId=$scenarioId" -Method GET -Headers $headers
```

### 4. Using Browser/Postman

1. **Login**: `POST http://localhost:3001/api/auth/login`
   ```json
   {
     "email": "admin@waterways.com",
     "password": "admin123"
   }
   ```
   Copy the `token` from response

2. **Set Authorization Header**: `Bearer <your-token>`

3. **Test Endpoints**:
   - `GET http://localhost:3001/api/analytics/competition-trends`
   - `GET http://localhost:3001/api/analytics/run-diagnostics?runTypeCode=A1`
   - `GET http://localhost:3001/api/scenarios`

### 5. Expected Results

- **Competition Trends**: Array of competition performance metrics
- **Run Diagnostics**: Object with dataPoints, rollingMedian, rollingIQR
- **Drivers**: Array of run types with penalty analysis
- **Scenarios**: Array of scenario objects with adjustments

All endpoints require authentication (JWT token in Authorization header).
