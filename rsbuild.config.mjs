import { defineConfig } from '@rsbuild/core';
import { pluginVue } from '@rsbuild/plugin-vue';
import { resolve } from 'path'
import { pluginSass } from '@rsbuild/plugin-sass';

export default defineConfig({
  html: {
    title: '定位地图',
  },
  output: {
    assetPrefix: '/mapOrientation/',
  },
  plugins: [pluginVue(), pluginSass()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@assets': resolve(__dirname, 'src/assets')
    }
  }
});
