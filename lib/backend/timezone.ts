/**
 * Timezone parsing, validation, and conversion utilities
 */

const RUSSIAN_TIMEZONE_MAP: Record<string, string> = {
  'калининград': 'Europe/Kaliningrad', // UTC+2
  'москва': 'Europe/Moscow',          // UTC+3
  'мск': 'Europe/Moscow',
  'питер': 'Europe/Moscow',
  'спб': 'Europe/Moscow',
  'самара': 'Europe/Samara',          // UTC+4
  'екатеринбург': 'Asia/Yekaterinburg',// UTC+5
  'екб': 'Asia/Yekaterinburg',
  'омск': 'Asia/Omsk',                // UTC+6
  'красноярск': 'Asia/Krasnoyarsk',   // UTC+7
  'новосибирск': 'Asia/Krasnoyarsk',  // UTC+7
  'нск': 'Asia/Krasnoyarsk',
  'иркутск': 'Asia/Irkutsk',          // UTC+8
  'якутск': 'Asia/Yakutsk',           // UTC+9
  'владивосток': 'Asia/Vladivostok',  // UTC+10
  'магадан': 'Asia/Magadan',          // UTC+11
  'камчатка': 'Asia/Kamchatka',       // UTC+12
}

const OFFSET_HOURS_TO_ZONE: Record<number, string> = {
  2: 'Europe/Kaliningrad',
  3: 'Europe/Moscow',
  4: 'Europe/Samara',
  5: 'Asia/Yekaterinburg',
  6: 'Asia/Omsk',
  7: 'Asia/Krasnoyarsk',
  8: 'Asia/Irkutsk',
  9: 'Asia/Yakutsk',
  10: 'Asia/Vladivostok',
  11: 'Asia/Magadan',
  12: 'Asia/Kamchatka',
}

/**
 * Validates and normalizes user timezone input into a standard IANA timezone string.
 * Supports:
 * - City names (Москва, Екатеринбург, etc.)
 * - Offsets (+3, +03, +03:00, UTC+3, GMT+3, UTC + 3, +5, etc.)
 * - IANA timezone names (Europe/Moscow, Asia/Yekaterinburg, UTC, America/New_York)
 */
export function parseTimezoneInput(input: string): string | null {
  if (!input) return null
  const text = input.toLowerCase().trim()

  // 1. Check explicit city keywords
  for (const [key, zone] of Object.entries(RUSSIAN_TIMEZONE_MAP)) {
    if (text.includes(key)) return zone
  }

  // 2. Check numeric offset with word/boundary awareness (+3, +03, +03:00, UTC+3, GMT+3, UTC + 5, etc.)
  const offsetMatch = text.match(/(?:utc|gmt)?\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?(?!\d)/i)
  if (offsetMatch) {
    const sign = offsetMatch[1]
    const hours = parseInt(offsetMatch[2], 10)
    const minutes = offsetMatch[3] ? parseInt(offsetMatch[3], 10) : 0

    if (sign === '+' && minutes === 0 && hours in OFFSET_HOURS_TO_ZONE) {
      return OFFSET_HOURS_TO_ZONE[hours]
    }
  }

  // 3. Check standard IANA timezone format (e.g. Europe/Moscow, Asia/Novosibirsk, America/New_York)
  if (/^(?:europe|asia|america|africa|australia|pacific|atlantic|indian|antarctica)\/[\w_+-]+/i.test(text)) {
    try {
      // Test with Intl.DateTimeFormat to ensure validity
      new Intl.DateTimeFormat(undefined, { timeZone: text })
      return text
    } catch {
      return null
    }
  }

  if (text === 'utc' || text === 'gmt') {
    return 'UTC'
  }

  return null
}
