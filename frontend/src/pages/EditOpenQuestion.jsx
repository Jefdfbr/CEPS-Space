import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function EditOpenQuestion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [game, setGame] = useState({
    title: '',
    description: '',
    game_password: '',
    presenter_password: '',
    questions: []
  });

  useEffect(() => {
    fetchGame();
  }, [id]);

  const fetchGame = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/protected/open-question/games/${id}/edit`);
      setGame(response.data);
    } catch (error) {
      console.error('Erro ao carregar jogo:', error);
      toast.error('Erro ao carregar jogo');
      navigate('/my-games');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setGame(prev => ({ ...prev, [name]: value }));
  };

  const handleQuestionChange = (index, value) => {
    const updatedQuestions = [...game.questions];
    updatedQuestions[index].question_text = value;
    setGame(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const addQuestion = () => {
    setGame(prev => ({
      ...prev,
      questions: [...prev.questions, { question_text: '', is_open: false }]
    }));
  };

  const removeQuestion = (index) => {
    if (game.questions.length <= 1) {
      toast.error('O jogo deve ter pelo menos uma pergunta');
      return;
    }
    const updatedQuestions = game.questions.filter((_, i) => i !== index);
    setGame(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!game.title.trim()) {
      toast.error('Digite o título do jogo');
      return;
    }

    if (!game.game_password.trim()) {
      toast.error('Digite a senha dos jogadores');
      return;
    }

    if (!game.presenter_password.trim()) {
      toast.error('Digite a senha do apresentador');
      return;
    }

    if (game.questions.length === 0) {
      toast.error('Adicione pelo menos uma pergunta');
      return;
    }

    const emptyQuestion = game.questions.find(q => !q.question_text.trim());
    if (emptyQuestion) {
      toast.error('Todas as perguntas devem ter texto');
      return;
    }

    try {
      setSaving(true);
      await api.put(`/protected/open-question/games/${id}`, {
        title: game.title,
        description: game.description,
        game_password: game.game_password,
        presenter_password: game.presenter_password,
        questions: game.questions.map(q => ({ question_text: q.question_text }))
      });
      toast.success('Jogo atualizado com sucesso!');
      navigate('/my-games');
    } catch (error) {
      console.error('Erro ao atualizar jogo:', error);
      toast.error(error.response?.data?.error || 'Erro ao atualizar jogo');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-dark-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-surface py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/my-games')}
            className="flex items-center gap-2 text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-dark-text-primary mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para Meus Jogos
          </button>

          <h1 className="text-4xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
            Editar Pergunta Aberta
          </h1>
          <p className="text-gray-600 dark:text-dark-text-secondary">
            Atualize as informações do seu jogo
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="bg-white dark:bg-dark-elevated border border-gray-200 dark:border-dark-border rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
              Informações Básicas
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                  Título do Jogo *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={game.title}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="Ex: Conhecimentos Gerais"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                  Descrição (Opcional)
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={game.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                  placeholder="Descreva o tema ou objetivo do jogo..."
                />
              </div>
            </div>
          </div>

          {/* Senhas */}
          <div className="bg-white dark:bg-dark-elevated border border-gray-200 dark:border-dark-border rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
              Senhas de Acesso
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="game_password" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                  Senha dos Jogadores *
                </label>
                <input
                  type="text"
                  id="game_password"
                  name="game_password"
                  value={game.game_password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="Senha para jogadores"
                  required
                />
              </div>

              <div>
                <label htmlFor="presenter_password" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                  Senha do Apresentador *
                </label>
                <input
                  type="text"
                  id="presenter_password"
                  name="presenter_password"
                  value={game.presenter_password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="Senha para apresentador"
                  required
                />
              </div>
            </div>
          </div>

          {/* Perguntas */}
          <div className="bg-white dark:bg-dark-elevated border border-gray-200 dark:border-dark-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary">
                Perguntas ({game.questions.length})
              </h2>
              <button
                type="button"
                onClick={addQuestion}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold text-sm"
              >
                <Plus className="w-4 h-4" />
                Adicionar Pergunta
              </button>
            </div>

            <div className="space-y-4">
              {game.questions.map((question, index) => (
                <div
                  key={index}
                  className="bg-gray-50 dark:bg-dark-surface/50 border border-gray-200 dark:border-dark-border rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-yellow-500 text-black rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={question.question_text}
                        onChange={(e) => handleQuestionChange(index, e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                        placeholder={`Digite a pergunta ${index + 1}...`}
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQuestion(index)}
                      className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Remover pergunta"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/my-games')}
              className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
