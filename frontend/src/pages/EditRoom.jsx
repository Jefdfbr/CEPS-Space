import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { Users, Lock, Clock, Edit, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-react';

// Função para normalizar senha: remover acentos, ç e converter para minúsculas
const normalizarSenha = (senha) => {
  if (!senha) return '';
  return senha
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c');
};

function EditRoom() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [useSameAsName, setUseSameAsName] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [formData, setFormData] = useState({
    room_name: '',
    password: '',
    max_players: 50,
    duration_hours: 24,
    reactivate: false,
  });

  useEffect(() => {
    fetchRoomData();
  }, [roomId]);

  const fetchRoomData = async () => {
    try {
      const response = await api.get(`/protected/rooms/by-id/${roomId}`);
      const room = response.data;
      setRoomData(room);
      
      // Verificar se a sala está realmente fechada (is_active false OU expirada)
      const isExpired = room.expires_at && new Date(room.expires_at) < new Date();
      const isClosed = !room.is_active || isExpired;
      
      setFormData({
        room_name: room.room_name || '',
        password: '', // Senha não vem do backend (está em hash)
        max_players: room.max_players || 50,
        duration_hours: 24,
        reactivate: false,
      });
    } catch (error) {
      console.error('Erro ao buscar dados da sala:', error);
      alert('Erro ao carregar sala. Você será redirecionado.');
      navigate('/my-games');
    } finally {
      setLoading(false);
    }
  };

  const handleUseSameAsName = (checked) => {
    setUseSameAsName(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, password: normalizarSenha(prev.room_name) }));
    }
  };

  const handleRoomNameChange = (name) => {
    if (useSameAsName) {
      setFormData(prev => ({ ...prev, room_name: name, password: normalizarSenha(name) }));
    } else {
      setFormData(prev => ({ ...prev, room_name: name }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.room_name.length < 3) {
      alert('Nome da sala deve ter pelo menos 3 caracteres');
      return;
    }

    if (formData.password && formData.password.length < 3) {
      alert('Senha deve ter pelo menos 3 caracteres');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        room_name: formData.room_name,
        max_players: formData.max_players,
      };

      // Só envia senha se foi informada (já normalizada)
      if (formData.password) {
        payload.password = normalizarSenha(formData.password);
      }

      // Se reativar estiver marcado (sala fechada)
      if (formData.reactivate) {
        payload.duration_hours = formData.duration_hours;
        payload.reactivate = true;
      }
      // Se sala está ativa e duração foi alterada
      else if (roomData && roomData.is_active && formData.duration_hours !== 24) {
        payload.duration_hours = formData.duration_hours;
      }

      await api.put(`/protected/rooms/by-id/${roomId}`, payload);
      
      // Mostrar toast de sucesso
      setShowSuccessToast(true);
      
      // Redirecionar para Meus Jogos após 1.5 segundos
      setTimeout(() => {
        navigate('/my-games');
      }, 1500);
    } catch (error) {
      console.error('Erro ao atualizar sala:', error);
      const errorMessage = error.response?.data?.error || 'Erro ao atualizar sala. Tente novamente.';
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
          <p className="text-gray-600 dark:text-dark-text-secondary">Carregando sala...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg py-8 px-4 pt-24">
      <div className="container mx-auto max-w-2xl">
        <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate('/my-games')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-dark-text-secondary" />
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary flex items-center gap-2">
              <Edit className="w-8 h-8" />
              Editar Sala
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome da Sala */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                Nome da Sala *
              </label>
              <input
                type="text"
                value={formData.room_name}
                onChange={(e) => handleRoomNameChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-elevated dark:text-dark-text-primary"
                placeholder="Digite o nome da sala"
                required
                minLength={3}
              />
            </div>

            {/* Senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                Nova Senha (opcional)
              </label>
              <div className="space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Deixe em branco para manter a senha atual
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="useSameAsName"
                    checked={useSameAsName}
                    onChange={(e) => handleUseSameAsName(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="useSameAsName" className="text-sm text-gray-600 dark:text-dark-text-secondary">
                    Usar o mesmo nome da sala como senha
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => !useSameAsName && setFormData(prev => ({ ...prev, password: e.target.value }))}
                    disabled={useSameAsName}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-elevated dark:text-dark-text-primary disabled:bg-gray-100 dark:disabled:bg-dark-hover disabled:cursor-not-allowed"
                    placeholder="Digite uma nova senha ou deixe em branco"
                    minLength={3}
                  />
                </div>
              </div>
            </div>

            {/* Status da Sala e Reativação */}
            {(() => {
              const isExpired = roomData?.expires_at && new Date(roomData.expires_at) < new Date();
              const isClosed = !roomData?.is_active || isExpired;
              
              return isClosed && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <RefreshCw className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                        Esta sala está fechada
                      </h3>
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          id="reactivate"
                          checked={formData.reactivate}
                          onChange={(e) => setFormData(prev => ({ ...prev, reactivate: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="reactivate" className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                          Reativar esta sala
                        </label>
                      </div>
                      
                      {formData.reactivate && (
                        <div>
                          <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2">
                            Tempo que a sala ficará aberta
                          </label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-yellow-600 w-5 h-5" />
                            <input
                              type="number"
                              value={formData.duration_hours}
                              onChange={(e) => setFormData(prev => ({ ...prev, duration_hours: parseInt(e.target.value) }))}
                              min="1"
                              max="168"
                              className="w-full pl-10 pr-4 py-2 border border-yellow-300 dark:border-yellow-600 rounded-lg focus:ring-2 focus:ring-yellow-500 bg-white dark:bg-yellow-900/30 text-gray-900 dark:text-yellow-100"
                            />
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-yellow-600 dark:text-yellow-400">
                              horas
                            </span>
                          </div>
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                            A sala será reativada a partir de agora
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Duração da Sala (apenas para salas ativas) */}
            {(() => {
              const isExpired = roomData?.expires_at && new Date(roomData.expires_at) < new Date();
              const isActive = roomData?.is_active && !isExpired;
              
              return isActive && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                    Tempo que a sala ficará aberta
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="number"
                      value={formData.duration_hours}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration_hours: parseInt(e.target.value) }))}
                      min="1"
                      max="168"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-elevated dark:text-dark-text-primary"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                      horas
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Ajusta o tempo restante da sala a partir de agora
                  </p>
                </div>
              );
            })()}

            {/* Número máximo de jogadores */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                Número Máximo de Jogadores
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="number"
                  value={formData.max_players}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_players: parseInt(e.target.value) }))}
                  min="2"
                  max="100"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-dark-elevated dark:text-dark-text-primary"
                  required
                />
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/my-games')}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast de Sucesso */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px]">
            <div className="flex-shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-lg">Sala atualizada!</p>
              <p className="text-sm text-green-100">As alterações foram salvas com sucesso</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditRoom;
