import { mutateItem } from '../../api.js';
import { GLYPH } from '../theme.js';
export async function handleNoteCommand(rawText, creds) {
    const text = rawText.replace(/^\/note\s*/i, '').trim();
    if (!text) {
        return { ok: false, message: 'Укажите текст заметки. Пример: /note Идея для нового модуля' };
    }
    try {
        await mutateItem(creds, {
            action: 'create_note',
            title: text.length > 50 ? text.slice(0, 47) + '…' : text,
            body: text,
            tags: ['cli'],
        });
        return {
            ok: true,
            message: `${GLYPH.ok} Заметка сохранена`,
            details: [`«${text}»`],
        };
    }
    catch (err) {
        return {
            ok: false,
            message: `${GLYPH.cancel} Ошибка сохранения заметки: ${err.message}`,
        };
    }
}
