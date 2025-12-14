#!/bin/bash

echo "🚀 Iniciando Plataforma de Jogos Educativos..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando. Por favor, inicie o Docker primeiro."
    exit 1
fi

# Build and start containers
echo "📦 Building containers..."
cd /var/www/ClubeVip
docker-compose up -d --build

# Wait for services to be ready
echo "⏳ Aguardando serviços iniciarem..."
sleep 10

# Check if services are running
if docker ps | grep -q "jogos-educativos-backend"; then
    echo "✅ Backend está rodando na porta 8080"
else
    echo "❌ Backend falhou ao iniciar"
fi

if docker ps | grep -q "jogos-educativos-frontend"; then
    echo "✅ Frontend está rodando na porta 3030"
else
    echo "❌ Frontend falhou ao iniciar"
fi

# Reload Nginx
echo "🔄 Recarregando Nginx..."
sudo systemctl reload nginx

echo ""
echo "✨ Aplicação iniciada com sucesso!"
echo "🌐 Acesse: https://clubevip.space"
echo "📊 Ver logs: docker-compose logs -f"
echo "🛑 Parar: docker-compose down"
