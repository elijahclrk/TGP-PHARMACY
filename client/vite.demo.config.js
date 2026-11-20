import { mergeConfig } from 'vite'
import base from './vite.config.js'

// Separate IP origin avoids sharing the live localhost session cookie.
export default mergeConfig(base, {
  server: { host: '127.0.0.1', port: 5174, strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:5001' } },
})
