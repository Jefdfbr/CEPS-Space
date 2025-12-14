import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Eye, Save, AlertCircle, ArrowUp, ArrowDown, ArrowRight, ArrowLeft, ArrowUpRight, ArrowUpLeft, ArrowDownRight, ArrowDownLeft, X, CheckCircle } from 'lucide-react';
import api from '../services/api';

const EditWordSearch = () => {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState(null);
  const [words, setWords] = useState([]);
  const [currentWord, setCurrentWord] = useState('');
  const [concepts, setConcepts] = useState({});
  const [showConceptInput, setShowConceptInput] = useState(false);
  const [currentConcept, setCurrentConcept] = useState('');
  const [editingWordConcept, setEditingWordConcept] = useState(null);
  const [gridSize, setGridSize] = useState(15);
  const [showPreview, setShowPreview] = useState(false);
  const [previewGrid, setPreviewGrid] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [endScreenText, setEndScreenText] = useState('Parabéns! Você completou o jogo!');
  const [endScreenButtonText, setEndScreenButtonText] = useState('');
  const [endScreenButtonUrl, setEndScreenButtonUrl] = useState('');
  const [endScreenButtonNewTab, setEndScreenButtonNewTab] = useState(true);
  const [showEndScreenButton, setShowEndScreenButton] = useState(false);
  const [selectedDirections, setSelectedDirections] = useState({
    up: true,
    down: true,
    left: true,
    right: true,
    upLeft: true,
    upRight: true,
    downLeft: true,
    downRight: true,
  });

  useEffect(() => {
    loadGameData();
  }, [gameId]);

  const loadGameData = async () => {
    try {
      setLoading(true);
      
      // Buscar dados do jogo
      const gameResponse = await api.get(`/protected/games/${gameId}`);
      const game = gameResponse.data;
      
      setGameData({
        name: game.name,
        description: game.description
      });

      // Buscar configuração do caça-palavras
      const configResponse = await api.get(`/word-search/${gameId}`);
      const config = configResponse.data;
      
      setGridSize(config.grid_size || 15);
      setEndScreenText(game.end_screen_text || 'Parabéns! Você encontrou todas as palavras!');
      setEndScreenButtonText(game.end_screen_button_text || '');
      setEndScreenButtonUrl(game.end_screen_button_url || '');
      setEndScreenButtonNewTab(game.end_screen_button_new_tab !== false);
      setShowEndScreenButton(!!(game.end_screen_button_text && game.end_screen_button_url));

      // Carregar palavras do campo words
      const loadedWords = config.words || [];
      setWords(loadedWords.map(w => w.toUpperCase()));
      
      // Carregar conceitos
      if (config.concepts) {
        setConcepts(config.concepts);
      }
      
      // Carregar direções permitidas
      if (config.allowed_directions) {
        const directions = config.allowed_directions;
        setSelectedDirections({
          up: directions.includes('up'),
          down: directions.includes('down'),
          left: directions.includes('left'),
          right: directions.includes('right'),
          upLeft: directions.includes('upLeft'),
          upRight: directions.includes('upRight'),
          downLeft: directions.includes('downLeft'),
          downRight: directions.includes('downRight'),
        });
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar jogo:', error);
      alert('Erro ao carregar dados do jogo');
      navigate('/my-games');
    }
  };

  const addWord = () => {
    const cleanWord = currentWord.trim().toUpperCase();
    
    if (!cleanWord) {
      alert('Digite uma palavra válida');
      return;
    }

    if (cleanWord.length < 3) {
      alert('A palavra deve ter pelo menos 3 letras');
      return;
    }

    if (cleanWord.length > gridSize) {
      alert(`A palavra não pode ter mais de ${gridSize} letras`);
      return;
    }

    if (!/^[A-Z]+$/.test(cleanWord)) {
      alert('Use apenas letras (sem acentos ou números)');
      return;
    }

    if (words.includes(cleanWord)) {
      alert('Esta palavra já foi adicionada');
      return;
    }

    setWords([...words, cleanWord]);
    
    if (showConceptInput && currentConcept.trim()) {
      setConcepts({
        ...concepts,
        [cleanWord]: currentConcept.trim()
      });
    }
    
    setCurrentWord('');
    setCurrentConcept('');
    setShowConceptInput(false);
  };

  const removeWord = (wordToRemove) => {
    setWords(words.filter((word) => word !== wordToRemove));
    const newConcepts = { ...concepts };
    delete newConcepts[wordToRemove];
    setConcepts(newConcepts);
  };

  const startEditingConcept = (word) => {
    setEditingWordConcept(word);
    setCurrentConcept(concepts[word] || '');
  };

  const saveWordConcept = (word) => {
    if (currentConcept.trim()) {
      setConcepts({
        ...concepts,
        [word]: currentConcept.trim()
      });
    } else {
      const newConcepts = { ...concepts };
      delete newConcepts[word];
      setConcepts(newConcepts);
    }
    setEditingWordConcept(null);
    setCurrentConcept('');
  };

  const cancelEditingConcept = () => {
    setEditingWordConcept(null);
    setCurrentConcept('');
  };

  const generateGrid = () => {
    if (words.length === 0) {
      alert('Adicione pelo menos uma palavra');
      return;
    }

    const grid = Array(gridSize).fill(null).map(() => 
      Array(gridSize).fill(null).map(() => ({ letter: '', placed: false }))
    );

    const directions = [];
    if (selectedDirections.right) directions.push({ dx: 0, dy: 1 });
    if (selectedDirections.left) directions.push({ dx: 0, dy: -1 });
    if (selectedDirections.down) directions.push({ dx: 1, dy: 0 });
    if (selectedDirections.up) directions.push({ dx: -1, dy: 0 });
    if (selectedDirections.downRight) directions.push({ dx: 1, dy: 1 });
    if (selectedDirections.downLeft) directions.push({ dx: 1, dy: -1 });
    if (selectedDirections.upRight) directions.push({ dx: -1, dy: 1 });
    if (selectedDirections.upLeft) directions.push({ dx: -1, dy: -1 });

    if (directions.length === 0) {
      alert('Selecione pelo menos uma direção permitida');
      return;
    }

    const sortedWords = [...words].sort((a, b) => b.length - a.length);
    const placedWords = [];

    for (const word of sortedWords) {
      let placed = false;
      const maxAttempts = 100;
      
      for (let attempt = 0; attempt < maxAttempts && !placed; attempt++) {
        const direction = directions[Math.floor(Math.random() * directions.length)];
        const startRow = Math.floor(Math.random() * gridSize);
        const startCol = Math.floor(Math.random() * gridSize);

        if (canPlaceWord(grid, word, startRow, startCol, direction)) {
          placeWord(grid, word, startRow, startCol, direction);
          placedWords.push(word);
          placed = true;
        }
      }

      if (!placed) {
        alert(`Não foi possível colocar a palavra "${word}". Tente aumentar o tamanho da grade ou reduzir o número de palavras.`);
        return;
      }
    }

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (!grid[i][j].placed) {
          grid[i][j].letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        }
      }
    }

    setPreviewGrid(grid);
    setShowPreview(true);
  };

  const canPlaceWord = (grid, word, startRow, startCol, direction) => {
    const { dx, dy } = direction;
    
    for (let i = 0; i < word.length; i++) {
      const row = startRow + (i * dx);
      const col = startCol + (i * dy);
      
      if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
        return false;
      }
      
      if (grid[row][col].placed && grid[row][col].letter !== word[i]) {
        return false;
      }
    }
    
    return true;
  };

  const placeWord = (grid, word, startRow, startCol, direction) => {
    const { dx, dy } = direction;
    
    for (let i = 0; i < word.length; i++) {
      const row = startRow + (i * dx);
      const col = startCol + (i * dy);
      grid[row][col] = { letter: word[i], placed: true };
    }
  };

  const handleSave = async () => {
    if (words.length === 0) {
      alert('Adicione pelo menos uma palavra');
      return;
    }

    if (!gameData || !gameData.name) {
      alert('Dados do jogo não carregados');
      return;
    }

    setSaving(true);

    try {
      // Atualizar dados do jogo
      await api.put(`/protected/games/${gameId}`, {
        name: gameData.name,
        description: gameData.description,
        game_type: 'word_search',
        is_active: true,
        end_screen_text: endScreenText,
        end_screen_button_text: showEndScreenButton ? endScreenButtonText : null,
        end_screen_button_url: showEndScreenButton ? endScreenButtonUrl : null,
        end_screen_button_new_tab: showEndScreenButton ? endScreenButtonNewTab : null,
      });

      // Atualizar configuração
      const allowedDirections = Object.keys(selectedDirections).filter(
        key => selectedDirections[key]
      );
      
      await api.put(`/protected/word-search/${gameId}`, {
        game_id: parseInt(gameId),
        grid_size: gridSize,
        words: words,
        time_limit: null,
        allowed_directions: allowedDirections,
        concepts: concepts,
      });

      // Mostrar toast de sucesso
      setShowSuccessToast(true);
      
      // Redirecionar para Meus Jogos após 1.5 segundos
      setTimeout(() => {
        navigate('/my-games');
      }, 1500);
    } catch (error) {
      console.error('Erro ao atualizar jogo:', error);
      alert('Erro ao atualizar o jogo. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDirection = (direction) => {
    setSelectedDirections(prev => ({
      ...prev,
      [direction]: !prev[direction]
    }));
  };

  const DirectionButton = ({ direction, icon: Icon, label }) => (
    <button
      type="button"
      onClick={() => toggleDirection(direction)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
        selectedDirections[direction]
          ? 'bg-blue-500 text-white border-blue-600 dark:bg-blue-600 dark:border-blue-700'
          : 'bg-white text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-dark-text-primary dark:border-gray-600'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-dark-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-dark-text-secondary">Carregando jogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-dark-text-primary mb-2">
          Editar Caça-Palavras
        </h1>
        <p className="text-gray-600 dark:text-dark-text-secondary">
          Edite as palavras e configurações do seu jogo
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configurações */}
        <div className="space-y-6">
          {/* Informações do Jogo */}
          <div className="bg-white dark:bg-dark-elevated rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-dark-text-primary flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Informações do Jogo
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                  Nome do Jogo
                </label>
                <input
                  type="text"
                  value={gameData?.name || ''}
                  onChange={(e) => setGameData({ ...gameData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-dark-text-primary"
                  placeholder="Ex: Animais da Floresta"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                  Descrição
                </label>
                <textarea
                  value={gameData?.description || ''}
                  onChange={(e) => setGameData({ ...gameData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-dark-text-primary"
                  rows="3"
                  placeholder="Descreva o tema do jogo..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                    Tamanho da Grade
                  </label>
                  <select
                    value={gridSize}
                    onChange={(e) => setGridSize(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-dark-text-primary"
                  >
                    <option value={10}>10x10</option>
                    <option value={12}>12x12</option>
                    <option value={15}>15x15</option>
                    <option value={20}>20x20</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Direções Permitidas */}
          <div className="bg-white dark:bg-dark-elevated rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-dark-text-primary">
              Direções Permitidas
            </h2>
            
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-dark-text-secondary mb-3">
                Selecione as direções em que as palavras podem aparecer:
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <DirectionButton direction="right" icon={ArrowRight} label="Direita →" />
                <DirectionButton direction="left" icon={ArrowLeft} label="Esquerda ←" />
                <DirectionButton direction="down" icon={ArrowDown} label="Baixo ↓" />
                <DirectionButton direction="up" icon={ArrowUp} label="Cima ↑" />
                <DirectionButton direction="downRight" icon={ArrowDownRight} label="Diagonal ↘" />
                <DirectionButton direction="downLeft" icon={ArrowDownLeft} label="Diagonal ↙" />
                <DirectionButton direction="upRight" icon={ArrowUpRight} label="Diagonal ↗" />
                <DirectionButton direction="upLeft" icon={ArrowUpLeft} label="Diagonal ↖" />
              </div>
            </div>
          </div>

          {/* Tela de Conclusão */}
          <div className="bg-white dark:bg-dark-elevated rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-dark-text-primary">
              Tela de Conclusão
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                  Mensagem de Conclusão
                </label>
                <textarea
                  value={endScreenText}
                  onChange={(e) => setEndScreenText(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-dark-text-primary"
                  rows="3"
                  placeholder="Mensagem que aparecerá quando o jogador completar o jogo..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showButton"
                  checked={showEndScreenButton}
                  onChange={(e) => setShowEndScreenButton(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="showButton" className="text-sm font-medium text-gray-700 dark:text-dark-text-primary">
                  Mostrar botão personalizado
                </label>
              </div>

              {showEndScreenButton && (
                <div className="space-y-3 pl-6 border-l-2 border-blue-500">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                      Texto do Botão
                    </label>
                    <input
                      type="text"
                      value={endScreenButtonText}
                      onChange={(e) => setEndScreenButtonText(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-dark-text-primary"
                      placeholder="Ex: Ver Certificado"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                      Link do Botão
                    </label>
                    <input
                      type="url"
                      value={endScreenButtonUrl}
                      onChange={(e) => setEndScreenButtonUrl(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-dark-text-primary"
                      placeholder="https://..."
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="newTab"
                      checked={endScreenButtonNewTab}
                      onChange={(e) => setEndScreenButtonNewTab(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-dark-elevated border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="newTab" className="text-sm font-medium text-gray-700 dark:text-dark-text-primary cursor-pointer">
                      Abrir em nova guia
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Palavras */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-dark-elevated rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-dark-text-primary">
              Palavras ({words.length})
            </h2>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={currentWord}
                onChange={(e) => setCurrentWord(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && addWord()}
                placeholder="Digite uma palavra"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-dark-text-primary"
                maxLength={gridSize}
              />
              <button
                onClick={addWord}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Adicionar
              </button>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="add-concept-edit"
                  checked={showConceptInput}
                  onChange={(e) => setShowConceptInput(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="add-concept-edit" className="text-sm font-medium text-gray-700 dark:text-dark-text-primary">
                  Adicionar conceito/definição
                </label>
              </div>

              {showConceptInput && (
                <textarea
                  value={currentConcept}
                  onChange={(e) => setCurrentConcept(e.target.value)}
                  placeholder="Digite o conceito ou definição da palavra..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                />
              )}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {words.map((word, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  {editingWordConcept === word ? (
                    // Modo de edição
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800 dark:text-dark-text-primary">
                          {word}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveWordConcept(word)}
                            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm transition-colors"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={cancelEditingConcept}
                            className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={currentConcept}
                        onChange={(e) => setCurrentConcept(e.target.value)}
                        placeholder="Digite o conceito ou definição da palavra..."
                        rows={3}
                        maxLength={500}
                        autoFocus
                        className="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500 resize-none text-sm"
                      />
                    </div>
                  ) : (
                    // Modo de visualização
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-800 dark:text-dark-text-primary">
                          {word}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditingConcept(word)}
                            className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                          >
                            {concepts[word] ? 'Editar conceito' : 'Adicionar conceito'}
                          </button>
                          <button
                            onClick={() => removeWord(word)}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      {concepts[word] && (
                        <p className="text-sm text-gray-600 dark:text-dark-text-secondary italic">
                          {concepts[word]}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}

              {words.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-dark-text-secondary">
                  Nenhuma palavra adicionada ainda
                </div>
              )}
            </div>

            <button
              onClick={generateGrid}
              disabled={words.length === 0}
              className="w-full mt-4 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Eye className="w-5 h-5" />
              Visualizar Grade
            </button>
          </div>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="mt-8 flex gap-4 justify-end">
        <button
          onClick={() => navigate('/my-games')}
          className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving || words.length === 0}
          className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-elevated rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-dark-text-primary">
                  Pré-visualização da Grade
                </h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-dark-text-secondary dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex justify-center mb-6">
                <div className="inline-block bg-gray-100 dark:bg-dark-surface p-4 rounded-lg">
                  <div className="grid gap-1" style={{ 
                    gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` 
                  }}>
                    {previewGrid.map((row, i) =>
                      row.map((cell, j) => (
                        <div
                          key={`${i}-${j}`}
                          className={`${
                            gridSize > 15 ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
                          } flex items-center justify-center font-bold bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 ${
                            cell.placed ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          {cell.letter}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 dark:text-dark-text-primary mb-2">
                  Palavras para encontrar:
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {words.map((word, index) => (
                    <div
                      key={index}
                      className="text-sm font-medium text-gray-700 dark:text-dark-text-primary"
                    >
                      • {word}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowPreview(false)}
                className="w-full mt-6 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Fechar Pré-visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast de Sucesso */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px]">
            <div className="flex-shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-lg">Jogo atualizado com sucesso!</p>
              <p className="text-sm text-green-100">Redirecionando...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditWordSearch;
