# 📱 Executando BaixaSom no Termux

Guia rápido para rodar o servidor Node.js diretamente no celular usando Termux.

## ⚡ Setup Rápido (Automático)

### 1️⃣ Instalar Termux
- Baixe do [F-Droid](https://f-droid.org/packages/com.termux/) (recomendado)
- **Não use a versão da Play Store** (está desatualizada)

### 2️⃣ Obter o Projeto

**Opção A - Clonar do Git:**
```bash
cd ~
pkg install git -y
git clone https://github.com/fjefferson/baixasom-back.git
cd baixasom-back
```

**Opção B - Copiar arquivos:**
1. Copie a pasta do projeto para: `/data/data/com.termux/files/home/baixasom-back`
2. No Termux: `cd ~/baixasom-back`

### 3️⃣ Executar Script de Setup (TUDO AUTOMÁTICO!)

```bash
chmod +x setup.sh
./setup.sh
```

🎉 **Pronto!** O script vai:
- ✅ Atualizar pacotes do Termux
- ✅ Instalar Node.js, Yarn, FFmpeg e Git
- ✅ Configurar variável `YOUTUBE_DL_SKIP_PYTHON_CHECK=1`
- ✅ Instalar dependências do projeto
- ✅ Perguntar se quer iniciar o servidor

---

## 🛠️ Setup Manual (se preferir)

### 2️⃣ Instalar Dependências Manualmente

```bash
# Atualizar pacotes
pkg update && pkg upgrade

# Instalar tudo de uma vez
pkg install nodejs-lts git ffmpeg -y

# Instalar Yarn
npm install -g yarn
```

### 3️⃣ Configurar Variável de Ambiente

```bash
export YOUTUBE_DL_SKIP_PYTHON_CHECK=1
echo 'export YOUTUBE_DL_SKIP_PYTHON_CHECK=1' >> ~/.bashrc
source ~/.bashrc
```

### 4️⃣ Instalar Dependências do Projeto

```bash
cd ~/baixasom-back
yarn install
```

### 5️⃣ Executar o Servidor

```bash
node server.js
```

Você deve ver:
```
🚀 Servidor rodando em http://localhost:3000
✅ IP do celular: 192.168.x.x
📱 Acesse de outro dispositivo: http://192.168.x.x:3000
```

## 🌐 Acessando o Servidor

### Do próprio celular:
- Abra o navegador e acesse: `http://localhost:3000`

### De outro dispositivo (mesmo Wi-Fi):
1. Anote o IP mostrado no console (ex: `192.168.1.100`)
2. No outro dispositivo, acesse: `http://192.168.1.100:3000`

## 🔧 Comandos Úteis

```bash
# Ver IP do celular
ifconfig wlan0

# Parar o servidor
Ctrl + C

# Rodar em background (não recomendado)
node server.js &

# Ver processos rodando
ps aux | grep node

# Matar processo Node.js
pkill node
```

## ❓ Troubleshooting

### Erro: "youtube-dl-exec needs Python"
```bash
export YOUTUBE_DL_SKIP_PYTHON_CHECK=1
yarn install
```

### Erro: "EADDRINUSE" (porta já em uso)
```bash
# Matar processo na porta 3000
pkill node
# ou
lsof -ti:3000 | xargs kill
```

### Erro: "Cannot find module"
```bash
# Limpar e reinstalar
rm -rf node_modules
yarn install
```

### Servidor muito lento
- Normal na primeira execução
- Downloads grandes podem demorar
- Verifique espaço em disco: `df -h`

### Sem espaço no celular
```bash
# Limpar cache do Termux
apt clean

# Limpar downloads antigos
rm -rf ~/baixasom-back/temp/downloads/*
```

## 📊 Performance

### Tempo médio de conversão:
- Música 3-4 min: ~10-30 segundos
- Depende do modelo do celular
- Downloads usam a internet do celular

### Consumo de recursos:
- RAM: ~200-300MB
- CPU: Moderado durante conversão
- Bateria: ~5-10%/hora de uso ativo

## 🔐 Segurança

- ⚠️ O servidor fica acessível na rede local
- 🔒 Não exponha para internet sem proteção
- 🚫 Não use para distribuição em massa

## 💡 Dicas

1. **Mantenha o Termux aberto** - Se fechar, o servidor para
2. **Use Wake Lock** - Evita que o celular durma
3. **Carregador conectado** - Para sessões longas
4. **Wi-Fi estável** - Downloads são mais rápidos
5. **Espaço livre** - Mantenha pelo menos 1GB livre

## 🚀 Próximos Passos

- Para app Android nativo: Veja [ANDROID-INTEGRATION.md](ANDROID-INTEGRATION.md)
- Para produção: Use servidor dedicado
- Para desenvolvimento: Use nodemon

## 📝 Notas

- Este é um setup de **desenvolvimento/teste**
- Para uso em produção, considere servidor dedicado
- Termux não é ideal para servidores 24/7
- Para app final, veja implementação nativa no Android

## 🆘 Suporte

Se encontrar problemas:
1. Verifique se seguiu todos os passos
2. Confirme que a variável `YOUTUBE_DL_SKIP_PYTHON_CHECK=1` está definida
3. Tente reinstalar as dependências
4. Verifique os logs de erro no Termux
