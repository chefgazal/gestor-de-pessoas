# Gestão de Escalas

App de escala de colaboradores (fixos, diaristas e intermitentes) em Next.js, com banco e login no Supabase.

## 1. Preparar o Supabase (uma vez, uns 5 minutos)

1. Abra o projeto no Supabase, **SQL Editor**, e crie uma nova consulta.
2. Abra `supabase/schema.sql`, **troque o e-mail da última linha pelo seu** e rode o arquivo inteiro.
   Esse e-mail precisa ser o mesmo que você vai cadastrar no passo 4. Para liberar outras pessoas, repita a linha com o e-mail delas.
3. Abra `supabase/seed.sql` e rode. Ele cadastra os 11 colaboradores, as 3 vagas, os feriados acumulados e a configuração.
4. Em **Authentication > Users**, clique em **Add user**, informe o e-mail e uma senha, e marque para confirmar o e-mail.
5. Em **Authentication > Sign In / Providers**, desligue **Allow new users to sign up**. O nome do menu pode variar um pouco.
   Mesmo com o cadastro aberto, só entram os e-mails da lista do passo 2, mas desligar evita contas desconhecidas.

## 2. Testar no seu computador

```bash
npm install
npm run dev
```

Abra http://localhost:3000 e entre com o e-mail e a senha do passo 4.
O arquivo `.env.local` já traz a URL e a chave pública do projeto.

## 3. Publicar na Vercel

1. Envie esta pasta para um repositório no GitHub (o `.env.local` não vai junto, está no `.gitignore`).
2. Na Vercel: **Add New > Project**, escolha o repositório. O framework Next.js é detectado sozinho.
3. Antes de clicar em Deploy, abra **Environment Variables** e cadastre as duas variáveis do arquivo `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Clique em **Deploy**. Pronto: o endereço da Vercel abre a tela de login.

## Como os dados ficam guardados

- Tudo fica na tabela `public.docs` (uma linha por colaborador, extra, falta, baixa de feriado etc.). O app lê e grava ali.
- A chave `sb_publishable_...` pode ficar no navegador. Quem protege os dados são as regras do banco (RLS):
  só e-mails da tabela `allowed_users`, logados, leem ou gravam.
- Mudanças feitas em um aparelho aparecem nos outros em tempo real. Uma releitura a cada 60 segundos cobre qualquer falha de conexão.
- Para fazer backup, em **Table Editor > docs**, exporte como CSV.

## Observações

- O check-in de diaristas é feito no aparelho de quem está logado (por exemplo, um tablet da gestão), não pelo celular do diarista.
- Os horários de trabalho dos 11 colaboradores estão provisórios (08:00 às 17:00, todos os dias). Ajuste em **Escala > Escala geral**.
