const express = require('express');
const router = express.Router();
const { getVideoInfo, downloadMP3, isPlaylist, getPlaylistInfo } = require('../utils/youtube');
const { resetAdCounter, getDownloadStatus } = require('../utils/adTracker');

// GET /api/youtube/info?url=<youtube-url>
router.get('/info', async (req, res, next) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        error: true,
        message: 'URL parameter is required'
      });
    }

    // Verificar se é playlist
    if (isPlaylist(url)) {
      const playlistInfo = await getPlaylistInfo(url);
      return res.json({
        success: true,
        data: playlistInfo
      });
    }

    // Se for vídeo único
    const info = await getVideoInfo(url);
    res.json({
      success: true,
      data: {
        isPlaylist: false,
        ...info
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/youtube/download?url=<youtube-url>&quality=<high|medium|low>
router.get('/download', async (req, res, next) => {
  try {
    const { url, quality } = req.query;

    if (!url) {
      return res.status(400).json({
        error: true,
        message: 'URL parameter is required'
      });
    }

    // Obter IP do usuário
    const userIp = req.ip || req.connection.remoteAddress;

    await downloadMP3(url, res, quality, userIp);
  } catch (error) {
    next(error);
  }
});

// POST /api/youtube/ad-watched - Confirma que o usuário assistiu o anúncio
router.post('/ad-watched', (req, res) => {
  try {
    const userIp = req.ip || req.connection.remoteAddress;
    const result = resetAdCounter(userIp);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

// GET /api/youtube/ad-status - Verifica status do contador de anúncios
router.get('/ad-status', (req, res) => {
  try {
    const userIp = req.ip || req.connection.remoteAddress;
    const status = getDownloadStatus(userIp);
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

module.exports = router;
