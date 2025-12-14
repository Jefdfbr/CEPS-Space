import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, GripVertical } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

export default function CreateOpenQuestion() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    game_password: '',
    presenter_password: '',
  });
  const [questions, setQuestions] = useState(['']);

  useEffect(() => {
    // Tentar carregar dados do fluxo "Criar Jogos"
    const tempData = localStorage.getItem('tempGameData');
    if (tempData) {
      try {
        const parsed = JSON.parse(tempData);
        setFormData(prev => ({
          ...prev,
          title: parsed.name || '',
          description: parsed.description || '',
        }));
        // Limpar dados temporários após uso
        localStorage.removeItem('tempGameData');
      } catch (e) {
        console.error('Erro ao parsear tempGameData:', e);
      }
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleQuestionChange = (index, value) => {
    const newQuestions = [...questions];
    newQuestions[index] = value;
    setQuestions(newQuestions);
  };

  const addQuestion = () => {
    setQuestions([...questions, '']);
  };

  const removeQuestion = (index) => {
    if (questions.length <= 1) {
      toast.error('Você precisa ter pelo menos uma pergunta');
      return;
    }
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
  };

  const moveQuestion = (index, direction) => {
    const newQuestions = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= questions.length) return;
    
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestions(newQuestions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('O título é obrigatório');
      return;
    }
    
    if (!formData.game_password.trim()) {
      toast.error('A senha do jogo é obrigatória');
      return;
    }
    
    if (!formData.presenter_password.trim()) {
      toast.error('A senha do apresentador é obrigatória');
      return;
    }
    
    const validQuestions = questions.filter(q => q.trim() !== '');
    
    if (validQuestions.length === 0) {
      toast.error('Adicione pelo menos uma pergunta');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await api.post('/protected/open-question/games', {
        title: formData.title,
        description: formData.description || null,
        game_password: formData.game_password,
        presenter_password: formData.presenter_password,
        questions: validQuestions,
      });
      
      toast.success('Jogo criado com sucesso!');
      
      setTimeout(() => {
        navigate('/my-games');
      }, 1500);
    } catch (error) {
      console.error('Erro ao criar jogo:', error);
      toast.error(error.response?.data?.error || 'Erro ao criar jogo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-surface py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white dark:bg-dark-elevated border border-gray-200 dark:border-dark-border rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
            Criar Pergunta Aberta
          </h1>
          <p className="text-gray-600 dark:text-dark-text-secondary mb-8">
            Crie um jogo com múltiplas perguntas abertas e controle as respostas em tempo real
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Título */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                Título do Jogo *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                placeholder="Ex: Avaliação da Aula de Matemática"
                required
              />
            </div>

            {/* Descrição */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                Descrição (Opcional)
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                placeholder="Informações adicionais sobre o jogo..."
              />
            </div>

            {/* Senhas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="game_password" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                  Senha do Jogo *
                </label>
                <input
                  type="text"
                  id="game_password"
                  name="game_password"
                  value={formData.game_password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="Senha para os jogadores"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-dark-text-secondary">
                  Jogadores precisarão dessa senha para participar
                </p>
              </div>

              <div>
                <label htmlFor="presenter_password" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                  Senha do Apresentador *
                </label>
                <input
                  type="text"
                  id="presenter_password"
                  name="presenter_password"
                  value={formData.presenter_password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="Senha para apresentar"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-dark-text-secondary">
                  Necessária para acessar a tela de apresentação
                </p>
              </div>
            </div>

            {/* Perguntas */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary">
                  Perguntas *
                </label>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:shadow-lg transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Pergunta
                </button>
              </div>

              <div className="space-y-3">
                {questions.map((question, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="flex flex-col gap-1 pt-3">
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, 'up')}
                        disabled={index === 0}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <GripVertical className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-8 h-10 flex items-center justify-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg font-semibold">
                          {index + 1}
                        </span>
                        <textarea
                          value={question}
                          onChange={(e) => handleQuestionChange(index, e.target.value)}
                          rows={2}
                          className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-primary focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                          placeholder={`Digite a pergunta ${index + 1}...`}
                          required
                        />
                        {questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeQuestion(index)}
                            className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/create')}
                className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Criando...' : 'Criar Jogo'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
