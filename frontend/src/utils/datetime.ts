const SERVER_UTC_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T])(\d{2}):(\d{2})(?::(\d{2}))?$/

const pad = (value: number) => String(value).padStart(2, '0')

export const parseServerDateTime = (value?: string | null): Date | null => {
  if (!value || typeof value !== 'string') {
    return null
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return null
  }

  const utcMatch = trimmedValue.match(SERVER_UTC_DATETIME_PATTERN)
  if (utcMatch) {
    const [, year, month, day, hours, minutes, seconds = '00'] = utcMatch
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes),
        Number(seconds),
      ),
    )
  }

  const parsedDate = new Date(trimmedValue)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

export const formatServerDateTime = (value?: string | null, fallback = '-'): string => {
  const parsedDate = parseServerDateTime(value)
  if (!parsedDate) {
    return fallback
  }

  return [
    `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`,
    `${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}:${pad(parsedDate.getSeconds())}`,
  ].join(' ')
}
