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

    // Limitar duração a 10 minutos (600 segundos)
    const MAX_DURATION = 600;
    if (info.duration > MAX_DURATION) {
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
 * Faz download do vídeo e converte para MP3
 * @param {string} url - URL do vídeo do YouTube
 * @param {Object} res - Express response object
 * @param {string} quality - Qualidade do áudio: 'high', 'medium', 'low' (opcional, padrão: 'high')
 * @param {string} userIp - IP do usuário para tracking de anúncios
 */
async function downloadMP3(url, res, quality = 'medium', userIp) {
  try {
    // Mapear qualidade para valor do yt-dlp (0 = melhor, 9 = pior)
    const qualityMap = {
      'high': 0,      // ~256kbps
      'medium': 5,    // ~128kbps
      'low': 9        // ~64kbps
    };

    // Validar e definir qualidade
    const audioQuality = qualityMap[quality] !== undefined ? qualityMap[quality] : qualityMap['medium'];
    
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
    const info = await youtubedl(url, {
      ...downloadOptions,
      dumpSingleJson: true,
      ffmpegLocation: ffmpegPath === 'ffmpeg' ? '/data/data/com.termux/files/usr/bin' : path.dirname(ffmpegPath)
    });

    // Limitar duração a 10 minutos (600 segundos)
    const MAX_DURATION = 600;
    if (info.duration > MAX_DURATION) {
      throw new Error(`Vídeo muito longo! Duração máxima permitida: 10 minutos. Duração do vídeo: ${Math.floor(info.duration / 60)} minutos.`);
    }

    const title = info.title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
    const finalPath = path.join(downloadsDir, `${timestamp}_${title}.mp3`);

    // Configurar headers para download + informações de anúncio
    res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Requires-Ad', adStatus.requiresAd.toString());
    res.setHeader('X-Downloads-Count', adStatus.count.toString());
    res.setHeader('X-Downloads-Until-Ad', adStatus.downloadsUntilAd.toString());

    // Download e conversão para MP3 SEM metadados (para evitar problemas com caracteres especiais)
    await youtubedl(url, {
      ...downloadOptions,
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: audioQuality,
      output: finalPath,
      ffmpegLocation: ffmpegPath === 'ffmpeg' ? '/data/data/com.termux/files/usr/bin' : path.dirname(ffmpegPath)
    });

    console.log('Download completed:', title);

    // Adicionar TODOS os metadados usando node-id3 (mais confiável que ffmpeg)
    try {
      console.log('Adding ID3 tags...');
      
      // Fazer download da thumbnail
      let imageBuffer = null;
      if (info.thumbnail) {
        try {
          imageBuffer = await downloadImage(info.thumbnail);
          console.log('Thumbnail downloaded successfully');
        } catch (imageErr) {
          console.error('Failed to download thumbnail:', imageErr.message);
        }
      }

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
    } catch (tagError) {
      console.error('Error adding ID3 tags:', tagError.message);
    }

    // Enviar arquivo para o cliente
    res.sendFile(finalPath, (err) => {
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

module.exports = {
  getVideoInfo,
  downloadMP3
};
