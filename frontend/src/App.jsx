import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CalendarClock, ChevronRight, Compass, Download, HardDrive, Map as MapIcon,
  Plus, Route as RouteIcon, Trash2, Upload, Wallet, Wifi, WifiOff, X,
} from 'lucide-react';
import AuthScreen from './components/AuthScreen.jsx';
import TripWorkspace from './components/TripWorkspace.jsx';
import { EmptyState, PageHeader, Section, Stack, Stat, StatusChip } from './components/ui.jsx';
import http from './api/http.js';
import { buildLocalBackup, clearLocalProfile, createLocalUser, getLocalProfile, restoreLocalBackup } from './data/localStore.js';
import { tokens } from './theme.js';
import { money } from './utils.js';

const EMPTY_TRIP = { name: '', origin: '', destination: '', waypoints: [], startDate: '', incomeAmount: '0', incomeCurrency: 'ARS' };
const SIDEBAR_WIDTH = 248;

/** Ítem de navegación de la barra lateral (escritorio). */
function NavItem({ icon: Icon, label, selected = false, onClick, compact = false }) {
  return (
    <Tooltip title={compact ? label : ''} placement="right">
      <ButtonBase
        onClick={onClick}
        aria-current={selected ? 'page' : undefined}
        sx={{
          width: '100%', justifyContent: compact ? 'center' : 'flex-start', gap: 1.5, px: compact ? 0 : 1.5, height: 40,
          borderRadius: 2, color: selected ? tokens.navTextActive : tokens.navText, bgcolor: selected ? 'rgba(255,255,255,.10)' : 'transparent',
          fontSize: 14, fontWeight: 500, textAlign: 'left', transition: 'background-color .15s, color .15s',
          '&:hover': { bgcolor: 'rgba(255,255,255,.07)', color: tokens.navTextActive },
        }}
      >
        <Icon size={18} />
        {!compact && <span>{label}</span>}
      </ButtonBase>
    </Tooltip>
  );
}

/** Ítem de la barra inferior (móvil). */
function MobileNavItem({ icon: Icon, label, selected = false, onClick }) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={label}
      aria-current={selected ? 'page' : undefined}
      sx={{ flex: 1, minHeight: 56, flexDirection: 'column', gap: 0.5, borderRadius: 2, color: selected ? '#fff' : tokens.navText, fontSize: 12, fontWeight: 500, bgcolor: selected ? 'rgba(255,255,255,.10)' : 'transparent' }}
    >
      <Icon size={20} />
      <span>{label}</span>
    </ButtonBase>
  );
}

/** Fila de viaje en el listado. */
function TripRow({ trip, summary, onOpen, onDelete, deleting }) {
  const stops = [trip.origin, ...(trip.waypoints || []), trip.destination];
  const profit = summary.availableProfit;
  return (
    <Stack direction="row" alignItems="center" sx={{ position: 'relative', '&:not(:last-of-type)': { borderBottom: `1px solid ${tokens.line}` }, '&:hover': { bgcolor: tokens.surfaceMuted } }}>
      <ButtonBase
        onClick={onOpen}
        sx={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr) auto', md: 'minmax(0,1.6fr) auto 160px' }, alignItems: 'center', columnGap: 2, rowGap: 0.75, px: { xs: 2, sm: 3 }, py: 2, textAlign: 'left', borderRadius: 0 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 600, fontSize: '1rem' }}>{trip.name}</Typography>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.5, color: 'text.secondary', minWidth: 0 }}>
            <MapIcon size={14} style={{ flexShrink: 0 }} />
            <Typography noWrap variant="body2" title={stops.join(' → ')} sx={{ color: 'inherit' }}>{stops.join(' → ')}</Typography>
          </Stack>
          {(trip.waypoints || []).length > 0 && (
            <Typography variant="caption" color="textSecondary">{trip.waypoints.length} {trip.waypoints.length === 1 ? 'parada intermedia' : 'paradas intermedias'}</Typography>
          )}
        </Box>
        <Box sx={{ justifySelf: { xs: 'end', md: 'start' }, gridRow: { xs: 1, md: 'auto' }, gridColumn: { xs: 2, md: 'auto' } }}><StatusChip status={trip.status} /></Box>
        <Box sx={{ textAlign: { xs: 'left', md: 'right' }, gridColumn: { xs: '1 / -1', md: 'auto' } }}>
          <Typography variant="caption" color="textSecondary" sx={{ mr: { xs: 1, md: 0 }, display: { xs: 'inline', md: 'block' } }}>Disponible</Typography>
          <Typography className="tabular" component="span" sx={{ fontWeight: 700, fontSize: '1.0625rem', color: profit < 0 ? 'error.main' : 'success.main' }}>{money(profit, summary.currency)}</Typography>
        </Box>
      </ButtonBase>
      <Tooltip title="Eliminar viaje">
        <span>
          <IconButton disabled={deleting} onClick={onDelete} aria-label={`Eliminar viaje ${trip.name}`} sx={{ mr: { xs: 1, sm: 2 }, '&:hover': { color: 'error.main', bgcolor: tokens.negativeSoft } }}>
            <Trash2 size={17} />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_TRIP);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingTrip, setSavingTrip] = useState(false);
  const [deletingTripId, setDeletingTripId] = useState(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(() => Boolean(navigator.serviceWorker?.controller));
  const [installPrompt, setInstallPrompt] = useState(null);
  const fileInputRef = useRef(null);
  const loadSeqRef = useRef(0);

  useEffect(() => {
    let active = true;
    getLocalProfile()
      .then((profile) => { if (active && profile) setUser(createLocalUser(profile)); })
      .catch((loadError) => { if (active) setError(loadError.message || 'No se pudo abrir el almacenamiento local.'); })
      .finally(() => { if (active) setProfileReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    let currentController = null;
    let connectivityTimeoutId = null;

    // navigator.onLine only reports the network interface state. A same-origin
    // no-store request also verifies that this browser can actually reach the app.
    const checkConnectivity = async () => {
      if (!navigator.onLine) {
        currentController?.abort();
        currentController = null;
        if (connectivityTimeoutId !== null) {
          window.clearTimeout(connectivityTimeoutId);
          connectivityTimeoutId = null;
        }
        if (active) setOnline(false);
        return;
      }

      currentController?.abort();
      if (connectivityTimeoutId !== null) window.clearTimeout(connectivityTimeoutId);
      const controller = new AbortController();
      currentController = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 3500);
      connectivityTimeoutId = timeoutId;

      try {
        const response = await fetch(`/connectivity.txt?probe=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'Cache-Control': 'no-cache' },
          signal: controller.signal,
        });
        const reachable = response.ok && (await response.text()).trim() === 'ok';
        if (active && currentController === controller) setOnline(reachable);
      } catch {
        if (active && currentController === controller) setOnline(false);
      } finally {
        window.clearTimeout(timeoutId);
        if (connectivityTimeoutId === timeoutId) connectivityTimeoutId = null;
        if (currentController === controller) currentController = null;
      }
    };

    const onlineHandler = () => { void checkConnectivity(); };
    const offlineHandler = () => {
      currentController?.abort();
      if (active) setOnline(false);
    };
    const installHandler = (event) => { event.preventDefault(); setInstallPrompt(event); };
    const installedHandler = () => setInstallPrompt(null);

    void checkConnectivity();
    const probeInterval = window.setInterval(checkConnectivity, 30000);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    window.addEventListener('beforeinstallprompt', installHandler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      active = false;
      currentController?.abort();
      if (connectivityTimeoutId !== null) {
        window.clearTimeout(connectivityTimeoutId);
        connectivityTimeoutId = null;
      }
      window.clearInterval(probeInterval);
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
      window.removeEventListener('beforeinstallprompt', installHandler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const refreshOfflineReady = () => setOfflineReady(Boolean(navigator.serviceWorker.controller));
    navigator.serviceWorker.addEventListener('controllerchange', refreshOfflineReady);
    navigator.serviceWorker.ready.then(refreshOfflineReady).catch(() => setOfflineReady(false));
    refreshOfflineReady();
    return () => navigator.serviceWorker.removeEventListener('controllerchange', refreshOfflineReady);
  }, []);

  async function loadTrips() {
    // Only the latest request may update state, so overlapping reloads
    // (create, delete, child refreshes) cannot overwrite newer data.
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const { data } = await http.get('/trips');
      if (seq !== loadSeqRef.current) return;
      setTrips(data.items || []);
      setError('');
    } catch (requestError) {
      if (seq !== loadSeqRef.current) return;
      setError(requestError.userMessage || requestError.message || 'No se pudieron cargar los viajes locales.');
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }

  useEffect(() => { if (user) loadTrips(); }, [user]);

  function addWaypoint() {
    setForm((previous) => previous.waypoints.length >= 10
      ? previous
      : { ...previous, waypoints: [...previous.waypoints, ''] });
  }

  function updateWaypoint(index, value) {
    setForm((previous) => ({
      ...previous,
      waypoints: previous.waypoints.map((point, pointIndex) => pointIndex === index ? value : point),
    }));
  }

  function removeWaypoint(index) {
    setForm((previous) => ({
      ...previous,
      waypoints: previous.waypoints.filter((_, pointIndex) => pointIndex !== index),
    }));
  }

  function openCreateDialog() {
    setError('');
    setForm(EMPTY_TRIP);
    setCreating(true);
  }

  async function createTrip(event) {
    event.preventDefault();
    if (savingTrip) return;
    setError('');
    const incomeAmount = Number(form.incomeAmount === '' ? 0 : form.incomeAmount);
    if (!Number.isFinite(incomeAmount) || incomeAmount < 0) {
      setError('Ingresá una ganancia inicial válida (cero o mayor).');
      return;
    }
    setSavingTrip(true);
    try {
      const payload = {
        ...form,
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        waypoints: form.waypoints.map((point) => point.trim()).filter(Boolean),
        incomeAmount,
        startDate: form.startDate ? new Date(`${form.startDate}T12:00:00`).toISOString() : null,
      };
      const { data } = await http.post('/trips', payload);
      setCreating(false);
      setForm(EMPTY_TRIP);
      await loadTrips();
      setSelectedTripId(data.trip._id);
    } catch (requestError) {
      setError(requestError.userMessage || requestError.message || 'No se pudo crear el viaje.');
    } finally {
      setSavingTrip(false);
    }
  }

  async function removeTrip(tripId, tripName) {
    const confirmed = window.confirm(`¿Eliminar el viaje "${tripName}"?\n\nTambién se eliminarán sus gastos asociados de esta computadora. Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    setError('');
    setDeletingTripId(tripId);
    try {
      await http.delete(`/trips/${tripId}`);
      if (selectedTripId === tripId) setSelectedTripId(null);
      await loadTrips();
    } catch (requestError) {
      setError(requestError.userMessage || requestError.message || 'No se pudo eliminar el viaje.');
    } finally {
      setDeletingTripId(null);
    }
  }

  async function exportBackup() {
    try {
      const backup = await buildLocalBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `rutas-gastos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError('');
    } catch (backupError) {
      setError(backupError.message || 'No se pudo exportar la copia.');
    }
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError('La copia supera el límite de 50 MB.');
      return;
    }
    if (!window.confirm('La importación reemplazará todos los viajes y gastos de esta computadora por los incluidos en la copia. Exportá una copia actual antes de continuar. ¿Deseás seguir?')) return;
    try {
      const content = JSON.parse(await file.text());
      const result = await restoreLocalBackup(content);
      if (result.profile) setUser(createLocalUser(result.profile));
      setSelectedTripId(null);
      await loadTrips();
      window.alert(`Copia restaurada: ${result.trips} viajes y ${result.expenses} gastos.`);
    } catch (restoreError) {
      setError(restoreError.message || 'No se pudo restaurar la copia.');
    }
  }

  async function editLocalProfile() {
    if (!window.confirm('Podés volver a configurar el nombre de este espacio. Los viajes y gastos no se eliminarán. ¿Continuar?')) return;
    try {
      await clearLocalProfile();
    } catch (profileError) {
      setError(profileError.message || 'No se pudo editar el perfil local.');
      return;
    }
    setUser(null);
    setTrips([]);
    setSelectedTripId(null);
  }

  async function installApp() {
    if (!installPrompt) return;
    try {
      // The browser requires prompt() to run directly from this user click.
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } finally {
      setInstallPrompt(null);
    }
  }

  if (!profileReady) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 1.5 }} role="status">
        <CircularProgress size={28} />
        <Typography color="textSecondary">Preparando almacenamiento local…</Typography>
      </Box>
    );
  }

  if (!user) return <AuthScreen onAuthenticated={setUser} />;
  const selected = trips.find((item) => item.trip._id === selectedTripId);
  const profitIn = (currency) => trips.reduce((sum, item) => sum + (item.financialSummary?.currency === currency ? (item.financialSummary?.availableProfit || 0) : 0), 0);
  const inProgress = trips.filter((item) => item.trip.status === 'IN_PROGRESS').length;
  const planned = trips.filter((item) => item.trip.status === 'PLANNED').length;
  const initial = user.name?.slice(0, 1)?.toUpperCase() || 'U';

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.default' }}>
      <Box
        component="aside"
        sx={{
          position: 'fixed', inset: '0 auto 0 0', zIndex: 1200, display: { xs: 'none', sm: 'flex' }, flexDirection: 'column',
          width: { sm: 72, md: SIDEBAR_WIDTH }, p: { sm: 1.5, md: 2 }, bgcolor: tokens.nav, color: tokens.navText, overflowY: 'auto',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ height: 48, mb: 2.5, px: { md: 0.5 }, justifyContent: { sm: 'center', md: 'flex-start' } }}>
          <Box sx={{ width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 2, color: '#fff', bgcolor: tokens.brand }}>
            <Compass size={19} />
          </Box>
          <Typography sx={{ display: { sm: 'none', md: 'block' }, color: '#fff', fontWeight: 650, fontSize: 15, letterSpacing: '-0.01em' }}>Rutas &amp; Gastos</Typography>
        </Stack>

        <Stack spacing={0.5} component="nav" aria-label="Navegación principal">
          <Typography variant="overline" sx={{ display: { sm: 'none', md: 'block' }, px: 1.5, pb: 0.5, color: '#64748B' }}>Espacio</Typography>
          <Box sx={{ display: { xs: 'none', md: 'block' } }}><NavItem icon={RouteIcon} label="Mis viajes" selected={!selectedTripId} onClick={() => setSelectedTripId(null)} /></Box>
          <Box sx={{ display: { xs: 'none', sm: 'block', md: 'none' } }}><NavItem icon={RouteIcon} label="Mis viajes" selected={!selectedTripId} onClick={() => setSelectedTripId(null)} compact /></Box>
          {selected && (
            <Box sx={{ display: { xs: 'none', md: 'block' } }}><NavItem icon={MapIcon} label={selected.trip.name.length > 22 ? `${selected.trip.name.slice(0, 21)}…` : selected.trip.name} selected /></Box>
          )}
        </Stack>

        <Stack spacing={0.5} sx={{ mt: 3 }}>
          <Typography variant="overline" sx={{ display: { sm: 'none', md: 'block' }, px: 1.5, pb: 0.5, color: '#64748B' }}>Datos</Typography>
          {[{ icon: Download, label: 'Exportar copia', onClick: exportBackup }, { icon: Upload, label: 'Restaurar copia', onClick: () => fileInputRef.current?.click() }].map((item) => (
            <Box key={item.label}>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}><NavItem {...item} /></Box>
              <Box sx={{ display: { xs: 'none', sm: 'block', md: 'none' } }}><NavItem {...item} compact /></Box>
            </Box>
          ))}
        </Stack>

        <Box sx={{ mt: 'auto', pt: 2 }}>
          <Divider sx={{ borderColor: tokens.navLine, mb: 1.5 }} />
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: { md: 0.5 }, py: 1, justifyContent: { sm: 'center', md: 'flex-start' } }}>
            <Avatar sx={{ width: 34, height: 34, fontSize: 14, fontWeight: 600, bgcolor: 'rgba(255,255,255,.12)', color: '#fff' }}>{initial}</Avatar>
            <Box sx={{ display: { sm: 'none', md: 'block' }, minWidth: 0 }}>
              <Typography noWrap sx={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{user.name}</Typography>
              <Typography noWrap sx={{ color: tokens.navText, fontSize: 12.5 }}>{user.organizationName}</Typography>
            </Box>
          </Stack>
          <Box sx={{ display: { xs: 'none', md: 'block' } }}><NavItem icon={HardDrive} label="Editar perfil local" onClick={editLocalProfile} /></Box>
          <Box sx={{ display: { xs: 'none', sm: 'block', md: 'none' } }}><NavItem icon={HardDrive} label="Editar perfil local" onClick={editLocalProfile} compact /></Box>
        </Box>
      </Box>

      <Box
        component="nav"
        aria-label="Navegación móvil"
        sx={{
          display: { xs: 'flex', sm: 'none' }, position: 'fixed', zIndex: 1300, inset: 'auto 0 0', gap: 0.5, px: 1, pt: 0.75,
          pb: 'max(8px, env(safe-area-inset-bottom))', bgcolor: tokens.nav, borderTop: `1px solid ${tokens.navLine}`,
        }}
      >
        <MobileNavItem icon={RouteIcon} label="Viajes" selected={!selectedTripId} onClick={() => setSelectedTripId(null)} />
        <MobileNavItem icon={Download} label="Exportar" onClick={exportBackup} />
        <MobileNavItem icon={Upload} label="Restaurar" onClick={() => fileInputRef.current?.click()} />
        <MobileNavItem icon={HardDrive} label="Perfil" onClick={editLocalProfile} />
      </Box>

      <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />

      <Box
        component="main"
        sx={{ ml: { xs: 0, sm: '72px', md: `${SIDEBAR_WIDTH}px` }, width: { xs: '100%', sm: 'calc(100% - 72px)', md: `calc(100% - ${SIDEBAR_WIDTH}px)` }, minWidth: 0, pb: { xs: 'calc(88px + env(safe-area-inset-bottom))', sm: 0 } }}
      >
        <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, height: 60, px: { xs: 2, sm: 3, lg: 5 }, bgcolor: 'rgba(255,255,255,.9)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${tokens.line}` }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0, color: 'text.secondary' }}>
            <ButtonBase onClick={() => setSelectedTripId(null)} sx={{ fontSize: 14, color: selectedTripId ? 'text.secondary' : 'text.primary', fontWeight: selectedTripId ? 400 : 600, borderRadius: 1 }}>Viajes</ButtonBase>
            {selected && (<><ChevronRight size={15} /><Typography noWrap sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', maxWidth: { xs: 160, sm: 320 } }}>{selected.trip.name}</Typography></>)}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            {installPrompt && <Button size="small" variant="outlined" startIcon={<Download size={15} />} onClick={installApp}>Instalar app</Button>}
            <Tooltip title={offlineReady ? 'La app está lista para funcionar sin conexión.' : 'Todavía se está preparando el modo sin conexión.'}>
              <Chip
                size="small"
                variant="outlined"
                icon={online ? <Wifi size={14} /> : <WifiOff size={14} />}
                label={online ? 'En línea' : 'Sin conexión'}
                sx={{ color: online ? 'success.main' : 'warning.main', borderColor: online ? '#ABEFC6' : '#FEDF89', bgcolor: online ? tokens.positiveSoft : tokens.warningSoft, '& .MuiChip-icon': { color: 'inherit', ml: 1 } }}
              />
            </Tooltip>
          </Stack>
        </Box>

        {selectedTripId ? (
          <TripWorkspace key={selectedTripId} tripId={selectedTripId} online={online} onBack={() => setSelectedTripId(null)} onChanged={loadTrips} />
        ) : (
          <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 3, md: 5 } }}>
            <PageHeader
              title="Mis viajes"
              description="Planificá recorridos y controlá ingresos y gastos, incluso sin Internet."
              actions={<Button size="large" variant="contained" startIcon={<Plus size={18} />} onClick={openCreateDialog}>Nuevo viaje</Button>}
            />

            {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
            {!online && (
              <Alert severity="warning" icon={<WifiOff size={18} />} sx={{ mb: 3 }}>
                <strong>Estás trabajando sin conexión.</strong> Tus viajes, ingresos y gastos se guardan en este equipo. La planificación de rutas con IA necesita Internet.
              </Alert>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', lg: 'repeat(4,minmax(0,1fr))' }, gap: { xs: 1.5, md: 2 }, mb: { xs: 3, md: 4 } }}>
              <Stat featured label="Saldo ARS" value={money(profitIn('ARS'), 'ARS')} icon={Wallet} hint="Suma de viajes en pesos" />
              <Stat label="Saldo USD" value={money(profitIn('USD'), 'USD')} icon={Wallet} hint="Suma de viajes en dólares" />
              <Stat label="Viajes" value={trips.length} icon={RouteIcon} hint={`${inProgress} en curso`} />
              <Stat label="Planificados" value={planned} icon={CalendarClock} hint="Pendientes de iniciar" />
            </Box>

            <Section
              title="Todos los viajes"
              subtitle={trips.length ? `${trips.length} ${trips.length === 1 ? 'registro guardado' : 'registros guardados'} en este equipo` : 'Guardados en este equipo'}
              padded={false}
            >
              {loading && !trips.length ? (
                <Box sx={{ py: 8, display: 'grid', placeItems: 'center', gap: 1.5 }} role="status">
                  <CircularProgress size={26} />
                  <Typography color="textSecondary">Cargando viajes…</Typography>
                </Box>
              ) : trips.length ? (
                trips.map(({ trip, financialSummary }) => (
                  <TripRow key={trip._id} trip={trip} summary={financialSummary} deleting={deletingTripId === trip._id} onOpen={() => setSelectedTripId(trip._id)} onDelete={() => removeTrip(trip._id, trip.name)} />
                ))
              ) : (
                <EmptyState
                  icon={Compass}
                  title="Todavía no hay viajes"
                  description="Creá tu primer viaje para planificar la ruta y registrar ingresos y gastos."
                  action={<Button variant="contained" startIcon={<Plus size={17} />} onClick={openCreateDialog}>Crear primer viaje</Button>}
                />
              )}
            </Section>
          </Box>
        )}
      </Box>

      <Dialog open={creating} onClose={() => setCreating(false)} fullWidth maxWidth="sm" scroll="paper" slotProps={{ paper: { sx: { m: { xs: 0, sm: 2 }, width: { xs: '100%', sm: 'calc(100% - 32px)' }, maxHeight: { xs: '100dvh', sm: 'calc(100% - 32px)' }, height: { xs: '100dvh', sm: 'auto' }, borderRadius: { xs: 0, sm: 4 } } } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, pb: 1.5 }}>
          <Box>
            <Typography component="span" variant="h2" sx={{ display: 'block' }}>Nuevo viaje</Typography>
            <Typography component="span" variant="body2" color="textSecondary" sx={{ display: 'block', mt: 0.5, fontWeight: 400 }}>Se guarda en este equipo y queda disponible sin conexión.</Typography>
          </Box>
          <IconButton onClick={() => setCreating(false)} aria-label="Cerrar" size="small" sx={{ mt: -0.5, mr: -1 }}><X size={20} /></IconButton>
        </DialogTitle>
        <Box component="form" onSubmit={createTrip} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
          <DialogContent dividers sx={{ display: 'grid', gap: 2.5, alignContent: 'start', p: { xs: 2, sm: 3 } }}>
            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
            <TextField fullWidth label="Nombre del viaje" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required autoFocus slotProps={{ htmlInput: { minLength: 2, maxLength: 140 } }} placeholder="Ej.: Traslado de noviembre" />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField fullWidth label="Origen" value={form.origin} onChange={(event) => setForm((prev) => ({ ...prev, origin: event.target.value }))} required placeholder="Ciudad o dirección" />
              <TextField fullWidth label="Destino final" value={form.destination} onChange={(event) => setForm((prev) => ({ ...prev, destination: event.target.value }))} required placeholder="Ciudad o dirección" />
            </Box>

            <Box sx={{ p: 2, border: `1px solid ${tokens.line}`, borderRadius: 2.5, bgcolor: tokens.surfaceMuted }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: form.waypoints.length ? 1.5 : 0.5 }}>
                <Box>
                  <Typography variant="subtitle2">Paradas intermedias</Typography>
                  <Typography variant="caption" color="textSecondary">Se respeta el orden al calcular la ruta. Hasta 10.</Typography>
                </Box>
                <Chip size="small" label={`${form.waypoints.length}/10`} variant="outlined" />
              </Stack>
              <Stack spacing={1.25}>
                {form.waypoints.map((point, index) => (
                  <Stack key={index} direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 24, height: 24, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: tokens.brandSoft, color: tokens.brand, fontSize: 12, fontWeight: 600 }}>{index + 1}</Box>
                    <TextField fullWidth size="small" aria-label={`Parada ${index + 1}`} value={point} onChange={(event) => updateWaypoint(index, event.target.value)} placeholder="Ej.: Neuquén, Neuquén" slotProps={{ htmlInput: { maxLength: 180 } }} />
                    <IconButton onClick={() => removeWaypoint(index)} aria-label={`Quitar parada ${index + 1}`} size="small"><Trash2 size={16} /></IconButton>
                  </Stack>
                ))}
              </Stack>
              <Button size="small" onClick={addWaypoint} disabled={form.waypoints.length >= 10} startIcon={<Plus size={15} />} sx={{ mt: 1, ml: -0.5 }}>Agregar parada</Button>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
              <TextField fullWidth type="date" label="Fecha de inicio" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField fullWidth type="number" label="Ganancia inicial" value={form.incomeAmount} onChange={(event) => setForm((prev) => ({ ...prev, incomeAmount: event.target.value }))} slotProps={{ htmlInput: { min: 0, step: 0.01, inputMode: 'decimal' } }} />
              <TextField fullWidth select label="Moneda" value={form.incomeCurrency} onChange={(event) => setForm((prev) => ({ ...prev, incomeCurrency: event.target.value }))}>
                <MenuItem value="ARS">ARS · Peso</MenuItem>
                <MenuItem value="USD">USD · Dólar</MenuItem>
              </TextField>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' }, '& > .MuiButton-root': { width: { xs: '100%', sm: 'auto' }, m: 0 } }}>
            <Button type="button" variant="outlined" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={savingTrip}>{savingTrip ? 'Creando…' : 'Crear viaje'}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
