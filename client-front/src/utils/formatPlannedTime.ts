// 서버 planned_time("10:00", 초가 있으면 "10:00:30") → "오전 10:00". 없거나 형식이 다르면 null
export function formatPlannedTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2];
  if (hour > 23) return null;
  const period = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${hour12}:${minute}`;
}
