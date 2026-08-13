import type { AppSettings } from '@shared/types'

/**
 * El tema se aplica con un atributo en <html>; el CSS intercambia las
 * variables y toda la interfaz se re-tine sin tocar ningun componente.
 *
 * Vive aparte del dialogo de ajustes para que el store pueda usarlo al
 * arrancar sin crear un import circular.
 */
export function applyTheme(theme: AppSettings['theme']): void {
  if (theme === 'dark') document.documentElement.dataset.theme = 'oscuro'
  else delete document.documentElement.dataset.theme
}
