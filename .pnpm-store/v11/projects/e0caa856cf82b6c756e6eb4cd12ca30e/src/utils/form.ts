export const str = (data: FormData, key: string): string =>
  String(data.get(key) || "");
export const num = (data: FormData, key: string): number =>
  Number(str(data, key));
