import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

function CreateKahoot() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [gameData, setGameData] = useState({
    title: '',
    description: '',
    presenter_password: '',
    room_password: ''
  });

  // Carregar dados do localStorage
  useEffect(() => {
    const tempData = localStorage.getItem('tempGameData');
    if (tempData) {
      const data = JSON.parse(tempData);
      setGameData(prev => ({
        ...prev,
        title: data.name || '',
        description: data.description || ''
      }));
      localStorage.removeItem('tempGameData');
    }
  }, []);

  const showNotification = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const [questions, setQuestions] = useState([
    {
      question_text: '',
      options: [
        { option_text: '', is_correct: false, points: 100 },
        { option_text: '', is_correct: false, points: 50 },
        { option_text: '', is_correct: false, points: 0 },
        { option_text: '', is_correct: false, points: 0 }
      ]
    }
  ]);

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: '',
        options: [
          { option_text: '', is_correct: false, points: 100 },
          { option_text: '', is_correct: false, points: 50 },
          { option_text: '', is_correct: false, points: 0 },
          { option_text: '', is_correct: false, points: 0 }
        ]
      }
    ]);
  };

  const handleRemoveQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const handleOptionChange = (questionIndex, optionIndex, field, value) => {
    const newQuestions = [...questions];
    
    // Se marcou como correta, desmarcar as outras
    if (field === 'is_correct' && value) {
      newQuestions[questionIndex].options.forEach((opt, i) => {
        opt.is_correct = i === optionIndex;
      });
    } else {
      newQuestions[questionIndex].options[optionIndex][field] = value;
    }
    
    setQuestions(newQuestions);
  };

  const validateForm = () => {
    if (!gameData.title.trim()) {
      showNotification('Por favor, insira um título para o jogo', 'error');
      return false;
    }

    if (!gameData.presenter_password.trim()) {
      showNotification('Por favor, defina uma senha de apresentador', 'error');
      return false;
    }

    if (!gameData.room_password.trim()) {
      showNotification('Por favor, defina uma senha para os jogadores', 'error');
      return false;
    }

    if (gameData.presenter_password === gameData.room_password) {
      showNotification('A senha do apresentador deve ser diferente da senha dos jogadores', 'error');
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      if (!q.question_text.trim()) {
        showNotification(`Por favor, preencha a pergunta ${i + 1}`, 'error');
        return false;
      }

      const hasCorrect = q.options.some(opt => opt.is_correct);
      if (!hasCorrect) {
        showNotification(`Por favor, marque pelo menos uma resposta correta na pergunta ${i + 1}`, 'error');
        return false;
      }

      const emptyOptions = q.options.filter(opt => !opt.option_text.trim());
      if (emptyOptions.length > 0) {
        showNotification(`Por favor, preencha todas as alternativas da pergunta ${i + 1}`, 'error');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        ...gameData,
        questions: questions.map((q, index) => ({
          ...q,
          question_order: index,
          options: q.options.map((opt, optIndex) => ({
            ...opt,
            option_order: optIndex
          }))
        }))
      };

      const response = await api.post('/protected/kahoot/games', payload, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      showNotification('Jogo criado com sucesso!');
      setTimeout(() => {
        navigate('/my-games');
      }, 1500);
    } catch (error) {
      showNotification('Erro ao criar jogo: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-dark-elevated rounded-xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/my-games')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-surface rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary">
                Criar Jogo Kahoot
              </h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Informações do Jogo */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text-primary">
                Informações do Jogo
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                  Título do Jogo *
                </label>
                <input
                  type="text"
                  value={gameData.title}
                  onChange={(e) => setGameData({ ...gameData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-surface dark:text-dark-text-primary"
                  placeholder="Ex: Quiz de Geografia"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                  Descrição
                </label>
                <textarea
                  value={gameData.description}
                  onChange={(e) => setGameData({ ...gameData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-surface dark:text-dark-text-primary"
                  placeholder="Descrição do jogo..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                    Senha do Apresentador *
                  </label>
                  <input
                    type="text"
                    value={gameData.presenter_password}
                    onChange={(e) => setGameData({ ...gameData, presenter_password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-surface dark:text-dark-text-primary"
                    placeholder="Senha para controlar o jogo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                    Senha dos Jogadores *
                  </label>
                  <input
                    type="text"
                    value={gameData.room_password}
                    onChange={(e) => setGameData({ ...gameData, room_password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-surface dark:text-dark-text-primary"
                    placeholder="Senha para os jogadores"
                  />
                </div>
              </div>
            </div>

            {/* Perguntas */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text-primary">
                  Perguntas
                </h2>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Pergunta
                </button>
              </div>

              {questions.map((question, qIndex) => (
                <div key={qIndex} className="border border-gray-200 dark:border-dark-border rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text-primary">
                      Pergunta {qIndex + 1}
                    </h3>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIndex)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                      Texto da Pergunta *
                    </label>
                    <textarea
                      value={question.question_text}
                      onChange={(e) => handleQuestionChange(qIndex, 'question_text', e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-surface dark:text-dark-text-primary"
                      placeholder="Digite a pergunta..."
                    />
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-400">
                      💡 <strong>Dica:</strong> O tempo para responder é controlado pelo apresentador durante o jogo. 
                      Defina os pontos de cada alternativa abaixo.
                    </p>
                  </div>

                  {/* Alternativas */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary">
                      Alternativas * (marque as corretas e defina pontos)
                    </label>
                    
                    {question.options.map((option, oIndex) => (
                      <div key={oIndex} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={option.is_correct}
                          onChange={(e) => handleOptionChange(qIndex, oIndex, 'is_correct', e.target.checked)}
                          className="w-4 h-4 text-green-600"
                        />
                        <span className="font-medium text-gray-700 dark:text-dark-text-secondary w-8">
                          {String.fromCharCode(65 + oIndex)}.
                        </span>
                        <input
                          type="text"
                          value={option.option_text}
                          onChange={(e) => handleOptionChange(qIndex, oIndex, 'option_text', e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-surface dark:text-dark-text-primary"
                          placeholder={`Alternativa ${String.fromCharCode(65 + oIndex)}`}
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600 dark:text-dark-text-secondary whitespace-nowrap">
                            Pontos:
                          </label>
                          <input
                            type="number"
                            value={option.points}
                            onChange={(e) => handleOptionChange(qIndex, oIndex, 'points', parseInt(e.target.value) || 0)}
                            min="0"
                            max="1000"
                            step="10"
                            className="w-24 px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-surface dark:text-dark-text-primary"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Botões */}
            <div className="flex gap-4 justify-end pt-6 border-t border-gray-200 dark:border-dark-border">
              <button
                type="button"
                onClick={() => navigate('/my-games')}
                className="px-6 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text-secondary rounded-lg hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Salvando...' : 'Criar Jogo'}
              </button>
            </div>
          </form>
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
    </div>
  );
}

export default CreateKahoot;
