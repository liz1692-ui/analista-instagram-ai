@'
# analista-instagram-ai

Projeto separado para rodar o módulo ANALISTA INSTAGRAM.

## O que este projeto faz

- Login no Instagram via Playwright.
- Acesso a perfis configurados.
- Coleta de Reels recentes.
- Captura de views, likes, comentários, hashtags, descrição, música, horário e duração.
- Salva em JSON.
- Envia para Supabase se configurado.
- Usa delays humanos.
- Pode rodar via Docker.
- Pode ser chamado pelo n8n.

## Primeiro uso

```bash
npm run setup:local
npm install
npx playwright install chromium