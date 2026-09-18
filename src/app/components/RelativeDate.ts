export function relativeDate(iso: string): string {
  const timestamp = new Date(iso).getTime()
  if (Number.isNaN(timestamp)) return ''
  const seconds = Math.round((Date.now() - timestamp) / 1000)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [['second', 60], ['minute', 60], ['hour', 24], ['day', 7], ['week', 4.348], ['month', 12], ['year', Number.POSITIVE_INFINITY]]
  let value = seconds
  for (const [unit, span] of units) {
    if (Math.abs(value) < span) return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.round(value), unit)
    value /= span
  }
  return ''
}
