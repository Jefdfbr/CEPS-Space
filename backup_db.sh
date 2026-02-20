#!/bin/bash
# =============================================================================
# CEPS Space — Database Backup Script
# Runs pg_dump inside the ceps-space-db container, compresses and stores
# locally (keeping 7 days). Optionally uploads to OneDrive via rclone.
# =============================================================================

set -euo pipefail

# ---- Config -----------------------------------------------------------------
BACKUP_DIR="/var/backups/ceps-space"
DB_CONTAINER="ceps-space-db"
DB_NAME="jogos_educativos"
DB_USER="ceps_user"
KEEP_DAYS=7
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Rclone remote name (configure with: rclone config)
# Set RCLONE_REMOTE to empty string to skip OneDrive upload
RCLONE_REMOTE="${RCLONE_REMOTE:-onedrive:Backups/ceps-space}"

# ---- Logging ----------------------------------------------------------------
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# ---- Create backup dir if needed -------------------------------------------
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

log "=== Iniciando backup do banco de dados ==="

# ---- Dump -------------------------------------------------------------------
log "Executando pg_dump no container ${DB_CONTAINER}..."
if docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
    log "Backup criado: ${BACKUP_FILE} (${SIZE})"
else
    log "ERRO: falha ao criar backup!"
    exit 1
fi

# ---- Protect file -----------------------------------------------------------
chmod 600 "$BACKUP_FILE"

# ---- Remove old backups -----------------------------------------------------
log "Removendo backups com mais de ${KEEP_DAYS} dias..."
DELETED=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime "+${KEEP_DAYS}" -print -delete | wc -l)
log "${DELETED} arquivo(s) antigo(s) removido(s)."

# ---- List current backups ---------------------------------------------------
TOTAL=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" | wc -l)
log "Total de backups armazenados: ${TOTAL}"

# ---- Backup rclone config --------------------------------------------------
RCLONE_CONF="${HOME}/.config/rclone/rclone.conf"
RCLONE_CONF_BACKUP="${BACKUP_DIR}/rclone.conf.bak"
if [ -f "$RCLONE_CONF" ]; then
    cp "$RCLONE_CONF" "$RCLONE_CONF_BACKUP"
    chmod 600 "$RCLONE_CONF_BACKUP"
    log "Config do rclone salva em ${RCLONE_CONF_BACKUP}"
fi

# ---- Upload to OneDrive (if rclone configured) ------------------------------
if command -v rclone &>/dev/null && [ -n "${RCLONE_REMOTE}" ]; then
    REMOTE_NAME="${RCLONE_REMOTE%%:*}"
    if rclone listremotes 2>/dev/null | grep -q "^${REMOTE_NAME}:"; then
        log "Enviando backup para OneDrive (${RCLONE_REMOTE})..."
        UPLOAD_OK=true

        # Upload DB backup
        if ! rclone copy "$BACKUP_FILE" "${RCLONE_REMOTE}/" --log-level INFO 2>>"$LOG_FILE"; then
            UPLOAD_OK=false
        fi

        # Upload rclone.conf backup (so it can be recovered from OneDrive itself)
        if [ -f "$RCLONE_CONF_BACKUP" ]; then
            rclone copy "$RCLONE_CONF_BACKUP" "${RCLONE_REMOTE}/" --log-level INFO 2>>"$LOG_FILE" || true
        fi

        if $UPLOAD_OK; then
            log "Upload para OneDrive concluído com sucesso."
            # Remove remote DB backups older than KEEP_DAYS (keep rclone.conf.bak always)
            rclone delete --min-age "${KEEP_DAYS}d" --include "backup_*.sql.gz" "${RCLONE_REMOTE}/" 2>>"$LOG_FILE" || true
        else
            log "AVISO: falha no upload para OneDrive (backup local mantido)."
        fi
    else
        log "Rclone instalado mas remote '${REMOTE_NAME}' não configurado. Pulando upload."
        log "  → Para configurar: rclone config"
    fi
else
    log "Rclone não instalado ou RCLONE_REMOTE vazio. Apenas backup local."
fi

log "=== Backup concluído ==="
