import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  console.log(dev);

  const httpServer = createServer(handler);
  // const io = new Server(httpServer);
  const io = new Server(httpServer, {
    cors: {
      origin: !dev
        ? 'http://localhost:3000'
        : 'https://indian-codenames.vercel.app/',
      methods: ['GET', 'POST'],
    },
  });

  const roomStates = new Map();
  const wordListState = new Map();
  const clueState = new Map();
  const teamTurnState = new Map();

  // Initialize room state if it doesn't exist
  const initializeRoomState = (roomId) => {
    if (!roomStates.has(roomId)) {
      roomStates.set(roomId, {
        redTeam: [],
        redSpyMaster: [],
        blueTeam: [],
        blueSpyMaster: [],
        connectedUsers: new Set(),
      });
    }
    return roomStates.get(roomId);
  };

  const initializeWordListState = (roomId, wordList) => {
    // if (!wordListState.has(roomId)) {
    //   wordListState.set(roomId, wordList);
    // }
    wordListState.set(roomId, wordList);
    return wordListState.get(roomId);
  };

  const updateClueState = (roomId, clueText = null, clueOption = null) => {
    // if (roomId && clueText && clueOption !== null) {
    if (roomId) {
      clueState.set(roomId, {
        clueText: clueText,
        clueOption: clueOption,
      });
    }
    // }
    return clueState.get(roomId);
  };

  const updateTeamTurn = (roomId, team) => {
    if (roomId && team) {
      teamTurnState.set(roomId, team === 'blue' ? 'red' : 'blue');
    }
    return teamTurnState.get(roomId);
  };

  io.on('connection', (socket) => {
    if (socket) {
      console.log(`Socket connected: ${socket.id}`);
    }

    socket.on('message', (payload) => {
      // console.log('The first message is', payload);

      io.sockets.adapter.rooms.forEach((clients, roomId) => {
        console.log(`Room ${roomId} has ${clients.size} clients:`, [
          ...clients,
        ]);
      });
    });

    // Handle initial room join
    socket.on('join-socket-room', ({ roomId, nickName }) => {
      console.log('initial Room join');
      try {
        console.log(`User ${nickName} joined socket room ${roomId}`);

        socket.join(roomId);
        const roomState = initializeRoomState(roomId);
        roomState.connectedUsers.add(nickName);

        socket.emit('initial-state', {
          redTeam: roomState.redTeam,
          redSpyMaster: roomState.redSpyMaster,
          blueTeam: roomState.blueTeam,
          blueSpyMaster: roomState.blueSpyMaster,
          connectedUsers: [...roomState.connectedUsers],
        });
      } catch (error) {
        console.error('Error joining socket room:', error);
      }
    });

    socket.on('initialize-word-list', ({ roomId, wordList }) => {
      try {
        const existingWordList = initializeWordListState(roomId, wordList);

        // if (existingWordList === wordList) {
        io.to(roomId).emit('initial-word-list', {
          wordList: existingWordList,
        });
        // }
      } catch (error) {
        console.error('Error initialize word list:', error);
      }
    });

    socket.emit('update-remaining-team-card', ({ roomId }) => {
      try {
        console.log('emit 1');
        io.to(roomId).emit('updated-remaining-team-card', {
          roomId,
        });
      } catch (error) {
        console.error('Error update-remaining-team-card', error);
      }
    });

    socket.on(
      'update-word-state',
      ({ roomId, cardId, nickName, updatedWords }) => {
        try {
          // const wordState = wordListState.get(roomId);
          const existingWordList = initializeWordListState(
            roomId,
            updatedWords
          );

          if (existingWordList) {
            io.to(roomId).emit('update-word-list', {
              wordList: existingWordList,
            });
          }
        } catch (error) {
          console.error('Error updating word state:', error);
        }
        // try {
        //   const wordState = wordListState.get(roomId);

        //   if (wordState) {
        //     const card = wordState.find((item) => item.id === cardId);
        //     if (card) {
        //       if (card.selectors.includes(nickName)) {
        //         card.selectors = card.selectors.filter(
        //           (name) => name !== nickName
        //         );
        //       } else {
        //         card.selectors.push(nickName);
        //       }

        //       io.to(roomId).emit('update-word-list', { wordList: wordState });
        //     }
        //   }
        // } catch (error) {
        //   console.error('Error updating word state:', error);
        // }
      }
    );

    socket.on(
      'initialize-clue-name',
      async ({ roomId, clueText, clueOption }) => {
        try {
          // await socket.join(roomId);

          if (!roomId || !clueText || clueOption === null) {
            console.error('Missing required parameters:', {
              roomId,
              clueText,
              clueOption,
            });
            return;
          }

          const updatedClue = updateClueState(roomId, clueText, clueOption);
          // console.log('Updated clue state for room 1:', roomId, updatedClue);

          // Emit to all clients in the room including sender
          io.to(roomId).emit('initial-clue-word', {
            clueText: updatedClue.clueText,
            clueOption: updatedClue.clueOption,
          });
        } catch (error) {
          console.error('Error initialize clue word:', error);
        }
      }
    );

    socket.on('get-clue-word', ({ roomId }) => {
      const updatedClue = updateClueState(roomId);
      // console.log('Updated clue state for room 2:', roomId, updatedClue);

      io.to(roomId).emit('initial-clue-word', {
        clueText: updatedClue?.clueText,
        clueOption: updatedClue?.clueOption,
      });
    });

    socket.on('update-team-turn', ({ roomId, team }) => {
      if (roomId && team) {
        console.log('update-team-turn is called in server', roomId, team);
        const updatedTurn = updateTeamTurn(roomId, team);
        console.log('Updated Team Turn', roomId, updatedTurn);

        io.to(roomId).emit('updated-team-turn', {
          team: updatedTurn,
        });
      }
    });

    socket.on('room-info', (data) => {
      console.log('Room info:', data);
    });

    socket.on('join-room', ({ roomId, team, type, nickName }) => {
      try {
        console.log(
          `User ${socket.id} joined room ${roomId} as ${type} in ${team} team with nickName ${nickName}`
        );

        const roomState = initializeRoomState(roomId);
        // const userInfo = { userId: socket.id, nickName, type };

        // Remove from all teams first
        roomState.redTeam = roomState.redTeam.filter(
          (name) => name !== nickName
        );
        roomState.redSpyMaster = roomState.redSpyMaster.filter(
          (name) => name !== nickName
        );
        roomState.blueTeam = roomState.blueTeam.filter(
          (name) => name !== nickName
        );
        roomState.blueSpyMaster = roomState.blueSpyMaster.filter(
          (name) => name !== nickName
        );

        if (team === 'red') {
          if (type === 'operative') {
            roomState.redTeam.push(nickName);
          } else if (type === 'spymaster') {
            roomState.redSpyMaster.push(nickName);
          }
        } else {
          if (type === 'operative') {
            roomState.blueTeam.push(nickName);
          } else if (type === 'spymaster') {
            roomState.blueSpyMaster.push(nickName);
          }
        }

        socket
          .to(roomId)
          .emit('new-user', { userId: socket.id, team, type, nickName });

        // Get room info
        const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);

        io.to(roomId).emit('room-info', { roomId, clients });

        socket.emit('join-confirmed', { roomId });
      } catch (error) {
        console.error('Error in join-room handler:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('leave-room', ({ roomId, team, type, nickName }) => {
      try {
        const roomState = roomStates.get(roomId);
        if (roomState) {
          // Remove user from room state
          if (team === 'red') {
            if (type === 'operative') {
              roomState.redTeam = roomState.redTeam.filter(
                (user) => user.nickName !== nickName
              );
            } else if (type === 'spymaster') {
              roomState.redSpyMaster = roomState.redSpyMaster.filter(
                (user) => user.nickName !== nickName
              );
            }
          } else {
            if (type === 'operative') {
              roomState.blueTeam = roomState.blueTeam.filter(
                (user) => user.nickName !== nickName
              );
            } else if (type === 'spymaster') {
              roomState.blueSpyMaster = roomState.blueSpyMaster.filter(
                (user) => user.nickName !== nickName
              );
            }
          }

          io.to(roomId).emit('room-state', roomState);
        }
      } catch (error) {
        console.error('Error in leave-room handler:', error);
      }
    });

    // Logging all rooms whenever a client connects
    io.sockets.adapter.rooms.forEach((clients, roomId) => {
      console.log(`Room ${roomId} has ${clients.size} clients:`, [...clients]);
    });

    // Leaving room or disconnecting
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);

      // Iterate over all rooms and find the user's data to remove them
      for (const [roomId, roomState] of roomStates.entries()) {
        if (roomState.connectedUsers.has(socket.id)) {
          roomState.connectedUsers.delete(socket.id);

          // Remove the user from all teams
          roomState.redTeam = roomState.redTeam.filter(
            (name) => name !== nickName
          );
          roomState.redSpyMaster = roomState.redSpyMaster.filter(
            (name) => name !== nickName
          );
          roomState.blueTeam = roomState.blueTeam.filter(
            (name) => name !== nickName
          );
          roomState.blueSpyMaster = roomState.blueSpyMaster.filter(
            (name) => name !== nickName
          );

          // Notify clients in the room about the user's disconnection
          io.to(roomId).emit('user-disconnected', {
            userId: socket.id,
            nickName,
            roomId,
            redTeam: roomState.redTeam,
            redSpyMaster: roomState.redSpyMaster,
            blueTeam: roomState.blueTeam,
            blueSpyMaster: roomState.blueSpyMaster,
          });

          // Clean up roomState if empty (optional)
          if (roomState.connectedUsers.size === 0) {
            roomStates.delete(roomId);
          }

          break;
        }
      }
    });

    socket.on('add', (payload) => {
      io.emit('add', payload);
    });

    socket.on('minus', (payload) => {
      io.emit('minus', payload);
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
