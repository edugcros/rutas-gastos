import { useState } from 'react';
import { ArrowRight, Compass, HardDrive, UserRound, WifiOff } from 'lucide-react';
import { createLocalUser, saveLocalProfile } from '../data/localStore.js';

export default function AuthScreen({ onAuthenticated }) {
  const [form, setForm] = useState({ name: '', organizationName: 'Mi espacio de viajes' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const profile = await saveLocalProfile(form);
      onAuthenticated(createLocalUser(profile));
    } catch (saveError) {
      setError(saveError.message || 'No se pudo crear el espacio local.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="brand-mark"><Compass size={22} /><span>RUTAS <b>&</b> GASTOS</span></div>
        <div className="auth-hero-copy">
          <span className="eyebrow">LOCAL · PRIVADO · OFFLINE FIRST</span>
          <h1>El viaje, bajo control.</h1>
          <p>Registrá viajes, ingresos y gastos aunque no tengas conexión. La información queda guardada en esta computadora.</p>
        </div>
        <div className="auth-visual-bottom"><span>Tu espacio de trabajo no depende de un servidor.</span><span>ARGENTINA · ARS</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <div className="auth-heading">
            <span className="eyebrow">CONFIGURACIÓN DE ESTE EQUIPO</span>
            <h2>Crear espacio local</h2>
            <p>Esta instalación tendrá sus propios viajes y registros, independientes de otras computadoras.</p>
          </div>
          <div className="local-mode-info">
            <div><HardDrive size={18} /><span><strong>Base local</strong><small>Los datos se guardan en este dispositivo.</small></span></div>
            <div><WifiOff size={18} /><span><strong>Sin conexión</strong><small>Los movimientos y balances siguen funcionando offline.</small></span></div>
          </div>
          <form onSubmit={submit} className="form-stack">
            <label>Nombre del responsable<div className="input-wrap"><UserRound size={17} /><input value={form.name} onChange={change('name')} minLength="2" maxLength="100" required placeholder="Tu nombre" autoComplete="name" /></div></label>
            <label>Nombre de este espacio<div className="input-wrap"><Compass size={17} /><input value={form.organizationName} onChange={change('organizationName')} minLength="2" maxLength="100" required placeholder="Ej.: Viajes personales" /></div></label>
            {error && <div className="form-error">{error}</div>}
            <button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Preparando almacenamiento...' : 'Crear espacio en este equipo'}<ArrowRight size={17} /></button>
          </form>
          <p className="auth-footnote">No se crea una cuenta online. Otra computadora tendrá una base local independiente. Guardá copias de seguridad periódicas.</p>
        </div>
      </section>
    </main>
  );
}
