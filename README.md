# Clube Vip - Plataforma de Jogos Educativos

Plataforma para criar e jogar jogos educativos de forma interativa.

## Tecnologias

- **Backend**: Rust com Actix-web
- **Frontend**: React com Vite e Tailwind CSS
- **Banco de Dados**: PostgreSQL
- **Containerização**: Docker e Docker Compose

## Jogos Disponíveis

1. **Caça-Palavras**: Crie jogos de caça-palavras personalizados
2. **Quiz**: Desenvolva questionários de múltipla escolha

## Configuração e Execução

### Requisitos

- Docker e Docker Compose
- PostgreSQL rodando (já configurado)

### Executar com Docker

```bash
# Build e start dos containers
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Parar containers
docker-compose down
```

### Acessar

- Frontend: http://localhost:3030
- Backend API: http://localhost:8080
- Produção: https://clubevip.space

## Estrutura do Banco de Dados

- `users`: Usuários cadastrados (criadores de jogos)
- `games`: Jogos criados
- `word_search_configs`: Configurações de caça-palavras
- `quiz_configs`: Configurações de quiz
- `quiz_questions`: Perguntas dos quizzes
- `game_sessions`: Sessões de jogo
- `game_results`: Resultados dos jogadores

## API Endpoints

### Públicos (sem autenticação)
- POST `/api/auth/register` - Cadastro
- POST `/api/auth/login` - Login
- GET `/api/games` - Listar jogos
- GET `/api/games/{id}` - Detalhes do jogo
- POST `/api/sessions/join` - Entrar em sessão
- POST `/api/scores` - Enviar pontuação

### Protegidos (requer autenticação)
- GET `/api/protected/profile` - Perfil do usuário
- POST `/api/protected/games` - Criar jogo
- GET `/api/protected/games/my` - Meus jogos
- POST `/api/protected/sessions` - Criar sessão

## Funcionalidades

- ✅ Sistema de autenticação com JWT
- ✅ Tema dark/light
- ✅ Criação de jogos personalizados
- ✅ Sessões com códigos para compartilhar
- ✅ Proteção por senha opcional
- ✅ Ranking de pontuações
- ✅ Modo single e multiplayer

## Desenvolvimento

### Backend (Rust)

```bash
cd backend
cargo run
```

### Frontend (React)

```bash
cd frontend
npm run dev
```

## Licença

MIT
