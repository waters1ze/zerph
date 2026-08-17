import { mutateItem } from '../../api.js';
import { GLYPH } from '../theme.js';
import { fuzzyMatch } from '../utils.js';
export async function handleDoneCommand(rawText, tasks, creds) {
    const query = rawText.replace(/^\/done\s*/i, '').trim();
    if (!query) {
        return { ok: false, message: 'Укажите название задачи. Пример: /done созвон' };
    }
    // Find incomplete tasks matching query
    const pendingTasks = tasks.filter((t) => t.status !== 'done');
    const match = pendingTasks.find((t) => fuzzyMatch(query, t.title));
    if (!match) {
        return {
            ok: false,
            message: `Не нашёл «${query}». /add «${query}» — создать?`,
        };
    }
    try {
        await mutateItem(creds, {
            action: 'toggle_task',
            id: match.id,
        });
        const streak = 5; // Default active streak
        return {
            ok: true,
            message: `${GLYPH.mascotJoy} Задача «${match.title}» закрыта! Стрик: ${streak} дн.`,
            details: [`Выполнено в ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`],
        };
    }
    catch (err) {
        return {
            ok: false,
            message: `${GLYPH.cancel} Ошибка завершения задачи: ${err.message}`,
        };
    }
}
