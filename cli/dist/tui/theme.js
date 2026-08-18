import chalk from 'chalk';
/**
 * Strict monochrome design tokens for Zerf CLI 2.0 per specification §2.1
 */
export const c = {
    text: chalk.white,
    dim: chalk.gray,
    accent: chalk.bold.white,
    ok: chalk.green,
    err: chalk.red,
    warn: chalk.yellow,
    subtle: chalk.dim,
};
export const ASCII_BANNER = [
    '  ██████╗ ███████╗██████╗ ███████╗',
    '  ╚════██╗██╔════╝██╔══██╗██╔════╝',
    '   █████╔╝█████╗  ██████╔╝█████╗  ',
    '   ╚═══██╗██╔══╝  ██╔══██╗██╔══╝  ',
    '  ██████╔╝███████╗██║  ██║██║     ',
    '  ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  Note ✦',
].join('\n');
/**
 * Standard ASCII glyphs per specification §2.2
 */
export const GLYPH = {
    logo: '❖',
    bullet: '●',
    ok: '✔',
    cancel: '✕',
    arrow: '▸',
    todo: '◌',
    taskTodo: '[◌]',
    taskDone: '[✔]',
    thinking: '⬡',
    mascotIdle: '✦',
    mascotFocus: '˘ᴗ˘',
    mascotAlert: '⊙_⊙',
    mascotJoy: '✧ᴗ✧',
    barFilled: '▓',
    barEmpty: '░',
    divider: '─',
};
export function pad(str, length) {
    if (str.length >= length)
        return str;
    return str + ' '.repeat(length - str.length);
}
export function truncate(str, maxLength) {
    if (str.length <= maxLength)
        return str;
    return str.slice(0, Math.max(0, maxLength - 1)) + '…';
}
export function divider(width = 72) {
    const cols = typeof process !== 'undefined' && process.stdout?.columns ? process.stdout.columns : 72;
    const effectiveWidth = Math.min(cols - 2, Math.max(20, width));
    return c.dim(GLYPH.divider.repeat(effectiveWidth));
}
export function progressBar(ratio, width = 10) {
    const clamped = Math.max(0, Math.min(1, isNaN(ratio) ? 0 : ratio));
    const filledCount = Math.round(clamped * width);
    const emptyCount = width - filledCount;
    return `${GLYPH.barFilled.repeat(filledCount)}${GLYPH.barEmpty.repeat(emptyCount)}`;
}
export function formatCountdown(dueDate, dueTime, status) {
    if (status === 'done')
        return c.ok(GLYPH.ok + ' Выполнено');
    if (!dueDate)
        return c.dim('без срока');
    const todayStr = new Date().toISOString().slice(0, 10);
    if (dueDate < todayStr) {
        const diffDays = Math.ceil((new Date(todayStr).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
        return c.warn(`просрочено на ${diffDays} дн.`);
    }
    if (dueDate === todayStr) {
        if (!dueTime)
            return c.dim('сегодня');
        const [h, m] = dueTime.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
            const now = new Date();
            const target = new Date();
            target.setHours(h, m, 0, 0);
            const diffMs = target.getTime() - now.getTime();
            if (diffMs < 0)
                return c.warn(`просрочено (${dueTime})`);
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMins / 60);
            const remMins = diffMins % 60;
            if (diffHours === 0)
                return c.dim(`через ${remMins} мин (${dueTime})`);
            return c.dim(`через ${diffHours} ч ${remMins > 0 ? `${remMins} мин` : ''} (${dueTime})`);
        }
        return c.dim(`сегодня · ${dueTime}`);
    }
    return c.dim(dueDate + (dueTime ? ` в ${dueTime}` : ''));
}
export function formatDate(date = new Date()) {
    const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const dayName = days[date.getDay()];
    const dayNum = date.getDate();
    const monthName = months[date.getMonth()];
    return `${dayName}, ${dayNum} ${monthName}`;
}
