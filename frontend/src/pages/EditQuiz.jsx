import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Save, ChevronUp, ChevronDown, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

const EditQuiz = () => {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [endScreenText, setEndScreenText] = useState('Parabéns! Você completou o quiz!');
  const [endScreenButtonText, setEndScreenButtonText] = useState('');
  const [endScreenButtonUrl, setEndScreenButtonUrl] = useState('');
  const [endScreenButtonNewTab, setEndScreenButtonNewTab] = useState(true);
  const [showEndScreenButton, setShowEndScreenButton] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    loadGameData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const loadGameData = async () => {
    try {
      setLoading(true);
      console.log('Carregando quiz com ID:', gameId);
      
      const gameResponse = await api.get(`/protected/games/${gameId}`);
      console.log('Resposta do game:', gameResponse.data);
      const game = gameResponse.data;
      
      setGameData({ name: game.name, description: game.description });
      setEndScreenText(game.end_screen_text || 'Parabéns! Você completou o quiz!');
      setEndScreenButtonText(game.end_screen_button_text || '');
      setEndScreenButtonUrl(game.end_screen_button_url || '');
      setEndScreenButtonNewTab(game.end_screen_button_new_tab !== false);
      setShowEndScreenButton(!!(game.end_screen_button_text && game.end_screen_button_url));

      console.log('Buscando questões...');
      const questionsResponse = await api.get(`/quiz/${gameId}/questions`);
      console.log('Resposta das questões:', questionsResponse.data);
      
      // Converter correct_option ("A", "B", "C", "D") para correct_answer (0, 1, 2, 3)
      const optionToIndex = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
      
      // Converter estrutura da API para estrutura do componente
      const convertedQuestions = questionsResponse.data.map(q => ({
        id: q.id || Date.now() + Math.random(),
        question_text: q.question || '',
        options: [
          q.option_a || '',
          q.option_b || '',
          q.option_c || '',
          q.option_d || ''
        ],
        correct_answer: optionToIndex[q.correct_option?.trim()] ?? 0,
        points: q.points || 100,
        has_justification: !!q.justification,
        justification: q.justification || '',
      }));
      
      console.log('Questões convertidas:', convertedQuestions);
      setQuestions(convertedQuestions);
      
      console.log('Quiz carregado com sucesso!');
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar jogo:', error);
      console.error('Detalhes do erro:', error.response?.data || error.message);
      setError('Erro ao carregar dados do jogo. Redirecionando...');
      setLoading(false);
      showNotification('Erro ao carregar dados do jogo', 'error');
      setTimeout(() => navigate('/my-games'), 2000);
    }
  };

  const showNotification = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const addQuestion = () => {
    const newQuestion = {
      id: Date.now(),
      question_text: '',
      options: ['', '', '', ''],
      correct_answer: 0,
      points: 100,
      has_justification: false,
      justification: '',
    };
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (questionId) => {
    setQuestions(questions.filter((q) => q.id !== questionId));
  };

  const updateQuestion = (questionId, field, value) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId ? { ...q, [field]: value } : q
      )
    );
  };

  const updateOption = (questionId, optionIndex, value) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId) {
          const newOptions = [...q.options];
          newOptions[optionIndex] = value;
          return { ...q, options: newOptions };
        }
        return q;
      })
    );
  };

  const moveQuestion = (index, direction) => {
    const newQuestions = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= questions.length) return;
    
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestions(newQuestions);
  };

  const validateQuestions = () => {
    for (const q of questions) {
      if (!q.question_text.trim()) {
        showNotification('Todas as perguntas devem ter um texto', 'error');
        return false;
      }
      
      if (q.question_text.trim().length < 5) {
        showNotification('As perguntas devem ter no mínimo 5 caracteres', 'error');
        return false;
      }
      
      if (q.question_text.trim().length > 500) {
        showNotification('As perguntas devem ter no máximo 500 caracteres', 'error');
        return false;
      }
      
      for (const option of q.options) {
        if (!option.trim()) {
          showNotification('Todas as opções devem ser preenchidas', 'error');
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (questions.length === 0) {
      showNotification('Adicione pelo menos uma pergunta', 'error');
      return;
    }

    if (questions.length < 3) {
      setShowConfirmModal(true);
      return;
    }

    if (!validateQuestions()) {
      return;
    }

    await saveQuiz();
  };

  const saveQuiz = async () => {
    setSaving(true);

    try {
      // Update game
      await api.put(`/protected/games/${gameId}`, {
        name: gameData.name,
        game_type: 'quiz',
        description: gameData.description,
        is_active: true,
        end_screen_text: endScreenText,
        end_screen_button_text: showEndScreenButton ? endScreenButtonText : null,
        end_screen_button_url: showEndScreenButton ? endScreenButtonUrl : null,
        end_screen_button_new_tab: showEndScreenButton ? endScreenButtonNewTab : null,
      });

      // Update quiz config (for end screen settings)
      await api.put(`/protected/quiz/${gameId}`, {
        end_screen_text: endScreenText,
        end_screen_button_text: showEndScreenButton ? endScreenButtonText : null,
        end_screen_button_url: showEndScreenButton ? endScreenButtonUrl : null,
        end_screen_button_new_tab: showEndScreenButton ? endScreenButtonNewTab : null,
      });

      await api.delete(`/protected/quiz/${gameId}/questions`);

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await api.post(`/protected/quiz/${gameId}/questions`, {
          question_text: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer,
          order_number: i + 1,
          points: q.points || 100,
          justification: q.has_justification ? q.justification : null,
        });
      }

      localStorage.removeItem('tempGameData');
      showNotification('Quiz atualizado com sucesso!', 'success');
      setTimeout(() => navigate('/my-games'), 1000);
    } catch (error) {
      console.error('Erro ao atualizar quiz:', error);
      showNotification('Erro ao atualizar quiz. Tente novamente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-dark-text-secondary">Carregando quiz...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-dark-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  if (!gameData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
            Editar Quiz
          </h1>
        </div>

        <div className="space-y-6">
          {/* Game Information */}
          <div className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-6">
              Informações do Quiz
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                  Nome do Quiz *
                </label>
                <input
                  type="text"
                  value={gameData.name}
                  onChange={(e) => setGameData({ ...gameData, name: e.target.value })}
                  placeholder="Digite o nome do quiz..."
                  maxLength={100}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                  Descrição (opcional)
                </label>
                <textarea
                  value={gameData.description || ''}
                  onChange={(e) => setGameData({ ...gameData, description: e.target.value })}
                  placeholder="Adicione uma descrição..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-900 dark:text-dark-text-primary"
                />
              </div>
            </div>
          </div>

          {/* Questions List */}
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary">
                  Pergunta {index + 1}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => moveQuestion(index, 'up')}
                    disabled={index === 0}
                    className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg transition-colors disabled:opacity-30"
                    title="Mover para cima"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => moveQuestion(index, 'down')}
                    disabled={index === questions.length - 1}
                    className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg transition-colors disabled:opacity-30"
                    title="Mover para baixo"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => removeQuestion(question.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Remover pergunta"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Question Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                    Texto da Pergunta *
                  </label>
                  <textarea
                    value={question.question_text}
                    onChange={(e) => updateQuestion(question.id, 'question_text', e.target.value)}
                    placeholder="Digite a pergunta..."
                    rows={2}
                    maxLength={500}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-900 dark:text-dark-text-primary"
                  />
                </div>

                {/* Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                    Opções de Resposta *
                  </label>
                  <div className="space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-3">
                        <input
                          type="radio"
                          name={`correct-${question.id}`}
                          checked={question.correct_answer === optionIndex}
                          onChange={() => updateQuestion(question.id, 'correct_answer', optionIndex)}
                          className="w-5 h-5 text-purple-600"
                        />
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                          placeholder={`Opção ${optionIndex + 1}`}
                          maxLength={200}
                          className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary ${
                            question.correct_answer === optionIndex
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                              : 'bg-gray-50 dark:bg-dark-surface border-gray-300 dark:border-dark-border'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-2">
                    Selecione o botão de rádio ao lado da resposta correta
                  </p>
                </div>

                {/* Points */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                    Pontos
                  </label>
                  <input
                    type="number"
                    value={question.points}
                    onChange={(e) => updateQuestion(question.id, 'points', parseInt(e.target.value) || 10)}
                    min="1"
                    max="100"
                    className="w-32 px-4 py-2 bg-gray-50 dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary"
                  />
                </div>
                
                {/* Justification */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id={`has-justification-${question.id}`}
                      checked={question.has_justification}
                      onChange={(e) => updateQuestion(question.id, 'has_justification', e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <label htmlFor={`has-justification-${question.id}`} className="text-sm font-medium text-gray-700 dark:text-dark-text-primary">
                      Adicionar justificativa/explicação
                    </label>
                  </div>
                  
                  {question.has_justification && (
                    <textarea
                      value={question.justification}
                      onChange={(e) => updateQuestion(question.id, 'justification', e.target.value)}
                      placeholder="Digite a justificativa ou explicação da resposta correta..."
                      rows={3}
                      maxLength={1000}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Add Question Button */}
          <button
            onClick={addQuestion}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-200 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-primary rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors border-2 border-dashed border-gray-300 dark:border-dark-border"
          >
            <Plus className="w-5 h-5" />
            Adicionar Pergunta
          </button>

          {/* End Screen Configuration */}
          <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
              Tela de Conclusão
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                  Mensagem Final
                </label>
                <textarea
                  value={endScreenText}
                  onChange={(e) => setEndScreenText(e.target.value)}
                  placeholder="Mensagem exibida quando o jogador completar o quiz"
                  rows="3"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 pb-2 border-t border-gray-200 dark:border-dark-border">
                <input
                  type="checkbox"
                  id="showButton"
                  checked={showEndScreenButton}
                  onChange={(e) => setShowEndScreenButton(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-gray-100 dark:bg-dark-elevated border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="showButton" className="text-sm font-medium text-gray-700 dark:text-dark-text-primary cursor-pointer">
                  Exibir botão personalizado
                </label>
              </div>

              {showEndScreenButton && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                      Texto do Botão
                    </label>
                    <input
                      type="text"
                      value={endScreenButtonText}
                      onChange={(e) => setEndScreenButtonText(e.target.value)}
                      placeholder="Ex: Voltar ao site"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                      Link do Botão (URL)
                    </label>
                    <input
                      type="url"
                      value={endScreenButtonUrl}
                      onChange={(e) => setEndScreenButtonUrl(e.target.value)}
                      placeholder="https://exemplo.com"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="newTab"
                      checked={endScreenButtonNewTab}
                      onChange={(e) => setEndScreenButtonNewTab(e.target.checked)}
                      className="w-4 h-4 text-purple-600 bg-gray-100 dark:bg-dark-elevated border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="newTab" className="text-sm font-medium text-gray-700 dark:text-dark-text-primary cursor-pointer">
                      Abrir em nova guia
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200 dark:border-dark-border">
            <button
              onClick={handleSave}
              disabled={questions.length === 0 || saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-400 hover:to-purple-500 transition-all font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Salvando...' : 'Salvar Quiz'}
            </button>

            <button
              onClick={() => navigate('/create')}
              className="px-6 py-4 bg-gray-200 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Voltar
            </button>
          </div>

          {/* Info Box */}
          {questions.length === 0 && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-400">
                <p className="font-bold mb-1">Dica:</p>
                <ul className="space-y-1">
                  <li>• Adicione perguntas claras e objetivas</li>
                  <li>• Cada pergunta deve ter 4 opções de resposta</li>
                  <li>• Marque a resposta correta usando o botão de rádio</li>
                  <li>• Você pode reordenar as perguntas usando as setas</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className={`${
            toastType === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px]`}>
            <div className="flex-shrink-0">
              {toastType === 'success' ? (
                <CheckCircle className="w-6 h-6" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}
            </div>
            <div>
              <p className="font-bold text-lg">{toastType === 'success' ? 'Sucesso!' : 'Erro!'}</p>
              <p className="text-sm">{toastMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl p-6 max-w-md w-full border border-gray-200 dark:border-dark-border">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertCircle className="w-12 h-12 text-yellow-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
                  Poucas Perguntas
                </h3>
                <p className="text-gray-600 dark:text-dark-text-secondary mb-6">
                  Seu quiz tem menos de 3 perguntas. Deseja continuar mesmo assim?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      setShowConfirmModal(false);
                      if (validateQuestions()) {
                        saveQuiz();
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors font-medium"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditQuiz;
