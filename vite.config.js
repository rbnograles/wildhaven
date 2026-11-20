// Vite's settings. The game needs none of its own; this file only adds the world editor's
// dev-server endpoints (see tools/editor-server.js), which are left out of the production build.

import { defineConfig } from 'vite';
import { editorServer } from './tools/editor-server.js';

export default defineConfig({
  plugins: [editorServer()],
});
