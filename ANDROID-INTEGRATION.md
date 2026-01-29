# 📱 Integração Android (Kotlin)

Guia completo para integrar a API BaixaSom no seu app Android.

---

## 🚀 URLs da API

### Desenvolvimento Local (Teste):
```
http://localhost:3000
```

### Produção (Cloudflare Tunnel):
```
https://forecasts-toner-decide-previous.trycloudflare.com
```
⚠️ **Nota:** URL do Cloudflare Quick Tunnel muda ao reiniciar. Para URL permanente, configure um Named Tunnel.

---

## 📦 Dependências Necessárias (build.gradle)

```gradle
dependencies {
    // Retrofit para requisições HTTP
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    implementation 'com.squareup.okhttp3:okhttp:4.11.0'
    implementation 'com.squareup.okhttp3:logging-interceptor:4.11.0'
    
    // Coroutines para async
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
    
    // ViewModel e LiveData
    implementation 'androidx.lifecycle:lifecycle-viewmodel-ktx:2.6.2'
    implementation 'androidx.lifecycle:lifecycle-livedata-ktx:2.6.2'
}
```

---

## 🔧 Configuração Retrofit

### 1. Criar modelos de dados (Data Classes)

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

// ErrorResponse.kt
data class ErrorResponse(
    val error: Boolean,
    val message: String
)
```

### 2. Criar interface da API

```kotlin
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

### 3. Criar Retrofit Instance

```kotlin
// RetrofitClient.kt
object RetrofitClient {
    private const val BASE_URL = "https://forecasts-toner-decide-previous.trycloudflare.com/"
    
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
```

---

## 💻 Exemplos de Uso

### 1. Buscar informações do vídeo

```kotlin
// ViewModel ou Repository
class YouTubeRepository {
    private val api = RetrofitClient.api
    
    suspend fun getVideoInfo(youtubeUrl: String): Result<VideoData> {
        return try {
            val response = api.getVideoInfo(youtubeUrl)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Failed to fetch video info"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

// Activity/Fragment
lifecycleScope.launch {
    val url = "https://www.youtube.com/watch?v=Q0oIoR9mLwc"
    val result = repository.getVideoInfo(url)
    
    result.onSuccess { videoData ->
        textViewTitle.text = videoData.title
        textViewArtist.text = videoData.author
        Glide.with(this@MainActivity)
            .load(videoData.thumbnail)
            .into(imageViewThumbnail)
    }
    
    result.onFailure { error ->
        Toast.makeText(this@MainActivity, error.message, Toast.LENGTH_SHORT).show()
    }
}
```

### 2. Download de MP3 com Progress

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
