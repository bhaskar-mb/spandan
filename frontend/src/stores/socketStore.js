import { create } from 'zustand'
import { io } from 'socket.io-client'
import { SOCKET_URL, SOCKET_PATH } from '../config.js'
import useAuthStore from './authStore.js'

export const useSocketStore = create((set, get) => ({
  socket: null,
  isConnected: false,
  currentRoom: null,
  participants: 0,
  randomQuestion: null,
  // The room we should belong to. Kept across reconnects (unlike currentRoom, which is cleared
  // on disconnect) so the 'connect' handler can auto-rejoin after a dropped socket. Cleared only
  // on an explicit leaveRoom()/disconnect().
  joinedRoom: null,

  connect: (token) => {
    const { socket: existingSocket } = get()
    if (existingSocket) {
      if (existingSocket.connected) {
        console.log('Socket already connected, re-authenticating if token provided')
        if (token) {
          existingSocket.emit('authenticate', { token })
        }
        set({ isConnected: true })
        return
      }
      // If socket exists but is disconnected, clean up before creating a new socket instance
      existingSocket.removeAllListeners()
      existingSocket.disconnect()
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    })

    socket.on('connect', () => {
      console.log('Socket connected')
      set({ isConnected: true })
      if (token) {
        socket.emit('authenticate', { token })
      }
      const { joinedRoom } = get()
      if (joinedRoom?.roomCode) {
        socket.emit('room:join', { roomCode: joinedRoom.roomCode, userId: joinedRoom.userId })
      }
    })

    socket.io.on('reconnect', (attempt) => {
      console.log('Socket reconnected after attempt:', attempt)
      set({ isConnected: true })
      if (token) {
        socket.emit('authenticate', { token })
      }
      const { joinedRoom } = get()
      if (joinedRoom?.roomCode) {
        socket.emit('room:join', { roomCode: joinedRoom.roomCode, userId: joinedRoom.userId })
      }
    })

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      set({ isConnected: false })
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error?.message || error)
      set({ isConnected: false })
    })

    socket.on('authenticated', (data) => {
      if (!data.success) {
        console.error('Socket authentication failed:', data.error)
        if (data.expired) {
          useAuthStore.getState().handleSessionExpired()
        }
      } else {
        set({ isConnected: true })
      }
    })

    socket.on('room:joined', (data) => {
      console.log('Joined room:', data)
      set({ 
        currentRoom: data.roomCode,
        participants: data.participants || 0
      })
    })

    socket.on('room:left', (data) => {
      console.log('Left room:', data)
      set({ 
        currentRoom: null,
        participants: 0
      })
    })

    socket.on('question:started', (data) => {
      console.log('Question started:', data)
    })

    socket.on('question:ended', (data) => {
      console.log('Question ended:', data)
    })

    socket.on('response:new', (data) => {
      console.log('New response:', data)
    })

    socket.on('leaderboard:updated', (data) => {
      console.log('Leaderboard updated:', data)
    })

    socket.on('new_question', (data) => {
      console.log('New question received:', data)
      // Extract structured question object if nested, or build standard object if raw text
      const qObj = (data && data.question && typeof data.question === 'object')
        ? data.question
        : ((data && typeof data === 'object' && data.question)
          ? data
          : (typeof data === 'string' ? { question: data, type: 'MCQ', options: [] } : data))
      set({ randomQuestion: qObj })
    })

    set({ socket })
  },

  disconnect: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, isConnected: false, currentRoom: null, joinedRoom: null })
    }
  },

  joinRoom: (roomCode, userId) => {
    const { socket } = get()
    // Remember the room so the socket auto-rejoins after a reconnect (see the 'connect' handler).
    set({ joinedRoom: { roomCode, userId } })
    if (socket) {
      socket.emit('room:join', { roomCode, userId })
    }
  },

  leaveRoom: (roomCode, userId) => {
    const { socket } = get()
    // Deliberate leave — stop auto-rejoining on future reconnects.
    set({ joinedRoom: null })
    if (socket) {
      socket.emit('room:leave', { roomCode, userId })
      set({ currentRoom: null, participants: 0 })
    }
  },

  submitResponse: (data) => {
    const { socket } = get()
    if (socket) {
      socket.emit('response:submit', data)
    }
  },

  startQuestion: (data) => {
    const { socket } = get()
    if (socket) {
      socket.emit('question:start', data)
    }
  },

  endQuestion: (data) => {
    const { socket } = get()
    if (socket) {
      socket.emit('question:end', data)
    }
  },

  clearRandomQuestion: () => {
    set({ randomQuestion: null })
  },
}))

export default useSocketStore