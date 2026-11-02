import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowLeft, CalendarDays, Check, ChevronDown, CircleDollarSign, Clock3, Fuel, MapPinned,
  Plus, Route as RouteIcon, ShieldAlert, Trash2, Wallet, WifiOff,
} from 'lucide-react';
import http from '../api/http.js';
import { GOOGLE_MAPS_BROWSER_KEY_CONFIGURED, ROUTE_SERVICE_CONFIGURED } from '../config/services.js';
import MapCanvas from './MapCanvas.jsx';
import { categoryLabel, dateLabel, distance, duration, expenseCategories, money } from '../utils.js';

const EMPTY_EXPENSE = {
  category: 'FUEL',
  description: '',
  amount: '',
  currency: 'ARS',
  deductFromProfit: true,
  paymentMethod: 'CASH',
  expenseDate: new Date().toISOString().slice(0, 10),
};

const tripStatus = {
  PLANNED: { label: 'PLANIFICADO', color: 'info' },
  IN_PROGRESS: { label: 'EN CURSO', color: 'warning' },
  COMPLETED: { label: 'COMPLETADO', color: 'success' },
  CANCELLED: { label: 'CANCELADO', color: 'error' },
};

export default function TripWorkspace({ tripId, online = navigator.onLine, onBack, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('route');
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expense, setExpense] = useState(EMPTY_EXPENSE);
  const [showExpense, setShowExpense] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const plannerInFlightRef = useRef(false);
  const [savingRoute, setSavingRoute] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadDetail() {
    const { data } = await http.get(`/trips/${tripId}`);
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
    loadDetail().catch((requestError) => setError(requestError.userMessage || 'No se pudo cargar el viaje.'));
  }, [tripId]);

  useEffect(() => {
    if (currentTrip && !prompt) {
      setPrompt(`Calculá la mejor ruta desde ${currentTrip.origin} hasta ${currentTrip.destination}. Mostrame alternativas si están disponibles, kilómetros, tiempo estimado y advertencias viales.`);
    }
  }, [currentTrip?._id, currentTrip?.origin, currentTrip?.destination, prompt]);

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
      const { data } = await http.post('/routes/plan', { prompt: normalizedPrompt });
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
    setError('');
    setSuccess('');
    try {
      await http.post(`/trips/${tripId}/expenses`, {
        ...expense,
        currency: currentTrip.income.currency,
        amount: Number(expense.amount),
        expenseDate: new Date(`${expense.expenseDate}T12:00:00`).toISOString(),
      });
      setExpense(EMPTY_EXPENSE);
      setShowExpense(false);
      await loadDetail();
      onChanged();
      setSuccess('Gasto registrado. El saldo fue recalculado.');
    } catch (requestError) {
      setError(requestError.userMessage || 'No se pudo registrar el gasto.');
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
    try {
      await http.patch(`/trips/${tripId}`, { incomeAmount: Number(incomeAmount) });
      await loadDetail();
      onChanged();
      setSuccess('Ingreso base actualizado.');
    } catch (requestError) {
      setError(requestError.userMessage || 'No se pudo actualizar el ingreso.');
    }
  }

  if (!currentTrip) {
    return (
      <Box sx={{ minHeight: 250, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 1 }}>
        <Box sx={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 3, color: '#fff', background: 'linear-gradient(135deg,#5967E8,#C45FA8)' }}>
          <RouteIcon size={20} />
        </Box>
        <Typography color="text.secondary" sx={{ fontSize: 12 }}>Cargando viaje...</Typography>
      </Box>
    );
  }

  const status = tripStatus[currentTrip.status] || { label: currentTrip.status, color: 'default' };

  return (
    <Box sx={{ maxWidth: 1600, mx: 'auto', px: { xs: 1.5, sm: 2.5, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ mb: 2.7 }}>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ flex: 1, minWidth: 0 }}>
          <Tooltip title="Volver a mis viajes">
            <IconButton onClick={onBack} aria-label="Volver" sx={{ width: 42, height: 42, color: '#5967D6', bgcolor: '#fff', border: '1px solid #E5E8F3', borderRadius: 2.7, boxShadow: '0 4px 12px rgba(48,58,118,.05)' }}>
              <ArrowLeft size={19} />
            </IconButton>
          </Tooltip>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={.8} flexWrap="wrap">
              <Typography sx={{ color: 'primary.main', fontSize: 9, fontWeight: 900, letterSpacing: 1.3 }}>VIAJE</Typography>
              <Chip size="small" label={status.label} color={status.color} sx={{ height: 22, fontSize: 9 }} />
            </Stack>
            <Typography component="h1" noWrap sx={{ mt: .3, color: '#202744', fontSize: { xs: 21, sm: 25 }, fontWeight: 900, letterSpacing: '-.04em' }}>{currentTrip.name}</Typography>
            <Typography color="text.secondary" sx={{ fontSize: 11 }}>
              {currentTrip.origin} <Box component="span" sx={{ color: '#8991AE', mx: .4 }}>→</Box> {currentTrip.destination}
            </Typography>
          </Box>
        </Stack>
        <Chip icon={<CalendarDays size={15} />} label={dateLabel(currentTrip.startDate)} variant="outlined" sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, bgcolor: '#fff', borderColor: '#E4E8F2', color: '#65718F', fontSize: 10, fontWeight: 750, height: 33 }} />
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', lg: '1.45fr repeat(3,minmax(0,1fr))' }, gap: 1.2, mb: 2.6 }}>
        <Card sx={{ gridColumn: { xs: '1 / -1', lg: 'auto' }, overflow: 'hidden', color: '#fff', background: 'linear-gradient(120deg,#30429C 0%,#5869E9 58%,#8B67D8 100%)', border: 0, boxShadow: '0 12px 25px rgba(72,84,188,.18)' }}>
          <CardContent sx={{ p: 2.1, '&:last-child': { pb: 2.1 } }}>
            <Typography sx={{ color: 'rgba(255,255,255,.78)', fontSize: 9, fontWeight: 850, letterSpacing: 1.2 }}>GANANCIA DISPONIBLE</Typography>
            <Typography sx={{ mt: .8, color: '#fff', fontSize: { xs: 22, sm: 27 }, fontWeight: 900, letterSpacing: '-.04em', overflowWrap: 'anywhere' }}>{money(summary?.availableProfit, summary?.currency)}</Typography>
            <Typography sx={{ mt: .3, color: 'rgba(255,255,255,.72)', fontSize: 9.5 }}>Ingreso inicial menos gastos descontados</Typography>
          </CardContent>
        </Card>
        <Card sx={{ background: 'linear-gradient(145deg,#FFFFFF,#F1F4FF)', borderColor: '#E1E6FA' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography color="text.secondary" sx={{ fontSize: 10, fontWeight: 750 }}>Ingreso inicial</Typography>
              <Avatar variant="rounded" sx={{ width: 30, height: 30, bgcolor: '#E4E9FF', color: '#5967DB' }}><Wallet size={16} /></Avatar>
            </Stack>
            <Typography sx={{ mt: 1.1, color: '#2D385D', fontSize: 15, fontWeight: 850, overflowWrap: 'anywhere' }}>{money(summary?.initialIncome, summary?.currency)}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ background: 'linear-gradient(145deg,#FFFFFF,#FFF1F4)', borderColor: '#F3E0E7' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography color="text.secondary" sx={{ fontSize: 10, fontWeight: 750 }}>Gastos descontados</Typography>
              <Avatar variant="rounded" sx={{ width: 30, height: 30, bgcolor: '#FFE4EA', color: '#C34F6B' }}><CircleDollarSign size={16} /></Avatar>
            </Stack>
            <Typography sx={{ mt: 1.1, color: '#B14F67', fontSize: 15, fontWeight: 850, overflowWrap: 'anywhere' }}>− {money(summary?.deductibleExpenses, summary?.currency)}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ background: 'linear-gradient(145deg,#FFFFFF,#ECFAF7)', borderColor: '#D8EFE8' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography color="text.secondary" sx={{ fontSize: 10, fontWeight: 750 }}>Gastos registrados</Typography>
              <Avatar variant="rounded" sx={{ width: 30, height: 30, bgcolor: '#DDF5ED', color: '#12866A' }}><Fuel size={16} /></Avatar>
            </Stack>
            <Typography sx={{ mt: 1.1, color: '#187A67', fontSize: 19, fontWeight: 900 }}>{summary?.expenseCount || 0}</Typography>
          </CardContent>
        </Card>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, nextTab) => setTab(nextTab)}
        sx={{ mb: 2.2, borderBottom: '1px solid #E4E8F2', '& .MuiTab-root': { px: { xs: 1, sm: 2 }, minWidth: 0, mr: { xs: 1.3, sm: 2 }, fontSize: { xs: 10, sm: 12 } } }}
      >
        <Tab value="route" icon={<MapPinned size={17} />} iconPosition="start" label="Planificación de ruta" />
        <Tab value="expenses" icon={<Wallet size={17} />} iconPosition="start" label="Ingresos y gastos" />
      </Tabs>

      <Stack spacing={1.2} sx={{ mb: error || success ? 2 : 0 }}>
        {error && <Alert severity="error" variant="filled" onClose={() => setError('')} sx={{ borderRadius: 3 }}>{error}</Alert>}
        {success && <Alert severity="success" variant="outlined" onClose={() => setSuccess('')} sx={{ borderRadius: 3, bgcolor: '#F1FAF6' }}>{success}</Alert>}
      </Stack>

      {tab === 'route' ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px,.82fr) minmax(0,1.38fr)' }, gridTemplateAreas: { xs: '"map" "controls"', lg: '"controls map"' }, gap: 1.8, alignItems: 'start' }}>
          <Card sx={{ gridArea: 'controls', minWidth: 0 }}>
            <CardContent sx={{ p: { xs: 1.8, sm: 2.3 }, '&:last-child': { pb: { xs: 1.8, sm: 2.3 } } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <Box>
                  <Typography sx={{ color: 'primary.main', fontSize: 9, fontWeight: 900, letterSpacing: 1.3 }}>ASISTENTE DE RUTA</Typography>
                  <Typography component="h2" sx={{ mt: .4, color: '#252D4C', fontSize: 18, fontWeight: 900 }}>¿A dónde vamos?</Typography>
                </Box>
                <Chip size="small" label="IA + MAPS" color="secondary" variant="outlined" sx={{ bgcolor: '#FFF7FC', fontSize: 9 }} />
              </Stack>

              {!online && (
                <Alert severity="warning" icon={<WifiOff size={17} />} sx={{ mb: 1.8, borderRadius: 2.7, fontSize: 11 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 800 }}>Planificación con IA no disponible sin Internet</Typography>
                  <Typography sx={{ fontSize: 10 }}>Los viajes, gastos y rutas guardadas siguen disponibles en este equipo. Gemini y Google Routes requieren conexión.</Typography>
                </Alert>
              )}
              {online && !ROUTE_SERVICE_CONFIGURED && (
                <Alert severity="info" icon={<ShieldAlert size={17} />} sx={{ mb: 1.8, borderRadius: 2.7, fontSize: 11 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 800 }}>Servicio de rutas no configurado</Typography>
                  <Typography sx={{ fontSize: 10 }}>La gestión local está operativa. Configurá el endpoint remoto antes de compilar la aplicación.</Typography>
                </Alert>
              )}

              <Box component="form" onSubmit={runPlanner} sx={{ display: 'grid', gap: 1.3 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={5}
                  label="Describí el recorrido"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  required
                  helperText="Podés indicar paradas, prioridades, caminos que querés evitar y preferencias."
                  slotProps={{
                    htmlInput: { minLength: 10, maxLength: 2000 },
                  }}
                  placeholder="Ej.: Salgo desde Río Cuarto hacia Chos Malal, pasando por Neuquén. Priorizá rutas asfaltadas y evitá peajes..."
                />
                <Button type="submit" variant="contained" fullWidth disabled={busy || !online || !ROUTE_SERVICE_CONFIGURED} endIcon={busy ? undefined : <RouteIcon size={17} />} sx={{ minHeight: 48 }}>
                  {busy ? 'Interpretando y calculando...' : 'Interpretar y calcular rutas'}
                </Button>
              </Box>

              {plan && (
                <Stack spacing={1.2} sx={{ mt: 2.5, pt: 2, borderTop: '1px solid #ECEFF6' }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography sx={{ color: '#273054', fontSize: 12, fontWeight: 850 }}>Alternativas encontradas</Typography>
                    <Chip size="small" color="primary" label={`${plan.routes.length} opciones`} />
                  </Stack>
                  {plan.routes.map((route, index) => (
                    <Button
                      key={`${route.encodedPolyline.slice(0, 12)}-${index}`}
                      variant={selectedIndex === index ? 'contained' : 'outlined'}
                      color="primary"
                      onClick={() => setSelectedIndex(index)}
                      sx={{
                        width: '100%', display: 'block', py: 1.3, px: 1.5, textAlign: 'left', borderRadius: 2.7,
                        color: selectedIndex === index ? '#fff' : '#334061',
                        background: selectedIndex === index ? 'linear-gradient(110deg,#5967E8,#8065DE)' : '#fff',
                        borderColor: selectedIndex === index ? 'transparent' : '#E0E5F1',
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Typography noWrap sx={{ fontSize: 11, fontWeight: 800, maxWidth: '82%', color: 'inherit' }}>{route.description || `Alternativa ${index + 1}`}</Typography>
                        {selectedIndex === index && <Check size={16} />}
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: .8 }}>
                        <Typography sx={{ fontSize: 16, fontWeight: 900, color: 'inherit' }}>{distance(route.distanceMeters)}</Typography>
                        <Stack direction="row" spacing={.6} alignItems="center">
                          <Clock3 size={13} />
                          <Typography sx={{ fontSize: 10, color: 'inherit' }}>{duration(route.durationSeconds)}</Typography>
                        </Stack>
                      </Stack>
                    </Button>
                  ))}
                  <Button variant="contained" color="success" onClick={persistRoute} disabled={savingRoute} fullWidth endIcon={<Check size={16} />} sx={{ mt: .5, background: 'linear-gradient(110deg,#0E947A,#39B98A)' }}>
                    {savingRoute ? 'Guardando...' : 'Guardar alternativa seleccionada'}
                  </Button>
                </Stack>
              )}

              {!plan && currentTrip.routeOptions?.length > 0 && (
                <Paper variant="outlined" sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mt: 2.2, p: 1.5, borderRadius: 3, borderColor: '#E3E8F3', bgcolor: '#FBFCFF' }}>
                  <Avatar variant="rounded" sx={{ width: 39, height: 39, bgcolor: '#E7EBFF', color: '#5967D9' }}><RouteIcon size={18} /></Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ color: '#2A3557', fontSize: 11, fontWeight: 850 }}>Ruta guardada</Typography>
                    <Typography color="text.secondary" sx={{ fontSize: 10 }}>
                      {distance(currentTrip.routeOptions[currentTrip.selectedRouteIndex ?? 0]?.distanceMeters)} · {duration(currentTrip.routeOptions[currentTrip.selectedRouteIndex ?? 0]?.durationSeconds)}
                    </Typography>
                  </Box>
                  <Button size="small" variant="outlined" onClick={() => setSelectedIndex(currentTrip.selectedRouteIndex ?? 0)}>Ver en mapa</Button>
                </Paper>
              )}

              {(plan?.caveats?.length > 0 || (currentTrip.routeOptions?.length > 0 && !plan)) && (
                <Alert severity="warning" variant="outlined" icon={<ShieldAlert size={17} />} sx={{ mt: 2, borderRadius: 3, bgcolor: '#FFFBF4' }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 850 }}>Información vial y seguridad</Typography>
                  <Box component="ul" sx={{ pl: 2, my: .8, '& li': { mb: .4, fontSize: 10, lineHeight: 1.55 } }}>
                    {(plan?.caveats || ['Pavimentación y cortes no verificados en tiempo real por esta ruta guardada.']).map((item, index) => <li key={index}>{item}</li>)}
                  </Box>
                  <Typography component="a" href="https://www.argentina.gob.ar/rutasnacionales" target="_blank" rel="noreferrer" sx={{ color: '#5E6FC9', fontSize: 10, fontWeight: 750, textDecoration: 'underline' }}>
                    Consultar estado de rutas de Vialidad Nacional ↗
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card sx={{ gridArea: 'map', minWidth: 0 }}>
            <CardContent sx={{ p: { xs: 1.4, sm: 2 }, '&:last-child': { pb: { xs: 1.4, sm: 2 } } }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
                <Box>
                  <Typography sx={{ color: 'primary.main', fontSize: 9, fontWeight: 900, letterSpacing: 1.3 }}>VISUALIZACIÓN</Typography>
                  <Typography component="h2" sx={{ mt: .4, color: '#252D4C', fontSize: 17, fontWeight: 900 }}>Mapa del recorrido</Typography>
                </Box>
                <Chip size="small" label={online && GOOGLE_MAPS_BROWSER_KEY_CONFIGURED ? 'Google Maps' : online ? 'Esquema local' : 'Vista offline'} color={online && GOOGLE_MAPS_BROWSER_KEY_CONFIGURED ? 'success' : 'default'} variant="outlined" sx={{ fontSize: 9 }} />
              </Stack>
              <MapCanvas routes={displayedRoutes} selectedIndex={selectedIndex} origin={currentTrip.origin} destination={currentTrip.destination} online={online} />
              {activeRoute && (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 1, mt: 1.5 }}>
                  <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2.5, bgcolor: '#F4F6FF', borderColor: '#E3E8FB' }}>
                    <Typography sx={{ color: '#7B83A0', fontSize: 9, fontWeight: 700 }}>Distancia</Typography>
                    <Typography sx={{ mt: .3, color: '#29345E', fontSize: 13, fontWeight: 900 }}>{distance(activeRoute.distanceMeters)}</Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2.5, bgcolor: '#F1FAF8', borderColor: '#D9EEE8' }}>
                    <Typography sx={{ color: '#7B83A0', fontSize: 9, fontWeight: 700 }}>Duración estimada</Typography>
                    <Typography sx={{ mt: .3, color: '#207762', fontSize: 13, fontWeight: 900 }}>{duration(activeRoute.durationSeconds)}</Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2.5, bgcolor: '#FFF8EC', borderColor: '#F2E6CF' }}>
                    <Typography sx={{ color: '#8A7C61', fontSize: 9, fontWeight: 700 }}>Calzada</Typography>
                    <Typography sx={{ mt: .3, color: '#A07832', fontSize: 11, fontWeight: 850 }}>Sin verificar</Typography>
                  </Paper>
                </Box>
              )}
              {activeRoute?.legs?.some((leg) => leg.instructions?.length) && (
                <Accordion disableGutters elevation={0} sx={{ mt: 1.5, border: '1px solid #E6EAF3', borderRadius: '12px !important', '&::before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ChevronDown size={17} />} sx={{ minHeight: 44, '& .MuiAccordionSummary-content': { my: 1 } }}>
                    <Typography sx={{ color: '#53617F', fontSize: 11, fontWeight: 800 }}>Ver indicaciones y nombres de vías</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    {activeRoute.optimizedIntermediateWaypointIndex?.length > 0 && (
                      <Typography sx={{ color: '#5967C9', fontSize: 10, mb: 1 }}>
                        Orden optimizado de paradas (índices): {activeRoute.optimizedIntermediateWaypointIndex.map((value) => value + 1).join(' → ')}
                      </Typography>
                    )}
                    {activeRoute.legs.map((leg, legIndex) => (
                      <Box key={legIndex} sx={{ mb: 1.5 }}>
                        <Typography sx={{ color: '#33405F', fontSize: 10, fontWeight: 850 }}>Tramo {legIndex + 1}</Typography>
                        <Box component="ol" sx={{ pl: 2.2, mt: .6, mb: 0, '& li': { color: '#687591', mb: .5, fontSize: 10, lineHeight: 1.55 } }}>
                          {leg.instructions.map((instruction, index) => <li key={`${legIndex}-${index}`}>{instruction}</li>)}
                        </Box>
                      </Box>
                    ))}
                  </AccordionDetails>
                </Accordion>
              )}
              {activeRoute && (
                <Typography sx={{ mt: 1.2, color: '#76809B', fontSize: 9.5, lineHeight: 1.55 }}>
                  La línea representa el trazado calculado. La condición de cada tramo requiere verificación externa.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1.55fr) minmax(280px,.8fr)' }, gap: 1.8, alignItems: 'start' }}>
          <Card>
            <CardContent sx={{ p: { xs: 1.8, sm: 2.3 }, '&:last-child': { pb: { xs: 1.8, sm: 2.3 } } }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
                <Box>
                  <Typography sx={{ color: 'primary.main', fontSize: 9, fontWeight: 900, letterSpacing: 1.3 }}>MOVIMIENTOS DEL VIAJE</Typography>
                  <Typography component="h2" sx={{ mt: .4, color: '#252D4C', fontSize: 18, fontWeight: 900 }}>Registro de gastos</Typography>
                </Box>
                <Button size="small" variant="contained" startIcon={<Plus size={16} />} onClick={() => setShowExpense((value) => !value)}>
                  Nuevo gasto
                </Button>
              </Stack>

              {showExpense && (
                <Paper variant="outlined" sx={{ mb: 2, p: { xs: 1.5, sm: 2 }, borderRadius: 3, bgcolor: '#FAFBFF', borderColor: '#E3E8F3' }}>
                  <Box component="form" onSubmit={addExpense} sx={{ display: 'grid', gap: 1.5 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1.5 }}>
                      <TextField select fullWidth label="Categoría" value={expense.category} onChange={(event) => setExpense((prev) => ({ ...prev, category: event.target.value }))}>
                        {expenseCategories.map(([key, value]) => <MenuItem key={key} value={key}>{value}</MenuItem>)}
                      </TextField>
                      <TextField fullWidth type="number" label={`Importe (${currentTrip.income.currency})`} value={expense.amount} onChange={(event) => setExpense((prev) => ({ ...prev, amount: event.target.value }))} required slotProps={{ htmlInput: { min: .01, step: .01 } }} placeholder="0,00" />
                      <TextField fullWidth label="Detalle" value={expense.description} onChange={(event) => setExpense((prev) => ({ ...prev, description: event.target.value }))} required slotProps={{ htmlInput: { maxLength: 300 } }} placeholder="Ej.: carga de combustible en estación..." sx={{ gridColumn: { sm: '1 / -1' } }} />
                      <TextField fullWidth type="date" label="Fecha" value={expense.expenseDate} onChange={(event) => setExpense((prev) => ({ ...prev, expenseDate: event.target.value }))} required slotProps={{ inputLabel: { shrink: true } }} />
                      <TextField select fullWidth label="Medio de pago" value={expense.paymentMethod} onChange={(event) => setExpense((prev) => ({ ...prev, paymentMethod: event.target.value }))}>
                        <MenuItem value="CASH">Efectivo</MenuItem>
                        <MenuItem value="TRANSFER">Transferencia</MenuItem>
                        <MenuItem value="CARD">Tarjeta</MenuItem>
                        <MenuItem value="OTHER">Otro</MenuItem>
                      </TextField>
                    </Box>
                    <FormControlLabel
                      control={<Checkbox checked={expense.deductFromProfit} onChange={(event) => setExpense((prev) => ({ ...prev, deductFromProfit: event.target.checked }))} />}
                      label={<Box><Typography sx={{ fontSize: 11, fontWeight: 800 }}>Descontar de la ganancia</Typography><Typography color="text.secondary" sx={{ fontSize: 10 }}>Desmarcá si querés registrar el gasto sin afectar el saldo disponible.</Typography></Box>}
                      sx={{ alignItems: 'flex-start', m: 0, p: 1.1, borderRadius: 2.5, bgcolor: '#fff', border: '1px solid #E5EAF3' }}
                    />
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                      <Button variant="outlined" color="inherit" onClick={() => setShowExpense(false)}>Cancelar</Button>
                      <Button type="submit" variant="contained" color="primary">Guardar gasto</Button>
                    </Stack>
                  </Box>
                </Paper>
              )}

              {expenses.length ? (
                <List disablePadding>
                  {expenses.map((item, index) => (
                    <Box key={item._id}>
                      <ListItem
                        disableGutters
                        secondaryAction={
                          <Tooltip title="Eliminar gasto">
                            <IconButton edge="end" size="small" onClick={() => removeExpense(item._id)} aria-label="Eliminar gasto" sx={{ color: '#BD5366', border: '1px solid #F2DFE4', borderRadius: 2 }}>
                              <Trash2 size={15} />
                            </IconButton>
                          </Tooltip>
                        }
                        sx={{ py: 1.5, pr: 5.5, gap: 1 }}
                      >
                        <ListItemAvatar sx={{ minWidth: 46 }}>
                          <Avatar variant="rounded" sx={{ width: 39, height: 39, color: '#5D6ED1', bgcolor: '#EDF0FF', border: '1px solid #E0E6FF' }}>
                            <Fuel size={17} />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={<Typography noWrap sx={{ color: '#2D3655', fontSize: 11, fontWeight: 850 }}>{item.description}</Typography>}
                          secondary={<Typography sx={{ color: '#7D86A0', fontSize: 9.5 }}>{categoryLabel(item.category)} · {dateLabel(item.expenseDate)}</Typography>}
                        />
                        <Box sx={{ minWidth: { xs: 100, sm: 135 }, textAlign: 'right' }}>
                          <Typography sx={{ color: '#2A3453', fontSize: 12, fontWeight: 850 }}>{money(item.amount, item.currency)}</Typography>
                          <Typography sx={{ color: item.deductFromProfit ? '#B64E67' : '#6B7E96', fontSize: 9 }}>
                            {item.deductFromProfit ? 'Descontado de ganancia' : 'No afecta ganancia'}
                          </Typography>
                        </Box>
                      </ListItem>
                      {index < expenses.length - 1 && <Divider sx={{ borderColor: '#EDF0F6' }} />}
                    </Box>
                  ))}
                </List>
              ) : (
                <Paper variant="outlined" sx={{ minHeight: 220, p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', borderRadius: 3, borderStyle: 'dashed', borderColor: '#D8DEEF', bgcolor: '#FCFCFF' }}>
                  <Avatar sx={{ width: 55, height: 55, mb: 1.5, color: '#fff', background: 'linear-gradient(135deg,#6C7AF0,#B66BCF)' }}>
                    <CircleDollarSign size={25} />
                  </Avatar>
                  <Typography sx={{ color: '#303A5D', fontSize: 13, fontWeight: 850 }}>Todavía no hay gastos</Typography>
                  <Typography color="text.secondary" sx={{ maxWidth: 280, mt: .5, fontSize: 10.5 }}>Registrá combustible, viáticos, peajes y otros movimientos.</Typography>
                  <Button variant="outlined" size="small" startIcon={<Plus size={15} />} onClick={() => setShowExpense(true)} sx={{ mt: 1.5 }}>Agregar primer gasto</Button>
                </Paper>
              )}
            </CardContent>
          </Card>

          <Stack spacing={1.8}>
            <Card>
              <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
                <Typography sx={{ color: 'primary.main', fontSize: 9, fontWeight: 900, letterSpacing: 1.3 }}>RESUMEN ECONÓMICO</Typography>
                <Typography component="h2" sx={{ mt: .4, mb: 2, color: '#252D4C', fontSize: 18, fontWeight: 900 }}>Estado de la ganancia</Typography>
                <Box component="form" onSubmit={saveIncome} sx={{ display: 'grid', gap: 1.2 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label={`Ingreso / ganancia inicial (${currentTrip.income.currency})`}
                    value={incomeAmount}
                    onChange={(event) => setIncomeAmount(event.target.value)}
                    slotProps={{
                      htmlInput: { min: 0, step: .01 },
                      input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                    }}
                  />
                  <Button type="submit" variant="outlined" fullWidth>Actualizar ingreso</Button>
                </Box>
                <Divider sx={{ my: 2, borderColor: '#E9EDF5' }} />
                <Stack spacing={1.6}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography color="text.secondary" sx={{ fontSize: 10.5 }}>Ingreso inicial</Typography>
                    <Typography sx={{ color: '#37415F', fontSize: 11, fontWeight: 800 }}>{money(summary?.initialIncome, summary?.currency)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography color="text.secondary" sx={{ fontSize: 10.5 }}>Gastos que descuentan</Typography>
                    <Typography sx={{ color: '#B84D65', fontSize: 11, fontWeight: 800 }}>− {money(summary?.deductibleExpenses, summary?.currency)}</Typography>
                  </Stack>
                  <Paper variant="outlined" sx={{ p: 1.6, borderRadius: 3, borderColor: '#CFE9DE', background: 'linear-gradient(135deg,#EFFAF5,#E6F7F0)' }}>
                    <Typography sx={{ color: '#43846D', fontSize: 10, fontWeight: 800 }}>DISPONIBLE</Typography>
                    <Typography sx={{ mt: .4, color: '#0A8060', fontSize: 23, fontWeight: 900, letterSpacing: '-.04em', overflowWrap: 'anywhere' }}>{money(summary?.availableProfit, summary?.currency)}</Typography>
                  </Paper>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography color="text.secondary" sx={{ fontSize: 10.5 }}>Gastos no descontados</Typography>
                    <Typography sx={{ color: '#37415F', fontSize: 11, fontWeight: 800 }}>{money(summary?.nonDeductibleExpenses, summary?.currency)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography color="text.secondary" sx={{ fontSize: 10.5 }}>Total de gastos</Typography>
                    <Typography sx={{ color: '#37415F', fontSize: 11, fontWeight: 800 }}>{money(summary?.totalExpenses, summary?.currency)}</Typography>
                  </Stack>
                </Stack>
                <Alert severity="info" variant="outlined" sx={{ mt: 2, borderRadius: 2.5, fontSize: 10, '& .MuiAlert-icon': { fontSize: 17 } }}>
                  El ingreso original no se modifica al cargar gastos. El saldo se calcula automáticamente a partir de los movimientos marcados para descuento.
                </Alert>
                {Object.entries(groupedExpenses).some(([currency]) => currency !== (summary?.currency || 'ARS')) && (
                  <Alert severity="warning" sx={{ mt: 1.2, borderRadius: 2.5, fontSize: 10 }}>
                    Hay gastos en otra moneda. No se convierten automáticamente.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
