# H5P Local — Pacote para XAMPP

Este pacote foi preparado para você rodar conteúdos H5P localmente usando o **XAMPP (Apache)**.

## Estrutura sugerida (copie para o XAMPP)
Coloque a pasta `h5p-local` dentro de `C:\xampp\htdocs\` (Windows). Ficará assim:

```
C:\xampp\htdocs\h5p-local\
├─ index.html                 (usa CDN; mais rápido para testar)
├─ index_offline.html         (usa arquivos locais; exige baixar dist/)
├─ conteudos\
│  └─ meu-quiz\
│      ├─ h5p.json
│      ├─ content\
│      └─ libraries\
└─ assets\
   └─ h5p-player\            (coloque aqui os arquivos da pasta dist/ para uso offline)
      └─ (README.md explicando)
```

## Como usar (CDN)
1. Inicie o **Apache** no XAMPP Control Panel.
2. Acesse `http://localhost/h5p-local/` (o `index.html` será usado).
3. Extraia seu arquivo `.h5p`:
   - Renomeie `seu-conteudo.h5p` para `seu-conteudo.zip` e extraia.
   - Copie a pasta extraída para `conteudos/meu-quiz/` **(substitua a que está aqui)**.
   - A pasta final precisa conter **`h5p.json`**, **`content/`** e **`libraries/`**.
4. Recarregue a página. Se tudo estiver certo, o H5P roda imediatamente.

> Dica: prefira fixar a versão do `h5p-standalone` no HTML (por exemplo, `@3.8.0`) para evitar mudanças inesperadas.

## Como usar (Offline)
1. Instale o pacote `h5p-standalone` via `npm` ou `yarn` **em qualquer pasta** da sua máquina:
   ```bash
   npm i h5p-standalone
   # ou
   yarn add h5p-standalone
   ```
2. Copie **os arquivos da pasta `node_modules/h5p-standalone/dist/`** para `assets/h5p-player/` deste projeto, mantendo as subpastas (`styles/`, etc.).
3. Abra `http://localhost/h5p-local/index_offline.html`.
4. Garanta que `conteudos/meu-quiz/` contenha `h5p.json`, `content/` e `libraries/` do seu conteúdo H5P.

## Solução de problemas
- **Validar estrutura do conteúdo**: execute `powershell.exe -ExecutionPolicy Bypass -File scripts/validate-h5p.ps1` (ou `pwsh -File scripts/validate-h5p.ps1`, se tiver o PowerShell 7) para checar se cada pasta em `conteudos/` possui `h5p.json`, `content/content.json` e todas as bibliotecas declaradas. O script lista qualquer dependência ausente que causaria erros 404 como `H5P.Timer-0.4/library.json`.
- **Tela em branco/404 em libraries**: confirme que `conteudos/meu-quiz/` tem as **bibliotecas** dentro de `libraries/`. Alguns `.h5p` exportados não trazem todas as libs; reexporte usando uma ferramenta como o **Lumi Education** ou a plataforma onde o conteúdo foi criado, marcando para incluir libs.
- **Abrir o HTML direto com `file://`** não funciona – é necessário acessar via `http://localhost/`.
- **CORS** em ambientes restritos: use a versão offline (`index_offline.html`) com todos os arquivos locais.
- **Vários conteúdos**: crie subpastas em `conteudos/` e aponte `h5pJsonPath` para a pasta correspondente no HTML.

---

Feito com carinho para facilitar seus testes locais com H5P. :)
