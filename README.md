# ⚓ Lastro — Gestão Financeira Multiusuário

Sistema de gestão financeira por **workspaces** com papéis (dono/admin/editor/leitor),
construído em React + TypeScript + Vite sobre Firebase (Auth + Firestore), com
deploy gratuito no GitHub Pages via GitHub Actions.

## Setup (uma vez, ~10 minutos)

1. **Firebase** — em https://console.firebase.google.com crie um projeto:
   - *Authentication* → ativar **Google** e **E-mail/senha**;
   - *Firestore Database* → criar (modo produção) e colar o conteúdo de
     `firestore.rules` na aba **Regras** → Publicar;
   - *Configurações do projeto → Seus apps → Web* → registrar app e copiar a config.
2. **Local** — `cp .env.example .env` e preencher com a config copiada; depois:
   ```bash
   npm install
   npm run dev      # desenvolvimento
   npm test         # testes (Vitest)
   npm run build    # produção em dist/
   ```
3. **GitHub** — criar o repositório e enviar o código; em *Settings → Pages*
   escolher **GitHub Actions** como fonte; em *Settings → Secrets → Actions*
   criar os 6 secrets do `.env` (mesmos nomes `VITE_FB_*`).
   A cada push na `main`, o workflow roda os testes, builda e publica.
4. **Auth no Pages** — no Firebase, *Authentication → Settings → Domínios
   autorizados*: adicionar `SEU_USUARIO.github.io`.

## Regras de ouro do código

- **Dinheiro é inteiro em centavos** (`src/lib/dinheiro.ts`) — nunca float.
- **Todo dado pertence a um workspace**; permissões nascem nas Firestore Rules
  e são espelhadas no cliente (`podeFazer` em `src/types/dominio.ts`).
- Acesso a dados **só via repositórios** das features — troca de backend no
  futuro (ex.: Supabase) sem tocar em telas.
- Dois temas por design tokens (`src/styles/tokens.css`); componentes não
  conhecem cores, só tokens.

## Fases

F0 fundação → **F1 membros & convites (implementada)** → F2 contas, cartões e
lançamentos → F3 faturas & orçamentos → F4 dashboard & relatórios →
F5 metas & investimentos → F6 motor de inteligência. Detalhes em `ARCHITECTURE.md`.
