# 🎮 Plataforma de Jogos Educativos - Clube Vip

## ✅ Status da Implementação

### Concluído
- ✅ Remoção do projeto antigo (PM2 e configurações)
- ✅ Banco de dados PostgreSQL criado (`jogos_educativos`)
- ✅ Backend completo em Rust com Actix-web
  - Autenticação JWT
  - CRUD de jogos
  - Configuração de caça-palavras e quiz
  - Sistema de sessões com códigos
  - API completa documentada
- ✅ Frontend base em React com Vite
  - Tailwind CSS configurado
  - Tema dark/light
  - Sistema de autenticação
  - Páginas: Home, Login, Register, Games
- ✅ Docker Compose configurado
- ✅ Nginx configurado para clubevip.space

### Pendente (para adicionar aos poucos)
- ⏳ Componentes dos jogos (Caça-Palavras e Quiz)
- ⏳ Páginas de criação de jogos
- ⏳ Páginas de sessões e gameplay
- ⏳ WebSocket para multiplayer em tempo real

## 🚀 Como Iniciar

### 1. Build e Start

```bash
cd /var/www/ClubeVip
./start.sh
```

Ou manualmente:

```bash
# Build dos containers
docker-compose build

# Iniciar serviços
docker-compose up -d

# Recarregar Nginx
sudo systemctl reload nginx
```

### 2. Ver Logs

```bash
# Todos os serviços
docker-compose logs -f

# Apenas backend
docker-compose logs -f backend

# Apenas frontend
docker-compose logs -f frontend
```

### 3. Parar Serviços

```bash
docker-compose down
```

## 🔧 Desenvolvimento

### Backend (Rust)

Para desenvolver localmente sem Docker:

```bash
cd /var/www/ClubeVip/backend

# Instalar Rust se necessário
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Executar
cargo run

# Build release
cargo build --release
```

### Frontend (React)

Para desenvolver localmente sem Docker:

```bash
cd /var/www/ClubeVip/frontend

# Instalar dependências
npm install

# Modo desenvolvimento
npm run dev

# Build para produção
npm run build
```

## 📊 Banco de Dados

### Conexão
- Host: infra-db-1 (Docker) ou localhost
- Port: 5432
- Database: jogos_educativos
- User: alje
- Password: alje

### Tabelas Criadas
- `users` - Usuários cadastrados
- `games` - Jogos criados
- `word_search_configs` - Configurações caça-palavras
- `quiz_configs` - Configurações quiz
- `quiz_questions` - Perguntas dos quizzes
- `game_sessions` - Sessões de jogo
- `game_results` - Resultados/pontuações

### Acessar banco

```bash
docker exec -it infra-db-1 psql -U alje -d jogos_educativos
```

## 🌐 URLs

- **Produção**: https://clubevip.space
- **Frontend Dev**: http://localhost:3030
- **Backend API**: http://localhost:8080
- **API Docs**: http://localhost:8080/api

## 📝 Próximos Passos

### 1. Implementar Componentes dos Jogos

Criar os componentes React para:
- Caça-palavras (grade interativa, encontrar palavras)
- Quiz (perguntas e opções, feedback visual)

### 2. Páginas de Criação

- `/create-game` - Escolher tipo de jogo
- `/create-word-search` - Configurar caça-palavras
- `/create-quiz` - Configurar quiz e perguntas

### 3. Sistema de Sessões

- `/my-games` - Gerenciar jogos criados
- `/session/:code` - Entrar em sessão com código
- `/play/:gameId` - Jogar o jogo
- `/results/:sessionId` - Ver resultados

### 4. Melhorias

- WebSocket para multiplayer em tempo real
- Sistema de rankings
- Estatísticas dos jogos
- Exportar/importar jogos
- Templates de jogos prontos

## 🔐 Segurança

- JWT para autenticação
- Senhas com bcrypt
- HTTPS via Let's Encrypt
- Headers de segurança no Nginx
- Validação de dados no backend

## 📦 Estrutura do Projeto

```
/var/www/ClubeVip/
├── backend/               # Rust/Actix-web
│   ├── src/
│   │   ├── main.rs
│   │   ├── models.rs
│   │   ├── db.rs
│   │   ├── middleware.rs
│   │   └── handlers/
│   ├── Cargo.toml
│   └── Dockerfile
├── frontend/              # React/Vite
│   ├── src/
│   │   ├── App.jsx
│   │   ├── contexts/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── start.sh
└── README.md
```

## 🐛 Troubleshooting

### Backend não inicia
```bash
# Ver logs detalhados
docker-compose logs backend

# Rebuild
docker-compose up -d --build backend
```

### Frontend não carrega
```bash
# Verificar se está rodando
docker ps | grep frontend

# Rebuild
docker-compose up -d --build frontend
```

### Erro de conexão com banco
```bash
# Verificar se PostgreSQL está rodando
docker ps | grep postgres

# Testar conexão
docker exec -it infra-db-1 psql -U alje -d jogos_educativos -c "SELECT 1;"
```

### Nginx não serve o site
```bash
# Testar configuração
sudo nginx -t

# Recarregar
sudo systemctl reload nginx

# Ver logs
sudo tail -f /var/log/nginx/clubevip.space.error.log
```

## 📞 Suporte

Para problemas ou dúvidas:
1. Verificar logs: `docker-compose logs -f`
2. Verificar status: `docker-compose ps`
3. Restart: `docker-compose restart`

---

**Criado em**: 11 de novembro de 2025
**Stack**: Rust + React + PostgreSQL + Docker + Nginx
