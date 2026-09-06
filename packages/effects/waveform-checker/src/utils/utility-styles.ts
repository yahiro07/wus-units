export function npx(value: number) {
  return `${value}px`;
}

export function npx4(value: number) {
  return `${value * 4}px`;
}

export function flexH(gap?: number) {
  return {
    display: "flex",
    ...(gap && { gap: npx4(gap) }),
  } as const;
}

export function flexHA(gap?: number) {
  return {
    display: "flex",
    alignItems: "center",
    ...(gap && { gap: npx4(gap) }),
  } as const;
}

export function flexC(gap?: number) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...(gap && { gap: npx4(gap) }),
  } as const;
}

export function flexV(gap?: number) {
  return {
    display: "flex",
    flexDirection: "column",
    ...(gap && { gap: npx4(gap) }),
  } as const;
}

export function flexVA(gap?: number) {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    ...(gap && { gap: npx4(gap) }),
  } as const;
}

export function flexVC(gap?: number) {
  return {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    ...(gap && { gap: npx4(gap) }),
  } as const;
}
