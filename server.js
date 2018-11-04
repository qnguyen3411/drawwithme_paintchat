const express = require('express');

const hubServer = require('./hub_api');
const recorderServer = require('./recorder_api');

const app = express();
const server = app.listen(5000);

// Set up stroke recorder
const recorderSocket = require('socket.io-client')('http://localhost:9000');
recorderSocket.on('connect', function () {
  console.log("CONNECTED WITH SOCKET SERVER")
})


const io = require('socket.io')(server);
// TODO: downgrade to lower socket version

io.on('connection', function (socket) {

  socket.on('join', async function (data) {
    try {
      const roomId = data.room;
      const room = await hubServer.getRoomInfo(roomId);

      fetchCanvasData({ socket, roomId });
      hubServer.recordJoin(roomId, data.token);
      resolveUser({ socket, roomId, token: data.token })
      socket.emit('roomInfo', room)
      socket.join(roomId);

      attachSocketEventListeners({ socket, roomId });

    } catch (err) {
      socket.emit('forceDisconnect');
      socket.disconnect();
      console.error(err)
    }
  })

  // Try to request canvas data from peers. If no peers, fetch a snapshot 
  async function fetchCanvasData({ socket, roomId }) {
    try {
      const peer = await getRandomPeer(roomId);
      if (!peer) {
        const data = await recorderServer.fetchSnapshot(roomId)
        if (data) {
          socket.emit('canvasDataReceived', { data })
        }
      } else {
        socket.to(peer).emit('peersCanvasRequest', { id: socket.client.id });
      }
    } catch (err) {
      throw err
    }
  }

  function getRandomPeer(roomId) {
    return new Promise((resolve, reject) => {
      io.in(roomId).clients((error, clients) => {
        if (error) { reject(error) };
        if (!clients) { resolve(null) };
        const randIndex = Math.floor(Math.random() * clients.length);
        resolve(clients[randIndex])
      })
    })
  }

  async function resolveUser({ socket, roomId, token }) {
    let user = await hubServer.getUserIdentity(token);
    user = user || { username: getAnonName() };
    socket.emit('assignedUsername', { username: user.username });
    socket.broadcast.to(roomId).emit('peerJoined',
      { username: user.username, id: socket.client.id })
  }

  function getAnonName() {
    return "anon_" + Math.random().toString(36).substring(7);
  }

  function attachSocketEventListeners({ socket, roomId }) {
    try {
      attachCanvasEventListeners({ socket, roomId });
      attachRoomEventListenters({ socket, roomId });
      attachChatEventListeners({ socket, roomId });
    } catch (err) {
      throw err;
    }
  }

  function attachCanvasEventListeners({ socket, roomId }) {
    const id = socket.client.id
    socket.on('cursorSizeUpdate', ({ data }) => {
      socket.broadcast.to(roomId)
        .emit('peersCursorSizeUpdate', { id, data });
    })

    socket.on('mousePosUpdate', ({ data }) => {
      socket.broadcast.to(roomId)
        .emit('peersMousePosUpdate', { id, data });
    })
    socket.on('canvasActionStart', ({ data }) => {
      socket.broadcast.to(roomId)
        .emit('peersCanvasActionStart', { id, data });
    })
    socket.on('canvasActionEnd', ({ data }) => {
      if (recorderSocket.connected) {
        recorderSocket.emit('write', { roomId, data });
      }
      socket.broadcast.to(roomId)
        .emit('peersCanvasActionEnd', { id });
    })
  }

  function attachRoomEventListenters({ socket, roomId }) {
    try {
      socket.on('shareInfoWithPeer', ({ id, data }) => {
        socket.to(id).emit('peerInfoShared', {
          id: socket.client.id,
          username: data
        });
      });

      socket.on('tokenConsumed', () => {
        hubServer.consumeTimeToken(roomId)
          .then(data => {
            io.to(roomId).emit('roomTokenConsumed', data)
          })
          .catch(err => {
            throw err;
          })
      });

      socket.on('canvasDataToPeer', ({ id, data }) => {
        socket.to(id).emit('canvasDataReceived', { data })
      });

      socket.on('timeOut', () => {
        if (recorderSocket.connected) {
          recorderSocket.emit('end', { roomId });
        }
        socket.emit('forceDisconnect');
        socket.disconnect();  
      })

      socket.on('disconnect', () => {
        socket.broadcast.to(roomId).emit('peerLeft', { id: socket.client.id });
      });

      socket.on('snapShot', ({ data }) => {
        recorderSocket.emit('snapShot', { roomId, data })
      })

    
    } catch (err) {
      throw err;
    }
  }

  function attachChatEventListeners({ socket, roomId }) {
    socket.on('chatMessageSent', ({ data }) => {
      socket.broadcast.to(roomId)
        .emit('peersChatMessageSent', { id: socket.client.id, data });
    })
  }



})


