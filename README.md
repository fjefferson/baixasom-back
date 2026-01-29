# 🎵 BaixaSom Backend

API para conversão de vídeos do YouTube em MP3 com qualidade ajustável e metadata ID3 completa.

## 📱 **Integração com Android (Node.js Embarcado)**

**Este backend roda DENTRO do app Android!** Veja: [ANDROID-INTEGRATION.md](./ANDROID-INTEGRATION.md)

### Preparar para Android:

**Windows:**
```bash
prepare-for-android.bat
```

**Linux/Mac:**
```bash
chmod +x prepare-for-android.sh
./prepare-for-android.sh
```

Depois copie a pasta `android-assets/` para `app/src/main/assets/nodejs-project/` no seu projeto Android.

---

## 🚀 Instalação

### Pré-requisitos

- Node.js 16+ instalado
- **FFmpeg instalado no sistema** ([Download aqui](https://ffmpeg.org/download.html))

### Instalar dependências

```bash
npm install
```

## 📖 Como usar

### Iniciar o servidor

```bash
npm start
```

### Modo desenvolvimento (com auto-reload)

```bash
npm run dev
```

O servidor estará rodando em `http://localhost:3000`

## 🔌 Endpoints

### 1. Obter informações do vídeo

**GET** `/api/youtube/info?url=<youtube-url>`

**Exemplo:**
```
GET http://localhost:3000/api/youtube/info?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "title": "Video Title",
    "author": "Channel Name",
    "duration": "185",
    "thumbnail": "https://...",
    "description": "...",
    "viewCount": "1000000",
    "uploadDate": "2023-01-01"
  }
}
```

### 2. Baixar MP3

**GET** `/api/youtube/download?url=<youtube-url>`

**Exemplo:**
```
GET http://localhost:3000/api/youtube/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

**Resposta:**
- Stream do arquivo MP3 para download direto

## 🛠️ Tecnologias

- Express.js - Framework web
- @distube/ytdl-core - Download de vídeos do YouTube
- fluent-ffmpeg - Conversão de áudio
- CORS - Permitir requisições cross-origin

## ⚠️ Notas Importantes

- Certifique-se de ter o FFmpeg instalado no sistema
- O download pode levar alguns segundos dependendo do tamanho do vídeo
- Respeite os direitos autorais ao usar esta aplicação
