// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: [
      'src/entities/**/{domain,application}/**/*.ts',
      'src/{metrics,ingestion}/{domain,application}/**/*.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression, TSImportEqualsDeclaration',
          message: 'Usar imports estáticos para verificar los límites del módulo.',
        },
      ],
      'no-restricted-modules': [
        'error',
        {
          patterns: [
            '@nestjs/*',
            '@prisma/*',
            'bullmq',
            'ioredis',
            '**/adapters/**',
            '**/infrastructure/**',
            '**/prisma/**',
            '**/redis/**',
            '**/dto/**',
          ],
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '(^@nestjs/|^@prisma/|^(bullmq|ioredis|express|fastify|class-validator|class-transformer)(/|$)|(^|/)(adapters|infrastructure|prisma|redis|dto)(/|$)|\\.(controller|processor|module|service|store)(\\.js)?$)',
              message:
                'Dominio y aplicación usan contratos propios, sin depender de infraestructura o transporte.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['eslint.config.mjs', 'src/prisma/generated/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
);
