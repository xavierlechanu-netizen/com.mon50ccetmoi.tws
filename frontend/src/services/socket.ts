import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://fifty-cc.preview.emergentagent.com';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect() {
    if (this.socket?.connected) return;

    try {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        path: '/api/socket.io/',
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        console.log('Socket connected');
        this.socket?.emit('join_map', {});
      });

      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      this.socket.on('connect_error', (err) => {
        console.log('Socket connection error:', err.message);
      });

      this.socket.on('new_signal', (data) => {
        this.emit('new_signal', data);
      });

      this.socket.on('signal_updated', (data) => {
        this.emit('signal_updated', data);
      });

      this.socket.on('signal_deleted', (data) => {
        this.emit('signal_deleted', data);
      });
    } catch (error) {
      console.log('Socket init error:', error);
    }
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(data));
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  off(event: string, callback: (data: any) => void) {
    this.listeners.get(event)?.delete(callback);
  }
}

export const socketService = new SocketService();
