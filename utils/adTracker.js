// Sistema simples de tracking de downloads por IP
// Em produção, considere usar Redis ou banco de dados

const downloadCounts = new Map();
const DOWNLOADS_BEFORE_AD = 20;

/**
 * Incrementa o contador de downloads para um IP
 * @param {string} ip - Endereço IP do usuário
 * @returns {Object} { count, requiresAd }
 */
function incrementDownload(ip) {
  const currentCount = downloadCounts.get(ip) || 0;
  const newCount = currentCount + 1;
  downloadCounts.set(ip, newCount);

  const requiresAd = newCount % DOWNLOADS_BEFORE_AD === 0;

  return {
    count: newCount,
    requiresAd,
    downloadsUntilAd: requiresAd ? 0 : DOWNLOADS_BEFORE_AD - (newCount % DOWNLOADS_BEFORE_AD)
  };
}

/**
 * Reseta o contador após o usuário assistir o anúncio
 * @param {string} ip - Endereço IP do usuário
 */
function resetAdCounter(ip) {
  const currentCount = downloadCounts.get(ip) || 0;
  // Não reseta para 0, apenas para o próximo ciclo
  downloadCounts.set(ip, currentCount);
  return {
    success: true,
    message: 'Contador resetado. Continue baixando!'
  };
}

/**
 * Obtém o status atual do contador
 * @param {string} ip - Endereço IP do usuário
 * @returns {Object} { count, downloadsUntilAd }
 */
function getDownloadStatus(ip) {
  const count = downloadCounts.get(ip) || 0;
  const downloadsUntilAd = DOWNLOADS_BEFORE_AD - (count % DOWNLOADS_BEFORE_AD);

  return {
    count,
    downloadsUntilAd: downloadsUntilAd === DOWNLOADS_BEFORE_AD ? DOWNLOADS_BEFORE_AD : downloadsUntilAd
  };
}

// Limpar contadores antigos a cada 24 horas (opcional)
setInterval(() => {
  const now = Date.now();
  // Em produção, adicione timestamp e limpe apenas IPs antigos
  console.log(`Total de IPs rastreados: ${downloadCounts.size}`);
}, 24 * 60 * 60 * 1000);

module.exports = {
  incrementDownload,
  resetAdCounter,
  getDownloadStatus
};
