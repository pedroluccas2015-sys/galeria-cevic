# Miniaturas e upload — atualização de 30/10/2026

- Fotos: prévias geradas do original com orientação EXIF normalizada (inclusive espelhamento), sem alterar o arquivo armazenado. URLs das prévias versionadas para evitar imagens antigas em cache.
- Vídeos novos: primeiro frame extraído localmente e salvo como imagem JPEG no Drive; referência thumbnailUrl armazenada junto ao registro do vídeo. Se a extração ou o envio da prévia falhar, o vídeo original ainda é publicado e a interface tenta mostrar seu primeiro frame.
- Vídeos existentes: primeiro frame decodificado quando a miniatura entra na área visível, sem exigir reenvio. O navegador precisa suportar o formato do vídeo. Essa prévia é local; não há migração em lote dos registros antigos.
- Upload: até três arquivos simultâneos; blocos retomáveis de 32 MiB com confirmação de bytes pelo Drive; progresso ponderado pelo tamanho dos arquivos. Os originais não são comprimidos.

## Validação

25 testes automatizados passaram, incluindo oito orientações EXIF, limite de concorrência e tratamento de falhas. Build de produção e lint concluídos (lint com avisos preexistentes). Não houve validação com OAuth real nem medição da velocidade em produção. O teste de decodificação em navegador não pôde ser executado porque o ambiente não tem Chromium instalado.

## Publicação

Substitua os arquivos na raiz do repositório pelo conteúdo desta pasta, incluindo package.json, package-lock.json, api, server e src. A dependência sharp deve ser instalada no build da Vercel. As credenciais e as configurações existentes continuam necessárias.

A publicação automática desta atualização não foi realizada: a integração GitHub recusou gravação com HTTP 403. Após o deploy, verificar /api/storage, um álbum com fotos verticais e vídeos, e um upload múltiplo real. A velocidade final depende da conexão, do tamanho dos arquivos e do Drive.
