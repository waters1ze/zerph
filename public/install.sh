#!/usr/bin/env bash
set -e

echo "◈ Zerf CLI — Установка терминального ассистента..."

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Ошибка: Для работы Zerf CLI требуется Node.js 18+."
  echo "Установите Node.js с официального сайта: https://nodejs.org/"
  exit 1
fi

echo "📦 Установка пакета zerf через npm..."
npm install -g zerf@latest

echo ""
echo "✔ Zerf CLI успешно установлен!"
echo "Для первого входа выполните:"
echo "  zerf login"
echo ""
echo "Для запуска интерфейса:"
echo "  zerf"
