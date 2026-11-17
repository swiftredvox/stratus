import { defineConfig } from 'vite';

// Relative base so the build works at swiftredvox.github.io/stratus/ and locally.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
