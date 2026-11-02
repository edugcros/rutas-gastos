import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowUpRight, CalendarDays, ChevronRight, Compass, Download, HardDrive,
  MapPin, Plus, Route as RouteIcon, Trash2, Upload, Wallet, Wifi, WifiOff,
} from 'lucide-react';
import AuthScreen from './components/AuthScreen.jsx';
import TripWorkspace from './components/TripWorkspace.jsx';
import http from './api/http.js';
import { buildLocalBackup, clearLocalProfile, createLocalUser, getLocalProfile, restoreLocalBackup } from './data/localStore.js';
import { money } from './utils.js';

const EMPTY_TRIP = { name: '', origin: '', destination: '', startDate: '', incomeAmount: '0', incomeCurrency: 'ARS' };

const statusMeta = {
  PLANNED: { label: 'Planificado', color: 'info' },
  IN_PROGRESS: { label: 'En curso', color: 'warning' },
  COMPLETED: { label: 'Completado', color: 'success' },
  CANCELLED: { label: 'Cancelado', color: 'error' },
};

function MetricCard({ label, value, icon: Icon, gradient, hint }) {
  return (
    <Card
      sx={{
        minWidth: 0,
        minHeight: 132,
        color: '#fff',
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid rgba(255,255,255,.42)',
        background: gradient,
        boxShadow: '0 13px 27px rgba(54, 65, 142, .13)',
        '&::after': {
          content: '""',
          position: 'absolute',
          width: 138,
          height: 138,
          right: -43,
          top: -48,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,.18)',
          boxShadow: '0 0 0 18px rgba(255,255,255,.045), 0 0 0 38px rgba(255,255,255,.03)',
        },
      }}
    >
      <CardContent sx={{ position: 'relative', zIndex: 1, p: 2.2, '&:last-child': { pb: 2.2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: 'rgba(255,255,255,.82)', fontSize: 11, fontWeight: 750 }}>{label}</Typography>
            <Typography sx={{ mt: 1.1, color: '#fff', fontSize: { xs: 19, sm: 22 }, lineHeight: 1.2, fontWeight: 900, letterSpacing: '-.035em', overflowWrap: 'anywhere' }}>
              {value}
            </Typography>
            {hint && <Typography sx={{ mt: .7, color: 'rgba(255,255,255,.74)', fontSize: 9.5 }}>{hint}</Typography>}
          </Box>
          <Box sx={{ width: 39, height: 39, flexShrink: 0, display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,.24)', borderRadius: 2.5, bgcolor: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)' }}>
            <Icon size={19} />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function TripStatus({ status }) {
  const meta = statusMeta[status] || { label: status, color: 'default' };
  return <Chip size="small" label={meta.label} color={meta.color} variant="filled" sx={{ fontSize: 10, height: 25 }} />;
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
  const [deletingTripId, setDeletingTripId] = useState(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(() => Boolean(navigator.serviceWorker?.controller));
  const [installPrompt, setInstallPrompt] = useState(null);
  const fileInputRef = useRef(null);

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
    setLoading(true);
    try {
      const { data } = await http.get('/trips');
      setTrips(data.items || []);
      setError('');
    } catch (requestError) {
      setError(requestError.userMessage || requestError.message || 'No se pudieron cargar los viajes locales.');
    } finally { setLoading(false); }
  }

  useEffect(() => { if (user) loadTrips(); }, [user]);

  async function createTrip(event) {
    event.preventDefault();
    setError('');
    try {
      const payload = {
        ...form,
        incomeAmount: Number(form.incomeAmount || 0),
        startDate: form.startDate ? new Date(`${form.startDate}T12:00:00`).toISOString() : null,
      };
      const { data } = await http.post('/trips', payload);
      setCreating(false);
      setForm(EMPTY_TRIP);
      await loadTrips();
      setSelectedTripId(data.trip._id);
    } catch (requestError) {
      setError(requestError.userMessage || requestError.message || 'No se pudo crear el viaje.');
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
    await clearLocalProfile();
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
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', gap: 1, alignContent: 'center' }}>
        <CircularProgress size={32} />
        <Typography color="text.secondary" sx={{ fontSize: 12 }}>Preparando almacenamiento local...</Typography>
      </Box>
    );
  }

  if (!user) return <AuthScreen onAuthenticated={setUser} />;
  const selected = trips.find((item) => item.trip._id === selectedTripId);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: '#F5F6FC' }}>
      <Paper
        component="aside"
        square
        elevation={0}
        sx={{
          position: 'fixed',
          zIndex: 1200,
          inset: '0 auto 0 0',
          width: { xs: 76, md: 252 },
          display: 'flex',
          flexDirection: 'column',
          p: { xs: 1, md: 2 },
          color: '#E6E9FF',
          border: 0,
          borderRadius: 0,
          background: 'linear-gradient(180deg, #202C76 0%, #303C9B 40%, #27316F 100%)',
          boxShadow: '9px 0 28px rgba(38, 45, 112, .12)',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent={{ xs: 'center', md: 'flex-start' }} spacing={1.2} sx={{ px: { xs: 0, md: 1 }, py: 2.2, mb: 2 }}>
          <Box sx={{ width: 39, height: 39, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 2.5, color: '#fff', border: '1px solid rgba(255,255,255,.22)', bgcolor: 'rgba(255,255,255,.13)' }}>
            <Compass size={20} />
          </Box>
          <Typography sx={{ display: { xs: 'none', md: 'block' }, color: '#fff', fontSize: 11, fontWeight: 900, letterSpacing: 1.25 }}>
            RUTAS <Box component="span" sx={{ color: '#F4B7E3' }}>&</Box> GASTOS
          </Typography>
        </Stack>

        <Typography sx={{ display: { xs: 'none', md: 'block' }, px: 1.2, mb: 1, color: '#A9B5F4', fontSize: 9, fontWeight: 850, letterSpacing: 1.25 }}>
          GESTIÓN LOCAL
        </Typography>
        <List disablePadding sx={{ display: 'grid', gap: .5 }}>
          <Tooltip title="Mis viajes" placement="right" disableHoverListener={false}>
            <ListItemButton
              selected={!selectedTripId}
              onClick={() => setSelectedTripId(null)}
              sx={{
                minHeight: 44, px: { xs: 1.2, md: 1.4 }, borderRadius: 2.5, color: '#DCE3FF',
                '& .MuiListItemIcon-root': { color: '#B9C7FF', minWidth: { xs: 0, md: 38 }, justifyContent: 'center' },
                '& .MuiListItemText-primary': { fontSize: 11, fontWeight: 750 },
                '&.Mui-selected': { color: '#fff', bgcolor: 'rgba(255,255,255,.15)', boxShadow: 'inset 3px 0 #F5B7E4' },
                '&.Mui-selected .MuiListItemIcon-root': { color: '#fff' },
                '&:hover': { bgcolor: 'rgba(255,255,255,.10)' },
              }}
            >
              <ListItemIcon><RouteIcon size={18} /></ListItemIcon>
              <ListItemText primary="Viajes" sx={{ display: { xs: 'none', md: 'block' } }} />
            </ListItemButton>
          </Tooltip>
          {selected && (
            <Tooltip title={selected.trip.name} placement="right">
              <ListItemButton
                selected
                sx={{
                  minHeight: 43, px: { xs: 1.2, md: 1.4 }, borderRadius: 2.5, color: '#fff',
                  '& .MuiListItemIcon-root': { color: '#F7C5E8', minWidth: { xs: 0, md: 38 }, justifyContent: 'center' },
                  '& .MuiListItemText-primary': { fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                  '&.Mui-selected': { bgcolor: 'rgba(255,255,255,.11)' },
                }}
              >
                <ListItemIcon><MapPin size={17} /></ListItemIcon>
                <ListItemText primary={selected.trip.name} sx={{ display: { xs: 'none', md: 'block' } }} />
              </ListItemButton>
            </Tooltip>
          )}
        </List>

        <Divider sx={{ display: { xs: 'none', md: 'block' }, my: 2.2, borderColor: 'rgba(255,255,255,.14)' }} />
        <Typography sx={{ display: { xs: 'none', md: 'block' }, px: 1.2, mb: 1, color: '#A9B5F4', fontSize: 9, fontWeight: 850, letterSpacing: 1.15 }}>
          DATOS DE ESTE EQUIPO
        </Typography>
        <List disablePadding sx={{ display: 'grid', gap: .5 }}>
          <Tooltip title="Exportar copia" placement="right">
            <ListItemButton onClick={exportBackup} sx={{ minHeight: 43, px: { xs: 1.2, md: 1.4 }, borderRadius: 2.5, color: '#C5D0EC', '& .MuiListItemIcon-root': { color: '#B6C7F5', minWidth: { xs: 0, md: 38 }, justifyContent: 'center' }, '& .MuiListItemText-primary': { fontSize: 11, fontWeight: 650 }, '&:hover': { bgcolor: 'rgba(255,255,255,.10)', color: '#fff' } }}>
              <ListItemIcon><Download size={17} /></ListItemIcon>
              <ListItemText primary="Exportar copia" sx={{ display: { xs: 'none', md: 'block' } }} />
            </ListItemButton>
          </Tooltip>
          <Tooltip title="Restaurar copia" placement="right">
            <ListItemButton onClick={() => fileInputRef.current?.click()} sx={{ minHeight: 43, px: { xs: 1.2, md: 1.4 }, borderRadius: 2.5, color: '#C5D0EC', '& .MuiListItemIcon-root': { color: '#B6C7F5', minWidth: { xs: 0, md: 38 }, justifyContent: 'center' }, '& .MuiListItemText-primary': { fontSize: 11, fontWeight: 650 }, '&:hover': { bgcolor: 'rgba(255,255,255,.10)', color: '#fff' } }}>
              <ListItemIcon><Upload size={17} /></ListItemIcon>
              <ListItemText primary="Restaurar copia" sx={{ display: { xs: 'none', md: 'block' } }} />
            </ListItemButton>
          </Tooltip>
        </List>
        <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />

        <Box sx={{ mt: 'auto', pt: 2 }}>
          <Divider sx={{ mb: 1.5, borderColor: 'rgba(255,255,255,.14)' }} />
          <Stack direction="row" alignItems="center" spacing={1.1} sx={{ px: { xs: 0, md: .8 }, py: 1.2, justifyContent: { xs: 'center', md: 'flex-start' } }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'linear-gradient(135deg,#E47DBA,#8B7CF4)', background: 'linear-gradient(135deg,#E47DBA,#8B7CF4)', color: '#fff', fontSize: 12, fontWeight: 850 }}>
              {user.name?.slice(0, 1)?.toUpperCase() || 'U'}
            </Avatar>
            <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0 }}>
              <Typography sx={{ color: '#fff', fontSize: 10, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</Typography>
              <Typography sx={{ color: '#AFBAD8', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.organizationName}</Typography>
            </Box>
          </Stack>
          <Tooltip title="Editar perfil local" placement="right">
            <ListItemButton onClick={editLocalProfile} sx={{ minHeight: 41, px: { xs: 1.2, md: 1.4 }, borderRadius: 2.5, color: '#C5D0EC', '& .MuiListItemIcon-root': { color: '#B6C7F5', minWidth: { xs: 0, md: 38 }, justifyContent: 'center' }, '& .MuiListItemText-primary': { fontSize: 10, fontWeight: 650 }, '&:hover': { bgcolor: 'rgba(255,255,255,.10)', color: '#fff' } }}>
              <ListItemIcon><HardDrive size={17} /></ListItemIcon>
              <ListItemText primary="Editar perfil local" sx={{ display: { xs: 'none', md: 'block' } }} />
            </ListItemButton>
          </Tooltip>
        </Box>
      </Paper>

      <Box component="main" sx={{ ml: { xs: '76px', md: '252px' }, width: { xs: 'calc(100% - 76px)', md: 'calc(100% - 252px)' }, minWidth: 0 }}>
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ bgcolor: 'rgba(255,255,255,.88)', borderBottom: '1px solid #E8EAF3', backdropFilter: 'blur(18px)' }}>
          <Toolbar sx={{ minHeight: { xs: '62px !important', md: '70px !important' }, px: { xs: 1.5, sm: 2.5, lg: 4 }, gap: 1.2, justifyContent: 'space-between' }}>
            <Stack direction="row" alignItems="center" spacing={.8} sx={{ minWidth: 0 }}>
              <Typography sx={{ color: '#78819B', fontSize: { xs: 10, sm: 11 }, fontWeight: 650, whiteSpace: 'nowrap' }}>Workspace</Typography>
              <ChevronRight size={14} color="#A9AEC2" />
              <Typography noWrap sx={{ color: '#263054', fontSize: { xs: 10, sm: 12 }, fontWeight: 800, maxWidth: { xs: 90, sm: 240 } }}>
                {selected ? selected.trip.name : 'Mis viajes'}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={{ xs: .6, sm: 1 }}>
              {installPrompt && <Button size="small" variant="outlined" startIcon={<Download size={14} />} onClick={installApp} sx={{ minWidth: 0, px: { xs: 1, sm: 1.5 }, fontSize: { xs: 9, sm: 11 } }}>Instalar app</Button>}
              <Tooltip title={online ? 'Con conexión' : 'Modo sin conexión'}>
                <Chip size="small" icon={online ? <Wifi size={14} /> : <WifiOff size={14} />} label={<Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{online ? 'Con conexión' : 'Modo sin conexión'}</Box>} color={online ? 'success' : 'warning'} variant="outlined" sx={{ '& .MuiChip-icon': { ml: 1 }, height: 31 }} />
              </Tooltip>
              <Tooltip title={offlineReady ? 'La aplicación está controlada por el Service Worker.' : 'El navegador todavía no confirmó el control offline de esta pestaña.'}>
                <Chip size="small" icon={<HardDrive size={14} />} label={<Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>{offlineReady ? 'App offline preparada' : 'Preparando modo offline'}</Box>} color={offlineReady ? 'success' : 'warning'} variant="outlined" sx={{ '& .MuiChip-icon': { ml: 1 }, height: 31 }} />
              </Tooltip>
              <Avatar sx={{ width: 34, height: 34, ml: .4, color: '#fff', fontSize: 11, fontWeight: 850, background: 'linear-gradient(135deg,#6675F3,#C35EA9)' }} title={user.name}>
                {user.name?.slice(0, 1)?.toUpperCase() || 'U'}
              </Avatar>
            </Stack>
          </Toolbar>
        </AppBar>

        {selectedTripId ? (
          <TripWorkspace key={selectedTripId} tripId={selectedTripId} online={online} onBack={() => setSelectedTripId(null)} onChanged={loadTrips} />
        ) : (
          <Box sx={{ maxWidth: 1580, mx: 'auto', px: { xs: 1.5, sm: 2.5, lg: 4 }, py: { xs: 2.5, md: 4 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
              <Box>
                <Typography sx={{ color: 'primary.main', fontSize: 10, fontWeight: 850, letterSpacing: 1.35 }}>PANEL DE CONTROL · ALMACENAMIENTO LOCAL</Typography>
                <Typography component="h1" sx={{ mt: .7, color: '#202744', fontSize: { xs: 27, sm: 32 }, fontWeight: 900, letterSpacing: '-.05em' }}>Mis viajes</Typography>
                <Typography color="text.secondary" sx={{ mt: .5, fontSize: 12 }}>Organizá recorridos y mantené tus números actualizados, incluso sin Internet.</Typography>
              </Box>
              <Button size="large" variant="contained" startIcon={<Plus size={18} />} onClick={() => setCreating(true)} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, minHeight: 47, px: 2.3, background: 'linear-gradient(110deg,#5967E8,#825FDC 65%,#D85CA7)' }}>
                Nuevo viaje
              </Button>
            </Stack>

            {error && <Alert severity="error" variant="filled" sx={{ mb: 2, borderRadius: 3 }}>{error}</Alert>}
            {!online && (
              <Alert severity="warning" variant="outlined" icon={<WifiOff size={18} />} sx={{ mb: 2.5, borderRadius: 3, bgcolor: '#FFF9EB' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 800 }}>Estás trabajando sin conexión.</Typography>
                <Typography sx={{ fontSize: 11 }}>Los viajes, ingresos y gastos se guardan en esta computadora. La planificación con IA requiere Internet.</Typography>
              </Alert>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', lg: 'repeat(4,minmax(0,1fr))' }, gap: 1.5, mb: 4 }}>
              <MetricCard label="Viajes registrados" value={trips.length} icon={RouteIcon} gradient="linear-gradient(135deg,#5368E6,#7985F4 65%,#9C83EF)" hint="En este dispositivo" />
              <MetricCard label="Ganancia disponible · ARS" value={money(trips.reduce((sum, item) => sum + (item.financialSummary?.currency === 'ARS' ? (item.financialSummary?.availableProfit || 0) : 0), 0), 'ARS')} icon={Wallet} gradient="linear-gradient(135deg,#138A83,#2CB5A0 68%,#69C7B2)" hint="Pesos argentinos" />
              <MetricCard label="Ganancia disponible · USD" value={money(trips.reduce((sum, item) => sum + (item.financialSummary?.currency === 'USD' ? (item.financialSummary?.availableProfit || 0) : 0), 0), 'USD')} icon={Wallet} gradient="linear-gradient(135deg,#C45C9D,#DF78B1 65%,#EE9BC4)" hint="Dólares estadounidenses" />
              <MetricCard label="En planificación" value={trips.filter((item) => item.trip.status === 'PLANNED').length} icon={CalendarDays} gradient="linear-gradient(135deg,#C18432,#E3A84E 65%,#EEC77E)" hint="Viajes pendientes" />
            </Box>

            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1.7 }}>
              <Box>
                <Typography component="h2" sx={{ color: '#252D4C', fontSize: 17, fontWeight: 850 }}>Actividad reciente</Typography>
                <Typography color="text.secondary" sx={{ fontSize: 11 }}>Viajes guardados en este equipo</Typography>
              </Box>
              <Chip label={`${trips.length} registros`} size="small" variant="outlined" sx={{ bgcolor: '#fff', borderColor: '#E0E4F1', color: '#68718D', fontWeight: 750 }} />
            </Stack>

            {loading ? (
              <Paper variant="outlined" sx={{ minHeight: 220, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 1.2, borderRadius: 4, borderColor: '#E5E8F2' }}>
                <CircularProgress size={28} />
                <Typography color="text.secondary" sx={{ fontSize: 12 }}>Cargando viajes locales...</Typography>
              </Paper>
            ) : trips.length ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2,minmax(0,1fr))' }, gap: 1.7 }}>
                {trips.map(({ trip, financialSummary }) => (
                  <Card key={trip._id} sx={{ overflow: 'hidden', transition: 'transform .18s ease, box-shadow .18s ease', '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 17px 34px rgba(53,61,130,.12)' } }}>
                    <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                        <Box sx={{ width: 43, height: 43, display: 'grid', placeItems: 'center', borderRadius: 2.7, color: '#fff', background: 'linear-gradient(135deg,#6878F2,#A16AE0)' }}>
                          <RouteIcon size={20} />
                        </Box>
                        <Stack direction="row" alignItems="center" spacing={.8}>
                          <TripStatus status={trip.status} />
                          <Tooltip title="Eliminar viaje">
                            <span>
                              <IconButton size="small" disabled={deletingTripId === trip._id} onClick={() => removeTrip(trip._id, trip.name)} aria-label={`Eliminar viaje ${trip.name}`} sx={{ color: '#C05269', border: '1px solid #F2DCE3', borderRadius: 2 }}>
                                <Trash2 size={16} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </Stack>
                      <ButtonBase onClick={() => setSelectedTripId(trip._id)} sx={{ width: '100%', display: 'block', textAlign: 'left', mt: 1.8, borderRadius: 2, '&:focus-visible': { outline: '3px solid rgba(89,103,232,.4)', outlineOffset: 3 } }}>
                        <Typography component="h3" sx={{ color: '#232B4A', fontSize: 15, fontWeight: 850 }}>{trip.name}</Typography>
                        <Stack direction="row" alignItems="center" spacing={.7} sx={{ mt: .75, color: '#74809C', minWidth: 0 }}>
                          <Typography noWrap sx={{ fontSize: 11, maxWidth: '45%' }}>{trip.origin}</Typography>
                          <ArrowUpRight size={14} />
                          <Typography noWrap sx={{ fontSize: 11, maxWidth: '45%' }}>{trip.destination}</Typography>
                        </Stack>
                        <Divider sx={{ my: 1.8, borderColor: '#EDF0F6' }} />
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography sx={{ color: '#7C849D', fontSize: 10, fontWeight: 650 }}>Ganancia disponible</Typography>
                            <Typography sx={{ mt: .3, color: '#12866B', fontSize: 17, fontWeight: 900, letterSpacing: '-.025em' }}>{money(financialSummary.availableProfit, financialSummary.currency)}</Typography>
                          </Box>
                          <Box sx={{ width: 34, height: 34, display: 'grid', placeItems: 'center', color: '#6170DD', borderRadius: '50%', bgcolor: '#F0F1FF' }}>
                            <ChevronRight size={18} />
                          </Box>
                        </Stack>
                      </ButtonBase>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : (
              <Paper variant="outlined" sx={{ minHeight: 290, p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', borderRadius: 4, borderStyle: 'dashed', borderColor: '#CFD5EB', background: 'radial-gradient(circle at 50% 0%, rgba(126,120,241,.12), transparent 44%), linear-gradient(135deg,#FFFFFF,#F8F8FF)' }}>
                <Box sx={{ width: 66, height: 66, display: 'grid', placeItems: 'center', borderRadius: 4, color: '#fff', background: 'linear-gradient(135deg,#6376F0,#A35ED5)', boxShadow: '0 10px 22px rgba(93,105,223,.22)' }}>
                  <Compass size={30} />
                </Box>
                <Typography component="h2" sx={{ mt: 2, color: '#242D4D', fontSize: 18, fontWeight: 850 }}>Tu próximo viaje empieza acá</Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 340, mt: .6, mb: 2, fontSize: 12 }}>Creá un viaje para planificar una ruta y registrar ingresos y gastos.</Typography>
                <Button variant="contained" startIcon={<Plus size={17} />} onClick={() => setCreating(true)}>Crear primer viaje</Button>
              </Paper>
            )}
          </Box>
        )}
      </Box>

      <Dialog open={creating} onClose={() => setCreating(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden' } }}>
        <Box sx={{ px: 3, pt: 2.8, pb: 2.1, color: '#fff', background: 'linear-gradient(115deg,#4E5FD2,#7866DF 58%,#C35FA8)' }}>
          <Typography sx={{ color: 'rgba(255,255,255,.78)', fontSize: 9, fontWeight: 850, letterSpacing: 1.3 }}>NUEVO REGISTRO LOCAL</Typography>
          <Typography component="h2" sx={{ mt: .6, fontSize: 22, fontWeight: 900 }}>Crear viaje</Typography>
        </Box>
        <Box component="form" onSubmit={createTrip}>
          <DialogContent sx={{ display: 'grid', gap: 2, p: 3 }}>
            <TextField fullWidth label="Nombre del viaje" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required slotProps={{ htmlInput: { minLength: 2, maxLength: 140 } }} placeholder="Ej.: Traslado de noviembre" />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.7 }}>
              <TextField fullWidth label="Origen" value={form.origin} onChange={(event) => setForm((prev) => ({ ...prev, origin: event.target.value }))} required placeholder="Ciudad o dirección" />
              <TextField fullWidth label="Destino" value={form.destination} onChange={(event) => setForm((prev) => ({ ...prev, destination: event.target.value }))} required placeholder="Ciudad o dirección" />
              <TextField fullWidth type="date" label="Fecha de inicio" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField fullWidth type="number" label="Ganancia inicial" value={form.incomeAmount} onChange={(event) => setForm((prev) => ({ ...prev, incomeAmount: event.target.value }))} slotProps={{ htmlInput: { min: 0, step: .01 } }} />
              <TextField fullWidth select label="Moneda" value={form.incomeCurrency} onChange={(event) => setForm((prev) => ({ ...prev, incomeCurrency: event.target.value }))}>
                <MenuItem value="ARS">ARS · Peso argentino</MenuItem>
                <MenuItem value="USD">USD · Dólar</MenuItem>
              </TextField>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button type="button" color="inherit" variant="outlined" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" endIcon={<ChevronRight size={17} />}>Crear viaje</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
