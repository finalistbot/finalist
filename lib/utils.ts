export function randomString(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function discordTimestamp(date: Date, format: string = "f"): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${format}>`;
}

export function mentionUser(userId: string): string {
  return `<@${userId}>`;
}

export async function supress<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (e) {
    return null;
  }
}
