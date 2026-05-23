# Organizador de Rachas

Aplicativo web simples para organizar rachas de futebol society e volei.

## O que ja esta pronto

- Pagina publica com lista de rachas abertos.
- Inscricao de jogador com nome, WhatsApp, observacao e posicao.
- Painel admin com controle de confirmacao, pagamento e exclusao.
- Criacao de novos rachas pelo admin.
- Criacao separada por tipo: futebol ou volei.
- Posicoes exibidas conforme o esporte selecionado.
- Chave Pix por racha e anexo de comprovante apos inscricao.
- Vagas exibidas em bolinhas com iniciais e codigo da posicao.
- Confirmacao simples do telefone antes do pagamento, sem custo de SMS ou WhatsApp.
- Fluxo Pix com chave `edcdesigner@hotmail.com`.
- Jogador so aparece para validacao do admin depois de clicar em `FIZ O PAGAMENTO`.
- Pagamento mostra relogio regressivo ate 24h antes do horario do racha.
- Admin pode expandir o comprovante enviado pelo jogador.
- Home separada com cards de rachas abertos e botao de inscricao.
- Inscricao separada em 3 etapas: dados, confirmacao do telefone e pagamento.
- Pagina `overview.html` para consultar a situacao da inscricao pelo telefone.
- Apos `FIZ O PAGAMENTO`, o usuario e redirecionado para o overview do racha.
- Admin exclui inscricoes com remocao real do banco.
- Comprovante no admin abre em popup por icone compacto.
- Admin pode editar rachas em uma pagina separada.
- Admin pode excluir rachas; as inscricoes ligadas ao racha tambem sao removidas.
- Home prioriza criacao de racha, depois rachas abertos e por ultimo consulta de inscricao.
- Home mostra uma mensagem ludica quando nao houver rachas disponiveis.
- Organizadores podem criar rachas pela pagina `organizar.html`.
- Banco local gratuito em `data/db.json`.
- Visual de referencia inspirado no fluxo escuro, centralizado e direto do Manda Ai.

## Como rodar

```bash
npm start
```

Depois acesse:

- Publico: `http://localhost:3000`
- Admin: `http://localhost:3000/admin.html`

Senha admin padrao:

```text
admin123
```

Para trocar a senha ao iniciar:

```bash
ADMIN_PASSWORD=sua-senha npm start
```

No Windows PowerShell:

```powershell
$env:ADMIN_PASSWORD="sua-senha"; npm start
```

## Banco de dados

Em desenvolvimento, o app usa um arquivo JSON local para continuar rodando sem servicos externos. Ele fica em:

```text
data/db.json
```

Em producao, configure Supabase Free. Quando as variaveis abaixo existem, o app deixa de usar `data/db.json` e passa a salvar rachas e inscricoes no Supabase:

```text
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
SUPABASE_STATE_TABLE=app_state
```

Crie a tabela no Supabase:

1. Acesse `https://supabase.com`.
2. Crie um projeto gratuito.
3. Abra `SQL Editor`.
4. Cole e execute o conteudo do arquivo `supabase-schema.sql`.
5. Em `Project Settings` -> `API`, copie:
   - `Project URL` para `SUPABASE_URL`
   - `service_role` para `SUPABASE_SERVICE_ROLE_KEY`
6. Configure essas variaveis no Replit em `Secrets`.

Importante: `SUPABASE_SERVICE_ROLE_KEY` deve ficar apenas no servidor/Secrets. Nunca coloque essa chave em arquivo publico ou no frontend.

## Confirmacao de telefone

Para manter a V1 gratuita e sem cadastro externo, o app usa uma confirmacao simples do telefone digitado. O usuario confere o numero antes de ir para o pagamento, e esse telefone fica salvo no Supabase para consultar a situacao da inscricao depois.

Essa etapa nao envia SMS nem WhatsApp. Quando o projeto precisar de validacao real por telefone em producao, o caminho recomendado e contratar SMS/WhatsApp por provedor externo.

## Deploy gratuito

O projeto esta pronto para publicar como Web Service no Render usando o arquivo `render.yaml`.

Passos:

1. Crie uma conta em `https://render.com`.
2. Suba este projeto para um repositorio no GitHub.
3. No Render, escolha `New` -> `Blueprint`.
4. Conecte o repositorio.
5. Configure a variavel `ADMIN_PASSWORD` com uma senha segura.
6. Publique o servico.

O Render vai entregar um dominio gratuito no formato:

```text
https://nome-do-servico.onrender.com
```

Observacao importante: em plano gratuito, o Render pode desligar o app quando ficar sem acessos e o sistema de arquivos local e temporario. Para uma versao realmente persistente com banco, use Supabase Free. Os comprovantes ainda ficam no filesystem do servidor em `data/proofs`; para persistencia completa, o proximo passo e migrar comprovantes para Supabase Storage.
