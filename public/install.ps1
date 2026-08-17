Write-Host "◈ Zerf CLI — Установка терминального ассистента..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Ошибка: Для работы Zerf CLI требуется Node.js 18+." -ForegroundColor Red
    Write-Host "Скачайте и установите Node.js: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Установка пакета zerf через npm..." -ForegroundColor Cyan
npm install -g zerf@latest

Write-Host ""
Write-Host "✔ Zerf CLI успешно установлен!" -ForegroundColor Green
Write-Host "Для первого входа выполните:" -ForegroundColor White
Write-Host "  zerf login" -ForegroundColor Cyan
Write-Host ""
Write-Host "Для запуска интерфейса:" -ForegroundColor White
Write-Host "  zerf" -ForegroundColor Cyan
