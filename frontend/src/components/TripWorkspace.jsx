import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowLeft, BedDouble, CalendarDays, Check, ChevronDown, CircleDollarSign, Clock3, Fuel, Landmark, MapPinned,
  PawPrint, Plus, Receipt, Route as RouteIcon, ShieldAlert, Sparkles, Trash2, TrendingDown, Truck, Utensils, Wallet, WifiOff, Wrench,
} from 'lucide-react';
import http from '../api/http.js';
import { GOOGLE_MAPS_BROWSER_KEY_CONFIGURED, ROUTE_SERVICE_CONFIGURED } from '../config/services.js';
import { tokens } from '../theme.js';
import MapCanvas from './MapCanvas.jsx';
import { EmptyState, KeyValue, Section, Stack, Stat, StatusChip } from './ui.jsx';
import { categoryLabel, dateLabel, distance, duration, expenseCategories, money } from '../utils.js';

// Evaluated per form, in the user's local time zone. A module-level constant
// would freeze the date at load time and, via toISOString(), shift it to UTC.
function localDateInput(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

const makeEmptyExpense = () => ({
  category: 'FUEL',
  description: '',
  amount: '',
  currency: 'ARS',
  deductFromProfit: true,
  paymentMethod: 'CASH',
  expenseDate: localDateInput(),
});

const categoryIcons = {
  FUEL: Fuel, FOOD: Utensils, LODGING: BedDouble, TOLLS: Landmark,
  REPAIRS: Wrench, TRANSPORT: Truck, VETERINARY: PawPrint, OTHER: CircleDollarSign,
};

const paymentLabels = { CASH: 'Efectivo', TRANSFER: 'Transferencia', CARD: 'Tarjeta', OTHER: 'Otro' };

export default function TripWorkspace({ tripId, online = navigator.onLine, onBack, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('route');
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expense, setExpense] = useState(makeEmptyExpense);
  const [showExpense, setShowExpense] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const plannerInFlightRef = useRef(false);
  const [savingRoute, setSavingRoute] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const mountedRef = useRef(true);
  const promptSeededRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadDetail() {
    const { data } = await http.get(`/trips/${tripId}`);
    if (!mountedRef.current) return data;
    setDetail(data);
    setSelectedIndex(data.trip.selectedRouteIndex ?? 0);
    setIncomeAmount(String(data.trip.income?.amount ?? 0));
    return data;
  }

  // Derivar los datos antes de declararlos como dependencias de efectos.
  // Leer currentTrip antes de esta inicialización producía un ReferenceError (TDZ).
  const summary = detail?.financialSummary;
  const currentTrip = detail?.trip;
  const displayedRoutes = plan?.routes || currentTrip?.routeOptions || [];

  useEffect(() => {
    loadDetail().catch((requestError) => { if (mountedRef.current) setError(requestError.userMessage || requestError.message || 'No se pudo cargar el viaje.'); });
  }, [tripId]);

  useEffect(() => {
    // Seed the default prompt once; clearing the field afterwards must not refill it.
    if (currentTrip && !promptSeededRef.current) {
      promptSeededRef.current = true;
      if (!prompt) setPrompt('Calculá el recorrido respetando exactamente el orden de las ubicaciones definidas arriba. Mostrame kilómetros, tiempo estimado, indicaciones por tramo y advertencias viales.');
    }
  }, [currentTrip?._id]);

  const activeRoute = displayedRoutes[selectedIndex];
  const expenses = detail?.expenses || [];

  const groupedExpenses = useMemo(() => {
    return expenses.reduce((groups, item) => {
      const key = item.currency || 'ARS';
      groups[key] ||= { total: 0, deducted: 0, nonDeducted: 0 };
      groups[key].total += item.amount;
      if (item.deductFromProfit) groups[key].deducted += item.amount;
      else groups[key].nonDeducted += item.amount;
      return groups;
    }, {});
  }, [expenses]);

  async function runPlanner(event) {
    event.preventDefault();

    // Lock synchronously; React state updates are asynchronous.
    if (plannerInFlightRef.current) return;

    const normalizedPrompt = prompt.trim();
    if (normalizedPrompt.length < 10) {
      setError('Describí el recorrido con al menos 10 caracteres útiles.');
      setSuccess('');
      return;
    }

    plannerInFlightRef.current = true;
    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await http.post('/routes/plan', {
        prompt: normalizedPrompt,
        route: {
          origin: currentTrip.origin,
          waypoints: currentTrip.waypoints || [],
          destination: currentTrip.destination,
        },
      });
      setPlan(data);
      setSelectedIndex(0);
    } catch (requestError) {
      setError(requestError.userMessage || 'No se pudo calcular el recorrido.');
    } finally {
      plannerInFlightRef.current = false;
      setBusy(false);
    }
  }

  async function persistRoute() {
    if (!plan?.routes?.length) return;
    setSavingRoute(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await http.put(`/trips/${tripId}/routes`, {
        intent: plan.intent,
        prompt,
        routes: plan.routes,
        selectedRouteIndex: selectedIndex,
      });
      setDetail((prev) => ({ ...prev, trip: data.trip }));
      setPlan(null);
      setSuccess('Alternativa guardada en el viaje.');
      onChanged();
    } catch (requestError) {
      setError(requestError.userMessage || 'No se pudo guardar la ruta.');
    } finally {
      setSavingRoute(false);
    }
  }

  async function addExpense(event) {
    event.preventDefault();
    if (savingExpense) return;
    setError('');
    setSuccess('');
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Ingresá un importe mayor que cero.');
      return;
    }
    setSavingExpense(true);
    try {
      await http.post(`/trips/${tripId}/expenses`, {
        ...expense,
        currency: currentTrip.income.currency,
        amount,
        expenseDate: new Date(`${expense.expenseDate}T12:00:00`).toISOString(),
      });
      setExpense(makeEmptyExpense());
      setShowExpense(false);
      await loadDetail();
      onChanged();
      setSuccess('Gasto registrado. El saldo fue recalculado.');
    } catch (requestError) {
      setError(requestError.userMessage || requestError.message || 'No se pudo registrar el gasto.');
    } finally {
      if (mountedRef.current) setSavingExpense(false);
    }
  }

  async function removeExpense(expenseId) {
    if (!window.confirm('¿Eliminar este gasto? El saldo se recalculará.')) return;
    setError('');
    try {
      await http.delete(`/trips/${tripId}/expenses/${expenseId}`);
      await loadDetail();
      onChanged();
      setSuccess('Gasto eliminado.');
    } catch (requestError) {
      setError(requestError.userMessage || 'No se pudo eliminar el gasto.');
    }
  }

  async function saveIncome(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    const amount = Number(incomeAmount);
    if (incomeAmount.trim() === '' || !Number.isFinite(amount) || amount < 0) {
      setError('Ingresá un monto de ingreso válido (cero o mayor).');
      return;
    }
    try {
      await http.patch(`/trips/${tripId}`, { incomeAmount: amount });
      await loadDetail();
      onChanged();
      setSuccess('Ingreso base actualizado.');
    } catch (requestError) {
      setError(requestError.userMessage || requestError.message || 'No se pudo actualizar el ingreso.');
    }
  }

  if (!currentTrip) {
    return (
      <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 1.5 }} role="status">
        <Box sx={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 3, color: tokens.brand, bgcolor: tokens.brandSoft }}>
          <RouteIcon size={20} />
        </Box>
        <Typography color="textSecondary">{error || 'Cargando viaje…'}</Typography>
        {error && <Button onClick={onBack} startIcon={<ArrowLeft size={16} />}>Volver a mis viajes</Button>}
      </Box>
    );
  }

  const stops = [currentTrip.origin, ...(currentTrip.waypoints || []), currentTrip.destination];
  const currency = summary?.currency;
  const savedRoute = currentTrip.routeOptions?.[currentTrip.selectedRouteIndex ?? 0];
  const mapChip = online && GOOGLE_MAPS_BROWSER_KEY_CONFIGURED ? 'Google Maps' : online ? 'Esquema local' : 'Vista sin conexión';

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 3, md: 4 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ minWidth: 0, width: '100%' }}>
          <Tooltip title="Volver a mis viajes">
            <IconButton onClick={onBack} aria-label="Volver a mis viajes" sx={{ mt: 0.25, border: `1px solid ${tokens.lineStrong}`, bgcolor: '#fff' }}><ArrowLeft size={18} /></IconButton>
          </Tooltip>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap" useFlexGap>
              <Typography component="h1" variant="h1" sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' }, overflowWrap: 'anywhere' }}>{currentTrip.name}</Typography>
              <StatusChip status={currentTrip.status} />
            </Stack>
            <Typography color="textSecondary" sx={{ mt: 0.5 }}>{stops.join(' → ')}</Typography>
          </Box>
        </Stack>
        <Chip icon={<CalendarDays size={15} />} label={`Inicio: ${dateLabel(currentTrip.startDate)}`} variant="outlined" sx={{ flexShrink: 0, bgcolor: '#fff', '& .MuiChip-icon': { color: 'text.secondary', ml: 1 } }} />
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' }, gap: { xs: 1.5, md: 2 }, mb: 3 }}>
        <Stat featured label="Ganancia disponible" value={money(summary?.availableProfit, currency)} icon={Wallet} hint="Ingreso menos gastos descontados" sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }} />
        <Stat label="Ingreso inicial" value={money(summary?.initialIncome, currency)} icon={CircleDollarSign} />
        <Stat label="Gastos descontados" value={`− ${money(summary?.deductibleExpenses, currency)}`} icon={TrendingDown} tone="negative" />
        <Stat label="Gastos registrados" value={summary?.expenseCount || 0} icon={Receipt} sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }} />
      </Box>

      <Tabs value={tab} onChange={(_, nextTab) => setTab(nextTab)} sx={{ mb: 3, borderBottom: `1px solid ${tokens.line}` }}>
        <Tab value="route" icon={<MapPinned size={17} />} iconPosition="start" label="Ruta" />
        <Tab value="expenses" icon={<Wallet size={17} />} iconPosition="start" label="Ingresos y gastos" />
      </Tabs>

      {(error || success) && (
        <Stack spacing={1.5} sx={{ mb: 3 }} aria-live="polite">
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
        </Stack>
      )}

      {tab === 'route' ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(340px,.8fr) minmax(0,1.4fr)' }, gap: 3, alignItems: 'start' }}>
          <Section title="Asistente de ruta" subtitle="Indicá tus preferencias y calculá alternativas" action={<Chip size="small" icon={<Sparkles size={13} />} label="IA + Maps" sx={{ bgcolor: tokens.brandSoft, color: tokens.brand, '& .MuiChip-icon': { color: 'inherit' } }} />}>
            {!online && (
              <Alert severity="warning" icon={<WifiOff size={17} />} sx={{ mb: 2.5 }}>
                <strong>Sin Internet.</strong> La planificación con IA no está disponible, pero tus rutas y gastos guardados siguen accesibles.
              </Alert>
            )}
            {online && !ROUTE_SERVICE_CONFIGURED && (
              <Alert severity="info" icon={<ShieldAlert size={17} />} sx={{ mb: 2.5 }}>
                <strong>Servicio de rutas no configurado.</strong> La gestión local funciona; configurá el endpoint antes de compilar.
              </Alert>
            )}

            <Typography variant="overline" color="textSecondary">Recorrido en orden</Typography>
            <Box component="ol" sx={{ listStyle: 'none', m: 0, mt: 1, mb: 3, p: 0 }}>
              {stops.map((point, index) => {
                const last = index === stops.length - 1;
                const isEnd = index === 0 || last;
                return (
                  <Box component="li" key={`${index}-${point}`} sx={{ display: 'flex', gap: 1.5, position: 'relative', pb: last ? 0 : 1.75 }}>
                    {!last && <Box sx={{ position: 'absolute', left: 9.5, top: 22, bottom: 0, width: '1px', bgcolor: tokens.lineStrong }} />}
                    <Box sx={{ width: 20, height: 20, flexShrink: 0, mt: 0.25, borderRadius: '50%', border: `2px solid ${isEnd ? tokens.brand : tokens.lineStrong}`, bgcolor: index === 0 ? tokens.brand : '#fff', zIndex: 1 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', lineHeight: 1.3 }}>{index === 0 ? 'Origen' : last ? 'Destino' : `Parada ${index}`}</Typography>
                      <Typography sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>{point}</Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>

            <Box component="form" onSubmit={runPlanner} sx={{ display: 'grid', gap: 2 }}>
              <TextField
                fullWidth
                multiline
                minRows={4}
                maxRows={10}
                label="Indicaciones y preferencias"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                required
                helperText="Caminos a evitar, rutas asfaltadas, peajes u otras preferencias."
                slotProps={{ htmlInput: { minLength: 10, maxLength: 2000 } }}
                placeholder="Ej.: Priorizá rutas asfaltadas y evitá peajes."
              />
              <Button type="submit" variant="contained" size="large" fullWidth disabled={busy || !online || !ROUTE_SERVICE_CONFIGURED} endIcon={busy ? undefined : <RouteIcon size={17} />}>
                {busy ? 'Calculando rutas…' : 'Calcular rutas'}
              </Button>
            </Box>

            {plan && (
              <Box sx={{ mt: 3, pt: 3, borderTop: `1px solid ${tokens.line}` }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle2">Alternativas encontradas</Typography>
                  <Chip size="small" label={`${plan.routes.length} ${plan.routes.length === 1 ? 'opción' : 'opciones'}`} variant="outlined" />
                </Stack>
                <Stack spacing={1}>
                  {plan.routes.map((route, index) => {
                    const active = selectedIndex === index;
                    return (
                      <Box
                        key={`${route.encodedPolyline.slice(0, 12)}-${index}`}
                        component="button"
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                        aria-pressed={active}
                        sx={{ width: '100%', p: 2, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', borderRadius: 2.5, border: `${active ? 2 : 1}px solid ${active ? tokens.brand : tokens.lineStrong}`, bgcolor: active ? tokens.brandSoft : '#fff', m: active ? 0 : '1px', transition: 'background-color .15s, border-color .15s', '&:hover': { borderColor: tokens.brand } }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                          <Typography noWrap sx={{ fontWeight: 600 }}>{route.description || `Alternativa ${index + 1}`}</Typography>
                          {active && <Check size={18} color={tokens.brand} />}
                        </Stack>
                        <Stack direction="row" alignItems="baseline" spacing={2} sx={{ mt: 0.5 }}>
                          <Typography className="tabular" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>{distance(route.distanceMeters)}</Typography>
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
                            <Clock3 size={14} />
                            <Typography variant="body2" sx={{ color: 'inherit' }}>{duration(route.durationSeconds)}</Typography>
                          </Stack>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
                <Button variant="contained" color="success" onClick={persistRoute} disabled={savingRoute} fullWidth size="large" endIcon={<Check size={17} />} sx={{ mt: 2 }}>
                  {savingRoute ? 'Guardando…' : 'Guardar alternativa seleccionada'}
                </Button>
              </Box>
            )}

            {!plan && savedRoute && (
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 3, p: 2, border: `1px solid ${tokens.line}`, borderRadius: 2.5, bgcolor: tokens.surfaceMuted }}>
                <Box sx={{ width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 2, color: tokens.positive, bgcolor: tokens.positiveSoft }}><Check size={18} /></Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2">Ruta guardada</Typography>
                  <Typography variant="body2" color="textSecondary">{distance(savedRoute.distanceMeters)} · {duration(savedRoute.durationSeconds)}</Typography>
                </Box>
                <Button size="small" variant="outlined" onClick={() => setSelectedIndex(currentTrip.selectedRouteIndex ?? 0)}>Ver en mapa</Button>
              </Stack>
            )}

            {(plan?.caveats?.length > 0 || (currentTrip.routeOptions?.length > 0 && !plan)) && (
              <Alert severity="warning" icon={<ShieldAlert size={17} />} sx={{ mt: 3, alignItems: 'flex-start' }}>
                <Typography variant="subtitle2" sx={{ color: 'inherit' }}>Información vial y seguridad</Typography>
                <Box component="ul" sx={{ pl: 2.25, my: 0.75, '& li': { mb: 0.5, fontSize: '0.8125rem', lineHeight: 1.55 } }}>
                  {(plan?.caveats || ['Pavimentación y cortes no verificados en tiempo real por esta ruta guardada.']).map((item, index) => <li key={index}>{item}</li>)}
                </Box>
                <Typography component="a" href="https://www.argentina.gob.ar/rutasnacionales" target="_blank" rel="noreferrer" sx={{ color: 'inherit', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'underline' }}>
                  Consultar estado de rutas de Vialidad Nacional ↗
                </Typography>
              </Alert>
            )}
          </Section>

          <Section title="Mapa del recorrido" subtitle="Visualización de la alternativa seleccionada" action={<Chip size="small" variant="outlined" label={mapChip} />}>
            <Box sx={{ minWidth: 0, overflow: 'hidden', borderRadius: 2.5, border: `1px solid ${tokens.line}` }}>
              <MapCanvas routes={displayedRoutes} selectedIndex={selectedIndex} origin={currentTrip.origin} destination={currentTrip.destination} waypoints={currentTrip.waypoints || []} online={online} />
            </Box>
            {activeRoute && (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 1.5, mt: 2 }}>
                {[['Distancia', distance(activeRoute.distanceMeters)], ['Duración estimada', duration(activeRoute.durationSeconds)], ['Calzada', 'Sin verificar']].map(([label, value]) => (
                  <Box key={label} sx={{ p: 1.5, border: `1px solid ${tokens.line}`, borderRadius: 2.5, bgcolor: tokens.surfaceMuted }}>
                    <Typography variant="caption" color="textSecondary">{label}</Typography>
                    <Typography className="tabular" sx={{ mt: 0.25, fontWeight: 700, fontSize: { xs: '0.9375rem', sm: '1.0625rem' } }}>{value}</Typography>
                  </Box>
                ))}
              </Box>
            )}
            {activeRoute?.legs?.some((leg) => leg.instructions?.length) && (
              <Accordion disableGutters elevation={0} sx={{ mt: 2, border: `1px solid ${tokens.line}`, borderRadius: '10px !important', overflow: 'hidden' }}>
                <AccordionSummary expandIcon={<ChevronDown size={18} />}><Typography variant="subtitle2">Indicaciones y nombres de vías</Typography></AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  {activeRoute.optimizedIntermediateWaypointIndex?.length > 0 && (
                    <Typography variant="body2" color="primary" sx={{ mb: 1.5 }}>
                      Orden optimizado de paradas: {activeRoute.optimizedIntermediateWaypointIndex.map((value) => value + 1).join(' → ')}
                    </Typography>
                  )}
                  {activeRoute.legs.map((leg, legIndex) => (
                    <Box key={legIndex} sx={{ mb: 2, '&:last-child': { mb: 0 } }}>
                      <Typography variant="subtitle2">Tramo {legIndex + 1}</Typography>
                      <Box component="ol" sx={{ pl: 2.5, mt: 0.75, mb: 0, '& li': { color: 'text.secondary', mb: 0.5, fontSize: '0.875rem', lineHeight: 1.55 } }}>
                        {leg.instructions.map((instruction, index) => <li key={`${legIndex}-${index}`}>{instruction}</li>)}
                      </Box>
                    </Box>
                  ))}
                </AccordionDetails>
              </Accordion>
            )}
            {activeRoute && <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1.5 }}>La línea representa el trazado calculado. La condición de cada tramo requiere verificación externa.</Typography>}
          </Section>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,1.6fr) minmax(300px,.8fr)' }, gap: 3, alignItems: 'start' }}>
          <Section
            title="Registro de gastos"
            subtitle="Movimientos del viaje"
            padded={false}
            action={<Button size="small" variant={showExpense ? 'outlined' : 'contained'} startIcon={showExpense ? undefined : <Plus size={16} />} onClick={() => setShowExpense((value) => !value)}>{showExpense ? 'Cerrar' : 'Nuevo gasto'}</Button>}
          >
            {showExpense && (
              <Box component="form" onSubmit={addExpense} sx={{ display: 'grid', gap: 2, p: { xs: 2, sm: 3 }, bgcolor: tokens.surfaceMuted, borderBottom: `1px solid ${tokens.line}` }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 2 }}>
                  <TextField select fullWidth label="Categoría" value={expense.category} onChange={(event) => setExpense((prev) => ({ ...prev, category: event.target.value }))}>
                    {expenseCategories.map(([key, value]) => <MenuItem key={key} value={key}>{value}</MenuItem>)}
                  </TextField>
                  <TextField fullWidth type="number" label={`Importe (${currentTrip.income.currency})`} value={expense.amount} onChange={(event) => setExpense((prev) => ({ ...prev, amount: event.target.value }))} required slotProps={{ htmlInput: { min: 0.01, step: 0.01, inputMode: 'decimal' } }} placeholder="0,00" />
                  <TextField fullWidth label="Detalle" value={expense.description} onChange={(event) => setExpense((prev) => ({ ...prev, description: event.target.value }))} required slotProps={{ htmlInput: { maxLength: 300 } }} placeholder="Ej.: carga de combustible" sx={{ gridColumn: { sm: '1 / -1' } }} />
                  <TextField fullWidth type="date" label="Fecha" value={expense.expenseDate} onChange={(event) => setExpense((prev) => ({ ...prev, expenseDate: event.target.value }))} required slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField select fullWidth label="Medio de pago" value={expense.paymentMethod} onChange={(event) => setExpense((prev) => ({ ...prev, paymentMethod: event.target.value }))}>
                    {Object.entries(paymentLabels).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
                  </TextField>
                </Box>
                <FormControlLabel
                  control={<Checkbox checked={expense.deductFromProfit} onChange={(event) => setExpense((prev) => ({ ...prev, deductFromProfit: event.target.checked }))} />}
                  label={<Box><Typography variant="subtitle2">Descontar de la ganancia</Typography><Typography variant="caption" color="textSecondary">Desmarcá para registrarlo sin afectar el saldo disponible.</Typography></Box>}
                  sx={{ alignItems: 'flex-start', m: 0, p: 1.5, borderRadius: 2.5, bgcolor: '#fff', border: `1px solid ${tokens.line}` }}
                />
                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                  <Button variant="outlined" onClick={() => setShowExpense(false)}>Cancelar</Button>
                  <Button type="submit" variant="contained" disabled={savingExpense}>{savingExpense ? 'Guardando…' : 'Guardar gasto'}</Button>
                </Stack>
              </Box>
            )}

            {expenses.length ? (
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {expenses.map((item) => {
                  const CategoryIcon = categoryIcons[item.category] || CircleDollarSign;
                  return (
                    <Stack component="li" key={item._id} direction="row" alignItems="center" spacing={2} sx={{ px: { xs: 2, sm: 3 }, py: 1.75, '&:not(:last-of-type)': { borderBottom: `1px solid ${tokens.line}` }, '&:hover': { bgcolor: tokens.surfaceMuted } }}>
                      <Box sx={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 2.5, color: tokens.inkMuted, bgcolor: '#F2F4F7' }}><CategoryIcon size={18} /></Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography noWrap sx={{ fontWeight: 600 }}>{item.description}</Typography>
                        <Typography variant="caption" color="textSecondary" noWrap sx={{ display: 'block' }}>
                          {categoryLabel(item.category)} · {dateLabel(item.expenseDate)} · {paymentLabels[item.paymentMethod] || 'Otro'}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography className="tabular" sx={{ fontWeight: 700 }}>{money(item.amount, item.currency)}</Typography>
                        <Typography variant="caption" sx={{ color: item.deductFromProfit ? 'error.main' : 'text.secondary' }}>{item.deductFromProfit ? 'Descuenta' : 'No descuenta'}</Typography>
                      </Box>
                      <Tooltip title="Eliminar gasto">
                        <IconButton onClick={() => removeExpense(item._id)} aria-label={`Eliminar gasto ${item.description}`} size="small" sx={{ '&:hover': { color: 'error.main', bgcolor: tokens.negativeSoft } }}><Trash2 size={16} /></IconButton>
                      </Tooltip>
                    </Stack>
                  );
                })}
              </Box>
            ) : (
              <EmptyState icon={Receipt} title="Todavía no hay gastos" description="Registrá combustible, viáticos, peajes y otros movimientos del viaje." action={<Button variant="outlined" startIcon={<Plus size={16} />} onClick={() => setShowExpense(true)}>Agregar primer gasto</Button>} />
            )}
          </Section>

          <Section title="Estado de la ganancia" subtitle="Resumen económico del viaje">
            <Box component="form" onSubmit={saveIncome} sx={{ display: 'grid', gap: 1.5 }}>
              <TextField
                fullWidth
                type="number"
                label={`Ingreso inicial (${currentTrip.income.currency})`}
                value={incomeAmount}
                onChange={(event) => setIncomeAmount(event.target.value)}
                slotProps={{
                  htmlInput: { min: 0, step: 0.01, inputMode: 'decimal' },
                  input: { startAdornment: <InputAdornment position="start">{currentTrip.income.currency === 'USD' ? 'US$' : '$'}</InputAdornment> },
                }}
              />
              <Button type="submit" variant="outlined" fullWidth>Actualizar ingreso</Button>
            </Box>
            <Divider sx={{ my: 2.5 }} />
            <Stack spacing={1.75}>
              <KeyValue label="Ingreso inicial" value={money(summary?.initialIncome, currency)} />
              <KeyValue label="Gastos que descuentan" value={`− ${money(summary?.deductibleExpenses, currency)}`} tone="negative" />
              <Divider />
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="subtitle2">Disponible</Typography>
                <Typography className="tabular" sx={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: (summary?.availableProfit ?? 0) < 0 ? 'error.main' : 'success.main' }}>{money(summary?.availableProfit, currency)}</Typography>
              </Stack>
              <Divider />
              <KeyValue label="Gastos que no descuentan" value={money(summary?.nonDeductibleExpenses, currency)} />
              <KeyValue label="Total de gastos" value={money(summary?.totalExpenses, currency)} />
            </Stack>
            <Alert severity="info" sx={{ mt: 2.5, alignItems: 'flex-start' }}>
              El ingreso original no cambia al cargar gastos: el saldo se calcula con los movimientos marcados para descuento.
            </Alert>
            {summary?.mixedCurrencyWarning && (
              <Alert severity="warning" sx={{ mt: 1.5 }}>Hay gastos en otra moneda. No se convierten automáticamente.</Alert>
            )}
          </Section>
        </Box>
      )}
    </Box>
  );
}
