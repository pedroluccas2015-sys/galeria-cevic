# Migração da Galeria CEVIC para Google Drive

Estado: código preparado e validado localmente; NÃO publicado nem conectado ao Drive em produção. A variável GOOGLE_DRIVE_FOLDER_ID foi salva no ambiente Production pela interface da Vercel. O console Google Cloud ficou inacessível no navegador remoto durante a configuração OAuth.

## Comportamento

- Novos álbuns usam as coleções Firestore `events-drive` e `media-drive`, dentro do mesmo caminho `artifacts/galeria-cevic-app/public/data`. As coleções antigas permanecem intactas.
- Arquivos são enviados diretamente ao Drive em partes de 8 MiB, até 512 MiB por arquivo. A Vercel apenas inicia e confirma o envio.
- Fotos e vídeos são exibidos por `/api/media`, com suporte a Range para vídeos. A pasta fica privada no Drive; o app publica somente arquivos marcados `cevicGallery=true` dentro da pasta configurada.
- A senha é validada no servidor. A sessão usa cookie HttpOnly, Secure e SameSite=Strict, com duração de oito horas.
- Falhas não são anunciadas como sucesso. Arquivos com falha continuam selecionados para nova tentativa.
- Excluir um item da interface remove seu registro do álbum; o arquivo original continua no Drive, como os arquivos originais permaneciam no Cloudinary. Para revogar também o acesso pelo proxy, remova o arquivo da pasta da galeria ou envie-o para a lixeira no Drive.

## Configuração necessária antes de publicar

1. Conferir acesso à equipe Vercel `pedro-4911`, projeto `galeria-cevic` (`prj_11jsGhzUHhmmykY4t6xPMZKaFOFG`). A conexão atual devolveu 403 ao configurar o projeto. A gravação no GitHub também devolveu 403.
2. Criar/usar um cliente OAuth próprio da galeria e ativar a Drive API no projeto Google Cloud. A conexão do Drive no ChatGPT não fornece uma credencial para a aplicação publicada.
3. Preferir o escopo `https://www.googleapis.com/auth/drive.file`. O administrador deve conceder ao cliente da galeria acesso à pasta escolhida usando Google Picker, ou criar a pasta com o próprio cliente OAuth. Uma pasta criada por outro aplicativo não fica automaticamente acessível com esse escopo.
4. Obter autorização offline do proprietário com o cliente da galeria e armazenar o refresh token exclusivamente na Vercel. Não colocar credenciais no chat, no repositório, nem em variáveis `VITE_*`.
5. Configurar as variáveis de `.env.example`. A pasta criada nesta sessão tem ID `1YCRroxrjvcyXFRDm6tyrtqI3TpS5UHKn`; confirmar que o cliente OAuth recebeu acesso a ela antes de usar esse ID.
6. Configurar uma senha administrativa e um segredo aleatório de sessão com no mínimo 32 caracteres diretamente na Vercel. Usar valores distintos entre produção e testes. `GALLERY_ORIGIN` deve ser a origem exata do ambiente testado.
7. Conferir as regras do Firestore para as duas novas coleções. O projeto existente usa autenticação anônima para o catálogo. Este patch não altera as regras do banco; a proteção de escrita dos registros deve ser revisada antes de expor novos fluxos de administração.
8. Fazer deployment de teste, verificar `/api/storage` com `ready: true`, entrar na área administrativa, criar um álbum e testar envio, recarregamento e reprodução. Só então publicar no domínio de produção.

## Verificação local executada

`npm test`, `npm run build`, `npm run lint`, `git diff --check`.

Os testes usam respostas simuladas do Drive. Não substituem o teste real com OAuth, regras do Firestore, CORS do upload e hospedagem configurados.

## Custos e limites

Não foi contratado nenhum plano nem ativado faturamento. O espaço do Drive e as cotas de acesso da API/Vercel são limites distintos. Antes da publicação, manter os controles de uso compatíveis com o requisito de não gerar cobranças.

## Caminho com Vercel Connect

O cliente OAuth foi criado pelo proprietário no Google Cloud, com retorno `https://connect.vercel.com/callback`. O formulário Vercel avançou até Customize; o conector ainda depende da criação/aceitação dos termos pelo proprietário.

Após a criação, configurar `DRIVE_CONNECTOR_UID` com o UID real e `DRIVE_SUBJECT_ID` com a identidade estável do proprietário. Vincular o conector ao projeto e ao ambiente antes de publicar. Nesse modo não é necessário colocar refresh token nem segredo do cliente nas variáveis da aplicação. O SDK usa o OIDC da Vercel.

A área de mídia inclui Autorizar Google Drive e solicita somente `drive.file`. Caso a pasta criada pelo ChatGPT não seja visível ao cliente OAuth, a aplicação reutiliza/cria sua própria pasta privada marcada `cevicRoot=galeria-cevic`, chamada Galeria CEVIC — Uploads do aplicativo. Isso evita solicitar acesso irrestrito aos outros arquivos da conta.

A oferta Connect exibida no painel inclui 500 solicitações de credenciais a cada 30 dias e pausa ao atingir o limite. Não ativar upgrades pagos. Monitorar essa cota separadamente do espaço do Drive e do tráfego da Vercel.
