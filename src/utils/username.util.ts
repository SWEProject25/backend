export function generateUsername(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] || '';
  const last = parts[1] || parts[0] || '';
  const randomNum = Math.floor(Math.random() * 10000);
  return `${last.toLowerCase()}${first.slice(0, 2).toLowerCase()}${randomNum}`;
}
