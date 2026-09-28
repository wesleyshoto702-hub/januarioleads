# JanuarioLeads

oi

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cfc45a7b-7f48-4b0a-82fc-daf876974a6f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Busca de empresas em Lavras

A área **Buscar leads** usa o Google Places API (New) através de uma Server Function do TanStack Start. A chave não fica no frontend.

Configure no ambiente seguro do projeto/deploy:

```sh
GOOGLE_PLACES_API_KEY=sua_chave
```

A chave real não deve ser adicionada ao GitHub. Ative a **Places API (New)** no projeto correspondente do Google Maps Platform.
