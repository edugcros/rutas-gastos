import { useEffect, useRef, useState } from 'react';
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

    // navigator.onLine only reports the network interface state. A same-origin
    // no-store request also verifies that this browser can actually reach the app.
    const checkConnectivity = async () => {
      if (!navigator.onLine) {
        currentController?.abort();
        currentController = null;
        if (active) setOnline(false);
        return;
      }

      currentController?.abort();
      const controller = new AbortController();
      currentController = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 3500);

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
      if (timeoutId !== null) window.clearTimeout(timeoutId);
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
    event.preventDefault(); setError('');
    try {
      const payload = {
        ...form,
        incomeAmount: Number(form.incomeAmount || 0),
        startDate: form.startDate ? new Date(`${form.startDate}T12:00:00`).toISOString() : null,
      };
      const { data } = await http.post('/trips', payload);
      setCreating(false); setForm(EMPTY_TRIP); await loadTrips(); setSelectedTripId(data.trip._id);
    } catch (requestError) { setError(requestError.userMessage || requestError.message || 'No se pudo crear el viaje.'); }
  }

  async function removeTrip(tripId, tripName) {
    const confirmed = window.confirm(`¿Eliminar el viaje "${tripName}"?\n\nTambién se eliminarán sus gastos asociados de esta computadora. Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    setError(''); setDeletingTripId(tripId);
    try {
      await http.delete(`/trips/${tripId}`);
      if (selectedTripId === tripId) setSelectedTripId(null);
      await loadTrips();
    } catch (requestError) { setError(requestError.userMessage || requestError.message || 'No se pudo eliminar el viaje.'); }
    finally { setDeletingTripId(null); }
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
    } catch (backupError) { setError(backupError.message || 'No se pudo exportar la copia.'); }
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setError('La copia supera el límite de 50 MB.'); return; }
    if (!window.confirm('La importación reemplazará todos los viajes y gastos de esta computadora por los incluidos en la copia. Exportá una copia actual antes de continuar. ¿Deseás seguir?')) return;
    try {
      const content = JSON.parse(await file.text());
      const result = await restoreLocalBackup(content);
      if (result.profile) setUser(createLocalUser(result.profile));
      setSelectedTripId(null);
      await loadTrips();
      window.alert(`Copia restaurada: ${result.trips} viajes y ${result.expenses} gastos.`);
    } catch (restoreError) { setError(restoreError.message || 'No se pudo restaurar la copia.'); }
  }

  async function editLocalProfile() {
    if (!window.confirm('Podés volver a configurar el nombre de este espacio. Los viajes y gastos no se eliminarán. ¿Continuar?')) return;
    await clearLocalProfile();
    setUser(null); setTrips([]); setSelectedTripId(null);
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

  if (!profileReady) return <div className="loading-panel app-initializing"><HardDrive size={22} />Preparando almacenamiento local...</div>;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;
  const selected = trips.find((item) => item.trip._id === selectedTripId);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-icon"><Compass size={19} /></div><span>RUTAS <b>&</b> GASTOS</span></div>
        <div className="sidebar-label">GESTIÓN LOCAL</div>
        <button className={`side-link ${!selectedTripId ? 'active' : ''}`} onClick={() => setSelectedTripId(null)}><RouteIcon size={17} />Viajes</button>
        {selected && <button className="side-link active"><MapPin size={17} />{selected.trip.name}</button>}
        <div className="sidebar-label sidebar-tools-label">DATOS DE ESTE EQUIPO</div>
        <button className="side-link" onClick={exportBackup}><Download size={16} />Exportar copia</button>
        <button className="side-link" onClick={() => fileInputRef.current?.click()}><Upload size={16} />Restaurar copia</button>
        <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />
        <div className="sidebar-bottom">
          <div className="profile-chip"><div className="profile-avatar">{user.name?.slice(0, 1)?.toUpperCase() || 'U'}</div><div><strong>{user.name}</strong><span>{user.organizationName}</span></div></div>
          <button className="side-link logout-link" onClick={editLocalProfile}><HardDrive size={16} />Editar perfil local</button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <ChevronRight size={14} /> {selected ? selected.trip.name : 'Mis viajes'}</div>
          <div className="topbar-right">
            {installPrompt && <button className="utility-button" onClick={installApp}><Download size={14} />Instalar app</button>}
            <span className={`connection-status ${online ? 'is-online' : 'is-offline'}`}>{online ? <Wifi size={14} /> : <WifiOff size={14} />}{online ? 'Con conexión' : 'Modo sin conexión'}</span>
            <span className={`local-status ${offlineReady ? 'offline-ready' : 'offline-pending'}`} title={offlineReady ? 'La aplicación está controlada por el Service Worker.' : 'El navegador todavía no confirmó el control offline de esta pestaña.'}>
              <HardDrive size={13} /> {offlineReady ? 'App offline preparada' : 'Preparando modo offline'}
            </span>
            <button className="user-avatar" title={user.name}>{user.name?.slice(0, 1)?.toUpperCase() || 'U'}</button>
          </div>
        </header>
        {selectedTripId ? <TripWorkspace key={selectedTripId} tripId={selectedTripId} online={online} onBack={() => setSelectedTripId(null)} onChanged={loadTrips} /> : (
          <div className="dashboard-page">
            <div className="dashboard-heading"><div><span className="eyebrow">PANEL DE CONTROL · ALMACENAMIENTO LOCAL</span><h1>Mis viajes</h1><p>Organizá recorridos y mantené tus números actualizados, incluso sin Internet.</p></div><button className="button button-primary" onClick={() => setCreating(true)}><Plus size={17} />Nuevo viaje</button></div>
            {error && <div className="notice notice-error">{error}</div>}
            {!online && <div className="offline-banner"><WifiOff size={17} /><div><strong>Estás trabajando sin conexión.</strong><span>Los viajes, ingresos y gastos se guardan en esta computadora. La planificación con IA requiere Internet.</span></div></div>}
            <section className="dashboard-stats">
              <div className="dashboard-stat"><span>Viajes registrados</span><strong>{trips.length}</strong><RouteIcon size={18} /></div>
              <div className="dashboard-stat"><span>Ganancia disponible · ARS</span><strong>{money(trips.reduce((sum, item) => sum + (item.financialSummary?.currency === 'ARS' ? (item.financialSummary?.availableProfit || 0) : 0), 0), 'ARS')}</strong><Wallet size={18} /></div>
              <div className="dashboard-stat"><span>Ganancia disponible · USD</span><strong>{money(trips.reduce((sum, item) => sum + (item.financialSummary?.currency === 'USD' ? (item.financialSummary?.availableProfit || 0) : 0), 0), 'USD')}</strong><Wallet size={18} /></div>
              <div className="dashboard-stat"><span>En planificación</span><strong>{trips.filter((item) => item.trip.status === 'PLANNED').length}</strong><CalendarDays size={18} /></div>
            </section>
            <div className="list-heading"><div><h2>Actividad reciente</h2><span>Viajes guardados en este equipo</span></div><span className="list-count">{trips.length} registros</span></div>
            {loading ? <div className="loading-panel">Cargando viajes locales...</div> : trips.length ? (
              <section className="trip-grid">
                {trips.map(({ trip, financialSummary }) => <article className="trip-card" key={trip._id}>
                  <div className="trip-card-top">
                    <span className="trip-card-icon"><RouteIcon size={19} /></span>
                    <div className="trip-card-actions">
                      <span className={`status-pill status-${trip.status.toLowerCase()}`}>{trip.status === 'PLANNED' ? 'Planificado' : trip.status === 'IN_PROGRESS' ? 'En curso' : trip.status === 'COMPLETED' ? 'Completado' : 'Cancelado'}</span>
                      <button type="button" className="trip-delete-button" onClick={() => removeTrip(trip._id, trip.name)} disabled={deletingTripId === trip._id} aria-label={`Eliminar viaje ${trip.name}`} title="Eliminar viaje"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <button type="button" className="trip-card-open" onClick={() => setSelectedTripId(trip._id)}>
                    <h3>{trip.name}</h3>
                    <div className="trip-route"><span>{trip.origin}</span><ArrowUpRight size={14} /><span>{trip.destination}</span></div>
                    <div className="trip-card-footer"><div><span>Ganancia disponible</span><strong>{money(financialSummary.availableProfit, financialSummary.currency)}</strong></div><ChevronRight size={18} /></div>
                  </button>
                </article>)}
              </section>
            ) : <div className="empty-dashboard"><div className="empty-illustration"><Compass size={34} /></div><h2>Tu próximo viaje empieza acá</h2><p>Creá un viaje para planificar una ruta y registrar ingresos y gastos.</p><button className="button button-primary" onClick={() => setCreating(true)}><Plus size={17} />Crear primer viaje</button></div>}
          </div>
        )}
      </main>

      {creating && <div className="modal-backdrop" onClick={() => setCreating(false)}><section className="modal-card" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">NUEVO REGISTRO LOCAL</span><h2>Crear viaje</h2></div><button className="icon-button" onClick={() => setCreating(false)}>×</button></div><form onSubmit={createTrip} className="form-stack">
        <label>Nombre del viaje<input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required minLength="2" maxLength="140" placeholder="Ej.: Traslado de noviembre" /></label>
        <div className="form-grid"><label>Origen<input value={form.origin} onChange={(event) => setForm((prev) => ({ ...prev, origin: event.target.value }))} required placeholder="Ciudad o dirección" /></label><label>Destino<input value={form.destination} onChange={(event) => setForm((prev) => ({ ...prev, destination: event.target.value }))} required placeholder="Ciudad o dirección" /></label><label>Fecha de inicio<input type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} /></label><label>Ganancia inicial<input type="number" min="0" step="0.01" value={form.incomeAmount} onChange={(event) => setForm((prev) => ({ ...prev, incomeAmount: event.target.value }))} /></label><label>Moneda<select value={form.incomeCurrency} onChange={(event) => setForm((prev) => ({ ...prev, incomeCurrency: event.target.value }))}><option value="ARS">ARS · Peso argentino</option><option value="USD">USD · Dólar</option></select></label></div>
        <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setCreating(false)}>Cancelar</button><button className="button button-primary">Crear viaje <ChevronRight size={16} /></button></div>
      </form></section></div>}
    </div>
  );
}
