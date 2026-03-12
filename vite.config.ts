import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      proxy: {
        // Dev local: /api/recall-api/* → Recall.ai (token seguro via env var)
        // Em produção (Vercel): serverless function em api/recall-api/[...path].ts faz o proxy
        '/api/recall-api': {
          target: 'https://us-west-2.recall.ai',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/recall-api/, '/api/v1'),
          headers: {
            Authorization: `Token ${env.VITE_RECALL_API_TOKEN ?? env.RECALL_API_TOKEN ?? ''}`,
          },
        },
        // Dev local: /api/openai → OpenAI API (chave segura via env var, não exposta no bundle)
        // Em produção (Vercel): serverless function em api/openai.ts faz o proxy
        '/api/openai': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/openai/, '/v1/chat/completions'),
          headers: {
            Authorization: `Bearer ${env.VITE_OPENAI_API_KEY ?? env.OPENAI_API_KEY ?? ''}`,
          },
        },
      },
    },

    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
