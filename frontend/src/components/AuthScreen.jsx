import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
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
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.08fr) minmax(430px, .92fr)' },
        bgcolor: '#F5F6FC',
      }}
    >
      <Box
        component="section"
        sx={{
          position: 'relative',
          isolation: 'isolate',
          overflow: 'hidden',
          minHeight: { xs: 300, md: '100vh' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: { xs: 3, sm: 5, lg: 7 },
          color: '#fff',
          background: 'linear-gradient(132deg, #283B9A 0%, #5967E8 46%, #8D5DD6 100%)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            zIndex: -1,
            opacity: .28,
            backgroundImage: 'linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)',
            backgroundSize: '58px 58px',
            maskImage: 'linear-gradient(135deg, black, transparent 78%)',
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute', zIndex: -1, width: 390, height: 390, borderRadius: '50%',
            top: { xs: -240, md: -90 }, right: { xs: -120, md: -60 },
            background: 'radial-gradient(circle, rgba(255,255,255,.30), rgba(255,255,255,0) 70%)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute', zIndex: -1, width: 430, height: 430, borderRadius: '50%',
            bottom: -285, left: -170,
            border: '1px solid rgba(255,255,255,.18)',
            boxShadow: '0 0 0 45px rgba(255,255,255,.045), 0 0 0 90px rgba(255,255,255,.035)',
            pointerEvents: 'none',
          }}
        />

        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 3, border: '1px solid rgba(255,255,255,.27)', bgcolor: 'rgba(255,255,255,.13)', backdropFilter: 'blur(10px)' }}>
            <Compass size={23} />
          </Box>
          <Typography sx={{ fontSize: 13, letterSpacing: 1.8, fontWeight: 900 }}>
            RUTAS <Box component="span" sx={{ color: '#FFD4EE' }}>&</Box> GASTOS
          </Typography>
        </Stack>

        <Box sx={{ maxWidth: 590, py: { xs: 2, md: 5 } }}>
          <Typography sx={{ display: 'inline-flex', px: 1.35, py: .7, mb: 2, border: '1px solid rgba(255,255,255,.25)', borderRadius: 99, bgcolor: 'rgba(255,255,255,.12)', color: '#F2EFFF', fontSize: 12, fontWeight: 800, letterSpacing: 1.35 }}>
            LOCAL · PRIVADO · OFFLINE FIRST
          </Typography>
          <Typography component="h1" sx={{ fontSize: { xs: 37, sm: 48, lg: 65 }, lineHeight: 1.02, fontWeight: 900, letterSpacing: '-.055em', maxWidth: 560 }}>
            El viaje,
            <Box component="span" sx={{ display: 'block', color: '#FFE0F1' }}>bajo control.</Box>
          </Typography>
          <Typography sx={{ mt: 2.3, maxWidth: 465, color: 'rgba(255,255,255,.84)', fontSize: { xs: 13, sm: 15 }, lineHeight: 1.8 }}>
            Registrá viajes, ingresos y gastos aunque no tengas conexión. Tu información queda guardada en esta computadora.
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 3 }}>
            {['Finanzas claras', 'Rutas inteligentes', 'Datos locales'].map((item) => (
              <Box key={item} sx={{ px: 1.4, py: .85, border: '1px solid rgba(255,255,255,.22)', borderRadius: 99, bgcolor: 'rgba(255,255,255,.10)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                {item}
              </Box>
            ))}
          </Stack>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ color: 'rgba(255,255,255,.72)', fontSize: 12, letterSpacing: .25 }}>
          <Typography variant="caption" sx={{ color: 'inherit' }}>Tu espacio de trabajo no depende de un servidor.</Typography>
          <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 800, letterSpacing: 1 }}>ARGENTINA · ARS</Typography>
        </Stack>
      </Box>

      <Box
        component="section"
        sx={{
          minHeight: { xs: 'auto', md: '100vh' },
          display: 'grid',
          placeItems: 'center',
          px: { xs: 2.5, sm: 4, lg: 6 },
          py: { xs: 4, md: 6 },
          bgcolor: '#FBFCFF',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 470 }}>
          <Stack spacing={1} sx={{ mb: 3.2 }}>
            <Typography sx={{ color: 'primary.main', fontSize: 12, letterSpacing: 1.45, fontWeight: 850 }}>
              CONFIGURACIÓN DE ESTE EQUIPO
            </Typography>
            <Typography component="h2" variant="h4" sx={{ color: '#202744', fontWeight: 900 }}>
              Crear espacio local
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 13 }}>
              Esta instalación tendrá sus propios viajes y registros, independientes de otras computadoras.
            </Typography>
          </Stack>

          <Stack spacing={1.3} sx={{ mb: 3 }}>
            <Card variant="outlined" sx={{ borderRadius: 3, borderColor: '#E4E8F5', background: 'linear-gradient(115deg, #F0F3FF 0%, #FFFFFF 78%)', boxShadow: 'none' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '15px !important' }}>
                <Box sx={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center', color: '#5262D9', borderRadius: 2.5, bgcolor: '#E0E6FF' }}>
                  <HardDrive size={19} />
                </Box>
                <Box>
                  <Typography sx={{ color: '#28365C', fontSize: 12, fontWeight: 800 }}>Base local</Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 12.5 }}>Los datos se guardan en este dispositivo.</Typography>
                </Box>
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ borderRadius: 3, borderColor: '#E9E2F4', background: 'linear-gradient(115deg, #FAF1FF 0%, #FFFFFF 78%)', boxShadow: 'none' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '15px !important' }}>
                <Box sx={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center', color: '#9658BD', borderRadius: 2.5, bgcolor: '#F1E3FC' }}>
                  <WifiOff size={19} />
                </Box>
                <Box>
                  <Typography sx={{ color: '#513465', fontSize: 12, fontWeight: 800 }}>Modo sin conexión</Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 12.5 }}>Movimientos y balances siguen disponibles offline.</Typography>
                </Box>
              </CardContent>
            </Card>
          </Stack>

          <Box component="form" onSubmit={submit} sx={{ display: 'grid', gap: 2 }}>
            <TextField
              fullWidth
              label="Nombre del responsable"
              value={form.name}
              onChange={change('name')}
              required
              autoComplete="name"
              slotProps={{
                htmlInput: { minLength: 2, maxLength: 100 },
                input: { startAdornment: <InputAdornment position="start"><UserRound size={17} color="#8490AD" /></InputAdornment> },
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
                input: { startAdornment: <InputAdornment position="start"><Compass size={17} color="#8490AD" /></InputAdornment> },
              }}
            />
            {error && <Alert severity="error" variant="outlined">{error}</Alert>}
            <Button
              type="submit"
              size="large"
              fullWidth
              disabled={busy}
              endIcon={<ArrowRight size={18} />}
              sx={{ mt: .6, minHeight: 50, fontSize: 13, background: 'linear-gradient(110deg, #5967E8 0%, #7561E3 52%, #C45FAE 100%)' }}
            >
              {busy ? 'Preparando almacenamiento...' : 'Crear espacio en este equipo'}
            </Button>
          </Box>
          <Typography sx={{ mt: 3, color: '#8A91A9', fontSize: 12, lineHeight: 1.75, textAlign: 'center' }}>
            No se crea una cuenta online. Otra computadora tendrá una base local independiente. Guardá copias de seguridad periódicas.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
