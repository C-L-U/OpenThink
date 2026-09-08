import { useStore } from './store';

export type Lang = 'en' | 'es';

/**
 * Flat UI dictionaries. The `en` shape is the source of truth; `es` must
 * mirror it exactly. `{name}` placeholders are interpolated by `t()`.
 * `**bold**` markers inside a string are rendered by the components that
 * need them (see SettingsDrawer's security notice).
 */
const en = {
  'app.tagline': 'Ten minds. One answer.',
  'app.newDebate': 'New debate',
  'app.backendChecking': 'Checking backend…',
  'app.backendOnline': 'Backend connected',
  'app.backendOffline': 'Backend offline — click settings to retry or start uvicorn',
  'app.offlineBanner': 'Cannot reach the OpenThink backend — start it with',
  'app.offlineReconnect': 'Reconnect',
  'app.missingKeys': 'No API key configured for {names} — their models will report errors.',
  'app.missingKeysSuffix': 'to add keys.',
  'app.openSettings': 'Open settings',
  'app.retry': 'Retry',
  'app.dismissError': 'Dismiss error',
  'app.pressToFocus': 'Press',
  'app.pressToFocusAfter': 'to focus · ⚙️ to add API keys',
  'app.suggestions': [
    'What is the best 34-inch curved monitor for productivity?',
    "Is 'Dune' a good book for someone who liked 'Foundation'?",
    'Mechanical or membrane keyboard for long typing sessions?',
  ],

  'input.placeholder': 'Ask a subjective question…',
  'input.send': 'Send',
  'input.noModels': 'Add at least one model to the debate',

  'chips.add': 'Add',
  'chips.addTitle': 'Add models to the debate',
  'chips.remove': 'Remove {name} · {model}',
  'chips.noneSelected': 'No models selected — add at least one',

  'loading.gathering': 'Querying {n} AIs — gathering independent answers',
  'loading.debating': 'AIs are debating… Round {current}/{max}',
  'loading.judging': 'Judge is evaluating positions',
  'loading.moderating': 'Moderator is synthesizing the best compromise',
  'loading.chadBadge': '⚡ CHAD MODE — blunt verdict incoming',
  'loading.stop': '■ Stop',

  'chad.label': 'Chad Mode',
  'chad.on': 'ON',
  'chad.off': 'OFF',
  'chad.toggleTitle': 'Toggle Chad Mode — blunt, no-nuance verdicts',

  'timeline.history': 'Debate history',
  'timeline.roundInitial': 'Round {n} — Independent Answers',
  'timeline.roundDebate': 'Round {n} — Debate',
  'timeline.waiting': 'Waiting for model responses…',
  'timeline.showMore': 'Show more',
  'timeline.showLess': 'Show less',
  'timeline.consensusReached': 'Consensus reached',
  'timeline.noConsensus': 'No consensus',
  'timeline.judgedBy': '· judged by',
  'timeline.positionMatch': '· decided by position match',
  'timeline.moderatorInvoked': 'Moderator invoked — round limit reached',

  'consensus.title': 'Consensus',
  'consensus.compromise': 'Best Compromise',
  'consensus.unanimous': 'unanimous agreement · {n} {rounds}',
  'consensus.moderated': 'no unanimous agreement after {n} {rounds} — moderated',
  'consensus.copy': 'Copy consensus',
  'consensus.share': 'Share on X',
  'consensus.chadBadge': '⚡ CHAD MODE',
  'consensus.agreedBy': 'Agreed by {n} {models}',
  'consensus.finalPositions': 'Final positions from {n} {models}',

  'share.chadUnanimous': '⚡ Unanimous verdict from {n} AIs in {r} rounds · OpenThink',
  'share.chadVerdict': '⚡ Verdict from {n} AIs after {r} debate rounds · OpenThink',
  'share.normalConsensus': 'Consensus of {n} AIs in {r} rounds · OpenThink',
  'share.normalCompromise': 'Best compromise from {n} AIs in {r} rounds · OpenThink',

  'common.round': 'round',
  'common.rounds': 'rounds',
  'common.model': 'model',
  'common.models': 'models',
  'common.provider': 'provider',
  'common.providers': 'providers',

  'settings.title': 'Settings',
  'settings.subtitle': 'Add keys for the providers you want in the debate — any subset works.',
  'settings.appearance': 'Appearance',
  'settings.chadMode': 'Chad Mode',
  'settings.chadModeDesc':
    'Blunt, definitive verdicts: no nuance, no «it depends». The consensus is distilled to one punchy answer.',
  'settings.theme': 'Theme',
  'settings.light': 'Light',
  'settings.dark': 'Dark',
  'settings.language': 'Language',
  'settings.howTitle': 'How the debate works',
  'settings.howStep1':
    'Your question is sent to every selected model; each one answers independently (round 1).',
  'settings.howStep2':
    "In the debate rounds (up to 3), each model sees the others' answers and can concede (CONCEDED), maintain (MAINTAINED), or revise (REVISED) its position.",
  'settings.howStep3':
    'After each round, a judge model evaluates whether there is consensus and explains its verdict.',
  'settings.howStep4':
    'If consensus is reached —or the rounds run out— a moderator synthesizes the final answer.',
  'settings.howStep5': 'You can stop the debate at any time and keep the partial results.',
  'settings.howStep6':
    'With Chad Mode on, the final answer is distilled to a blunt verdict with no nuance or hedging.',
  'settings.securityTitle': 'Your keys never leave this machine',
  'settings.securityStep1':
    "Keys live **only in this tab's memory** — never in localStorage, cookies, or any file.",
  'settings.securityStep2':
    'They travel as request headers **only to your own local backend** (localhost:8000).',
  'settings.securityStep3':
    "The backend holds them in memory for the request and forwards them **only to each provider's official API** to authenticate.",
  'settings.securityStep4':
    'Never logged, never stored, no telemetry, no third parties. **Closing the tab erases them.**',
  'settings.modelsInDebate': '{a} of {m} models in debate',
  'settings.notInDebate': 'not in debate',
  'settings.filterPlaceholder': 'Filter models…',
  'settings.noMatch': 'No providers match "{filter}".',
  'settings.clearAll': 'Clear all keys',
  'settings.clearConfirm': 'Clear all keys?',
  'settings.clearYes': 'Yes, clear',
  'settings.clearCancel': 'Cancel',
  'settings.test': 'Test',
  'settings.connected': 'Connected · {ms}ms',
  'settings.lastTestConnected': 'Last test: connected',
  'settings.lastTestFailed': 'Last test: failed',
  'settings.untested': 'Untested',
  'settings.modelsCount': '{n} {models} from {m} {providers} in the debate',
  'settings.showKey': 'Show key',
  'settings.hideKey': 'Hide key',
  'settings.close': 'Close settings',
  'settings.defaultModel': '(default)',
  'settings.apiKeyPlaceholder': '{name} API key',
  'settings.addToDebate': 'Add {name} to the debate',
  'settings.removeFromDebate': 'Remove {name} from the debate',
  'settings.pillAdd': 'add to debate',
  'settings.pillRemove': 'remove from debate',

  'error.title': 'Something went wrong',
  'error.body':
    'The interface hit an unexpected error, but your settings and keys are intact — no need to reload the page.',
  'error.tryAgain': 'Try again',
  'error.reload': 'Reload page',
};

const es: typeof en = {
  'app.tagline': 'Diez mentes. Una respuesta.',
  'app.newDebate': 'Nuevo debate',
  'app.backendChecking': 'Comprobando el backend…',
  'app.backendOnline': 'Backend conectado',
  'app.backendOffline': 'Backend sin conexión — abre los ajustes para reintentar o inicia uvicorn',
  'app.offlineBanner': 'No se puede conectar con el backend de OpenThink — inícialo con',
  'app.offlineReconnect': 'Reconectar',
  'app.missingKeys': 'No hay clave API configurada para {names} — sus modelos devolverán errores.',
  'app.missingKeysSuffix': 'para añadir claves.',
  'app.openSettings': 'Abrir ajustes',
  'app.retry': 'Reintentar',
  'app.dismissError': 'Descartar error',
  'app.pressToFocus': 'Pulsa',
  'app.pressToFocusAfter': 'para escribir · ⚙️ para añadir claves API',
  'app.suggestions': [
    '¿Cuál es el mejor monitor curvo de 34 pulgadas para productividad?',
    "¿Es 'Dune' un buen libro para alguien al que le gustó 'Fundación'?",
    '¿Teclado mecánico o de membrana para escribir durante horas?',
  ],

  'input.placeholder': 'Haz una pregunta subjetiva…',
  'input.send': 'Enviar',
  'input.noModels': 'Añade al menos un modelo al debate',

  'chips.add': 'Añadir',
  'chips.addTitle': 'Añadir modelos al debate',
  'chips.remove': 'Quitar {name} · {model}',
  'chips.noneSelected': 'No hay modelos seleccionados — añade al menos uno',

  'loading.gathering': 'Consultando a {n} IAs — recopilando respuestas independientes',
  'loading.debating': 'Las IAs están debatiendo… Ronda {current}/{max}',
  'loading.judging': 'El juez está evaluando las posiciones',
  'loading.moderating': 'El moderador está sintetizando el mejor compromiso',
  'loading.chadBadge': '⚡ MODO CHAD — veredicto tajante en camino',
  'loading.stop': '■ Detener',

  'chad.label': 'Modo Chad',
  'chad.on': 'activado',
  'chad.off': 'desactivado',
  'chad.toggleTitle': 'Activa o desactiva el modo Chad — veredictos tajantes, sin matices',

  'timeline.history': 'Historial del debate',
  'timeline.roundInitial': 'Ronda {n} — Respuestas independientes',
  'timeline.roundDebate': 'Ronda {n} — Debate',
  'timeline.waiting': 'Esperando respuestas de los modelos…',
  'timeline.showMore': 'Mostrar más',
  'timeline.showLess': 'Mostrar menos',
  'timeline.consensusReached': 'Consenso alcanzado',
  'timeline.noConsensus': 'Sin consenso',
  'timeline.judgedBy': '· evaluado por',
  'timeline.positionMatch': '· decidido por coincidencia de posiciones',
  'timeline.moderatorInvoked': 'Moderador invocado — límite de rondas alcanzado',

  'consensus.title': 'Consenso',
  'consensus.compromise': 'Mejor compromiso',
  'consensus.unanimous': 'acuerdo unánime · {n} {rounds}',
  'consensus.moderated': 'sin acuerdo unánime tras {n} {rounds} — moderado',
  'consensus.copy': 'Copiar consenso',
  'consensus.share': 'Compartir en X',
  'consensus.chadBadge': '⚡ MODO CHAD',
  'consensus.agreedBy': 'Acordado por {n} {models}',
  'consensus.finalPositions': 'Posiciones finales de {n} {models}',

  'share.chadUnanimous': '⚡ Veredicto unánime de {n} IAs en {r} rondas · OpenThink',
  'share.chadVerdict': '⚡ Veredicto de {n} IAs tras {r} rondas de debate · OpenThink',
  'share.normalConsensus': 'Consenso de {n} IAs en {r} rondas · OpenThink',
  'share.normalCompromise': 'Mejor compromiso de {n} IAs en {r} rondas · OpenThink',

  'common.round': 'ronda',
  'common.rounds': 'rondas',
  'common.model': 'modelo',
  'common.models': 'modelos',
  'common.provider': 'proveedor',
  'common.providers': 'proveedores',

  'settings.title': 'Ajustes',
  'settings.subtitle': 'Añade claves para los proveedores que quieras en el debate — vale cualquier subconjunto.',
  'settings.appearance': 'Apariencia',
  'settings.chadMode': 'Modo Chad',
  'settings.chadModeDesc':
    'Veredictos tajantes y definitivos: sin matices, sin «depende». El consenso se reduce a una respuesta puntual.',
  'settings.theme': 'Tema',
  'settings.light': 'Claro',
  'settings.dark': 'Oscuro',
  'settings.language': 'Idioma',
  'settings.howTitle': 'Cómo funciona el debate',
  'settings.howStep1':
    'Tu pregunta se envía a todos los modelos seleccionados; cada uno responde de forma independiente (ronda 1).',
  'settings.howStep2':
    'En las rondas de debate (hasta 3), cada modelo ve las respuestas de los demás y puede ceder (CONCEDED), mantenerse (MAINTAINED) o revisar (REVISED) su postura.',
  'settings.howStep3':
    'Tras cada ronda, un modelo juez evalúa si hay consenso y explica su veredicto.',
  'settings.howStep4':
    'Si hay consenso —o se agotan las rondas— un moderador sintetiza la respuesta final.',
  'settings.howStep5': 'Puedes detener el debate en cualquier momento y conservar los resultados parciales.',
  'settings.howStep6':
    'Con el modo Chad activo, la respuesta final se reduce a un veredicto tajante, sin matices ni rodeos.',
  'settings.securityTitle': 'Tus claves nunca salen de esta máquina',
  'settings.securityStep1':
    'Las claves viven **solo en la memoria de esta pestaña** — nunca en localStorage, cookies ni ningún archivo.',
  'settings.securityStep2':
    'Viajan como cabeceras de petición **solo a tu propio backend local** (localhost:8000).',
  'settings.securityStep3':
    'El backend las mantiene en memoria durante la petición y las reenvía **solo a la API oficial de cada proveedor** para autenticarse.',
  'settings.securityStep4':
    'Nunca se registran, nunca se almacenan, sin telemetría ni terceros. **Cerrar la pestaña las borra.**',
  'settings.modelsInDebate': '{a} de {m} modelos en el debate',
  'settings.notInDebate': 'fuera del debate',
  'settings.filterPlaceholder': 'Filtrar modelos…',
  'settings.noMatch': 'Ningún proveedor coincide con "{filter}".',
  'settings.clearAll': 'Borrar todas las claves',
  'settings.clearConfirm': '¿Borrar todas las claves?',
  'settings.clearYes': 'Sí, borrar',
  'settings.clearCancel': 'Cancelar',
  'settings.test': 'Probar',
  'settings.connected': 'Conectado · {ms}ms',
  'settings.lastTestConnected': 'Última prueba: conectado',
  'settings.lastTestFailed': 'Última prueba: falló',
  'settings.untested': 'Sin probar',
  'settings.modelsCount': '{n} {models} de {m} {providers} en el debate',
  'settings.showKey': 'Mostrar clave',
  'settings.hideKey': 'Ocultar clave',
  'settings.close': 'Cerrar ajustes',
  'settings.defaultModel': '(predeterminado)',
  'settings.apiKeyPlaceholder': 'Clave API de {name}',
  'settings.addToDebate': 'Añadir {name} al debate',
  'settings.removeFromDebate': 'Quitar {name} del debate',
  'settings.pillAdd': 'añadir al debate',
  'settings.pillRemove': 'quitar del debate',

  'error.title': 'Algo salió mal',
  'error.body':
    'La interfaz encontró un error inesperado, pero tus ajustes y claves están intactos — no hace falta recargar la página.',
  'error.tryAgain': 'Intentar de nuevo',
  'error.reload': 'Recargar página',
};

export type Messages = typeof en;
export type MessageKey = keyof Messages;

const dictionaries: Record<Lang, Messages> = { en, es };

/** Look up a key in `lang` (falling back to English) and interpolate `{vars}`. */
export function translate(
  lang: Lang,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const value = dictionaries[lang][key] ?? en[key];
  if (typeof value !== 'string') return String(value);
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

/** Hook: current language's translator, reactive to store changes. */
export function useT() {
  const language = useStore((s) => s.language);
  return (key: MessageKey, vars?: Record<string, string | number>) =>
    translate(language, key, vars);
}

/** Hook: current language's full dictionary (for array values like suggestions). */
export function useMessages(): Messages {
  const language = useStore((s) => s.language);
  return dictionaries[language] ?? en;
}
