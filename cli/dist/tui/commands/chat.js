import { sendAiQuery, mutateItem } from '../../api.js';
import { GLYPH } from '../theme.js';
import { runLocalCliBridge } from '../../local-cli.js';
export async function handleChatCommand(rawText, creds, activeModel = 'openai/gpt-oss-120b', friends = []) {
    let text = rawText.trim();
    if (text.startsWith('/chat')) {
        text = text.replace(/^\/chat\s*/i, '').trim();
    }
    if (!text) {
        return {
            ok: false,
            message: 'Укажите вопрос ИИ или сообщение другу: /chat @username <текст>',
        };
    }
    // 1. Friend direct message / delegation: /chat @username text
    if (text.startsWith('@')) {
        const parts = text.split(' ');
        const targetUsername = parts[0].replace('@', '').toLowerCase();
        const msgText = parts.slice(1).join(' ').trim();
        if (!msgText) {
            return {
                ok: false,
                message: `Укажите текст поручения для @${targetUsername}`,
            };
        }
        const friend = friends.find((f) => (f.username || '').toLowerCase() === targetUsername || f.name.toLowerCase() === targetUsername);
        try {
            await mutateItem(creds, {
                action: 'create_task',
                title: msgText,
                priority: 'medium',
                isShared: true,
                assignees: friend?.chatId ? [String(friend.chatId)] : [targetUsername],
            });
            return {
                ok: true,
                message: `${GLYPH.ok} Задача передана @${targetUsername}`,
                details: [`«${msgText}»`, 'Синхронизировано в командный чат и Telegram.'],
            };
        }
        catch (err) {
            return {
                ok: false,
                message: `${GLYPH.cancel} Ошибка отправки: ${err.message}`,
            };
        }
    }
    // 2. Local CLI Agent Bridge
    if (activeModel.startsWith('cli:')) {
        try {
            const output = await runLocalCliBridge(activeModel, text);
            return {
                ok: true,
                message: `${GLYPH.bullet} Ответ ${activeModel.replace('cli:', '')}:`,
                details: output.split('\n').filter(Boolean),
            };
        }
        catch (err) {
            return {
                ok: false,
                message: `${GLYPH.cancel} Ошибка вызова CLI: ${err.message}`,
            };
        }
    }
    // 3. Cloud AI Intent & Query
    try {
        const res = await sendAiQuery(creds, text, activeModel);
        return {
            ok: true,
            message: res.message,
            details: res.details,
        };
    }
    catch (err) {
        return {
            ok: false,
            message: `${GLYPH.cancel} Ошибка запроса к ИИ: ${err.message}`,
        };
    }
}
