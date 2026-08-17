const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'api', 'telegram', 'route.ts');
let content = fs.readFileSync(filePath, 'utf8');

const targetFunction = `async function handleSiriSetup(chatId: number) {
  const appUrl = APP_URL || 'https://zeprh.vercel.app'
  const endpointUrl = \`\${appUrl}/api/shortcuts\`
  const siriKey = getSiriUserKey(chatId)
  const personalUrl = \`\${endpointUrl}?chatId=\${chatId}&key=\${siriKey}&text=\`
  const testUrl = \`\${endpointUrl}?chatId=\${chatId}&key=\${siriKey}&text=Купить+молоко+в+19:00\`

  let msg = \`🍏 *Интеграция с Siri, Action Button, жестами и виджетами*\\n\\n\` +
    \`Превратите Zerf AI в ультрабыстрого личного голосового ассистента на вашем iPhone или Android! Задачи, заметки и напоминания создаются за 1 секунду голосом или по касанию кнопки.\\n\\n\` +
    \`🔑 *Ваша персональная защищённая ссылка для шлюза:*\\n\` +
    \`\\\`\${personalUrl}\\\`\\n\\n\` +
    \`🆔 *Ваш Chat ID:* \\\`\${chatId}\\\`\\n\` +
    \`🔐 *Ключ безопасности:* \\\`\${siriKey}\\\`\\n\\n\` +
    \`───────────────\\n\` +
    \`📱 *ИНСТРУКЦИЯ ПО НАСТРОЙКЕ НА IPHONE (SIRI & КОМАНДЫ):*\\n\\n\` +
    \`1️⃣ Скопируйте персональную ссылку выше (нажмите на неё).\\n\` +
    \`2️⃣ Откройте приложение **«Быстрые команды» (Shortcuts)** на iPhone.\\n\` +
    \`3️⃣ Нажмите **+** (Создать команду) и добавьте 4 действия:\\n\` +
    \`   • 🎤 *1. Продиктовать текст* (язык: русский)\\n\` +
    \`   • 🔗 *2. URL Кодировать* [Продиктованный текст]\\n\` +
    \`   • 🌐 *3. Получить содержимое URL:* вставьте скопированную ссылку \\\`\${personalUrl}\\\` и выберите переменную [Кодированный в URL текст] в конец после \\\`text=\\\`\\n\` +
    \`   • 🔊 *4. Произнести текст* [Содержимое URL]\\n\` +
    \`4️⃣ Переименуйте команду в **«Запиши в Zerf»** (или любое удобное название).\\n\` +
    \`5️⃣ Готово! Теперь скажите Siri: *«Привет, Siri, Запиши в Zerf»*!\\n\\n\` +
    \`───────────────\\n\` +
    \`✨ *НАСТРОЙКА БЫСТРОГО ВХОДА И ЖЕСТОВ НА IPHONE:*\\n\\n\` +
    \`• 🔘 **Кнопка Action Button (iPhone 15 Pro / 16 / 16 Pro):**\\n\` +
    \`  _Настройки ➔ Кнопка действия ➔ Быстрая команда ➔ выберите «Запиши в Zerf»_.\\n\` +
    \`  _Теперь при зажатии боковой кнопки сразу открывается голосовой ввод!_\\n\\n\` +
    \`• 👆 **Двойной стук по задней крышке (любой iPhone):**\\n\` +
    \`  _Настройки ➔ Универсальный доступ ➔ Касание ➔ Касание задней панели ➔ «Двойное касание» ➔ выберите команду «Запиши в Zerf»_.\\n\` +
    \`  _Дважды постучите пальцем по задней панели iPhone — и надиктуйте задачу!_\\n\\n\` +
    \`• 🔒 **Виджет на экране блокировки (Lock Screen):**\\n\` +
    \`  _Зажмите экран блокировки ➔ Настроить ➔ Экран блокировки ➔ Добавить виджет ➔ «Команды» ➔ выберите «Запиши в Zerf»_.\\n\` +
    \`• 📲 **Иконка на экран «Домой» (PWA):**\\n\` +
    \`  _Откройте https://zeprh.vercel.app в Safari ➔ Поделиться (квадрат со стрелкой) ➔ «На экран \\"Домой\\"»_.\\n\\n\` +
    \`───────────────\\n\` +
    \`🤖 *ИНСТРУКЦИЯ ДЛЯ ANDROID (ВИДЖЕТ В 1 КЛИК):*\\n\\n\` +
    \`1️⃣ Установите бесплатное приложение **HTTP Shortcuts** из Google Play.\\n\` +
    \`2️⃣ Откройте приложение, нажмите **+** ➔ выберите **Обычный ярлык**.\\n\` +
    \`3️⃣ Во вкладке *«Переменные»* добавьте переменную \\\`voice_input\\\` с типом *«Голосовой ввод»*.\\n\` +
    \`4️⃣ В поле **URL** вставьте:\\n\` +
    \`   \\\`\${personalUrl}\\\` + добавьте \\\`{voice_input}\\\` в конец после \\\`text=\\\`\\n\` +
    \`5️⃣ В разделе *«Ответ» (Response)* включите опцию: **Озвучивать текст (TTS)**.\\n\` +
    \`6️⃣ Вынесите созданный виджет-кнопку на рабочий стол Android!\\n\` +
    \`7️⃣ Для добавления веб-приложения: откройте сайт в Chrome ➔ Меню (три точки) ➔ «Установить приложение».\\n\``;

// Find and replace the function body
const regex = /async function handleSiriSetup\(chatId: number\) {[\s\S]*?const replyMarkup = {/;
if (!regex.test(content)) {
  console.error('Regex did not match handleSiriSetup');
  process.exit(1);
}

content = content.replace(regex, `${targetFunction}\n\n  const replyMarkup = {`);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated handleSiriSetup in route.ts');
