# PowerShell Script to boot NeuronCast under PM2 process supervision
# Ensure PM2 is installed globally: npm install pm2 -g

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Starting NeuronCast Production HUD via PM2" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Run Preflight Theme Validation
Write-Host "`n[1/3] Running preflight theme validation..." -ForegroundColor Yellow
npm run theme:validate
if ($LASTEXITCODE -ne 0) {
    Write-Error "Preflight theme validation failed. Aborting production startup."
    Exit 1
}

# 2. Check if PM2 is available
Write-Host "`n[2/3] Checking PM2 availability..." -ForegroundColor Yellow
$pm2Check = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2Check) {
    Write-Host "[WARNING] PM2 is not installed globally." -ForegroundColor Yellow
    Write-Host "Please install it by running: npm install -g pm2" -ForegroundColor Cyan
    Write-Host "Starting server directly via Node instead..." -ForegroundColor Yellow
    $env:NODE_ENV="production"
    node .
    Exit 0
}

# 3. Startup PM2 ecosystem config
Write-Host "`n[3/3] Starting NeuronCast under process supervision..." -ForegroundColor Yellow
pm2 start ecosystem.config.cjs --env production

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host "✔ NeuronCast successfully orchestrated by PM2!" -ForegroundColor Green
Write-Host "Useful commands:" -ForegroundColor Green
Write-Host "  pm2 status    - Check NeuronCast status" -ForegroundColor Cyan
Write-Host "  pm2 logs neuroncast  - Stream realtime server logs" -ForegroundColor Cyan
Write-Host "  pm2 restart neuroncast - Restart NeuronCast server" -ForegroundColor Cyan
Write-Host "  pm2 stop neuroncast  - Turn off NeuronCast server" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Green
