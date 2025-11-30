# PowerShell setup script for ZRX Market
# Run this script to install dependencies and seed the database

Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
cd backend
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }
cd ..

Write-Host "Installing bot dependencies..." -ForegroundColor Cyan
cd bot
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }
cd ..

Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
cd frontend
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }
cd ..

Write-Host "Seeding database..." -ForegroundColor Cyan
cd backend
node scripts/seed.js
if ($LASTEXITCODE -ne 0) { exit 1 }
cd ..

Write-Host "`n✅ Setup complete! Run 'npm run dev' to start the application." -ForegroundColor Green





