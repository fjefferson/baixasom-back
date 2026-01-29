@echo off
REM Script para preparar backend Node.js para Android (Windows)

echo 📦 Preparando backend para Android...

REM Criar pasta de destino
if exist android-assets rmdir /s /q android-assets
mkdir android-assets

REM Copiar arquivos necessários
echo 📋 Copiando arquivos...
copy package.json android-assets\
copy server-android.js android-assets\server.js
xcopy /E /I routes android-assets\routes
xcopy /E /I utils android-assets\utils

REM Remover node_modules se existir
if exist android-assets\node_modules rmdir /s /q android-assets\node_modules

echo.
echo ✅ Pronto!
echo.
echo 📁 Arquivos em: android-assets\
echo.
echo Arquivos copiados:
echo   - package.json
echo   - server.js (versão Android otimizada)
echo   - routes/
echo   - utils/
echo.
echo Próximos passos:
echo 1. Copie a pasta 'android-assets' para seu projeto Android:
echo    app\src\main\assets\nodejs-project\
echo.
echo 2. O Node.js Mobile instalará as dependências automaticamente
echo    na primeira execução do app (pode demorar 30-60s).
echo.
echo 3. Veja ANDROID-INTEGRATION.md para instruções completas.
pause

