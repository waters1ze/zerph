import { mutateItem } from '../../api.js';
import { GLYPH } from '../theme.js';
export async function handleAddCommand(rawText, creds) {
    const text = rawText.replace(/^\/add\s*/i, '').trim();
    if (!text) {
        return { ok: false, message: 'Укажите текст задачи. Пример: /add Созвон в 15:00' };
    }
    // Basic date/time parsing
    let dueTime;
    let dueDate;
    const todayStr = new Date().toISOString().slice(0, 10);
    dueDate = todayStr;
    const timeMatch = text.match(/\b([0-1]?[0-9]|2[0-3]):[0-5][0-9]\b/);
    if (timeMatch) {
        dueTime = timeMatch[0];
    }
    const isUrgent = text.toLowerCase().includes('срочно') || text.toLowerCase().includes('важно');
    try {
        await mutateItem(creds, {
            action: 'create_task',
            title: text,
            dueDate,
            dueTime,
            priority: isUrgent ? 'urgent' : 'medium',
            rawText: text,
        });
        const timeInfo = dueTime ? ` на ${dueTime}` : ' · сегодня';
        return {
            ok: true,
            message: `${GLYPH.ok} Задача «${text}» создана${timeInfo}`,
        };
    }
    catch (err) {
        return {
            ok: false,
            message: `${GLYPH.cancel} Ошибка создания задачи: ${err.message}`,
        };
    }
}
