import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, { ignores: ['**/dist/**','**/node_modules/**','**/.expo/**','**/.expo-export/**'] }, { files: ['**/*.cjs'], languageOptions: { globals: { module: 'readonly', require: 'readonly', __dirname: 'readonly' } }, rules: { '@typescript-eslint/no-require-imports': 'off' } });
