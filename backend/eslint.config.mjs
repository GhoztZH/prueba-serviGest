import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      // Regla de arquitectura: el dominio y la aplicación no conocen Express ni pg.
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/modules/*/domain/**/*.ts', 'src/modules/*/application/**/*.ts', 'src/shared/domain/**/*.ts', 'src/shared/application/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [
        { name: 'express', message: 'Dominio y aplicación no dependen de Express.' },
        { name: 'pg', message: 'Dominio y aplicación no dependen de PostgreSQL.' },
      ] }],
    },
  },
);
