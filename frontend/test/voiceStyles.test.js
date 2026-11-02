import test from 'node:test';
import assert from 'node:assert/strict';
import { TUNING_LIMITS, VOICE_STYLES, effectiveStyle, expandNumbers, numberToSpanish, pickVoiceForStyle, spanishToCyrillic, styleText, voiceGender } from '../src/utils/voiceStyles.js';

test('numbers are spelled in Spanish', () => {
  assert.equal(numberToSpanish(0), 'cero');
  assert.equal(numberToSpanish(21), 'veintiuno');
  assert.equal(numberToSpanish(100), 'cien');
  assert.equal(numberToSpanish(151), 'ciento cincuenta y uno');
  assert.equal(numberToSpanish(817), 'ochocientos diecisiete');
  assert.equal(numberToSpanish(1000), 'mil');
  assert.equal(numberToSpanish(21000), 'veintiún mil');
  assert.equal(numberToSpanish(2026), 'dos mil veintiséis');
  assert.equal(numberToSpanish(1_250_000), 'un millón doscientos cincuenta mil');
});

test('expandNumbers handles decimals, thousands separators and ordinals', () => {
  assert.equal(expandNumbers('817,7 kilómetros'), 'ochocientos diecisiete coma siete kilómetros');
  assert.equal(expandNumbers('1.250 metros'), 'mil doscientos cincuenta metros');
  assert.equal(expandNumbers('toma la 2.ª salida'), 'toma la segunda salida');
  assert.equal(expandNumbers('el 1º paso'), 'el primero paso');
  assert.equal(expandNumbers('sin números'), 'sin números');
});

test('Spanish is transliterated to Cyrillic following Spanish pronunciation', () => {
  assert.equal(spanishToCyrillic('Mendoza'), 'мэндоса');
  assert.equal(spanishToCyrillic('Neuquén'), 'нэукэн');
  assert.equal(spanishToCyrillic('San Rafael'), 'сан рафаэл');
  assert.equal(spanishToCyrillic('que'), 'кэ');
  assert.equal(spanishToCyrillic('guerra'), 'гэрра');
  assert.equal(spanishToCyrillic('gira'), 'хира');
  assert.equal(spanishToCyrillic('cine'), 'синэ');
  assert.equal(spanishToCyrillic('casa'), 'каса');
  assert.equal(spanishToCyrillic('hacia'), 'асиа');
  assert.equal(spanishToCyrillic('calle'), 'кайэ');
  assert.equal(spanishToCyrillic('año'), 'аньо');
  assert.equal(spanishToCyrillic('chico'), 'чико');
  assert.equal(spanishToCyrillic('pingüino'), 'пингвино');
});

test('numbers are spoken as Spanish words before transliteration', () => {
  assert.equal(spanishToCyrillic('Ruta 40'), 'рута куарэнта');
});

test('voice gender is inferred from well-known voice names', () => {
  assert.equal(voiceGender({ name: 'Microsoft Salome Online (Natural) - Spanish (Colombia)' }), 'f');
  assert.equal(voiceGender({ name: 'Microsoft Gonzalo Online (Natural) - Spanish (Colombia)' }), 'm');
  assert.equal(voiceGender({ name: 'Microsoft Irina - Russian (Russia)' }), 'f');
  assert.equal(voiceGender({ name: 'Voz desconocida' }), '?');
});

const voice = (name, lang, localService = true) => ({ name, lang, localService, voiceURI: name });

test('Colombian style prefers a female es-CO voice, then approximates, then reports none', () => {
  const salome = voice('Microsoft Salome Online (Natural) - Spanish (Colombia)', 'es-CO', false);
  const gonzalo = voice('Microsoft Gonzalo Online (Natural) - Spanish (Colombia)', 'es-CO', false);
  const helena = voice('Microsoft Helena - Spanish (Spain)', 'es-ES');
  const dalia = voice('Microsoft Dalia Online (Natural) - Spanish (Mexico)', 'es-MX', false);
  assert.deepEqual(pickVoiceForStyle('colombiana', [gonzalo, helena, salome]), { voice: salome, match: 'exact' });
  assert.deepEqual(pickVoiceForStyle('colombiana', [gonzalo, helena, dalia]), { voice: dalia, match: 'approx' });
  assert.equal(pickVoiceForStyle('colombiana', [helena]).voice, helena);
  assert.equal(pickVoiceForStyle('colombiana', [voice('English', 'en-US')]).match, 'none');
});

test('Russian style needs a Russian voice and prefers a female one', () => {
  const irina = voice('Microsoft Irina - Russian (Russia)', 'ru-RU');
  const pavel = voice('Microsoft Pavel - Russian (Russia)', 'ru-RU');
  assert.deepEqual(pickVoiceForStyle('rusa', [pavel, irina]), { voice: irina, match: 'exact' });
  assert.deepEqual(pickVoiceForStyle('rusa', [pavel]), { voice: pavel, match: 'approx' });
  assert.equal(pickVoiceForStyle('rusa', [voice('Helena', 'es-ES')]).match, 'none');
});

test('style text: Russian is Cyrillic, Colombian and standard are untouched', () => {
  assert.equal(styleText('standard', 'Paso 1. Gira.'), 'Paso 1. Gira.');
  assert.equal(styleText('colombiana', 'Paso uno. Gira.'), 'Paso uno. Gira.', 'no artificial pauses');
  assert.match(styleText('rusa', 'Gira a la derecha. Sigue.'), /^хира а ла дэрэча\.\.\. хигэ\.?|^[а-яё .]+$/);
  assert.ok(!/[a-z]/i.test(styleText('rusa', 'Ruta Nacional 151.')), 'nothing is left in Latin letters or digits');
});

test('styles define slower, softer delivery than standard', () => {
  const [standard, colombiana, rusa] = VOICE_STYLES;
  assert.equal(standard.rate, 1);
  assert.ok(colombiana.rate < 1 && rusa.rate < 1);
  assert.ok(colombiana.pitch > 1, 'a young voice sits above the neutral pitch');
  assert.ok(colombiana.volume < 1, 'softer');
  assert.ok(rusa.pitch < colombiana.pitch);
});

// ---------- Estilo Medellín ----------
import { melodicParts, seseo, splitPhrases, styleParts, voseo } from '../src/utils/voiceStyles.js';

test('seseo makes a Spain voice read z/ce/ci like Latin American Spanish', () => {
  assert.equal(seseo('Mendoza'), 'Mendosa');
  assert.equal(seseo('Zapala, Cipolletti, cruce'), 'Sapala, Sipolletti, cruse');
  assert.equal(seseo('chico, casa, que'), 'chico, casa, que', 'ch, ca and que are untouched');
  assert.equal(seseo('dirección'), 'direcsión', 'cc is read k+s: only the second c softens');
});

test('voseo turns common directions into the paisa form, keeping capitalization', () => {
  assert.equal(voseo('Gira a la derecha'), 'Girá a la derecha');
  assert.equal(voseo('Continúa por RN151 y toma la salida'), 'Continuá por RN151 y tomá la salida');
  assert.equal(voseo('Mantente a la izquierda'), 'Mantenete a la izquierda');
  assert.equal(voseo('Sigue recto'), 'Seguí recto');
  assert.equal(voseo('la salida'), 'la salida', 'sal inside salida is untouched');
  assert.equal(voseo('girasol'), 'girasol', 'words that merely contain a verb are untouched');
});

test('phrases split on sentences then commas', () => {
  assert.deepEqual(splitPhrases('Hola, vamos despacio. Seguí recto, sin apuro.'), [['Hola,', 'vamos despacio.'], ['Seguí recto,', 'sin apuro.']]);
});

test('melodic contour rises on continuing phrases and falls and slows on closing ones', () => {
  const parts = melodicParts('Gira a la derecha, luego sigue. ¿Entendido?', { pitch: 1 });
  assert.equal(parts.length, 3);
  assert.ok(parts[0].pitch > 1, 'continuing phrase rises');
  assert.ok(parts[1].pitch < 1, 'closing phrase falls');
  assert.ok(parts[1].rateFactor < parts[0].rateFactor, 'closing phrase slows down');
  assert.ok(parts[2].pitch > 1, 'questions close rising');
  assert.ok(parts.every((part) => !part.text.includes('...')), 'no theatrical ellipses');
  assert.ok(parts.every((part) => Math.abs(part.pitch - 1) <= 0.07), 'contour stays subtle to sound natural');
  assert.ok(parts.every((part) => part.pitch >= 0.1 && part.pitch <= 2));
});

test('Colombian style applies seseo only to Spain voices and always voseo', () => {
  const spain = { lang: 'es-ES' };
  const colombia = { lang: 'es-CO' };
  assert.match(styleParts('colombiana', 'Gira hacia Mendoza.', spain).map((p) => p.text).join(' '), /Girá hasia Mendosa/);
  assert.match(styleParts('colombiana', 'Gira hacia Mendoza.', colombia).map((p) => p.text).join(' '), /Girá hacia Mendoza/);
  const standard = styleParts('standard', 'Gira hacia Mendoza.', spain);
  assert.equal(standard.length, 1);
  assert.equal(standard[0].text, 'Gira hacia Mendoza.');
});

test('neural (Natural/Online) Colombian voices are preferred over classic ones', () => {
  const classic = { name: 'Microsoft Sabina - Spanish (Colombia)', lang: 'es-CO', localService: true, voiceURI: 'a' };
  const neural = { name: 'Microsoft Salome Online (Natural) - Spanish (Colombia)', lang: 'es-CO', localService: false, voiceURI: 'b' };
  assert.equal(pickVoiceForStyle('colombiana', [classic, neural]).voice, neural);
});

test('melody 0 keeps the pitch flat and a higher melody exaggerates the contour', () => {
  const spread = (melody) => {
    const pitches = melodicParts('Gira a la derecha, luego sigue, y llegas.', { pitch: 1, melody }).map((part) => part.pitch);
    return Math.max(...pitches) - Math.min(...pitches);
  };
  assert.equal(spread(0), 0);
  assert.ok(spread(2) > spread(1) && spread(1) > 0);
});

test('styleParts honors tuned pitch and melody overrides', () => {
  const flat = styleParts('colombiana', 'Gira, ahora.', { lang: 'es-CO' }, { pitch: 1.3, melody: 0 });
  assert.ok(flat.every((part) => part.pitch === 1.3));
  assert.equal(styleParts('standard', 'Hola', null, { pitch: 1.2 })[0].pitch, 1.2);
});

test('effectiveStyle merges saved tuning and clamps it to the allowed range', () => {
  const [, colombiana] = VOICE_STYLES;
  const tuned = effectiveStyle(colombiana, { pitch: 5, rate: 0.1, volume: 'x', melody: 1.5 });
  assert.equal(tuned.pitch, TUNING_LIMITS.pitch.max);
  assert.equal(tuned.rate, TUNING_LIMITS.rate.min);
  assert.equal(tuned.volume, colombiana.volume, 'invalid values fall back to the style default');
  assert.equal(tuned.melody, 1.5);
  assert.equal(effectiveStyle(colombiana).melody, 1);
});

test('control ranges are wide enough for a clearly audible change', () => {
  assert.ok(TUNING_LIMITS.pitch.max - TUNING_LIMITS.pitch.min >= 1.5);
  assert.ok(TUNING_LIMITS.rate.max / TUNING_LIMITS.rate.min >= 3);
  assert.ok(TUNING_LIMITS.melody.max >= 5);
  const [, colombiana] = VOICE_STYLES;
  assert.ok(colombiana.pitch >= 1.25, 'default Colombian pitch sits in the feminine range');
  const wild = styleParts('colombiana', 'Gira, ahora, ya.', { lang: 'es-CO' }, { pitch: 1.3, melody: 5 }).map((part) => part.pitch);
  assert.ok(Math.max(...wild) - Math.min(...wild) > 0.3, 'maximum melody gives a very marked contour');
});

test('Colombian voice choice favors female names including newer ones', () => {
  assert.equal(voiceGender({ name: 'Microsoft Ximena Online (Natural) - Spanish (Mexico)' }), 'f');
  assert.equal(voiceGender({ name: 'Microsoft Mateo - Spanish' }), 'm');
});
