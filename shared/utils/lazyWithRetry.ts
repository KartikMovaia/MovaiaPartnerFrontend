// Wrapper around React.lazy that survives a stale chunk after a redeploy.
//
// When the app is redeployed, the hashed chunk filenames change. A tab that was
// open before the deploy will 404 on its next dynamic import — which Suspense
// does NOT catch (it rejects), white-screening the app. This retries the import
// once, and if it still fails, forces a single full reload (guarded via
// sessionStorage so we never loop) to pull the fresh index + chunk manifest.
import { lazy, ComponentType, LazyExoticComponent } from 'react';

const RELOAD_FLAG = 'mv:chunk-reloaded';

// Signature mirrors React.lazy so prop types on the imported page are preserved.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      // Success — clear any prior reload guard so future stale chunks can reload again.
      window.sessionStorage.removeItem(RELOAD_FLAG);
      return mod;
    } catch (err) {
      const alreadyReloaded = window.sessionStorage.getItem(RELOAD_FLAG) === '1';
      if (!alreadyReloaded) {
        window.sessionStorage.setItem(RELOAD_FLAG, '1');
        window.location.reload();
        // Return a never-resolving promise so nothing renders before the reload.
        return new Promise<{ default: T }>(() => {});
      }
      // Already reloaded once and it still failed — surface the real error to
      // the nearest ErrorBoundary instead of looping.
      throw err;
    }
  });
}
