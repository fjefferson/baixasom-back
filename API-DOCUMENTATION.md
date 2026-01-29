# YouMP3 API - Documentação

API para conversão de vídeos do YouTube em MP3.

## 🌐 Base URL

```
http://localhost:3000
```

Para produção, substitua pela URL do seu servidor.

---

## 📋 Endpoints

### 1. Health Check

Verifica se o servidor está online.

**Endpoint:** `GET /health`

**Resposta:**
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

---

### 2. Obter Informações do Vídeo

Retorna metadados do vídeo do YouTube.

**Endpoint:** `GET /api/youtube/info`

**Parâmetros (Query String):**
| Parâmetro | Tipo   | Obrigatório | Descrição                    |
|-----------|--------|-------------|------------------------------|
| url       | string | Sim         | URL completa do vídeo do YouTube |

**Exemplo de Requisição:**
```
GET /api/youtube/info?url=https://www.youtube.com/watch?v=wO0A0XcWy88
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "title": "Peter Schilling - Major Tom (Coming Home) (Official Video)",
    "author": "Peter Schilling",
    "duration": 246,
    "thumbnail": "https://i.ytimg.com/vi_webp/wO0A0XcWy88/maxresdefault.webp",
    "description": "Enjoy Peter Schillings video...",
    "viewCount": 9876543,
    "uploadDate": "20230101"
  }
}
```

**Resposta de Erro (400/500):**
```json
{
  "error": true,
  "message": "URL parameter is required"
}
```

---

### 3. Baixar MP3

Faz download do vídeo e converte para MP3.

**Endpoint:** `GET /api/youtube/download`

**Parâmetros (Query String):**
| Parâmetro | Tipo   | Obrigatório | Descrição                    |
|-----------|--------|-------------|------------------------------|
| url       | string | Sim         | URL completa do vídeo do YouTube |
| quality   | string | Não         | Qualidade do áudio: `high`, `medium`, `low` (padrão: `high`) |

**Qualidades Disponíveis:**
- **`high`** - ~256kbps (melhor qualidade)
- **`medium`** - ~128kbps (qualidade padrão MP3)
- **`low`** - ~64kbps (economiza largura de banda)

**Exemplo de Requisição:**
```
GET /api/youtube/download?url=https://www.youtube.com/watch?v=wO0A0XcWy88
GET /api/youtube/download?url=https://www.youtube.com/watch?v=wO0A0XcWy88&quality=high
GET /api/youtube/download?url=https://www.youtube.com/watch?v=wO0A0XcWy88&quality=medium
GET /api/youtube/download?url=https://www.youtube.com/watch?v=wO0A0XcWy88&quality=low
```

**Resposta de Sucesso (200):**
- **Content-Type:** `audio/mpeg`
- **Content-Disposition:** `attachment; filename="nome_do_video.mp3"`
- **Body:** Stream binário do arquivo MP3

**Resposta de Erro (400/500):**
```json
{
  "error": true,
  "message": "Não foi possível fazer o download do vídeo. Verifique se o vídeo está disponível."
}
```

---

## 💻 Exemplos de Implementação

### JavaScript (Fetch API)

```javascript
// Obter informações do vídeo
async function getVideoInfo(youtubeUrl) {
  const response = await fetch(
    `http://localhost:3000/api/youtube/info?url=${encodeURIComponent(youtubeUrl)}`
  );
  const data = await response.json();
  return data;
}

// Baixar MP3
async function downloadMP3(youtubeUrl) {
  const response = await fetch(
    `http://localhost:3000/api/youtube/download?url=${encodeURIComponent(youtubeUrl)}`
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  // Criar blob e fazer download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'audio.mp3';
  a.click();
  window.URL.revokeObjectURL(url);
}

// Baixar com qualidade específica
async function downloadMP3WithQuality(youtubeUrl, quality = 'high') {
  const response = await fetch(
    `http://localhost:3000/api/youtube/download?url=${encodeURIComponent(youtubeUrl)}&quality=${quality}`
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'audio.mp3';
  a.click();
  window.URL.revokeObjectURL(url);
}
```

### React Example

```jsx
import { useState } from 'react';

function YouTubeConverter() {
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGetInfo = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3000/api/youtube/info?url=${encodeURIComponent(url)}`
      );
      const data = await response.json();
      if (data.success) {
        setInfo(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3000/api/youtube/download?url=${encodeURIComponent(url)}`
      );
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${info?.title || 'audio'}.mp3`;
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Cole a URL do YouTube"
      />
      <button onClick={handleGetInfo} disabled={loading}>
        Buscar Info
      </button>
      {info && (
        <div>
          <h3>{info.title}</h3>
          <p>Autor: {info.author}</p>
          <p>Duração: {info.duration}s</p>
          <img src={info.thumbnail} alt={info.title} />
          <button onClick={handleDownload} disabled={loading}>
            Baixar MP3
          </button>
        </div>
      )}
    </div>
  );
}
```

### Axios Example

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

// Obter informações
async function getVideoInfo(youtubeUrl) {
  const response = await axios.get(`${API_BASE_URL}/api/youtube/info`, {
    params: { url: youtubeUrl }
  });
  return response.data;
}

// Baixar MP3
async function downloadMP3(youtubeUrl, quality = 'high') {
  const response = await axios.get(`${API_BASE_URL}/api/youtube/download`, {
    params: { 
      url: youtubeUrl,
      quality: quality
    },
    responseType: 'blob'
  });
  
  // Criar link de download
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'audio.mp3');
  document.body.appendChild(link);
  link.click();
  link.remove();
}
```

---

## ⚠️ Tratamento de Erros

Todos os erros retornam um objeto JSON com a seguinte estrutura:

```json
{
  "error": true,
  "message": "Descrição do erro"
}
```

**Códigos de Status HTTP:**
- `200` - Sucesso
- `400` - Requisição inválida (URL faltando ou inválida)
- `500` - Erro no servidor (vídeo indisponível, erro de processamento, etc)

---

## 🔒 CORS

O servidor está configurado para aceitar requisições de qualquer origem. Para produção, considere restringir para apenas o domínio do seu app.

---

## ⏱️ Tempo de Processamento

- **Info:** ~1-3 segundos
- **Download:** ~10-60 segundos (depende do tamanho do vídeo)

**Importante:** O download pode demorar alguns segundos. Implemente um indicador de loading no frontend.

---

## 📝 Notas

1. A URL deve ser comple
5. Duração em segundos
6. **Limite de duração:** Máximo 10 minutos por vídeo
7. **Qualidade padrão:** Se não especificar, usa `high` (~256kbps)RLs padrão do YouTube
3. Os arquivos são automaticamente deletados do servidor após o download
4. Formato de saída: MP3 (qualidade padrão)
5. Duração em segundos

---

## 🚀 URL de Produção

Quando fizer deploy, atualize a base URL para:
```
https://seu-dominio.com
```

Não esqueça de configurar HTTPS em produção!
