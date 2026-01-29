#!/bin/bash

# Script para preparar backend Node.js para Android
# Este script copia apenas os arquivos necessários (sem node_modules)

echo "📦 Preparando backend para Android..."

# Criar pasta de destino
rm -rf android-assets
mkdir -p android-assets

# Copiar arquivos necessários
echo "📋 Copiando arquivos..."
cp package.json android-assets/
cp server-android.js android-assets/server.js
cp -r routes android-assets/
cp -r utils android-assets/

# Remover node_modules se existir
rm -rf android-assets/node_modules

echo "✅ Pronto!"
echo ""
echo "📁 Arquivos em: android-assets/"
echo ""
echo "Arquivos copiados:"
echo "  - package.json"
echo "  - server.js (versão Android otimizada)"
echo "  - routes/"
echo "  - utils/"
echo ""
echo "Próximos passos:"
echo "1. Copie a pasta 'android-assets' para o Termux:"
echo "   No celular, execute:"
echo "   cd /data/data/com.termux/files/home"
echo "   (copie os arquivos aqui)"
echo ""
echo "2. No Termux, instale as dependências:"
echo "   export YOUTUBE_DL_SKIP_PYTHON_CHECK=1"
echo "   yarn install"
echo ""
echo "3. Execute o servidor:"
echo "   node server.js"
echo ""
echo "4. Veja ANDROID-INTEGRATION.md para instruções completas."

