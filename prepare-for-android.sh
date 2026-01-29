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
echo "1. Copie a pasta 'android-assets' para seu projeto Android:"
echo "   app/src/main/assets/nodejs-project/"
echo ""
echo "2. O Node.js Mobile instalará as dependências automaticamente"
echo "   na primeira execução do app (pode demorar 30-60s)."
echo ""
echo "3. Veja ANDROID-INTEGRATION.md para instruções completas."

