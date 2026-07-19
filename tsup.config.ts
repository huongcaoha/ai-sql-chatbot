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
    external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  {
    entry: ['src/bin/cli.ts'],
    format: ['cjs'],
    dts: false,
    outDir: 'dist/bin',
    clean: true,
    target: 'node18',
  }
]);
