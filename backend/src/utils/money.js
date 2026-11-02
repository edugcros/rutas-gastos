export function isValidMoneyAmount(value) {
  if (!Number.isFinite(value) || value < 0) return false;
  const scaled = value * 100;
  return Number.isSafeInteger(Math.round(scaled)) && Math.abs(scaled - Math.round(scaled)) < 1e-7;
}

export function toMinorUnits(value) {
  if (!isValidMoneyAmount(value)) throw new RangeError('El importe debe ser válido y tener como máximo dos decimales.');
  return Math.round(value * 100);
}

export function fromMinorUnits(value) {
  return Number(value || 0) / 100;
}
