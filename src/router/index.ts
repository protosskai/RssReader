import {route} from 'quasar/wrappers';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory, Router,
} from 'vue-router';

import routes from './routes';

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */
export let router: Router | null = null;
export default route(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory);

  router = createRouter({
    scrollBehavior: () => ({left: 0, top: 0}),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE),
  });

  // Expose globally so switchPage never hits a null import binding
  // (Vite can create dual module instances for src/router in some cases)
  if (typeof window !== 'undefined') {
    (window as unknown as { __APP_ROUTER__?: Router }).__APP_ROUTER__ = router;
  }

  // Route guard: warn when running outside Electron but never block.
  // All IPC methods are already protected by the noop proxy in electronClient.ts.
  router.beforeEach((to, from, next) => {
    const hasElectronAPI =
      typeof window !== 'undefined' && 'electronAPI' in window;
    if (!hasElectronAPI && to.name !== 'Home') {
      console.warn(
        `[Router] 非 Electron 环境，导航到 ${String(to.name)} (${to.path})`,
      );
    }
    next();
  });

  return router;
});
