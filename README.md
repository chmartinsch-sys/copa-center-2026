# Copa Center 2026

PWA para acompanhar a Copa do Mundo 2026 com foco em consulta rápida: jogos, resultados, Brasil, chaveamento, artilheiros e projeções separadas dos resultados oficiais.

## Estrutura

- `index.html`: estrutura do app
- `style.css`: visual mobile-first
- `app.js`: lógica de renderização, filtros, busca e painéis
- `data/copa2026.json`: base de dados consumida pelo app
- `scripts/update-data.mjs`: atualizador automático via API-Football/API-SPORTS
- `.github/workflows/update-copa-data.yml`: automação diária às 7h de Brasília
- `manifest.json` e `service-worker.js`: suporte PWA

## Atualização automática

O workflow roda diariamente às 7h de Brasília, que corresponde a 10h UTC no GitHub Actions.

A API usada é API-Football/API-SPORTS.

O repositório precisa ter este secret configurado:

```txt
API_FOOTBALL_KEY
```

Opcionalmente, estes valores podem ser alterados no workflow:

```txt
API_FOOTBALL_LEAGUE=1
API_FOOTBALL_SEASON=2026
```

## Desenvolvimento local

```bash
npm run check
npm run update:data
```

Para testar o app localmente, use um servidor estático simples, por exemplo:

```bash
python -m http.server 8080
```

Depois acesse:

```txt
http://localhost:8080
```

## Observação

Resultados oficiais, projeções e palpites aparecem separados no app para evitar confusão entre dado confirmado e análise.