export const currency = (v: number | null | undefined) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 2 }).format(Number(v ?? 0));

export const number = (v: number | null | undefined) =>
  new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(Number(v ?? 0));

export const percent = (v: number | null | undefined) => `${number(Number(v ?? 0))}٪`;

export const dateAr = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(date);
};

export const dateTimeAr = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(date);
};
