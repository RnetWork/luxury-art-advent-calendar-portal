export const editionLabel = (n: number | null | undefined, size: number) =>
  n ? `No. ${String(n).padStart(String(size).length, "0")} / ${size}` : "Edition pending";

export const roman = (n: number) => {
  const map: Array<[number, string]> = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
};
