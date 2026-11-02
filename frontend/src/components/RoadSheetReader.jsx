import { useEffect, useMemo, useRef } from 'react';
import { Alert, Box, Button, LinearProgress, MenuItem, TextField, Typography } from '@mui/material';
import { Mic, Pause, Play, Repeat, SkipBack, SkipForward, Square, Volume2 } from 'lucide-react';
import { useSpeechReader } from '../hooks/useSpeechReader.js';
import { buildSpeechScript } from '../utils/speech.js';
import { tokens } from '../theme.js';
import { Section, Stack } from './ui.jsx';

const RATES = [0.75, 1, 1.25, 1.5];
function styleHelp(styleId, match, voice, styles) {
  if (styleId === 'standard') return undefined;
  const name = voice ? `${voice.name} (${voice.lang})` : '';
  if (match === 'approx') {
    const wanted = styleId === 'colombiana' ? 'una voz femenina colombiana' : 'una voz femenina rusa';
    return `Aproximada: no hay ${wanted} instalada. Se usa ${name}. Instalá más voces en los ajustes de idioma del sistema.`;
  }
  return `Voz: ${name}`;
}

const STATUS_TEXT = { idle: 'Lista para leer', playing: 'Leyendo', paused: 'En pausa', finished: 'Lectura terminada' };

/**
 * Lector en voz alta de la hoja de ruta, pensado para personas ciegas o con baja
 * visión: controles grandes, atajos de teclado, lectura paso a paso y control
 * desde auriculares / pantalla de bloqueo (Media Session).
 */
export default function RoadSheetReader({ model, startSignal = 0 }) {
  const segments = useMemo(() => buildSpeechScript(model), [model]);
  const reader = useSpeechReader(segments);
  const { supported, status, index, total, current, voices, voiceURI, rate, styles, styleId, styleVoice, styleMatch, play, pause, stop, next, previous, repeat, setRate, setVoiceURI, setStyleId, preview } = reader;
  const regionRef = useRef(null);
  const lastSignalRef = useRef(startSignal);

  // "Escuchar" desde otra parte de la pantalla: inicia la lectura y mueve el foco aquí.
  useEffect(() => {
    if (startSignal === lastSignalRef.current) return;
    lastSignalRef.current = startSignal;
    regionRef.current?.focus();
    regionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    if (supported) play();
  }, [startSignal, supported, play]);

  // Controles del sistema (auriculares Bluetooth, pantalla de bloqueo).
  useEffect(() => {
    if (!supported || !('mediaSession' in navigator)) return undefined;
    const session = navigator.mediaSession;
    const handlers = { play, pause, stop, nexttrack: next, previoustrack: previous };
    const registered = [];
    Object.entries(handlers).forEach(([action, handler]) => {
      try { session.setActionHandler(action, handler); registered.push(action); } catch { /* acción no soportada */ }
    });
    try { session.metadata = new window.MediaMetadata({ title: `Hoja de ruta: ${model.title}`, artist: 'Rutas & Gastos' }); } catch { /* sin metadatos */ }
    return () => registered.forEach((action) => { try { session.setActionHandler(action, null); } catch { /* ignorar */ } });
  }, [supported, play, pause, stop, next, previous, model.title]);

  const toggle = () => (status === 'playing' ? pause() : play());

  const onKeyDown = (event) => {
    // Con el foco en un botón o selector, Enter/Espacio ya los maneja el navegador.
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    const actions = { ' ': toggle, k: toggle, ArrowRight: next, n: next, ArrowLeft: previous, p: previous, r: repeat, Escape: stop };
    const action = actions[event.key];
    if (action) { event.preventDefault(); action(); }
  };

  if (!supported) {
    return (
      <Section title="Lectura en voz alta" subtitle="No disponible en este navegador">
        <Alert severity="info">Este navegador no incluye síntesis de voz. Probá con Chrome, Edge o Safari actualizados, o descargá el PDF y leelo con tu lector de pantalla.</Alert>
      </Section>
    );
  }

  const progress = total ? Math.round(((index + (status === 'finished' ? 1 : 0)) / total) * 100) : 0;
  const playing = status === 'playing';

  return (
    <Section title="Lectura en voz alta" subtitle="Escuchá la hoja de ruta paso a paso, sin mirar la pantalla" action={<Volume2 size={20} color={tokens.brand} aria-hidden="true" />}>
      <Box
        ref={regionRef}
        role="group"
        tabIndex={0}
        aria-label="Lector de la hoja de ruta. Atajos: espacio para reproducir o pausar, flechas para cambiar de paso, R para repetir, Escape para detener."
        aria-keyshortcuts="Space ArrowLeft ArrowRight R Escape"
        onKeyDown={onKeyDown}
        sx={{ outline: 'none', borderRadius: 2.5, '&:focus-visible': { outline: `3px solid ${tokens.brand}`, outlineOffset: 4 } }}
      >
        <Box role="status" sx={{ position: 'absolute', width: '1px', height: '1px', m: '-1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{STATUS_TEXT[status]}</Box>

        <Box sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${tokens.line}`, bgcolor: tokens.surfaceMuted, minHeight: 92 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
            <Typography variant="overline" color="textSecondary">{current?.label || 'Hoja de ruta'}</Typography>
            <Typography variant="caption" color="textSecondary">Parte {Math.min(index + 1, total)} de {total}</Typography>
          </Stack>
          <Typography sx={{ mt: 0.5, fontSize: '1.125rem', lineHeight: 1.55, fontWeight: 500 }}>{current?.text}</Typography>
        </Box>

        <LinearProgress variant="determinate" value={progress} aria-label="Progreso de la lectura" sx={{ mt: 2, height: 6, borderRadius: 3, bgcolor: '#EAECF0' }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.25, mt: 2.5 }}>
          <Button variant="outlined" size="large" onClick={previous} disabled={index === 0 && status !== 'finished'} startIcon={<SkipBack size={18} />} aria-label="Paso anterior" sx={{ minHeight: 56 }}>Anterior</Button>
          <Button variant="contained" size="large" onClick={toggle} startIcon={playing ? <Pause size={20} /> : <Play size={20} />} aria-label={playing ? 'Pausar lectura' : status === 'paused' ? 'Continuar lectura' : status === 'finished' ? 'Leer de nuevo' : 'Comenzar lectura'} sx={{ minHeight: 56, fontSize: '1rem' }}>
            {playing ? 'Pausar' : status === 'paused' ? 'Continuar' : status === 'finished' ? 'Repetir todo' : 'Escuchar'}
          </Button>
          <Button variant="outlined" size="large" onClick={next} disabled={index >= total - 1} startIcon={<SkipForward size={18} />} aria-label="Paso siguiente" sx={{ minHeight: 56 }}>Siguiente</Button>
          <Button variant="outlined" onClick={repeat} startIcon={<Repeat size={16} />} aria-label="Repetir este paso" sx={{ gridColumn: 'span 2', minHeight: 48 }}>Repetir este paso</Button>
          <Button variant="outlined" color="inherit" onClick={stop} disabled={status === 'idle'} startIcon={<Square size={15} />} aria-label="Detener lectura" sx={{ minHeight: 48 }}>Detener</Button>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr auto' }, gap: 1.5, alignItems: 'start', mt: 2.5 }}>
          <TextField select size="small" label="Estilo de voz" value={styleId} onChange={(event) => setStyleId(event.target.value)} helperText={styleHelp(styleId, styleMatch, styleVoice, styles)}>
            {styles.map((style) => (
              <MenuItem key={style.id} value={style.id} disabled={style.match === 'none'}>
                <Box>
                  <Typography component="span" sx={{ display: 'block' }}>{style.label}</Typography>
                  {style.match === 'none' && <Typography component="span" variant="caption" color="textSecondary">No hay una voz compatible instalada en este dispositivo</Typography>}
                </Box>
              </MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" onClick={preview} startIcon={<Mic size={16} />} aria-label="Probar la voz elegida" sx={{ minHeight: 40 }}>Probar voz</Button>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: voices.length > 1 && styleId === 'standard' ? '1fr 1fr' : '1fr' }, gap: 1.5, mt: 2 }}>
          <TextField select size="small" label="Velocidad de lectura" value={rate} onChange={(event) => setRate(Number(event.target.value))}>
            {RATES.map((value) => <MenuItem key={value} value={value}>{value === 1 ? 'Normal (1x)' : `${value}x`}</MenuItem>)}
          </TextField>
          {voices.length > 1 && styleId === 'standard' && (
            <TextField select size="small" label="Voz" value={voiceURI} onChange={(event) => setVoiceURI(event.target.value)}>
              {voices.map((voice) => <MenuItem key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</MenuItem>)}
            </TextField>
          )}
        </Box>
        {voices.length === 0 && (
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1.5 }}>
            No se encontró una voz en español en este dispositivo; se usará la voz predeterminada del sistema.
          </Typography>
        )}
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1.5 }}>
          Atajos con el foco en este bloque: Espacio reproduce o pausa · ← → cambian de paso · R repite · Esc detiene.
        </Typography>
      </Box>
    </Section>
  );
}
