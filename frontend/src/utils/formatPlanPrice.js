export function formatPlanPrice(price, period = "monthly") {
  const amount =
    typeof price === "number"
      ? price
      : (price?.[period] ?? price?.monthly ?? price?.amount);

  if (amount == null || !Number.isFinite(Number(amount))) return "Free";
  if (Number(amount) === 0) return "Free";

  const currency = typeof price === "object" ? price.currency || "USD" : "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}
