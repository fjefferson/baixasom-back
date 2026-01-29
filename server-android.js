// server-android.js
// Versão do server.js otimizada para rodar no Android via nodejs-mobile

// Configurar ambiente Android
process.env.PLATFORM = 'android';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

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
  res.json({ status: 'ok', message: 'BaixaSom API is running on Android' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is healthy' });
});

// Routes
app.use('/api/youtube', youtubeRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Enviar erro para Android via nodejs-mobile bridge
  if (typeof rn_bridge !== 'undefined') {
    try {
      rn_bridge.channel.send(JSON.stringify({ 
        type: 'error', 
        message: err.message,
        stack: err.stack
      }));
    } catch (bridgeError) {
      console.error('Erro ao enviar para Android:', bridgeError);
    }
  }
  
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal server error'
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 Running on Android via nodejs-mobile`);
  
  // Notificar Android que servidor está pronto
  if (typeof rn_bridge !== 'undefined') {
    try {
      rn_bridge.channel.send(JSON.stringify({ 
        type: 'server_ready', 
        port: PORT,
        timestamp: new Date().toISOString()
      }));
    } catch (bridgeError) {
      console.error('Erro ao notificar Android:', bridgeError);
    }
  }
});

// Listener para mensagens do Android
if (typeof rn_bridge !== 'undefined') {
  rn_bridge.channel.on('message', (msg) => {
    console.log('📨 Mensagem recebida do Android:', msg);
    
    try {
      const message = typeof msg === 'string' ? JSON.parse(msg) : msg;
      
      switch (message.type) {
        case 'shutdown':
          console.log('🛑 Encerrando servidor...');
          server.close(() => {
            process.exit(0);
          });
          break;
          
        case 'ping':
          rn_bridge.channel.send(JSON.stringify({ 
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;
          
        default:
          console.log('Tipo de mensagem desconhecido:', message.type);
      }
    } catch (e) {
      console.error('Erro ao processar mensagem:', e);
    }
  });
  
  console.log('✅ Bridge Node.js <-> Android configurado');
} else {
  console.log('⚠️  Rodando fora do Android (modo desenvolvimento)');
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recebido, encerrando...');
  server.close(() => {
    console.log('Servidor encerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT recebido, encerrando...');
  server.close(() => {
    console.log('Servidor encerrado');
    process.exit(0);
  });
});
