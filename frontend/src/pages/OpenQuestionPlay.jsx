import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle, Send } from 'lucide-react';
import api from '../services/api';
import { toast, Toaster } from 'react-hot-toast';

export default function OpenQuestionPlay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(true);
  const [password, setPassword] = useState('');
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(null); // 'presenter' ou 'player'
  const [formData, setFormData] = useState({
    response_text: '',
    player_name: '',
    room_name: '',
  });
  const [submitted, setSubmitted] = useState(false);

  // Modal de senha unificada
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!password.trim()) {
      toast.error('Digite a senha');
      return;
    }
    
    setLoading(true);
    
    try {
      // Fazer requisição direta com axios para evitar interceptor de redirecionamento
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
      const response = await fetch(`${API_URL}/open-question/games/${id}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: password })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Senha inválida');
      }
      
      const data = await response.json();
      
      setGame(data.game);
      setRole(data.role);
      setShowPasswordModal(false);
      
      if (data.role === 'presenter') {
        toast.success('Acesso de Apresentador autorizado!');
        // Salvar senha no sessionStorage para o presenter
        sessionStorage.setItem(`presenter_auth_${id}`, password);
        // Redirecionar para tela de apresentador no domínio correto
        window.location.href = `https://ceps.space/open-question/presenter/${id}`;
      } else {
        toast.success('Acesso de Jogador autorizado!');
      }
    } catch (error) {
      console.error('Erro ao validar senha:', error);
      toast.error(error.message || 'Senha inválida');
      // Permanecer na página
    } finally {
      setLoading(false);
    }
  };

  // Atualizar estado do jogo (polling)
  const fetchGameStatus = async () => {
    if (!game || !password) return;
    
    try {
      const response = await api.get(`/open-question/games/${id}`, {
        params: { game_password: password }
      });
      setGame(response.data);
    } catch (error) {
      console.error('Erro ao atualizar jogo:', error);
    }
  };

  // Polling a cada 3 segundos
  useEffect(() => {
    if (!showPasswordModal && game) {
      const interval = setInterval(fetchGameStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [showPasswordModal, game, password]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.response_text.trim()) {
      toast.error('Digite sua resposta');
      return;
    }
    
    setLoading(true);
    
    try {
      await api.post(`/open-question/games/${id}/respond`, {
        response_text: formData.response_text,
        player_name: formData.player_name || null,
        room_name: formData.room_name || null,
        game_password: password,
      });
      
      toast.success('Resposta enviada com sucesso!');
      setSubmitted(true);
      
      // Limpar apenas o campo de resposta, manter nome/sala
      setFormData(prev => ({
        ...prev,
        response_text: '',
      }));
      
      // Resetar o estado de "enviado" após 3 segundos
      setTimeout(() => {
        setSubmitted(false);
      }, 3000);
    } catch (error) {
      console.error('Erro ao enviar resposta:', error);
      toast.error(error.response?.data?.error || 'Erro ao enviar resposta');
    } finally {
      setLoading(false);
    }
  };

  if (showPasswordModal) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-dark-surface flex items-center justify-center p-4">
        <Toaster position="top-center" />
        <div className="bg-white dark:bg-dark-elevated rounded-2xl shadow-2xl p-8 max-w-md w-full border border-gray-200 dark:border-dark-border">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gray-100 dark:bg-dark-surface rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-gray-600 dark:text-dark-text-secondary" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
              Acesso ao Jogo
            </h2>
            <p className="text-gray-600 dark:text-dark-text-secondary">
              Digite a senha para entrar
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

            <button
              type="submit"
              className="w-full px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const openQuestion = game.questions.find(q => q.is_open);
  const hasOpenQuestion = !!openQuestion;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-surface py-8">
      <Toaster position="top-center" />
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white dark:bg-dark-elevated rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-dark-border">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
              {game.title}
            </h1>
            {game.description && (
              <p className="text-gray-600 dark:text-dark-text-secondary">
                {game.description}
              </p>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center justify-center gap-3 mb-6">
            {hasOpenQuestion ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-500" />
                <span className="text-lg font-medium text-green-600 dark:text-green-400">
                  Pergunta Aberta - Você pode responder!
                </span>
              </>
            ) : (
              <>
                <Lock className="w-6 h-6 text-red-500" />
                <span className="text-lg font-medium text-red-600 dark:text-red-400">
                  Aguardando o apresentador abrir uma pergunta...
                </span>
              </>
            )}
          </div>

          {hasOpenQuestion ? (
            <>
              {/* Pergunta */}
              <div className="bg-yellow-50 dark:bg-yellow-900/10 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl p-6 mb-6">
                <p className="text-xl text-gray-900 dark:text-dark-text-primary font-medium text-center">
                  {openQuestion.question_text}
                </p>
              </div>

              {/* Formulário */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="response_text" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                    Sua Resposta *
                  </label>
                  <textarea
                    id="response_text"
                    name="response_text"
                    value={formData.response_text}
                    onChange={handleInputChange}
                    rows={5}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                    placeholder="Digite sua resposta aqui..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="player_name" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                      Seu Nome (Opcional)
                    </label>
                    <input
                      type="text"
                      id="player_name"
                      name="player_name"
                      value={formData.player_name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      placeholder="Ex: João Silva"
                    />
                  </div>

                  <div>
                    <label htmlFor="room_name" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                      Sala (Opcional)
                    </label>
                    <input
                      type="text"
                      id="room_name"
                      name="room_name"
                      value={formData.room_name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      placeholder="Ex: Sala 1"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                  {loading ? 'Enviando...' : 'Enviar Resposta'}
                </button>
              </form>

              {submitted && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200 text-center">
                    ✓ Resposta enviada! Você pode enviar outra resposta se desejar.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="animate-pulse mb-4">
                <Lock className="w-16 h-16 text-gray-400 dark:text-dark-text-secondary mx-auto" />
              </div>
              <p className="text-gray-500 dark:text-dark-text-secondary text-lg">
                Aguarde o apresentador abrir uma pergunta para você poder responder.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
