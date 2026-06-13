import { createApp } from 'vue';
import { DracoCompression } from '@babylonjs/core';
import App from './App.vue';
import './style.css';

/**
 * 模型皆以 Draco 壓縮（gltf-transform），解碼器改用自帶檔（public/draco/，同源），
 * 不依賴外部 CDN。於進入點設定，確保所有載入路徑（遊戲／圖鑑／角色預覽）皆生效。
 */
DracoCompression.Configuration = {
  decoder: {
    wasmUrl: '/draco/draco_wasm_wrapper_gltf.js',
    wasmBinaryUrl: '/draco/draco_decoder_gltf.wasm',
    fallbackUrl: '/draco/draco_decoder_gltf.js',
  },
};

createApp(App).mount('#app');
