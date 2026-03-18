export function formatCode(prefix: string, n: number): string {
  return `${prefix}-${n.toString().padStart(4, "0")}`;
}

export function userCode(role: string, id: number): string {
  switch (role) {
    case "owner":
      return `OW-${id}`;
    case "admin":
      return `admin-${id}`;
    case "consultant":
      return formatCode("CO", id);
    case "client":
      return formatCode("C", id);
    default:
      return formatCode("U", id);
  }
}