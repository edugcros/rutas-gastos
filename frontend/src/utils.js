export const money = (amount, currency = 'ARS') => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency, maximumFractionDigits: 2,
}).format(Number(amount || 0));

export const distance = (meters) => {
  const km = Number(meters || 0) / 1000;
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(km) + ' km';
};

export const duration = (seconds) => {
  const totalMinutes = Math.round(Number(seconds || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
};

export const dateLabel = (value) => value
  ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value))
  : 'Sin fecha';

export const expenseCategories = [
  ['FUEL', 'Combustible'], ['FOOD', 'Comida / viáticos'], ['LODGING', 'Alojamiento'],
  ['TOLLS', 'Peajes'], ['REPAIRS', 'Reparaciones'], ['TRANSPORT', 'Transporte'],
  ['VETERINARY', 'Veterinaria'], ['OTHER', 'Otros'],
];

export const categoryLabel = (category) => expenseCategories.find(([key]) => key === category)?.[1] || 'Otros';
