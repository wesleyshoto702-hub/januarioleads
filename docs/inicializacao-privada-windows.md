# Inicialização privada do laboratório Windows

O teste no Windows do proprietário mostrou que a CLI 2.122.1 publicou
`0.0.0.0:54322` e `[::]:54322`, mesmo com a opção de loopback na rede bridge.
Um container vazio publicado explicitamente com `-p 127.0.0.1:54329:5432`
respeitou a restrição. Portanto, não basta confiar nas opções da rede.

O auxiliar `scripts/iniciar-laboratorio-privado.mjs` inicia a mesma CLI,
mas passa sua conexão Docker por um named pipe temporário local. O auxiliar
reescreve `HostConfig.PortBindings[*].HostIp` para `127.0.0.1` antes de
criar os containers. Não disponibiliza uma API Docker por TCP. O pipe tem
nome aleatório, existe só durante o comando e encaminha chamadas para
`dockerDesktopLinuxEngine`. Não executar código não confiável durante o teste;
assim como a CLI, o auxiliar tem autoridade para administrar o Docker local.

O diretório deve ser um laboratório inicializado, separado do código e dos
backups, sem `supabase/.temp/project-ref`. O auxiliar não executa login,
link, migrations remotas, exportação ou restauração. Ele requer a rede
bridge **interna** `januario-restore-local`, criada anteriormente, e
recusa containers remanescentes do projeto: pare-os primeiro pela CLI.

## Executar

Pré-requisitos: Windows, Node 24, Docker Desktop Linux em execução e
armazenamento do laboratório e Docker criptografados. Use os arquivos
da revisão aprovada; não altere o verificador de restauração para
aceitar portas públicas.

Na pasta da cópia local do repositório:

```powershell
node .\scripts\iniciar-laboratorio-privado.mjs "$env:USERPROFILE\JanuarioRestoreLab"
```

O processo pode levar vários minutos. A saída da CLI vai para
`inicializacao-privada.log` **dentro do laboratório privado**. Esse arquivo
pode conter credenciais locais: não anexar a chat, GitHub ou artefatos de CI.

O auxiliar só retorna PASS após a CLI concluir e o Docker confirmar:

- banco publicado em `127.0.0.1:54322`;
- todas as demais portas publicadas exclusivamente em `127.0.0.1`;
- containers somente na rede interna esperada.

Em caso de falha, tenta parar a stack e não retorna PASS. Confira localmente
o log e o estado dos containers antes de tentar novamente. Não retirar
`Internal`, não aceitar `0.0.0.0` nem carregar dados para contornar erro.

Após PASS, confira independentemente:

```powershell
docker ps --filter "label=com.supabase.cli.project=JanuarioRestoreLab" --format "{{.Names}} | {{.Ports}}"
```

Depois use o roteiro de restauração já existente. Iniciar novamente pelo
`supabase start` original pode recriar portas públicas; use este auxiliar
para novas inicializações privadas. Encerrar com `supabase stop` continua
válido e não apaga os arquivos SQL do backup.

## Evidências e limites

Testes offline cobrem transformação de portas, rejeição de configurações
inseguras, pós-checagem, tráfego HTTP por socket local e conexão bidirecional
de exec/attach. A CI executa os mesmos testes em Linux e Windows, com Docker
**simulado** e dados fictícios. Não equivalem à execução do Supabase real
no Windows do proprietário, que permanece necessária.

Nenhum PASS deste auxiliar comprova backup recuperável, login de clientes,
restauração SQL, integridade de dados ou autorização para a PR #36.
