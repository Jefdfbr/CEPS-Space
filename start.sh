#!/bin/bash

echo "🚀 Iniciando CEPS Space - Plataforma de Jogos Educativos..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando. Por favor, inicie o Docker primeiro."
    exit 1
fi

# Build and start containers
echo "📦 Building containers..."
cd /var/www/ceps-space
docker compose up -d --build

# Wait for services to be ready
echo "⏳ Aguardando serviços iniciarem..."
sleep 15

# Check if services are running
if docker ps | grep -q "ceps-space-db"; then
    echo "✅ Banco de dados está rodando"
else
    echo "❌ Banco de dados falhou ao iniciar"
fi

if docker ps | grep -q "ceps-space-backend"; then
    echo "✅ Backend está rodando na porta 8081"
else
    echo "❌ Backend falhou ao iniciar"
fi

if docker ps | grep -q "ceps-space-frontend"; then
    echo "✅ Frontend está rodando na porta 3030"
else
    echo "❌ Frontend falhou ao iniciar"
fi

echo ""
echo "✨ Aplicação iniciada com sucesso!"
echo "🌐 Acesse: http://localhost:3030"
echo "🔌 API Backend: http://localhost:8081"
echo "📊 Ver logs: docker-compose logs -f"
echo "🛑 Parar: docker-compose down"
