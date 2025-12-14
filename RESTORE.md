# 🔄 Guia de Restauração Completa - CEPS Space

## 📦 Após Formatar a VPS

### 1. Instalar Dependências Básicas

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo apt install docker-compose -y

# Instalar Git
sudo apt install git -y

# Instalar Nginx
sudo apt install nginx -y
```

### 2. Clonar o Repositório

```bash
cd /var/www
git clone https://github.com/Jefdfbr/CEPS-Space.git ClubeVip
cd ClubeVip
```

### 3. Restaurar Arquivos de Configuração

Os arquivos de ambiente já estão incluídos no repositório (`.env.production` e `.env.backend`).

### 4. Configurar Banco de Dados PostgreSQL

O banco de dados precisa estar rodando em um container separado ou na rede `infra_default`.

**Se precisar criar a rede Docker:**
```bash
docker network create infra_default
```

**Se precisar criar o container PostgreSQL:**
```bash
docker run -d \
  --name infra-db-1 \
  --network infra_default \
  -e POSTGRES_USER=alje \
  -e POSTGRES_PASSWORD=alje \
  -e POSTGRES_DB=jogos_educativos \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15
```

### 5. Configurar Nginx

Criar arquivo: `/etc/nginx/sites-available/clubevip.space`

```nginx
server {
    listen 80;
    server_name ceps.space www.ceps.space;

    # Frontend
    location / {
        proxy_pass http://localhost:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Habilitar site:**
```bash
sudo ln -s /etc/nginx/sites-available/clubevip.space /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Instalar SSL (HTTPS)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d ceps.space -d www.ceps.space
```

### 7. Iniciar Aplicação

```bash
cd /var/www/ClubeVip
chmod +x start.sh
./start.sh
```

### 8. Verificar Status

```bash
# Ver containers rodando
docker ps

# Ver logs
docker-compose logs -f

# Testar backend
curl http://localhost:8081/api/health

# Testar frontend
curl http://localhost:3030
```

## 🔑 Credenciais e Configurações Importantes

### Banco de Dados PostgreSQL
- **Host:** infra-db-1 (container) ou localhost:5432
- **Usuário:** alje
- **Senha:** alje
- **Database:** jogos_educativos
- **URL Completa:** `postgresql://alje:alje@infra-db-1:5432/jogos_educativos`

### JWT Secret
- **Secret:** `clubevip_secret_2024_change_this_in_production`
- ⚠️ **Recomendado:** Mudar em produção para algo mais seguro

### URLs da Aplicação
- **Frontend Produção:** https://ceps.space
- **API Produção:** https://ceps.space/api
- **Backend Container:** http://localhost:8081
- **Frontend Container:** http://localhost:3030

### Portas
- **Backend:** 8081 (host) → 8080 (container)
- **Frontend:** 3030 (host) → 80 (container)
- **PostgreSQL:** 5432

## 🔄 Backup e Restauração do Banco de Dados

### Fazer Backup
```bash
docker exec infra-db-1 pg_dump -U alje jogos_educativos > backup.sql
```

### Restaurar Backup
```bash
cat backup.sql | docker exec -i infra-db-1 psql -U alje -d jogos_educativos
```

## 🐛 Troubleshooting

### Containers não iniciam
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Erro de rede
```bash
docker network ls
docker network create infra_default
```

### Limpar tudo e recomeçar
```bash
docker-compose down -v
docker system prune -a
# Depois refazer do passo 7
```

## 📝 Notas Importantes

1. O repositório Git contém **TODOS** os arquivos necessários, incluindo `.env`
2. Certifique-se de que a rede `infra_default` existe antes de iniciar
3. O banco PostgreSQL precisa estar acessível na rede `infra_default`
4. Após mudanças no código, faça rebuild: `docker-compose build`
5. DNS precisa apontar `ceps.space` para o IP da VPS

## 🔐 Segurança

- O repositório é **PRIVADO** - mantenha assim
- Todas as credenciais estão aqui para facilitar restauração
- Em produção, considere usar variáveis de ambiente mais seguras
- Sempre mantenha o Nginx e Docker atualizados
