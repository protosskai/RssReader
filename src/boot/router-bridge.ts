import { boot } from 'quasar/wrappers';
import type { Router } from 'vue-router';

/**
 * Bridge the Vue Router instance onto window so non-setup helpers
 * (e.g. switchPage in util.ts) always have a live reference.
 */
export default boot(({ router }) => {
  if (typeof window !== 'undefined' && router) {
    (window as unknown as { __APP_ROUTER__?: Router }).__APP_ROUTER__ = router;
  }
});
