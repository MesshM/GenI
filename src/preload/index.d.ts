import type { GenIApi } from '@shared/types'

declare global {
  interface Window {
    geni: GenIApi
  }
}

export {}
