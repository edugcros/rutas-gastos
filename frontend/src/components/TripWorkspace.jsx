import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CalendarDays, Check, CircleDollarSign, Clock3, Fuel, MapPinned,
  Plus, Route as RouteIcon, ShieldAlert, Trash2, Wallet, WifiOff,
} from 'lucide-react';
import http from '../api/http.js';
import MapCanvas from './MapCanvas.jsx';
import { categoryLabel, dateLabel, distance, duration, expenseCategories, money } from '../utils.js';

const ROUTE_SERVICE_CONFIGURED = Boolean(import.meta.env.VITE_ROUTE_API_URL);

const EMPTY_EXPENSE = {
  category: 'FUEL', description: '', amount: '', currency: 'ARS', deductFromProfit: true,
  paymentMethod: 'CASH', expenseDate: new Date().toISOString().slice(0, 10),
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
    setBusy(true); setError(''); setSuccess('');
    try {
      const { data } = await http.post('/routes/plan', { prompt });
      setPlan(data);
      setSelectedIndex(0);
    } catch (requestError) {
      setError(requestError.userMessage || 'No se pudo calcular el recorrido.');
    } finally { setBusy(false); }
  }

  async function persistRoute() {
    if (!plan?.routes?.length) return;
    setSavingRoute(true); setError(''); setSuccess('');
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
    } finally { setSavingRoute(false); }
  }

  async function addExpense(event) {
    event.preventDefault();
    setError(''); setSuccess('');
    try {
      await http.post(`/trips/${tripId}/expenses`, {
        ...expense,
        currency: currentTrip.income.currency,
        amount: Number(expense.amount),
        expenseDate: new Date(`${expense.expenseDate}T12:00:00`).toISOString(),
      });
      setExpense(EMPTY_EXPENSE); setShowExpense(false);
      await loadDetail(); onChanged();
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
      await loadDetail(); onChanged();
      setSuccess('Gasto eliminado.');
    } catch (requestError) { setError(requestError.userMessage); }
  }

  async function saveIncome(event) {
    event.preventDefault(); setError('');
    try {
      await http.patch(`/trips/${tripId}`, { incomeAmount: Number(incomeAmount) });
      await loadDetail(); onChanged(); setSuccess('Ingreso base actualizado.');
    } catch (requestError) { setError(requestError.userMessage); }
  }

  if (!currentTrip) return <div className="loading-panel">Cargando viaje...</div>;

  return (
    <div className="workspace-page">
      <div className="workspace-heading">
        <button className="icon-button back-button" onClick={onBack} aria-label="Volver"><ArrowLeft size={18} /></button>
        <div className="workspace-title">
          <span className="eyebrow">VIAJE · {currentTrip.status === 'PLANNED' ? 'PLANIFICADO' : currentTrip.status}</span>
          <h1>{currentTrip.name}</h1>
          <p>{currentTrip.origin} <span>→</span> {currentTrip.destination}</p>
        </div>
        <div className="workspace-date"><CalendarDays size={16} />{dateLabel(currentTrip.startDate)}</div>
      </div>

      <section className="finance-overview">
        <div className="finance-main">
          <span className="metric-label">GANANCIA DISPONIBLE</span>
          <strong>{money(summary?.availableProfit, summary?.currency)}</strong>
          <span className="metric-hint">Ingreso inicial menos gastos descontados</span>
        </div>
        <div className="finance-stat"><span>Ingreso inicial</span><strong>{money(summary?.initialIncome, summary?.currency)}</strong></div>
        <div className="finance-stat"><span>Gastos descontados</span><strong className="negative">− {money(summary?.deductibleExpenses, summary?.currency)}</strong></div>
        <div className="finance-stat"><span>Gastos registrados</span><strong>{summary?.expenseCount || 0}</strong></div>
      </section>

      <div className="tab-bar">
        <button className={tab === 'route' ? 'active' : ''} onClick={() => setTab('route')}><MapPinned size={17} />Planificación de ruta</button>
        <button className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}><Wallet size={17} />Ingresos y gastos</button>
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {success && <div className="notice notice-success">{success}</div>}

      {tab === 'route' ? (
        <div className="route-layout">
          <section className="panel route-controls">
            <div className="section-heading"><div><span className="eyebrow">ASISTENTE DE RUTA</span><h2>¿A dónde vamos?</h2></div><span className="ai-tag">IA + MAPS</span></div>
            {!online && <div className="offline-route-notice"><WifiOff size={17} /><div><strong>Planificación con IA no disponible sin Internet</strong><span>Los viajes, gastos y rutas guardadas siguen disponibles en este equipo. Gemini y Google Routes requieren conexión.</span></div></div>}
            {online && !ROUTE_SERVICE_CONFIGURED && <div className="offline-route-notice"><ShieldAlert size={17} /><div><strong>Servicio de rutas no configurado</strong><span>La gestión local está operativa. Para calcular recorridos nuevos, desplegá el servicio remoto y configurá VITE_ROUTE_API_URL antes de compilar.</span></div></div>}
            <form onSubmit={runPlanner} className="form-stack">
              <label>Describí el recorrido<textarea rows="5" value={prompt} onChange={(event) => setPrompt(event.target.value)} minLength="10" maxLength="2000" required placeholder="Ej.: Salgo desde Río Cuarto hacia Chos Malal, pasando por Neuquén. Priorizá rutas asfaltadas y evitá peajes..." /></label>
              <div className="hint-line">Podés indicar paradas, prioridades, caminos que querés evitar y preferencias.</div>
              <button className="button button-primary" disabled={busy || !online || !ROUTE_SERVICE_CONFIGURED}>{busy ? 'Interpretando y calculando...' : 'Interpretar y calcular rutas'}<RouteIcon size={17} /></button>
            </form>

            {plan && <div className="route-results">
              <div className="result-heading"><h3>Alternativas encontradas</h3><span>{plan.routes.length} opciones</span></div>
              {plan.routes.map((route, index) => (
                <button key={`${route.encodedPolyline.slice(0, 12)}-${index}`} className={`route-option ${selectedIndex === index ? 'selected' : ''}`} onClick={() => setSelectedIndex(index)}>
                  <span className="route-option-top"><b>{route.description || `Alternativa ${index + 1}`}</b>{selectedIndex === index && <Check size={16} />}</span>
                  <span className="route-option-metrics"><strong>{distance(route.distanceMeters)}</strong><span><Clock3 size={13} />{duration(route.durationSeconds)}</span></span>
                </button>
              ))}
              <button className="button button-primary" onClick={persistRoute} disabled={savingRoute}>{savingRoute ? 'Guardando...' : 'Guardar alternativa seleccionada'}<Check size={16} /></button>
            </div>}

            {!plan && currentTrip.routeOptions?.length > 0 && (
              <div className="saved-route-card"><div className="saved-route-icon"><RouteIcon size={18} /></div><div><strong>Ruta guardada</strong><span>{distance(currentTrip.routeOptions[currentTrip.selectedRouteIndex ?? 0]?.distanceMeters)} · {duration(currentTrip.routeOptions[currentTrip.selectedRouteIndex ?? 0]?.durationSeconds)}</span></div><button className="button button-quiet" onClick={() => setSelectedIndex(currentTrip.selectedRouteIndex ?? 0)}>Ver en mapa</button></div>
            )}

            {(plan?.caveats?.length > 0 || (currentTrip.routeOptions?.length > 0 && !plan)) && <div className="data-caveat"><ShieldAlert size={17} /><div><strong>Información vial y seguridad</strong><ul>{(plan?.caveats || ['Pavimentación y cortes no verificados en tiempo real por esta ruta guardada.']).map((item, index) => <li key={index}>{item}</li>)}</ul><a href="https://www.argentina.gob.ar/rutasnacionales" target="_blank" rel="noreferrer">Consultar estado de rutas de Vialidad Nacional ↗</a></div></div>}
          </section>

          <section className="panel map-panel">
            <div className="map-heading"><div><span className="eyebrow">VISUALIZACIÓN</span><h2>Mapa del recorrido</h2></div><span className="map-provider">{online && ROUTE_SERVICE_CONFIGURED && import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ? 'Google Maps' : online ? 'Esquema local' : 'Vista local offline'}</span></div>
            <MapCanvas routes={displayedRoutes} selectedIndex={selectedIndex} origin={currentTrip.origin} destination={currentTrip.destination} online={online} allowOnlineMap={ROUTE_SERVICE_CONFIGURED} />
            {activeRoute && <div className="map-summary"><div><span>Distancia</span><strong>{distance(activeRoute.distanceMeters)}</strong></div><div><span>Duración estimada</span><strong>{duration(activeRoute.durationSeconds)}</strong></div><div><span>Calzada</span><strong className="status-unknown">Sin verificar</strong></div></div>}
            {activeRoute?.legs?.some((leg) => leg.instructions?.length) && <details className="route-instructions">
              <summary>Ver indicaciones y nombres de vías</summary>
              {activeRoute.optimizedIntermediateWaypointIndex?.length > 0 && <p className="optimized-order">Orden optimizado de paradas (índices): {activeRoute.optimizedIntermediateWaypointIndex.map((value) => value + 1).join(' → ')}</p>}
              {activeRoute.legs.map((leg, legIndex) => <div className="route-leg" key={legIndex}>
                <strong>Tramo {legIndex + 1}</strong>
                <ol>{leg.instructions.map((instruction, index) => <li key={`${legIndex}-${index}`}>{instruction}</li>)}</ol>
              </div>)}
            </details>}
            {activeRoute && <div className="route-data-note">La línea representa el trazado calculado. La condición de cada tramo requiere verificación externa.</div>}
          </section>
        </div>
      ) : (
        <div className="expenses-layout">
          <section className="panel expense-ledger">
            <div className="section-heading"><div><span className="eyebrow">MOVIMIENTOS DEL VIAJE</span><h2>Registro de gastos</h2></div><button className="button button-primary button-small" onClick={() => setShowExpense((value) => !value)}><Plus size={16} />Nuevo gasto</button></div>
            {showExpense && <form onSubmit={addExpense} className="expense-form">
              <div className="form-grid">
                <label>Categoría<select value={expense.category} onChange={(event) => setExpense((prev) => ({ ...prev, category: event.target.value }))}>{expenseCategories.map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
                <label>Importe ({currentTrip.income.currency})<input type="number" min="0.01" step="0.01" value={expense.amount} onChange={(event) => setExpense((prev) => ({ ...prev, amount: event.target.value }))} required placeholder="0,00" /></label>
                <label className="full-field">Detalle<input value={expense.description} onChange={(event) => setExpense((prev) => ({ ...prev, description: event.target.value }))} required maxLength="300" placeholder="Ej.: carga de combustible en estación..." /></label>
                <label>Fecha<input type="date" value={expense.expenseDate} onChange={(event) => setExpense((prev) => ({ ...prev, expenseDate: event.target.value }))} required /></label>
                <label>Medio de pago<select value={expense.paymentMethod} onChange={(event) => setExpense((prev) => ({ ...prev, paymentMethod: event.target.value }))}><option value="CASH">Efectivo</option><option value="TRANSFER">Transferencia</option><option value="CARD">Tarjeta</option><option value="OTHER">Otro</option></select></label>
              </div>
              <label className="deduct-toggle"><input type="checkbox" checked={expense.deductFromProfit} onChange={(event) => setExpense((prev) => ({ ...prev, deductFromProfit: event.target.checked }))} /><span><b>Descontar de la ganancia</b><small>Desmarcá si querés registrar el gasto sin afectar el saldo disponible.</small></span></label>
              <div className="form-actions"><button type="button" className="button button-quiet" onClick={() => setShowExpense(false)}>Cancelar</button><button className="button button-primary">Guardar gasto</button></div>
            </form>}

            {expenses.length ? <div className="expense-list">
              {expenses.map((item) => <article className="expense-row" key={item._id}>
                <div className="expense-symbol"><Fuel size={17} /></div>
                <div className="expense-description"><strong>{item.description}</strong><span>{categoryLabel(item.category)} · {dateLabel(item.expenseDate)}</span></div>
                <div className="expense-impact"><strong>{money(item.amount, item.currency)}</strong><span className={item.deductFromProfit ? 'impact-deduct' : 'impact-neutral'}>{item.deductFromProfit ? 'Descontado de ganancia' : 'No afecta ganancia'}</span></div>
                <button className="icon-button delete-button" onClick={() => removeExpense(item._id)} aria-label="Eliminar gasto"><Trash2 size={16} /></button>
              </article>)}
            </div> : <div className="empty-ledger"><CircleDollarSign size={28} /><strong>Todavía no hay gastos</strong><span>Registrá combustible, viáticos, peajes y otros movimientos.</span><button className="button button-quiet" onClick={() => setShowExpense(true)}>Agregar primer gasto</button></div>}
          </section>

          <aside className="panel finance-sidebar">
            <div className="section-heading"><div><span className="eyebrow">RESUMEN ECONÓMICO</span><h2>Estado de la ganancia</h2></div></div>
            <form className="income-editor" onSubmit={saveIncome}><label>Ingreso / ganancia inicial ({currentTrip.income.currency})<div className="money-input"><span>$</span><input type="number" min="0" step="0.01" value={incomeAmount} onChange={(event) => setIncomeAmount(event.target.value)} /></div></label><button className="button button-outline button-small">Actualizar ingreso</button></form>
            <div className="financial-breakdown"><div><span>Ingreso inicial</span><b>{money(summary?.initialIncome, summary?.currency)}</b></div><div><span>Gastos que descuentan</span><b className="negative">− {money(summary?.deductibleExpenses, summary?.currency)}</b></div><div className="available-row"><span>Disponible</span><strong>{money(summary?.availableProfit, summary?.currency)}</strong></div><div><span>Gastos no descontados</span><b>{money(summary?.nonDeductibleExpenses, summary?.currency)}</b></div><div><span>Total de gastos</span><b>{money(summary?.totalExpenses, summary?.currency)}</b></div></div>
            <div className="ledger-note"><ShieldAlert size={16} /><span>El ingreso original no se modifica al cargar gastos. El saldo se calcula automáticamente a partir de los movimientos marcados para descuento.</span></div>
            {Object.entries(groupedExpenses).some(([currency]) => currency !== (summary?.currency || 'ARS')) && <div className="form-error">Hay gastos en otra moneda. No se convierten automáticamente.</div>}
          </aside>
        </div>
      )}
    </div>
  );
}
