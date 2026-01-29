# 📱 Node.js Embarcado no Android (Kotlin)

Guia completo para **rodar o backend Node.js DENTRO do app Android**.

## 🎯 Arquitetura

```
APK Android único
├── UI (Kotlin/Java)
├── Node.js Runtime (embarcado)
└── Backend (Express + youtube-dl)
```

✅ **Vantagens:**
- Sem servidor externo necessário
- Totalmente offline (após instalar)
- IP residencial do celular (não bloqueado pelo YouTube)
- Tudo em 1 APK

⚠️ **Desvantagens:**
- APK grande (~150-200MB)
- Consumo de bateria maior
- Requer binários ARM64 (FFmpeg, yt-dlp)

---

## 📦 1. Dependências (build.gradle)

### build.gradle (Project level)
```gradle
allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://jitpack.io' }
    }
}
```

### build.gradle (Module: app)
```gradle
dependencies {
    // Node.js Mobile para Android
    implementation 'com.github.node-android:nodejs-mobile:0.3.0'
    
    // Retrofit para comunicação HTTP com Node.js
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    implementation 'com.squareup.okhttp3:okhttp:4.11.0'
    implementation 'com.squareup.okhttp3:logging-interceptor:4.11.0'
    
    // Coroutines
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
    
    // ViewModel e LiveData
    implementation 'androidx.lifecycle:lifecycle-viewmodel-ktx:2.6.2'
    implementation 'androidx.lifecycle:lifecycle-livedata-ktx:2.6.2'
}
```

---

## 🗂️ 2. Estrutura do Projeto Android

```
app/
├── src/
│   ├── main/
│   │   ├── java/com/seupacote/baixasom/
│   │   │   ├── MainActivity.kt
│   │   │   ├── NodeJsService.kt
│   │   │   └── api/
│   │   │       ├── YouTubeApi.kt
│   │   │       └── RetrofitClient.kt
│   │   ├── assets/
│   │   │   └── nodejs-project/    ← BACKEND NODE.JS AQUI
│   │   │       ├── package.json
│   │   │       ├── server.js
│   │   │       ├── routes/
│   │   │       │   └── youtube.js
│   │   │       └── utils/
│   │   │           ├── youtube.js
│   │   │           └── adTracker.js
│   │   └── AndroidManifest.xml
```

---

## 📁 3. Copiar Backend para assets/nodejs-project/

**Importante:** Copie TODOS os arquivos do backend (exceto `node_modules/`) para `app/src/main/assets/nodejs-project/`:

```
nodejs-project/
├── package.json
├── server.js
├── routes/
│   └── youtube.js
└── utils/
    ├── youtube.js
    └── adTracker.js
```

⚠️ **NÃO copie `node_modules/`**. O Node.js Mobile instalará automaticamente no primeiro uso.

---

## 🔧 4. Configurar server.js para Android

## 🔧 4. Configurar server.js para Android

Modifique o `server.js` para enviar mensagens ao Android:

```javascript
const express = require('express');
const cors = require('cors');
const youtubeRoutes = require('./routes/youtube');

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'BaixaSom API is running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is healthy' });
});

// Routes
app.use('/api/youtube', youtubeRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Enviar erro para Android
  if (typeof rn_bridge !== 'undefined') {
    rn_bridge.channel.send(JSON.stringify({ 
      type: 'error', 
      message: err.message 
    }));
  }
  
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal server error'
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  
  // Notificar Android que servidor está pronto
  if (typeof rn_bridge !== 'undefined') {
    rn_bridge.channel.send(JSON.stringify({ 
      type: 'server_ready', 
      port: PORT 
    }));
  }
});

// Listener para mensagens do Android
if (typeof rn_bridge !== 'undefined') {
  rn_bridge.channel.on('message', (msg) => {
    console.log('Mensagem recebida do Android:', msg);
    
    if (msg === 'shutdown') {
      server.close();
      process.exit(0);
    }
  });
}
```

---

## 🤖 5. Código Kotlin - NodeJsService

Crie `NodeJsService.kt`:

```kotlin
package com.seupacote.baixasom

import android.content.Context
import android.util.Log
import com.janeasystems.cdvnodejsmobile.NodeJS
import kotlinx.coroutines.*

class NodeJsService(private val context: Context) {
    
    private var isServerReady = false
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    companion object {
        const val TAG = "NodeJsService"
        const val PORT = 3000
    }
    
    fun start(onReady: () -> Unit) {
        scope.launch {
            try {
                Log.d(TAG, "Iniciando Node.js...")
                
                // Iniciar Node.js em thread separada
                val nodejsThread = Thread {
                    try {
                        NodeJS.start(context, "server.js")
                    } catch (e: Exception) {
                        Log.e(TAG, "Erro ao iniciar Node.js: ${e.message}")
                    }
                }
                nodejsThread.start()
                
                // Aguardar servidor ficar pronto
                waitForServer()
                
                withContext(Dispatchers.Main) {
                    isServerReady = true
                    Log.d(TAG, "✅ Servidor Node.js pronto!")
                    onReady()
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Erro no NodeJsService: ${e.message}")
            }
        }
    }
    
    private suspend fun waitForServer() {
        repeat(30) { attempt ->
            try {
                val url = java.net.URL("http://localhost:$PORT/health")
                val connection = url.openConnection() as java.net.HttpURLConnection
                connection.requestMethod = "GET"
                connection.connectTimeout = 1000
                connection.readTimeout = 1000
                
                if (connection.responseCode == 200) {
                    Log.d(TAG, "Servidor respondeu na tentativa ${attempt + 1}")
                    return
                }
            } catch (e: Exception) {
                Log.d(TAG, "Tentativa ${attempt + 1}/30 - Aguardando servidor...")
                delay(1000)
            }
        }
        throw Exception("Servidor não iniciou em 30 segundos")
    }
    
    fun stop() {
        scope.cancel()
        // Enviar comando de shutdown para Node.js
        try {
            NodeJS.sendMessageToNode("shutdown")
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao parar Node.js: ${e.message}")
        }
    }
    
    fun isReady() = isServerReady
}
```

---

## 📱 6. Código Kotlin - MainActivity

```kotlin
package com.seupacote.baixasom

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    
    private lateinit var nodeService: NodeJsService
    private lateinit var apiClient: YouTubeApiClient
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // Iniciar Node.js
        nodeService = NodeJsService(this)
        nodeService.start {
            // Servidor pronto, inicializar API client
            apiClient = YouTubeApiClient()
            onServerReady()
        }
    }
    
    private fun onServerReady() {
        Toast.makeText(this, "✅ Servidor iniciado!", Toast.LENGTH_SHORT).show()
        
        // Testar API
        lifecycleScope.launch {
            testApi()
        }
    }
    
    private suspend fun testApi() {
        try {
            val info = apiClient.getVideoInfo("https://www.youtube.com/watch?v=Q0oIoR9mLwc")
            Log.d("MainActivity", "Título: ${info.data.title}")
            Log.d("MainActivity", "Artista: ${info.data.author}")
            
            runOnUiThread {
                Toast.makeText(this, "✅ API funcionando!", Toast.LENGTH_SHORT).show()
            }
            
        } catch (e: Exception) {
            Log.e("MainActivity", "Erro ao testar API: ${e.message}")
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        nodeService.stop()
    }
}
```

---

## 🌐 7. Retrofit Client para localhost

```kotlin
// RetrofitClient.kt
object RetrofitClient {
    private const val BASE_URL = "http://localhost:3000/"
    
    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }
    
    private val client = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .build()
    
    val api: YouTubeApiService by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(YouTubeApiService::class.java)
    }
}

// YouTubeApiClient.kt
class YouTubeApiClient {
    private val api = RetrofitClient.api
    
    suspend fun getVideoInfo(url: String): VideoInfoResponse {
        return api.getVideoInfo(url)
    }
    
    suspend fun downloadMP3(url: String, quality: String = "high"): ResponseBody {
        return api.downloadMP3(url, quality)
    }
}
```

---

## 📋 8. Models (Data Classes)

## 📋 8. Models (Data Classes)

```kotlin
// VideoInfo.kt
data class VideoInfoResponse(
    val success: Boolean,
    val data: VideoData
)

data class VideoData(
    val title: String,
    val author: String,
    val duration: Int,
    val thumbnail: String,
    val description: String
)

// YouTubeApiService.kt
interface YouTubeApiService {
    
    @GET("api/youtube/info")
    suspend fun getVideoInfo(
        @Query("url") videoUrl: String
    ): VideoInfoResponse
    
    @Streaming
    @GET("api/youtube/download")
    suspend fun downloadMP3(
        @Query("url") videoUrl: String,
        @Query("quality") quality: String = "high"
    ): ResponseBody
    
    @GET("health")
    suspend fun healthCheck(): JsonObject
}
```

---

## ⚙️ 9. Permissões (AndroidManifest.xml)

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <!-- Permissões Internet -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <!-- Permissões de Armazenamento -->
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
        android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
        android:maxSdkVersion="32" />
    
    <!-- Permissão para usar tráfego HTTP em localhost -->
    <application
        android:usesCleartextTraffic="true"
        ...>
        
        <activity android:name=".MainActivity">
            ...
        </activity>
    </application>
</manifest>
```

---

## 🚀 10. Build e Deploy

### Preparar assets do Node.js:

1. **No projeto Node.js (este repositório):**
```bash
# Criar pasta para copiar
mkdir -p android-assets
cp -r package.json server.js routes utils android-assets/
```

2. **No Android Studio:**
   - Copiar pasta `android-assets` para `app/src/main/assets/nodejs-project/`
   - Verificar que `node_modules/` NÃO foi copiado

3. **Build APK:**
```bash
./gradlew assembleDebug
# ou
./gradlew assembleRelease
```

### Tamanho esperado do APK:
- **Debug:** ~150-180MB
- **Release (com ProGuard):** ~120-150MB

---

## ⚡ 11. Otimizações

### Reduzir tamanho do APK:

```gradle
// build.gradle (app)
android {
    ...
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    
    // Gerar apenas ARM64 (maioria dos celulares modernos)
    splits {
        abi {
            enable true
            reset()
            include 'arm64-v8a'
            universalApk false
        }
    }
}
```

### Cache do npm (primeiro uso mais rápido):

Copie `package-lock.json` também para `assets/nodejs-project/` para cache de dependências.

---

## 🔍 12. Troubleshooting

### Problema: "Node.js não inicia"
**Solução:** Verificar logs do Logcat filtrado por "NodeJS"

### Problema: "Timeout ao conectar em localhost"
**Solução:** 
- Adicionar `android:usesCleartextTraffic="true"` no `AndroidManifest.xml`
- Aumentar timeout em `waitForServer()`

### Problema: "youtube-dl falha no Android"
**Solução:** 
- Usar `ytdl-core` em vez de `youtube-dl-exec`
- Ou incluir binário `yt-dlp` ARM64 em `assets/`

### Problema: "FFmpeg não encontrado"
**Solução:**
- Baixar FFmpeg ARM64: https://github.com/arthenica/ffmpeg-kit
- Colocar em `app/src/main/jniLibs/arm64-v8a/libffmpeg.so`

## 📊 13. Exemplo Completo - ViewModel

```kotlin
// YouTubeViewModel.kt
class YouTubeViewModel(application: Application) : AndroidViewModel(application) {
    
    private val apiClient = YouTubeApiClient()
    
    private val _videoInfo = MutableLiveData<VideoData>()
    val videoInfo: LiveData<VideoData> = _videoInfo
    
    private val _downloadProgress = MutableLiveData<Int>()
    val downloadProgress: LiveData<Int> = _downloadProgress
    
    private val _downloadComplete = MutableLiveData<File>()
    val downloadComplete: LiveData<File> = _downloadComplete
    
    private val _error = MutableLiveData<String>()
    val error: LiveData<String> = _error
    
    fun fetchVideoInfo(url: String) {
        viewModelScope.launch {
            try {
                val response = apiClient.getVideoInfo(url)
                _videoInfo.value = response.data
            } catch (e: Exception) {
                _error.value = e.message
            }
        }
    }
    
    fun downloadMusic(url: String, fileName: String) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val response = apiClient.downloadMP3(url, "high")
                val body = response.body() ?: throw Exception("Empty response")
                
                val outputFile = File(
                    getApplication<Application>().getExternalFilesDir(null),
                    "$fileName.mp3"
                )
                
                val totalBytes = body.contentLength()
                var downloadedBytes = 0L
                
                body.byteStream().use { input ->
                    outputFile.outputStream().use { output ->
                        val buffer = ByteArray(8192)
                        var bytesRead: Int
                        
                        while (input.read(buffer).also { bytesRead = it } != -1) {
                            output.write(buffer, 0, bytesRead)
                            downloadedBytes += bytesRead
                            
                            val progress = ((downloadedBytes * 100) / totalBytes).toInt()
                            _downloadProgress.postValue(progress)
                        }
                    }
                }
                
                _downloadComplete.postValue(outputFile)
                
            } catch (e: Exception) {
                _error.postValue("Erro no download: ${e.message}")
            }
        }
    }
}
```

---

## 🎯 14. Resumo - Checklist de Implementação

- [ ] Adicionar dependência `nodejs-mobile` no `build.gradle`
- [ ] Copiar backend para `app/src/main/assets/nodejs-project/`
- [ ] Modificar `server.js` para comunicação com Android
- [ ] Criar `NodeJsService.kt`
- [ ] Criar `RetrofitClient.kt` apontando para `localhost:3000`
- [ ] Criar Models (`VideoInfoResponse`, `VideoData`)
- [ ] Iniciar Node.js na `MainActivity`
- [ ] Adicionar permissões no `AndroidManifest.xml`
- [ ] Adicionar `usesCleartextTraffic="true"`
- [ ] Testar health check
- [ ] Testar busca de info
- [ ] Testar download

---

## 🚀 Vantagens desta Abordagem

✅ **Totalmente offline** - Não precisa de servidor externo  
✅ **IP residencial** - Celular não é bloqueado pelo YouTube  
✅ **Sem custos** - Não paga hosting  
✅ **Privacidade** - Downloads locais, nada enviado para servidor  
✅ **Sem limites** - Não depende de quota de servidor  

---

## ⚠️ Considerações Finais

1. **APK grande**: ~150-200MB (Node.js + dependencies)
2. **Primeiro uso lento**: Node.js instala `node_modules` na primeira execução (~30-60s)
3. **Consumo de bateria**: Node.js rodando consome mais bateria
4. **Compatibilidade**: Apenas ARM64 (99% dos celulares modernos)

---

Desenvolvido para **BaixaSom** 🎵

```kotlin
suspend fun downloadMP3(
    youtubeUrl: String,
    quality: String = "high",
    outputFile: File,
    onProgress: (Int) -> Unit
): Result<File> = withContext(Dispatchers.IO) {
    try {
        val response = RetrofitClient.api.downloadMP3(youtubeUrl, quality)
        val body = response.body() ?: throw Exception("Empty response body")
        
        val totalBytes = body.contentLength()
        var downloadedBytes = 0L
        
        body.byteStream().use { input ->
            outputFile.outputStream().use { output ->
                val buffer = ByteArray(8192)
                var bytesRead: Int
                
                while (input.read(buffer).also { bytesRead = it } != -1) {
                    output.write(buffer, 0, bytesRead)
                    downloadedBytes += bytesRead
                    
                    // Calcular progresso
                    val progress = ((downloadedBytes * 100) / totalBytes).toInt()
                    withContext(Dispatchers.Main) {
                        onProgress(progress)
                    }
                }
            }
        }
        
        Result.success(outputFile)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

// Uso na Activity/Fragment
lifecycleScope.launch {
    val url = "https://www.youtube.com/watch?v=Q0oIoR9mLwc"
    val outputFile = File(getExternalFilesDir(null), "music.mp3")
    
    downloadMP3(url, "high", outputFile) { progress ->
        progressBar.progress = progress
        textViewProgress.text = "$progress%"
    }.onSuccess { file ->
        Toast.makeText(this@MainActivity, "Download completo!", Toast.LENGTH_SHORT).show()
        // Reproduzir ou salvar na galeria
    }.onFailure { error ->
        Toast.makeText(this@MainActivity, "Erro: ${error.message}", Toast.LENGTH_SHORT).show()
    }
}
```

### 3. Exemplo completo com ViewModel

```kotlin
// YouTubeViewModel.kt
class YouTubeViewModel : ViewModel() {
    private val repository = YouTubeRepository()
    
    private val _videoInfo = MutableLiveData<VideoData>()
    val videoInfo: LiveData<VideoData> = _videoInfo
    
    private val _downloadProgress = MutableLiveData<Int>()
    val downloadProgress: LiveData<Int> = _downloadProgress
    
    private val _error = MutableLiveData<String>()
    val error: LiveData<String> = _error
    
    fun fetchVideoInfo(url: String) {
        viewModelScope.launch {
            repository.getVideoInfo(url)
                .onSuccess { _videoInfo.value = it }
                .onFailure { _error.value = it.message }
        }
    }
    
    fun downloadMusic(url: String, outputFile: File) {
        viewModelScope.launch {
            repository.downloadMP3(url, "high", outputFile) { progress ->
                _downloadProgress.value = progress
            }.onFailure { 
                _error.value = it.message 
            }
        }
    }
}

// MainActivity.kt
class MainActivity : AppCompatActivity() {
    private val viewModel: YouTubeViewModel by viewModels()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // Observar dados
        viewModel.videoInfo.observe(this) { video ->
            textViewTitle.text = video.title
            textViewArtist.text = video.author
        }
        
        viewModel.downloadProgress.observe(this) { progress ->
            progressBar.progress = progress
        }
        
        viewModel.error.observe(this) { errorMsg ->
            Toast.makeText(this, errorMsg, Toast.LENGTH_SHORT).show()
        }
        
        // Buscar info
        buttonSearch.setOnClickListener {
            val url = editTextUrl.text.toString()
            viewModel.fetchVideoInfo(url)
        }
        
        // Download
        buttonDownload.setOnClickListener {
            val url = editTextUrl.text.toString()
            val file = File(getExternalFilesDir(null), "music.mp3")
            viewModel.downloadMusic(url, file)
        }
    }
}
```

---

## 🎵 Salvar MP3 na Galeria do Android

```kotlin
fun saveToMusicLibrary(context: Context, sourceFile: File, title: String, artist: String) {
    val values = ContentValues().apply {
        put(MediaStore.Audio.Media.DISPLAY_NAME, "$title.mp3")
        put(MediaStore.Audio.Media.MIME_TYPE, "audio/mpeg")
        put(MediaStore.Audio.Media.TITLE, title)
        put(MediaStore.Audio.Media.ARTIST, artist)
        put(MediaStore.Audio.Media.ALBUM, "YouTube")
        put(MediaStore.Audio.Media.IS_MUSIC, true)
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC)
            put(MediaStore.Audio.Media.IS_PENDING, 1)
        }
    }
    
    val contentResolver = context.contentResolver
    val uri = contentResolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, values)
    
    uri?.let {
        contentResolver.openOutputStream(it)?.use { output ->
            sourceFile.inputStream().use { input ->
                input.copyTo(output)
            }
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.clear()
            values.put(MediaStore.Audio.Media.IS_PENDING, 0)
            contentResolver.update(it, values, null, null)
        }
        
        Toast.makeText(context, "Música salva na galeria!", Toast.LENGTH_SHORT).show()
    }
}
```

---

## 📋 Permissões Necessárias (AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Para salvar na galeria (Android 12 e inferior) -->
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />

<!-- Opcional: Para notificações de download -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### Solicitar permissões em Runtime (Android 6+):

```kotlin
private fun requestStoragePermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        // Android 13+ não precisa de permissão para escrever na galeria
        return
    }
    
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
        != PackageManager.PERMISSION_GRANTED) {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE),
            REQUEST_STORAGE_PERMISSION
        )
    }
}
```

---

## 🛠️ Tratamento de Erros

```kotlin
sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val message: String, val code: Int? = null) : ApiResult<Nothing>()
    object Loading : ApiResult<Nothing>()
}

suspend fun getVideoInfoSafe(url: String): ApiResult<VideoData> {
    return try {
        val response = RetrofitClient.api.getVideoInfo(url)
        if (response.success) {
            ApiResult.Success(response.data)
        } else {
            ApiResult.Error("Falha ao buscar informações")
        }
    } catch (e: IOException) {
        ApiResult.Error("Sem conexão com a internet")
    } catch (e: HttpException) {
        ApiResult.Error("Erro do servidor: ${e.code()}", e.code())
    } catch (e: Exception) {
        ApiResult.Error("Erro desconhecido: ${e.message}")
    }
}
```

---

## 📊 Endpoints Disponíveis

### 1. Health Check
```
GET /health
```
Verifica se servidor está online.

### 2. Info do Vídeo
```
GET /api/youtube/info?url={YOUTUBE_URL}
```
Retorna: título, autor, duração, thumbnail, descrição

### 3. Download MP3
```
GET /api/youtube/download?url={YOUTUBE_URL}&quality={high|medium|low}
```
Retorna: arquivo MP3 com metadata ID3 (título, artista, capa, etc.)

**Qualidades:**
- `high` - ~256kbps (recomendado)
- `medium` - ~128kbps (padrão)
- `low` - ~64kbps (economiza dados)

---

## 🎯 Dicas Importantes

1. **Timeout:** Use timeouts longos (60-120s) para downloads grandes
2. **Cache:** Implemente cache de thumbnails com Glide/Coil
3. **Background:** Use WorkManager para downloads em background
4. **Notificações:** Mostre progresso em notificação durante download
5. **Metadata:** Os MP3 já vêm com ID3 tags (título, artista, capa)
6. **Erros:** YouTube pode bloquear se fizer muitas requisições rápidas

---

## 🚨 Importante

⚠️ A URL do Cloudflare Quick Tunnel **muda ao reiniciar**. Para produção:
- Configure Named Tunnel com domínio próprio
- Ou use variável de configuração no app para facilitar updates

```kotlin
// Constants.kt
object ApiConstants {
    // Trocar essa URL quando tunnel reiniciar
    const val BASE_URL = "https://forecasts-toner-decide-previous.trycloudflare.com/"
}
```

---

## 📞 Suporte

Problemas? Verifique:
1. Servidor Node.js está rodando (`npm start`)
2. Cloudflare Tunnel está ativo (`cloudflared tunnel --url http://localhost:3000`)
3. URL no app está atualizada
4. Internet do celular está funcionando

---

Desenvolvido para **BaixaSom** 🎵
