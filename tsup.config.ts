import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/server/index.ts'],
    format: ['cjs', 'esm'],
    dts: false,
    outDir: 'dist/server',
    clean: true,
    target: 'node18',
  },
  {
    entry: ['src/react/index.ts'],
    format: ['cjs', 'esm'],
    dts: false,
    outDir: 'dist/react',
    clean: true,
    external: ['react', 'react-dom'],
  }
]);
