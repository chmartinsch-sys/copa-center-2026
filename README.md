# Copa Center 2026

PWA mobile-first para acompanhar a fase final da Copa do Mundo 2026: jogos, resultados, chaveamento, campanha do Brasil e artilharia.

## Decisão de operação

O app usa atualização manual e validada. Não depende de API esportiva, banco de dados ou backend.

A base principal é:

```txt
data/copa2026.json
```

Quando houver uma atualização, devem ser revisados no mesmo arquivo:

- data e hora em `meta.lastUpdated`;
- jogos, placares e situação;
- autores e minutos dos gols;
- artilheiros e total de gols;
- chaveamento;
- resumo da campanha do Brasil;
- campeão, vice e terceiro lugar quando definidos.

## Estrutura

- `index.html`: estrutura das telas;
- `style.css`: identidade e responsividade;
- `app.js`: renderização, filtros, busca e artilharia;
- `data/copa2026.json`: dados editáveis do torneio;
- `manifest.json`: instalação como PWA;
- `service-worker.js`: cache do app, preservando atualização online do JSON.

## Validação local

```bash
npm run check
python -m http.server 8080
```

Depois acesse:

```txt
http://localhost:8080
```

## Regra editorial

Resultados, autores dos gols, artilharia e chaveamento só devem ser publicados após validação. Projeções não devem ser apresentadas como resultados oficiais.