#!/data/data/com.termux/files/usr/bin/bash

# 🚀 Script de Setup Automático para Termux
# Configura todo o ambiente necessário para rodar o BaixaSom no Android

echo "================================================"
echo "📱 BaixaSom - Setup Automático para Termux"
echo "================================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar se comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Função para printar com cor
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# 1. Atualizar pacotes do Termux
echo "📦 Atualizando pacotes do Termux..."
pkg update -y && pkg upgrade -y
if [ $? -eq 0 ]; then
    print_status "Pacotes atualizados"
else
    print_error "Erro ao atualizar pacotes"
    exit 1
fi
echo ""

# 2. Instalar Node.js
if command_exists node; then
    print_status "Node.js já instalado: $(node --version)"
else
    echo "📥 Instalando Node.js LTS..."
    pkg install nodejs-lts -y
    if [ $? -eq 0 ]; then
        print_status "Node.js instalado: $(node --version)"
    else
        print_error "Erro ao instalar Node.js"
        exit 1
    fi
fi
echo ""

# 3. Instalar Yarn
if command_exists yarn; then
    print_status "Yarn já instalado: $(yarn --version)"
else
    echo "📥 Instalando Yarn..."
    npm install -g yarn
    if [ $? -eq 0 ]; then
        print_status "Yarn instalado: $(yarn --version)"
    else
        print_error "Erro ao instalar Yarn"
        exit 1
    fi
fi
echo ""

# 4. Instalar FFmpeg
if command_exists ffmpeg; then
    print_status "FFmpeg já instalado"
else
    echo "📥 Instalando FFmpeg..."
    pkg install ffmpeg -y
    if [ $? -eq 0 ]; then
        print_status "FFmpeg instalado"
    else
        print_error "Erro ao instalar FFmpeg"
        exit 1
    fi
fi
echo ""

# 5. Instalar Git (caso queira clonar/atualizar)
if command_exists git; then
    print_status "Git já instalado: $(git --version)"
else
    echo "📥 Instalando Git..."
    pkg install git -y
    if [ $? -eq 0 ]; then
        print_status "Git instalado"
    else
        print_info "Git não instalado (opcional)"
    fi
fi
echo ""

# 6. Configurar variável de ambiente
echo "🔧 Configurando variáveis de ambiente..."

# Adicionar ao .bashrc se não existir
if ! grep -q "YOUTUBE_DL_SKIP_PYTHON_CHECK" ~/.bashrc 2>/dev/null; then
    echo 'export YOUTUBE_DL_SKIP_PYTHON_CHECK=1' >> ~/.bashrc
    print_status "Variável YOUTUBE_DL_SKIP_PYTHON_CHECK adicionada ao .bashrc"
else
    print_status "Variável YOUTUBE_DL_SKIP_PYTHON_CHECK já configurada"
fi

# Exportar para sessão atual
export YOUTUBE_DL_SKIP_PYTHON_CHECK=1
print_status "Variável exportada para sessão atual"
echo ""

# 7. Verificar se estamos no diretório do projeto
if [ ! -f "package.json" ]; then
    print_error "package.json não encontrado!"
    print_info "Execute este script dentro da pasta do projeto baixasom-back"
    exit 1
fi

print_status "Projeto encontrado!"
echo ""

# 8. Instalar dependências do projeto
echo "📦 Instalando dependências do projeto..."
print_info "Isso pode demorar alguns minutos na primeira vez..."
yarn install

if [ $? -eq 0 ]; then
    print_status "Dependências instaladas com sucesso!"
else
    print_error "Erro ao instalar dependências"
    exit 1
fi
echo ""

# 9. Criar pasta temp/downloads se não existir
mkdir -p temp/downloads
print_status "Pasta temp/downloads criada"
echo ""

# 10. Mostrar informações do sistema
echo "================================================"
echo "📊 Informações do Sistema"
echo "================================================"
echo "Node.js: $(node --version)"
echo "NPM: $(npm --version)"
echo "Yarn: $(yarn --version)"
echo "FFmpeg: $(ffmpeg -version | head -n1)"
echo ""

# 11. Obter IP local
IP=$(ifconfig wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}')
if [ -z "$IP" ]; then
    IP=$(ip addr show wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
fi

echo "================================================"
echo "✅ Setup Concluído com Sucesso!"
echo "================================================"
echo ""
echo "🚀 Para iniciar o servidor, execute:"
echo "   node server.js"
echo ""
if [ ! -z "$IP" ]; then
    echo "🌐 Você poderá acessar em:"
    echo "   Local: http://localhost:3000"
    echo "   Rede:  http://$IP:3000"
    echo ""
fi

# 12. Perguntar se quer iniciar agora
echo -n "Deseja iniciar o servidor agora? (s/n): "
read -r response
if [[ "$response" =~ ^[Ss]$ ]]; then
    echo ""
    echo "================================================"
    echo "🚀 Iniciando servidor..."
    echo "================================================"
    echo ""
    print_info "Para parar o servidor, pressione Ctrl+C"
    echo ""
    sleep 2
    node server.js
else
    echo ""
    print_info "Quando quiser iniciar, execute: node server.js"
fi
