// C1 (Фаза 3): SortableJS, модалки аспект-динамики/сохранения и чат вынесены из
// eager-бандла. Sortable/модалки грузятся по требованию из forecast-new.js
// (ensureSortable/ensureAspectDynamicsModal/ensureSaveChartModal); чат — в idle
// ниже. Так первый визит не тянет ~114 КБ модалки + SortableJS + chat.js.
import '../js/i18n.js';
import '../js/i18n-ui.js';
import '../js/locale-formatters.js';
import '../js/locale-switcher.js';
import '../js/api.js';
import '../js/quick-open-popover.js';
import '../js/chart-picker.js';
import '../js/timezones.js';
import '../js/place-autocomplete.js';
import '../js/preferences.js';
import '../js/onboarding.js';
import '../js/chart-config-presets.js';
import '../js/symbols.js';
import '../js/planet-svg-icons.js';
import '../js/natal-wheel-data.js';
import '../js/chart-data.js';
import '../js/dispositor-chains.js';
import '../js/prognostic-layer-normalizer.js';
import '../js/forecast-new-card-identity.js';
import '../js/forecast-new-deep-link.js';
import '../js/prognostic-rings-wheel.js';
import '../js/forecast-new-state-storage.js';
import '../js/forecast-new-panel-layout.js';
import '../js/forecast-source-utils.js';
import '../js/chart-source-panel.js';
import '../js/forecast-commands.js';
import '../js/forecast-new.js';
import '../js/forecast-nav-menu.js';

// Чат не нужен для первого рендера рабочего экрана — грузим его чанк в простое,
// после интерактива. chat.js сам инициализируется, учитывая readyState.
function loadStylesheetOnce(href) {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`link[data-lazy-css="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute('data-lazy-css', href);
  document.head.appendChild(link);
}
const loadChat = () => {
  // C3: стили чата — из ленивого бандла; ?v= из build id для инвалидации кэша.
  const version = window.__APP_BUILD_ID__ ? `?v=${window.__APP_BUILD_ID__}` : '';
  loadStylesheetOnce(`/bundles/chat-widget.bundle.css${version}`);
  import('../js/chat.js');
};
if (typeof window !== 'undefined') {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(loadChat, { timeout: 3000 });
  } else {
    setTimeout(loadChat, 1200);
  }
}
