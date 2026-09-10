/** Categorical palette matching the Pega insight charts. */
export const PALETTE = ['#2b56d4', '#0f9d8a', '#f59f3c', '#8b5cf6', '#e5556e', '#0891b2', '#84a12f', '#c2410c'];

export const colorAt = (i: number) => PALETTE[i % PALETTE.length];
