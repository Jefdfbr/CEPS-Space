# 🔄 Guia de Restauração Completa — CEPS Space

Caso perca a VPS ou precise migrar, siga este guia do zero.
O banco de dados e a config do OneDrive ficam em: **OneDrive → Backups/ceps-space/**

---

## 1. Provisionar nova VPS (Ubuntu 22.04+ / Debian 12+)

```bash
apt update && apt upgrade -y
```

---

## 2. Instalar dependências

```bash
# Docker
curl -fsSL https://get.docker.com | bash

# Demais ferramentas
apt install -y docker-compose-plugin git nginx certbot python3-certbot-nginx rclone
```

---

## 3. Restaurar acesso ao OneDrive (rclone)

O arquivo `rclone.conf.bak` fica salvo na própria pasta do OneDrive.
Você precisa de **outro** dispositivo com rclone para baixá-lo primeiro.

**Na sua máquina local**, configure o rclone e baixe o arquivo:
```bash
# Se não tiver rclone local: https://rclone.org/downloads/
rclone config  # configure "onedrive" na máquina local
rclone copy "onedrive:Backups/ceps-space/rclone.conf.bak" ./
```

**Na nova VPS**, copie o arquivo:
```bash
mkdir -p /root/.config/rclone
# Envie o rclone.conf.bak para a VPS (scp, sftp, etc.)
cp rclone.conf.bak /root/.config/rclone/rclone.conf

# Testar
rclone lsd onedrive:
```

---

## 4. Clonar o repositório

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/Jefdfbr/CEPS-Space.git ceps-space
cd ceps-space
chmod +x start.sh backup_db.sh
```

> Os arquivos `.env.backend` e `frontend/.env` já estão no repositório (repo privado).

---

## 5. Restaurar o banco de dados

```bash
# Criar diretório de backups
mkdir -p /var/backups/ceps-space

# Listar backups disponíveis no OneDrive
rclone ls "onedrive:Backups/ceps-space/"

# Baixar o backup mais recente (substitua o nome do arquivo)
rclone copy "onedrive:Backups/ceps-space/backup_XXXXXXXX_XXXXXX.sql.gz" /var/backups/ceps-space/

# Subir apenas o banco primeiro
docker compose up -d db
sleep 8

# Restaurar
gunzip -c /var/backups/ceps-space/backup_XXXXXXXX_XXXXXX.sql.gz \
  | docker exec -i ceps-space-db psql -U ceps_user -d jogos_educativos
```

---

## 6. Subir a aplicação

```bash
cd /var/www/ceps-space
docker compose up -d
docker ps  # todos devem aparecer como "Up"
```

---

## 7. Configurar Nginx

```bash
cp nginx-config.conf /etc/nginx/sites-available/ceps-space
ln -sf /etc/nginx/sites-available/ceps-space /etc/nginx/sites-enabled/ceps-space
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

---

## 8. Instalar SSL (HTTPS)

```bash
certbot --nginx -d ceps.space -d www.ceps.space
```

---

## 9. Reativar backup automático

```bash
apt install -y cron && systemctl enable --now cron

(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/ceps-space/backup_db.sh >> /var/backups/ceps-space/backup.log 2>&1") | crontab -

# Testar
bash /var/www/ceps-space/backup_db.sh
```

---

## 10. Verificar tudo

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
curl -s http://localhost:8081/api/health
docker compose logs --tail=20
```

---

## 📋 Referência rápida

| Item | Valor |
|---|---|
| Repositório | https://github.com/Jefdfbr/CEPS-Space |
| Domínio | ceps.space |
| Frontend | porta 3030 (host) → 80 (container) |
| Backend | porta 8081 (host) → 8080 (container) |
| Banco | PostgreSQL 16, container `ceps-space-db` |
| DB name | `jogos_educativos` |
| DB user | `ceps_user` |
| Backups locais | `/var/backups/ceps-space/` (7 dias) |
| Backups OneDrive | `OneDrive/Backups/ceps-space/` |
| Cron backup | Todo dia às 02h00 |

---

## 🆘 Troubleshooting rápido

```bash
# Rebuild completo
docker compose down
docker compose build --no-cache
docker compose up -d

# Ver logs do backend
docker logs ceps-space-backend --tail=50

# Acessar banco direto
docker exec -it ceps-space-db psql -U ceps_user -d jogos_educativos
```
