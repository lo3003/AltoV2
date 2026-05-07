import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'

/**
 * Register the PWA service worker.
 *
 * - `autoUpdate` strategy in vite.config means the SW takes control immediately,
 *   but pages already loaded need to reload to pick up new assets.
 * - We surface a toast prompting reload when a new version is available.
 */
export function registerPWA() {
  if (typeof window === 'undefined') return

  const updateSW = registerSW({
    onNeedRefresh() {
      toast('Nouvelle version disponible', {
        description: 'Recharge pour profiter des dernières améliorations.',
        duration: Infinity,
        action: {
          label: 'Recharger',
          onClick: () => updateSW(true),
        },
      })
    },
    onOfflineReady() {
      // Optional: notify that the app is cached for offline use
      // toast.success('App prête hors-ligne')
    },
    onRegisterError(error) {
      console.error('SW registration error', error)
    },
  })
}
