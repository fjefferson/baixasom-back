const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');
const { incrementDownload } = require('./adTracker');
const NodeID3 = require('node-id3');
const https = require('https');
const http = require('http');

// Detectar FFmpeg: usar do sistema no Android/Termux, senão usar @ffmpeg-installer
let ffmpegPath;
try {
  // Tentar usar @ffmpeg-installer (Windows, Mac, Linux normal)
  ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
  console.log('✅ Usando FFmpeg do @ffmpeg-installer');
} catch (error) {
  // No Android/Termux, usar FFmpeg do sistema
  ffmpegPath = 'ffmpeg';
  console.log('✅ Usando FFmpeg do sistema (Android/Termux)');
}

// Criar pastas temp e downloads se não existirem
const tempDir = path.join(__dirname, '..', 'temp');
const downloadsDir = path.join(tempDir, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

/**
 * Normaliza o nome do arquivo removendo acentos e caracteres especiais
 * @param {string} filename - Nome do arquivo a ser normalizado
 * @returns {string} Nome normalizado
 */
function normalizeFilename(filename) {
  return filename
    .normalize('NFD')                           // Decompõe caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '')           // Remove acentos
    .replace(/[^\w\s-]/g, '')                  // Remove caracteres especiais (mantém letras, números, espaços e hífens)
    .replace(/\s+/g, '_')                      // Substitui espaços por underscores
    .replace(/_+/g, '_')                       // Remove underscores duplicados
    .replace(/^_|_$/g, '')                     // Remove underscores no início e fim
    .substring(0, 200);                        // Limita tamanho (evita nomes muito longos)
}

/**
 * Faz download de uma imagem e retorna o buffer
 * @param {string} url - URL da imagem
 * @returns {Promise<Buffer>} Buffer da imagem
 */
async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Obtém informações do vídeo do YouTube
 * @param {string} url - URL do vídeo do YouTube
 * @returns {Promise<Object>} Informações do vídeo
 */
async function getVideoInfo(url) {
  try {
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      preferFreeFormats: true,
      referer: 'https://www.youtube.com/',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      addHeader: [
        'Accept-Language:en-US,en;q=0.9',
        'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Sec-Fetch-Mode:navigate'
      ],
      extractorArgs: 'youtube:player_client=android,web;po_token=web+MNjq3DRWCZcxLxRQEeEaZcUQpnJKa9kczdtG4tLlpRrUK5tAA==',
      ffmpegLocation: ffmpegPath === 'ffmpeg' ? '/data/data/com.termux/files/usr/bin' : path.dirname(ffmpegPath)
    });

    // Limitar duração apenas em produção
    const isDev = process.env.NODE_ENV !== 'production';
    const MAX_DURATION = 600; // 10 minutos
    
    if (!isDev && info.duration > MAX_DURATION) {
      throw new Error(`Vídeo muito longo! Duração máxima permitida: 10 minutos. Duração do vídeo: ${Math.floor(info.duration / 60)} minutos.`);
    }

    return {
      title: info.title,
      author: info.uploader || info.channel,
      duration: info.duration,
      thumbnail: info.thumbnail,
      description: info.description,
      viewCount: info.view_count,
      uploadDate: info.upload_date
    };
  } catch (error) {
    console.error('Error getting video info:', error.message);
    throw new Error('Não foi possível obter informações do vídeo. Verifique se o vídeo está disponível.');
  }
}

/**
 * Faz download do vídeo e converte para áudio
 * @param {string} url - URL do vídeo do YouTube
 * @param {Object} res - Express response object
 * @param {string} quality - Qualidade do áudio: 'high', 'medium', 'low' (opcional, padrão: 'low')
 * @param {string} userIp - IP do usuário para tracking de anúncios
 * @param {boolean} addMetadata - Se true, adiciona metadados ID3 (título, artista, capa). Padrão: false
 * @param {string} format - Formato do áudio: 'mp3', 'm4a' ou 'mp4' (opcional, padrão: 'mp3')
 */
async function downloadMP3(url, res, quality = 'low', userIp, addMetadata = false, format = 'mp3') {
  try {
    const timerStart = Date.now();
    console.log('⏱️  [TIMER] Iniciando download...');
    
    // Mapear qualidade para valor do yt-dlp (0 = melhor, 9 = pior)
    const qualityMap = {
      'high': 0,      // ~256kbps
      'medium': 5,    // ~128kbps
      'low': 9        // ~64kbps
    };

    // Validar e definir qualidade
    const audioQuality = qualityMap[quality] !== undefined ? qualityMap[quality] : qualityMap['medium'];
    
    // Validar formato (mp3, m4a ou mp4)
    const audioFormat = ['mp3', 'm4a', 'mp4'].includes(format) ? format : 'mp3';
    const contentType = audioFormat === 'mp3' ? 'audio/mpeg' : 'audio/mp4';
    
    // Incrementar contador de downloads
    const adStatus = incrementDownload(userIp);
    
    const timestamp = Date.now();
    
    // Opções avançadas para evitar bloqueio 403
    const downloadOptions = {
      noWarnings: true,
      preferFreeFormats: true,
      referer: 'https://www.youtube.com/',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      addHeader: [
        'Accept-Language:en-US,en;q=0.9',
        'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Sec-Fetch-Mode:navigate'
      ],
      // Usar player client mais compatível
      extractorArgs: 'youtube:player_client=android,web;po_token=web+MNjq3DRWCZcxLxRQEeEaZcUQpnJKa9kczdtG4tLlpRrUK5tAA=='
    };

    // Obter informações primeiro para pegar o título
    const timerInfo = Date.now();
    const info = await youtubedl(url, {
      ...downloadOptions,
      dumpSingleJson: true,
      ffmpegLocation: ffmpegPath === 'ffmpeg' ? '/data/data/com.termux/files/usr/bin' : path.dirname(ffmpegPath)
    });
    console.log(`⏱️  [TIMER] Buscar info: ${((Date.now() - timerInfo) / 1000).toFixed(2)}s`);

    // Limitar duração apenas em produção
    const isDev = process.env.NODE_ENV !== 'production';
    const MAX_DURATION = 600; // 10 minutos
    
    if (!isDev && info.duration > MAX_DURATION) {
      throw new Error(`Vídeo muito longo! Duração máxima permitida: 10 minutos. Duração do vídeo: ${Math.floor(info.duration / 60)} minutos.`);
    }

    const title = normalizeFilename(info.title);
    const finalPath = path.join(downloadsDir, `${timestamp}_${title}.${audioFormat}`);

    // Configurar headers para download + informações de anúncio
    res.setHeader('Content-Disposition', `attachment; filename="${title}.${audioFormat}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Requires-Ad', adStatus.requiresAd.toString());
    res.setHeader('X-Downloads-Count', adStatus.count.toString());
    res.setHeader('X-Downloads-Until-Ad', adStatus.downloadsUntilAd.toString());

    // Download e conversão para o formato escolhido
    const timerDownload = Date.now();
    await youtubedl(url, {
      ...downloadOptions,
      extractAudio: true,
      audioFormat: audioFormat,
      audioQuality: audioQuality,
      format: 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio', // Prioriza áudio direto (mais rápido)
      output: finalPath,
      ffmpegLocation: ffmpegPath === 'ffmpeg' ? '/data/data/com.termux/files/usr/bin' : path.dirname(ffmpegPath)
    });
    console.log(`⏱️  [TIMER] Download + conversão: ${((Date.now() - timerDownload) / 1000).toFixed(2)}s`);

    console.log('Download completed:', title);

    // Sempre fazer download da thumbnail (independente de metadata)
    const timerThumb = Date.now();
    let imageBuffer = null;
    if (info.thumbnail) {
      try {
        imageBuffer = await downloadImage(info.thumbnail);
        console.log(`⏱️  [TIMER] Download thumbnail: ${((Date.now() - timerThumb) / 1000).toFixed(2)}s`);
      } catch (imageErr) {
        console.error('Failed to download thumbnail:', imageErr.message);
      }
    }

    // Adicionar metadados apenas se solicitado (economiza tempo)
    if (addMetadata) {
      const timerMetadata = Date.now();
      try {
        console.log('Adding ID3 tags...');

      // Preparar tags ID3
      const tags = {
        title: info.title,
        artist: info.uploader || info.channel || 'Unknown Artist',
        album: 'YouTube',
        year: info.upload_date ? info.upload_date.substring(0, 4) : new Date().getFullYear().toString(),
        genre: 'Music',
        comment: {
          language: 'eng',
          text: info.description ? info.description.substring(0, 500) : ''
        }
      };

      // Adicionar imagem se disponível
      if (imageBuffer) {
        tags.image = {
          mime: 'image/jpeg',
          type: {
            id: 3,
            name: 'front cover'
          },
          description: 'Cover',
          imageBuffer: imageBuffer
        };
      }

      // Escrever tags no arquivo MP3
      const success = NodeID3.write(tags, finalPath);
      if (success) {
        console.log('ID3 tags written successfully');
      } else {
        console.warn('Failed to write ID3 tags');
      }
      console.log(`⏱️  [TIMER] Adicionar metadados: ${((Date.now() - timerMetadata) / 1000).toFixed(2)}s`);
      } catch (tagError) {
        console.error('Error adding ID3 tags:', tagError.message);
      }
    } else {
      console.log('⚡ Skipping metadata (faster download)');
    }

    // Enviar arquivo para o cliente
    const timerSend = Date.now();
    res.sendFile(finalPath, (err) => {
      console.log(`⏱️  [TIMER] Enviar arquivo: ${((Date.now() - timerSend) / 1000).toFixed(2)}s`);
      console.log(`⏱️  [TIMER] TOTAL: ${((Date.now() - timerStart) / 1000).toFixed(2)}s`);
      
      if (err) {
        console.error('Error sending file:', err.message);
      }
      
      // Deletar arquivo após envio
      // IMPORTANTE: No Android, SEMPRE deletar para economizar espaço do celular
      const shouldDelete = process.env.NODE_ENV === 'production' || 
                          process.env.PLATFORM === 'android';
      
      // Padrão: deletar (pode desabilitar só no desenvolvimento PC)
      if (shouldDelete !== false) {
        // Deletar após 5 segundos (tempo para completar stream)
        setTimeout(() => {
          fs.unlink(finalPath, (unlinkErr) => {
            if (unlinkErr) {
              console.error('Error deleting file:', unlinkErr.message);
            } else {
              console.log('✅ Arquivo temporário deletado:', finalPath);
            }
          });
        }, 5000);
      } else {
        console.log('⚠️  Development mode: File kept at', finalPath);
      }
    });

  } catch (error) {
    console.error('Error downloading video:', error.message);
    if (!res.headersSent) {
      res.status(500).json({
        error: true,
        message: 'Não foi possível fazer o download do vídeo. Verifique se o vídeo está disponível.'
      });
    }
  }
}

/**
 * Verifica se a URL é uma playlist
 * @param {string} url - URL a ser verificada
 * @returns {boolean} True se for playlist
 */
function isPlaylist(url) {
  return url.includes('list=') || url.includes('/playlist');
}

/**
 * Obtém informações de uma playlist do YouTube
 * @param {string} url - URL da playlist
 * @returns {Promise<Object>} Informações da playlist com lista de vídeos
 */
async function getPlaylistInfo(url) {
  try {
    // Verificar se realmente é uma playlist
    if (!isPlaylist(url)) {
      throw new Error('URL fornecida não é uma playlist');
    }

    console.log('Fetching playlist info...');
    
    const playlistData = await youtubedl(url, {
      dumpSingleJson: true,
      flatPlaylist: true,
      noWarnings: true,
      preferFreeFormats: true,
      referer: 'https://www.youtube.com/',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      addHeader: [
        'Accept-Language:en-US,en;q=0.9',
        'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Sec-Fetch-Mode:navigate'
      ],
      extractorArgs: 'youtube:player_client=android,web',
      ffmpegLocation: ffmpegPath === 'ffmpeg' ? '/data/data/com.termux/files/usr/bin' : path.dirname(ffmpegPath)
    });

    // Extrair lista de vídeos
    const videos = (playlistData.entries || []).map(video => ({
      id: video.id,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      title: video.title,
      duration: video.duration,
      thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.id}/default.jpg`,
      uploader: video.uploader || video.channel
    }));

    return {
      isPlaylist: true,
      title: playlistData.title || 'Playlist',
      uploader: playlistData.uploader || playlistData.channel,
      videoCount: videos.length,
      videos: videos
    };
  } catch (error) {
    console.error('Error getting playlist info:', error.message);
    throw new Error('Não foi possível obter informações da playlist. Verifique se a playlist está disponível e é pública.');
  }
}

module.exports = {
  getVideoInfo,
  downloadMP3,
  isPlaylist,
  getPlaylistInfo
};
