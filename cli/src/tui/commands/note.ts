import { mutateItem, type ZerfCredentials } from '../../api.js'
import { GLYPH } from '../theme.js'

export async function handleNoteCommand(
  rawText: string,
  creds: ZerfCredentials
): Promise<{ ok: boolean; message: string; details?: string[] }> {
  const text = rawText.replace(/^\/note\s*/i, '').trim()
  if (!text) {
    return { ok: false, message: 'Укажите текст заметки. Пример: /note Идея для нового модуля' }
  }

  try {
    await mutateItem(creds, {
      action: 'create_note',
      title: text.length > 50 ? text.slice(0, 47) + '…' : text,
      body: text,
      tags: ['cli'],
    })

    return {
      ok: true,
      message: `${GLYPH.ok} Заметка сохранена`,
      details: [`«${text}»`],
    }
  } catch (err: any) {
    return {
      ok: false,
      message: `${GLYPH.cancel} Ошибка сохранения заметки: ${err.message}`,
    }
  }
}
