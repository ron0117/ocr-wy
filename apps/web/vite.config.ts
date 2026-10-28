import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { publicAssetCdnPlugin } from './vite-public-asset-cdn';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  const cdnBase = (env.VITE_PUBLIC_ASSET_CDN ?? '').replace(/\/$/, '');
  const keyPrefix = (env.VITE_PUBLIC_ASSET_KEY_PREFIX ?? env.COS_KEY_PREFIX ?? '').trim();
  const omitLocalAssets =
    env.VITE_PUBLIC_ASSET_OMIT_LOCAL === 'true' || env.VITE_PUBLIC_ASSET_OMIT_LOCAL === '1';

  return {
  plugins: [
    vue(),
    publicAssetCdnPlugin({
      cdnBase,
      keyPrefix,
      omitLocalAssets,
      outDir: 'dist',
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5777,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  };
});
