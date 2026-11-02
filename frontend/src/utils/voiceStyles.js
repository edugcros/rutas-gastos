/**
 * Estilos de voz del lector.
 *
 * El navegador no puede inventar acentos: usa las voces instaladas en el
 * dispositivo. Por eso cada estilo combina tres cosas:
 *  - la voz más adecuada que haya instalada (idioma y género),
 *  - una entonación (velocidad, tono y volumen) más lenta, grave y suave,
 *  - para el acento ruso, una transliteración del texto a letras cirílicas, de modo
 *    que una voz rusa lea el español con su fonética: acento ruso real.
 */

// ---------- Números en español (para que una voz rusa no los lea en ruso) ----------

const UNITS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
const ORDINALS_F = ['', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava', 'novena', 'décima'];
const ORDINALS_M = ['', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];

function below1000(n) {
  if (n < 30) return UNITS[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` y ${UNITS[n % 10]}` : '');
  if (n === 100) return 'cien';
  return `${HUNDREDS[Math.floor(n / 100)]}${n % 100 ? ` ${below1000(n % 100)}` : ''}`;
}

/** Entero 0..999.999.999 en palabras ("1" -> "uno"; "21000" -> "veintiún mil"). */
export function numberToSpanish(value) {
  const n = Math.floor(Math.abs(Number(value)));
  if (!Number.isFinite(n) || n > 999_999_999) return String(value);
  if (n < 1000) return below1000(n);
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (millions) parts.push(millions === 1 ? 'un millón' : `${below1000(millions)} millones`);
  if (thousands) {
    const words = thousands === 1 ? '' : below1000(thousands).replace(/uno$/, 'ún').replace(/veintiuno$/, 'veintiún');
    parts.push(`${words} mil`.trim());
  }
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

/** Reemplaza cifras y ordinales por palabras: "817,7" -> "ochocientos diecisiete coma siete". */
export function expandNumbers(text) {
  return String(text ?? '')
    .replace(/(\d+)\s?\.?\s?([ªº])/g, (_, digits, mark) => {
      const list = mark === 'ª' ? ORDINALS_F : ORDINALS_M;
      const n = Number(digits);
      return list[n] || numberToSpanish(n);
    })
    .replace(/\d{1,3}(?:\.\d{3})+(?!\d)/g, (match) => match.replace(/\./g, ''))
    .replace(/\d+(?:,\d+)?/g, (match) => {
      const [whole, decimals] = match.split(',');
      const head = numberToSpanish(whole);
      return decimals ? `${head} coma ${[...decimals].map((digit) => UNITS[Number(digit)]).join(' ')}` : head;
    });
}

// ---------- Español -> cirílico (lectura con fonética rusa) ----------

const VOWELS = { a: 'а', e: 'э', i: 'и', o: 'о', u: 'у', á: 'а', é: 'э', í: 'и', ó: 'о', ú: 'у', ü: 'у' };
const SIMPLE = { b: 'б', d: 'д', f: 'ф', k: 'к', l: 'л', m: 'м', n: 'н', p: 'п', r: 'р', s: 'с', t: 'т', v: 'в', w: 'в', z: 'с', ñ: 'нь' };

function transliterateWord(word) {
  const w = word.toLowerCase();
  let out = '';
  for (let i = 0; i < w.length; i += 1) {
    const c = w[i];
    const next = w[i + 1] || '';
    const afterNext = w[i + 2] || '';
    const frontVowel = 'eiéí'.includes(next);
    if (c === 'c' && next === 'h') { out += 'ч'; i += 1; continue; }
    if (c === 'l' && next === 'l') { out += 'й'; i += 1; continue; }
    if (c === 'r' && next === 'r') { out += 'рр'; i += 1; continue; }
    if (c === 'q' && next === 'u') { out += 'к'; i += 1; continue; } // que/qui -> кэ/ки
    if (c === 'g' && next === 'u' && 'eiéí'.includes(afterNext)) { out += 'г'; i += 1; continue; } // gue/gui
    if (c === 'g' && next === 'ü') { out += 'гв'; i += 1; continue; } // güe/güi
    if (c === 'g') { out += frontVowel ? 'х' : 'г'; continue; }
    if (c === 'c') { out += frontVowel ? 'с' : 'к'; continue; }
    if (c === 'j') { out += 'х'; continue; }
    if (c === 'h') continue; // muda
    if (c === 'x') { out += 'кс'; continue; }
    if (c === 'y') { out += i === w.length - 1 && w.length === 1 ? 'и' : (VOWELS[next] ? 'й' : 'и'); continue; }
    if (VOWELS[c]) { out += VOWELS[c]; continue; }
    if (SIMPLE[c]) { out += SIMPLE[c]; continue; }
    out += c; // símbolos y cualquier otro carácter pasan sin cambios
  }
  return out;
}

/** Transcribe texto en español a cirílico para que una voz rusa lo lea con su fonética. */
export function spanishToCyrillic(text) {
  return expandNumbers(text).replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, transliterateWord);
}

// ---------- Elección de voz ----------

const FEMALE = /(sabina|helena|elena|paulina|dalia|salom[eé]|camila|luc[ií]a|laura|mar[ií]a|m[oó]nica|sof[ií]a|valentina|paloma|elvira|marisol|esperanza|irina|svetlana|dariya|daria|milena|katya|tatyana|tatiana|anna|olga|samantha|karen|female|mujer|femenin)/i;
const MALE = /(gonzalo|jorge|diego|pablo|ra[uú]l|carlos|[aá]lvaro|juan|pedro|andrei|dmitri|dmitry|yuri|pavel|sergei|maxim|male\b|hombre)/i;

export function voiceGender(voice) {
  const name = String(voice?.name || '');
  if (FEMALE.test(name)) return 'f';
  if (MALE.test(name)) return 'm';
  return '?';
}

const langOf = (voice) => String(voice?.lang || '').replace('_', '-').toLowerCase();
const PRIORITY = (voice) => (voice.localService ? 0 : 1);

function firstBy(voices, predicate) {
  return voices.filter(predicate).sort((a, b) => PRIORITY(a) - PRIORITY(b) || String(a.name).localeCompare(String(b.name)))[0] || null;
}

export const VOICE_STYLES = [
  { id: 'standard', label: 'Estándar (voz del sistema)', description: 'Voz en español del dispositivo.', rate: 1, pitch: 1, volume: 1, pause: false },
  { id: 'colombiana', label: 'Colombiana · femenina, cálida y sensual', description: 'Acento colombiano, más lenta, grave y suave.', rate: 0.88, pitch: 0.92, volume: 0.95, pause: true },
  { id: 'rusa', label: 'Rusa · grave y sensual', description: 'Acento ruso al hablar español, lento y envolvente.', rate: 0.85, pitch: 0.82, volume: 0.95, pause: true },
];

/**
 * @returns {{voice: SpeechSynthesisVoice|null, match: 'exact'|'approx'|'none'}}
 *  exact: cumple idioma y género pedidos; approx: sirve pero no coincide del todo; none: no hay voz usable.
 */
export function pickVoiceForStyle(styleId, voices = []) {
  if (styleId === 'colombiana') {
    const exact = firstBy(voices, (v) => langOf(v) === 'es-co' && voiceGender(v) === 'f') || firstBy(voices, (v) => langOf(v) === 'es-co' && voiceGender(v) === '?');
    if (exact) return { voice: exact, match: 'exact' };
    const latam = firstBy(voices, (v) => /^es-(419|mx|us|ar|uy|cl|pe|ve)/.test(langOf(v)) && voiceGender(v) === 'f') || firstBy(voices, (v) => langOf(v).startsWith('es') && voiceGender(v) === 'f');
    if (latam) return { voice: latam, match: 'approx' };
    const any = firstBy(voices, (v) => langOf(v).startsWith('es'));
    return any ? { voice: any, match: 'approx' } : { voice: null, match: 'none' };
  }
  if (styleId === 'rusa') {
    const exact = firstBy(voices, (v) => langOf(v).startsWith('ru') && voiceGender(v) === 'f') || firstBy(voices, (v) => langOf(v).startsWith('ru') && voiceGender(v) === '?');
    if (exact) return { voice: exact, match: 'exact' };
    const male = firstBy(voices, (v) => langOf(v).startsWith('ru'));
    return male ? { voice: male, match: 'approx' } : { voice: null, match: 'none' };
  }
  return { voice: null, match: 'exact' };
}

/** Texto que realmente se envía al motor de voz según el estilo. */
export function styleText(styleId, text) {
  const base = String(text ?? '');
  if (styleId === 'rusa') return spanishToCyrillic(base).replace(/\.\s/g, '... ');
  if (styleId === 'colombiana') return base.replace(/\.\s/g, '... ');
  return base;
}

export const STYLE_PREVIEW = 'Hola, soy tu guía. Seguí conmigo por la ruta, con calma, hasta llegar a destino.';
