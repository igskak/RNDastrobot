import '../js/i18n.js';
import '../js/i18n-ui.js';
import '../js/locale-formatters.js';
import '../js/locale-switcher.js';
import '../js/timezones.js';
import '../js/api.js';
import '../js/place-autocomplete.js';
import '../js/index-landing.js';
// form.js is intentionally NOT imported: the birth-data form moved off the landing
// (it lives in the app's New chart dialog on the Practice page, where the user is
// already signed in). form.js binds #birthDataForm without a null guard, so importing
// it here would throw a TypeError now that the form is gone from this page.
