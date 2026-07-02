# Prescritores — Painel Comercial

Sistema web local para acompanhamento de prescritores (nutricionistas, médicos, hospitais), cruzamento de visitas com vendas, análise de representantes e geração de cronograma.

## Pré-requisitos

- **Node.js 18+** — https://nodejs.org
- **npm** (vem com Node)

## Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/SEU_USUARIO/prescritores.git
cd prescritores

# 2. Instale as dependências
npm install

# 3. Rode o servidor de desenvolvimento
npm run dev
```

Acesse **http://localhost:3000** no navegador.

O banco de dados SQLite é criado automaticamente em `data/data.db` na primeira execução.

## Importação de dados

Padrão de nomes aceitos:

| Tipo | Exemplo |
|------|---------|
| Vendas | `Prescrições_out_2025.xlsx` |
| Visitas | `relatorio_visitas__1_.xlsx` |

Fluxo: `/importacao` → arraste os `.xlsx` → confirme → revise matches.

## Backup

Botão **Backup** em `/importacao`, ou `GET /api/backup` (JSON com todas as tabelas).

## Deploy no Railway

1. Novo projeto → conecte este repositório
2. Railway detecta Next.js automaticamente
3. **Importante:** para persistência, monte um volume no diretório `/app/data`

## Scripts

```bash
npm run dev    # desenvolvimento
npm run build  # build produção
npm run start  # rodar build localmente
```
