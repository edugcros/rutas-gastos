import { useState } from 'react';
import { Alert, Box, Button, InputAdornment, TextField, Typography } from '@mui/material';
import { ArrowRight, BarChart3, Compass, HardDrive, ShieldCheck, UserRound, WifiOff } from 'lucide-react';
import { createLocalUser, saveLocalProfile } from '../data/localStore.js';
import { tokens } from '../theme.js';
import { Stack } from './ui.jsx';

const FEATURES = [
  { icon: BarChart3, title: 'Finanzas claras', text: 'Ingresos, gastos y ganancia disponible de cada viaje, siempre actualizados.' },
  { icon: WifiOff, title: 'Funciona sin conexión', text: 'Registrá movimientos en ruta; la app no necesita Internet para llevar tus números.' },
  { icon: ShieldCheck, title: 'Datos en tu equipo', text: 'No hay cuenta online: la información se guarda en este dispositivo.' },
];

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
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1fr) minmax(440px,540px)' }, bgcolor: 'background.default' }}>
      <Box
        component="section"
        sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 5, p: { xs: 3, sm: 5, lg: 8 }, color: '#fff', bgcolor: tokens.nav }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: tokens.brand }}><Compass size={21} /></Box>
          <Typography sx={{ fontWeight: 650, fontSize: 17, letterSpacing: '-0.01em' }}>Rutas &amp; Gastos</Typography>
        </Stack>

        <Box sx={{ maxWidth: 560 }}>
          <Typography component="h1" sx={{ fontSize: { xs: '2rem', sm: '2.75rem', lg: '3.25rem' }, lineHeight: 1.08, fontWeight: 700, letterSpacing: '-0.035em' }}>
            Cada viaje, con sus números claros.
          </Typography>
          <Typography sx={{ mt: 2.5, color: '#CBD5E1', fontSize: { xs: '1rem', sm: '1.0625rem' }, lineHeight: 1.65, maxWidth: 480 }}>
            Planificá la ruta y controlá ingresos y gastos desde un solo lugar, aunque no tengas señal.
          </Typography>
          <Stack spacing={2.5} sx={{ mt: { xs: 4, md: 6 }, display: { xs: 'none', sm: 'flex' } }}>
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <Stack key={title} direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{ width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 2, color: '#C7D2FE', bgcolor: 'rgba(255,255,255,.08)' }}><Icon size={18} /></Box>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
                  <Typography sx={{ color: tokens.navText, fontSize: '0.9375rem', lineHeight: 1.55 }}>{text}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Typography variant="caption" sx={{ color: '#64748B', display: { xs: 'none', md: 'block' } }}>Argentina · ARS y USD</Typography>
      </Box>

      <Box component="section" sx={{ display: 'grid', placeItems: 'center', px: { xs: 2.5, sm: 4, lg: 6 }, py: { xs: 5, md: 6 }, bgcolor: '#fff' }}>
        <Box sx={{ width: '100%', maxWidth: 440 }}>
          <Typography component="h2" variant="h1" sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }}>Crear espacio local</Typography>
          <Typography color="textSecondary" sx={{ mt: 1, mb: 4 }}>
            Esta instalación tendrá sus propios viajes y registros, independientes de otros equipos.
          </Typography>

          <Box component="form" onSubmit={submit} sx={{ display: 'grid', gap: 2.5 }}>
            <TextField
              fullWidth
              label="Nombre del responsable"
              value={form.name}
              onChange={change('name')}
              required
              autoFocus
              autoComplete="name"
              slotProps={{
                htmlInput: { minLength: 2, maxLength: 100 },
                input: { startAdornment: <InputAdornment position="start"><UserRound size={18} color={tokens.inkSubtle} /></InputAdornment> },
              }}
            />
            <TextField
              fullWidth
              label="Nombre de este espacio"
              value={form.organizationName}
              onChange={change('organizationName')}
              required
              slotProps={{
                htmlInput: { minLength: 2, maxLength: 100 },
                input: { startAdornment: <InputAdornment position="start"><HardDrive size={18} color={tokens.inkSubtle} /></InputAdornment> },
              }}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" fullWidth disabled={busy} endIcon={<ArrowRight size={18} />} sx={{ mt: 0.5 }}>
              {busy ? 'Preparando almacenamiento…' : 'Crear espacio'}
            </Button>
          </Box>

          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 3, textAlign: 'center' }}>
            No se crea una cuenta online. Exportá copias de seguridad con regularidad.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
