import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Lock, Unlock, RefreshCw, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

export default function OpenQuestionPresenter() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(true);
  const [password, setPassword] = useState('');
  const [game, setGame] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  // Verificar se já tem autenticação salva
  useEffect(() => {
    const savedPassword = sessionStorage.getItem(`presenter_auth_${id}`);
    if (savedPassword) {
      setPassword(savedPassword);
      // Tentar autenticar automaticamente
      handleAutoAuth(savedPassword);
    }
  }, [id]);

  const handleAutoAuth = async (savedPassword) => {
    try {
      const response = await api.get(`/open-question/games/${id}/presenter-public`, {
        params: { presenter_password: savedPassword }
      });
      
      setGame(response.data);
      setShowPasswordModal(false);
      
      const openIndex = response.data.questions.findIndex(q => q.is_open);
      if (openIndex !== -1) {
        setCurrentQuestionIndex(openIndex);
      }
    } catch (error) {
      // Se falhar, mostrar modal de senha
      sessionStorage.removeItem(`presenter_auth_${id}`);
      setShowPasswordModal(true);
    }
  };

  // Modal de senha
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!password.trim()) {
      toast.error('Digite a senha do apresentador');
      return;
    }
    
    try {
      const response = await api.get(`/open-question/games/${id}/presenter-public`, {
        params: { presenter_password: password }
      });
      
      setGame(response.data);
      setShowPasswordModal(false);
      
      // Salvar senha no sessionStorage
      sessionStorage.setItem(`presenter_auth_${id}`, password);
      
      // Encontrar a primeira pergunta aberta ou começar pela primeira
      const openIndex = response.data.questions.findIndex(q => q.is_open);
      if (openIndex !== -1) {
        setCurrentQuestionIndex(openIndex);
      }
      
      toast.success('Acesso autorizado!');
    } catch (error) {
      console.error('Erro ao validar senha:', error);
      toast.error(error.response?.data?.error || 'Senha inválida');
    }
  };

  // Buscar respostas da pergunta atual
  const fetchResponses = async () => {
    if (!game || !game.questions[currentQuestionIndex]) return;
    
    const currentQuestion = game.questions[currentQuestionIndex];
    setLoadingResponses(true);
    
    try {
      const response = await api.get(`/open-question/questions/${currentQuestion.id}/responses-public`, {
        params: { presenter_password: password }
      });
      setResponses(response.data);
    } catch (error) {
      console.error('Erro ao buscar respostas:', error);
    } finally {
      setLoadingResponses(false);
    }
  };

  // Toggle da pergunta atual
  const handleToggle = async () => {
    if (!game || !game.questions[currentQuestionIndex]) return;
    
    const currentQuestion = game.questions[currentQuestionIndex];
    
    try {
      const response = await api.post(
        `/open-question/questions/${currentQuestion.id}/toggle-public`,
        { presenter_password: password }
      );
      
      // Atualizar estado local
      const updatedQuestions = [...game.questions];
      
      // Se estamos abrindo esta pergunta, fechar todas as outras
      if (response.data.is_open) {
        updatedQuestions.forEach((q, idx) => {
          q.is_open = idx === currentQuestionIndex;
        });
      } else {
        updatedQuestions[currentQuestionIndex].is_open = false;
      }
      
      setGame({ ...game, questions: updatedQuestions });
      
      toast.success(response.data.is_open ? 'Respostas abertas!' : 'Respostas fechadas!');
    } catch (error) {
      console.error('Erro ao alternar pergunta:', error);
      toast.error('Erro ao alternar pergunta');
    }
  };

  // Navegação entre perguntas
  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setResponses([]);
    }
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < game.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setResponses([]);
    }
  };

  // Polling de respostas
  useEffect(() => {
    if (!showPasswordModal && game) {
      fetchResponses();
      const interval = setInterval(fetchResponses, 2000);
      return () => clearInterval(interval);
    }
  }, [showPasswordModal, game, currentQuestionIndex]);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (showPasswordModal) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-dark-surface flex items-center justify-center p-4">
        <div className="bg-white dark:bg-dark-elevated border border-gray-200 dark:border-dark-border rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gray-100 dark:bg-dark-surface rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-gray-600 dark:text-dark-text-secondary" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
              Senha do Apresentador
            </h2>
            <p className="text-gray-600 dark:text-dark-text-secondary">
              Digite a senha para acessar o painel de controle
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-center text-lg tracking-wider"
                placeholder="••••••"
                autoFocus
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/my-games')}
                className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold"
              >
                Acessar
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const currentQuestion = game.questions[currentQuestionIndex];
  const isOpen = currentQuestion?.is_open || false;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-surface py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/my-games')}
            className="flex items-center gap-2 text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-dark-text-primary mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para Meus Jogos
          </button>

          <div className="bg-white dark:bg-dark-elevated border border-gray-200 dark:border-dark-border rounded-2xl shadow-xl p-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
              {game.title}
            </h1>
            {game.description && (
              <p className="text-gray-600 dark:text-dark-text-secondary">
                {game.description}
              </p>
            )}
          </div>
        </div>

        {/* Navegação de Perguntas */}
        <div className="bg-white dark:bg-dark-elevated border border-gray-200 dark:border-dark-border rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPreviousQuestion}
              disabled={currentQuestionIndex === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
              Anterior
            </button>

            <div className="text-center">
              <span className="text-sm text-gray-600 dark:text-dark-text-secondary">
                Pergunta {currentQuestionIndex + 1} de {game.questions.length}
              </span>
            </div>

            <button
              onClick={goToNextQuestion}
              disabled={currentQuestionIndex === game.questions.length - 1}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/10 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
            <p className="text-xl text-gray-900 dark:text-dark-text-primary font-medium">
              {currentQuestion?.question_text}
            </p>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                isOpen
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {isOpen ? 'Aberta' : 'Fechada'}
              </span>
              <span className="text-gray-600 dark:text-dark-text-secondary">
                {responses.length} {responses.length === 1 ? 'resposta' : 'respostas'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchResponses}
                disabled={loadingResponses}
                className="p-2 text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Atualizar respostas"
              >
                <RefreshCw className={`w-5 h-5 ${loadingResponses ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleToggle}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                  isOpen
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {isOpen ? (
                  <>
                    <Lock className="w-5 h-5" />
                    Fechar Respostas
                  </>
                ) : (
                  <>
                    <Unlock className="w-5 h-5" />
                    Abrir Respostas
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Respostas */}
        <div className="bg-white dark:bg-dark-elevated border border-gray-200 dark:border-dark-border rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
            Respostas Recebidas
          </h2>

          {responses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-dark-text-secondary">
                Nenhuma resposta ainda. {isOpen ? 'Aguardando jogadores...' : 'Abra a pergunta para receber respostas.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {responses.map((response) => (
                <div
                  key={response.id}
                  className="bg-gray-50 dark:bg-dark-surface/50 border border-gray-200 dark:border-dark-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <p className="text-lg text-gray-900 dark:text-dark-text-primary mb-2">
                    {response.response_text}
                  </p>
                  {(response.player_name || response.room_name) && (
                    <div className="text-xs text-gray-500 dark:text-dark-text-secondary text-right space-y-0.5">
                      {response.player_name && <div>{response.player_name}</div>}
                      {response.room_name && <div>{response.room_name}</div>}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 dark:text-dark-text-secondary mt-2">
                    {new Date(response.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
