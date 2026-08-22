import dns from 'dns/promises'

/**
 * Shared SSRF protection for server-side fetches of user-supplied URLs.
 * Extracted from app/api/extensions/ai (audit H-6: ping_host had no
 * protection at all — now every outbound-to-user-URL path reuses this).
 */

function isPrivateIp(ip: string): boolean {
  // IPv4 private & link-local ranges
  if (
    ip.startsWith('10.') ||
    ip.startsWith('127.') ||
    ip.startsWith('169.254.') ||
    ip.startsWith('192.168.') ||
    ip === '0.0.0.0'
  ) {
    return true
  }

  // 172.16.0.0 - 172.31.255.255
  const parts = ip.split('.').map(Number)
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true
  }

  // IPv6 loopback & unique local
  const lower = ip.toLowerCase()
  if (
    lower === '::1' ||
    lower.startsWith('fe80:') ||
    lower.startsWith('fc00:') ||
    lower.startsWith('fd00:') ||
    lower.startsWith('::ffff:127.') ||
    lower.startsWith('::ffff:10.') ||
    lower.startsWith('::ffff:192.168.')
  ) {
    return true
  }

  return false
}

const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1', 'metadata.google.internal', 'instance-data']

export async function validateOutboundUrl(urlStr: string, opts?: { allowHttp?: boolean }): Promise<{ safe: boolean; error?: string }> {
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    return { safe: false, error: 'Некорректный URL' }
  }

  if (parsed.protocol !== 'https:' && !opts?.allowHttp) {
    return { safe: false, error: 'Разрешены только HTTPS-адреса' }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { safe: false, error: 'Недопустимый протокол' }
  }

  const hostname = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTS.includes(hostname)) {
    return { safe: false, error: 'Обращение к внутренним хостам запрещено' }
  }

  try {
    const addresses = await dns.lookup(parsed.hostname, { all: true })
    if (!addresses || addresses.length === 0) {
      return { safe: false, error: 'Не удалось разрешить имя хоста' }
    }
    for (const { address } of addresses) {
      if (isPrivateIp(address)) {
        return { safe: false, error: 'Доступ к приватным IP-адресам запрещён (SSRF Protection)' }
      }
    }
  } catch {
    return { safe: false, error: 'Ошибка разрешения доменного имени' }
  }

  return { safe: true }
}
