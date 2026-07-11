import { boot } from 'quasar/wrappers';
import { createPinia } from 'pinia';

/**
 * Explicit Pinia install — guarantees getActivePinia() works for all layouts.
 * (Quasar's auto pinia can race with ErrorBoundary remounts / HMR.)
 */
export default boot(({ app }) => {
  // Avoid double-install if Quasar already registered Pinia
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(app as any).config.globalProperties.$pinia) {
    const pinia = createPinia();
    app.use(pinia);
  }
});
