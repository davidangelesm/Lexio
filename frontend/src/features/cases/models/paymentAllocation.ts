import type { Installment } from "../../../types";

function cents(value: string): bigint {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return 0n;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function automaticAllocations(
  amount: string,
  installments: Pick<Installment, "id" | "number" | "balance">[],
): Record<number, string> {
  let remaining = cents(amount);
  const result: Record<number, string> = {};
  for (const quota of [...installments].sort(
    (a, b) => a.number - b.number || a.id - b.id,
  )) {
    const balance = cents(quota.balance);
    const applied = remaining < balance ? remaining : balance;
    if (applied > 0n) {
      result[quota.id] =
        `${applied / 100n}.${(applied % 100n).toString().padStart(2, "0")}`;
      remaining -= applied;
    }
    if (remaining === 0n) break;
  }
  return result;
}
