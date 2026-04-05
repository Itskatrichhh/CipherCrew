const { socketAuthMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const Message = require('../models/Message');
const { activeGames } = require('../routes/games');

function setupSocket(io) {
  // Auth middleware
  io.use(socketAuthMiddleware);

  io.on('connection', async (socket) => {
    console.log(`✅ User connected: ${socket.user.displayName} (${socket.userId})`);

    // Update user status
    try {
      await User.findByIdAndUpdate(socket.userId, {
        status: 'online',
        socketId: socket.id,
        lastSeen: new Date()
      });

      // Auto-join all rooms this user is a part of to receive instant messages everywhere
      const Room = require('../models/Room');
      const userRooms = await Room.find({ 'members.user': socket.userId, isActive: true });
      userRooms.forEach(room => {
        socket.join(room._id.toString());
      });
    } catch (err) {
      console.error('Error updating user status or joining rooms:', err);
    }

    // Broadcast online status
    socket.broadcast.emit('user_status', {
      userId: socket.userId,
      status: 'online',
      lastSeen: new Date()
    });

    // Join room
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      socket.to(roomId).emit('user_joined', {
        userId: socket.userId,
        username: socket.user.username,
        displayName: socket.user.displayName,
        roomId
      });
    });

    // Leave room
    socket.on('leave_room', (roomId) => {
      socket.leave(roomId);
      socket.to(roomId).emit('user_left', {
        userId: socket.userId,
        username: socket.user.username,
        displayName: socket.user.displayName,
        roomId
      });
    });

    // Typing indicators
    socket.on('typing_start', ({ roomId }) => {
      socket.to(roomId).emit('user_typing', {
        userId: socket.userId,
        username: socket.user.username,
        displayName: socket.user.displayName,
        isTyping: true,
        roomId
      });
    });

    socket.on('typing_stop', ({ roomId }) => {
      socket.to(roomId).emit('user_typing', {
        userId: socket.userId,
        username: socket.user.username,
        displayName: socket.user.displayName,
        isTyping: false,
        roomId
      });
    });

    // Chat messaging fallback (direct socket)
    socket.on('new_message', (data) => {
      // Broadcast to everyone else in the room
      socket.to(data.roomId).emit('new_message', data);
    });

    // ========== CALL EVENTS ==========

    socket.on('call_initiate', ({ roomId, callType, targetUserId }) => {
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      if (targetUserId) {
        // Direct call to specific user
        io.to(getSocketId(targetUserId)).emit('incoming_call', {
          callId,
          callType,
          roomId,
          caller: {
            userId: socket.userId,
            username: socket.user.username,
            displayName: socket.user.displayName
          }
        });
      } else {
        // Group call - notify all room members
        socket.to(roomId).emit('incoming_call', {
          callId,
          callType,
          roomId,
          caller: {
            userId: socket.userId,
            username: socket.user.username,
            displayName: socket.user.displayName
          }
        });
      }
    });

    socket.on('call_accept', ({ callId }) => {
      socket.broadcast.emit('call_accepted', {
        callId,
        userId: socket.userId,
        username: socket.user.username,
        displayName: socket.user.displayName
      });
    });

    socket.on('call_reject', ({ callId }) => {
      socket.broadcast.emit('call_rejected', {
        callId,
        userId: socket.userId,
        displayName: socket.user.displayName
      });
    });

    socket.on('call_end', ({ callId }) => {
      socket.broadcast.emit('call_ended', {
        callId,
        userId: socket.userId
      });
    });

    // ========== WEBRTC SIGNALING ==========

    socket.on('webrtc_offer', ({ callId, offer, targetUserId }) => {
      const targetSocketId = getSocketId(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc_offer', {
          callId,
          offer,
          fromUserId: socket.userId
        });
      }
    });

    socket.on('webrtc_answer', ({ callId, answer, targetUserId }) => {
      const targetSocketId = getSocketId(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc_answer', {
          callId,
          answer,
          fromUserId: socket.userId
        });
      }
    });

    socket.on('webrtc_ice_candidate', ({ callId, candidate, targetUserId }) => {
      const targetSocketId = getSocketId(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc_ice_candidate', {
          callId,
          candidate,
          fromUserId: socket.userId
        });
      }
    });

    // ========== WATCH PARTY ==========

    socket.on('watchparty_create', ({ roomId, videoUrl, platform }) => {
      const partyId = `party_${Date.now()}`;
      socket.join(partyId);
      
      socket.to(roomId).emit('watchparty_created', {
        partyId,
        roomId,
        videoUrl,
        platform,
        host: {
          userId: socket.userId,
          displayName: socket.user.displayName
        }
      });
    });

    socket.on('watchparty_join', ({ partyId }) => {
      socket.join(partyId);
      io.to(partyId).emit('watchparty_joined', {
        partyId,
        user: {
          userId: socket.userId,
          displayName: socket.user.displayName
        }
      });
    });

    socket.on('watchparty_sync', ({ partyId, state, currentTime }) => {
      socket.to(partyId).emit('watchparty_sync', {
        partyId,
        state,
        currentTime,
        fromUserId: socket.userId
      });
    });

    // ========== SCREEN SHARE ==========

    socket.on('screenshare_start', ({ roomId }) => {
      socket.to(roomId).emit('screenshare_started', {
        roomId,
        userId: socket.userId,
        displayName: socket.user.displayName
      });
    });

    socket.on('screenshare_stop', ({ roomId }) => {
      socket.to(roomId).emit('screenshare_stopped', {
        roomId,
        userId: socket.userId
      });
    });

    // ========== GAME EVENTS ==========

    socket.on('game_create', ({ gameType, maxPlayers }) => {
      const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const game = {
        id: gameId,
        type: gameType,
        host: socket.userId,
        hostName: socket.user.displayName,
        maxPlayers: maxPlayers || 4,
        players: [{
          userId: socket.userId,
          username: socket.user.username,
          displayName: socket.user.displayName,
          ready: false
        }],
        status: 'waiting',
        createdAt: new Date()
      };

      activeGames.set(gameId, game);
      socket.join(gameId);

      socket.emit('game_created', { game });
      socket.broadcast.emit('game_created', { game });
    });

    socket.on('game_join', ({ gameId }) => {
      const game = activeGames.get(gameId);
      if (!game) return;

      if (game.players.length >= game.maxPlayers) {
        socket.emit('game_error', { error: 'Game is full' });
        return;
      }

      const alreadyJoined = game.players.find(p => p.userId === socket.userId);
      if (!alreadyJoined) {
        game.players.push({
          userId: socket.userId,
          username: socket.user.username,
          displayName: socket.user.displayName,
          ready: false
        });
      }

      socket.join(gameId);
      io.to(gameId).emit('player_joined', {
        gameId,
        player: {
          userId: socket.userId,
          username: socket.user.username,
          displayName: socket.user.displayName
        },
        game
      });
    });

    socket.on('game_ready', ({ gameId, ready }) => {
      const game = activeGames.get(gameId);
      if (!game) return;

      const player = game.players.find(p => p.userId === socket.userId);
      if (player) {
        player.ready = ready;
      }

      io.to(gameId).emit('player_ready', {
        gameId,
        userId: socket.userId,
        ready,
        game
      });
    });

    socket.on('game_action', ({ gameId, action, data }) => {
      io.to(gameId).emit('game_action', {
        gameId,
        action,
        data,
        fromUserId: socket.userId,
        fromDisplayName: socket.user.displayName
      });
    });

    socket.on('game_state_update', ({ gameId, state }) => {
      const game = activeGames.get(gameId);
      if (game) {
        game.state = state;
        game.status = 'active';
      }
      io.to(gameId).emit('game_state', {
        gameId,
        state,
        updatedBy: socket.userId
      });
    });

    socket.on('game_leave', ({ gameId }) => {
      const game = activeGames.get(gameId);
      if (!game) return;

      game.players = game.players.filter(p => p.userId !== socket.userId);
      socket.leave(gameId);

      if (game.players.length === 0) {
        activeGames.delete(gameId);
      } else {
        io.to(gameId).emit('player_left', {
          gameId,
          userId: socket.userId,
          displayName: socket.user.displayName,
          game
        });
      }
    });

    // ========== DISCONNECT ==========

    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.user.displayName}`);

      try {
        await User.findByIdAndUpdate(socket.userId, {
          status: 'offline',
          socketId: null,
          lastSeen: new Date()
        });
      } catch (err) {
        console.error('Error updating disconnect status:', err);
      }

      socket.broadcast.emit('user_status', {
        userId: socket.userId,
        status: 'offline',
        lastSeen: new Date()
      });

      // Clean up games
      for (const [gameId, game] of activeGames) {
        game.players = game.players.filter(p => p.userId !== socket.userId);
        if (game.players.length === 0) {
          activeGames.delete(gameId);
        } else {
          io.to(gameId).emit('player_left', {
            gameId,
            userId: socket.userId,
            displayName: socket.user.displayName,
            game
          });
        }
      }
    });
  });

  // Helper: get socket ID for a user
  async function getSocketId(userId) {
    try {
      const user = await User.findById(userId).select('socketId');
      return user?.socketId || null;
    } catch {
      return null;
    }
  }
}

module.exports = setupSocket;
