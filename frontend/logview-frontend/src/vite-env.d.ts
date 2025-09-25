/// <reference types="vite/client" />

import { FrontendConfig } from './types'

declare global {
  const __FRONTEND_CONFIG__: FrontendConfig
}