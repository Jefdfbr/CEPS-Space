import { useEffect, useRef, useState, useCallback } from 'react';

export const useRoomWebSocket = (roomId, onMessage) => {
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const onMessageRef = useRef(onMessage);

  // Atualizar ref do callback sem causar reconexão
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!roomId) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Fechar conexão existente antes de criar nova
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        return;
      }
      wsRef.current.close();
      return;
    }

    // Verificar se tem token ou session_id
    const token = localStorage.getItem('token');
    const sessionId = localStorage.getItem('session_id');
    
    if (!token && !sessionId) {
      return;
    }

    // WebSocket URL baseada no host atual da aplicação
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = window.location.host;
    
    // Adicionar token ou session_id como query parameter
    // WebSocket não suporta headers customizados, então enviamos via query string
    let queryParam = '';
    if (token) {
      queryParam = `?token=${token}`;
    } else if (sessionId) {
      queryParam = `?session_id=${sessionId}`;
    }
    
    const wsUrl = `${wsProtocol}://${wsHost}/api/rooms/${roomId}/ws${queryParam}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (onMessageRef.current) {
            onMessageRef.current(message);
          }
        } catch (error) {
          // Silenciar erro
        }
      };

      ws.onerror = (error) => {
        // Silenciar erro
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Tentar reconectar continuamente enquanto o hook estiver ativo
        if (shouldReconnectRef.current) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, Math.min(reconnectAttemptsRef.current, 5)), 30000);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      // Silenciar erro
    }
  }, [roomId]);

  // Enviar mensagem
  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Conectar ao montar
  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    const handleOnline = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connect();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
        connect();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup ao desmontar
    return () => {
      shouldReconnectRef.current = false;
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected,
    sendMessage,
    reconnect: connect
  };
};
