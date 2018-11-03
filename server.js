const express = require('express');

const hubServer = require('./hub_api');

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
      socket.join(roomId);
      socket.emit('roomInfo', room)

      attachSocketEventListeners({ socket, roomId });

    } catch (err) {
      socket.emit('forceDisconnect');
      socket.disconnect();
      console.error(err)
    }
  })
  
  async function fetchCanvasData({ socket, roomId }) {
    try {
      const canvasRequestComplete = await requestCanvasDataFromPeers({ socket, roomId })
      if (!canvasRequestComplete) {
        // Fetch strokelog
        console.log("CANVAS REQUEST FAILED. FETCHING STROKELOG")
      }
    } catch (err) {
      throw err
    }
  }


  async function requestCanvasDataFromPeers({ socket, roomId }) {
    try {
      const peer = await getRandomPeer(roomId);
      if (!peer) return false;
      console.log("REQUESTING PEER", peer )
      socket.to(peer).emit('peersCanvasRequest', { id: socket.client.id });
      return true;
    } catch (err) {
      throw err;
    }
  }

  function getRandomPeer(roomId) {
    return new Promise((resolve, reject) => {
      io.in(roomId).clients((error, clients) => {
        console.log(clients)
        if (error) { reject(error) };
        if (!clients) { resolve(null) };
        const randIndex = Math.ceil(Math.random() * clients.length) - 1;
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

  function attachSocketEventListeners({ socket, roomId }) {
    attachCanvasEventListeners({ socket, roomId });
    attachRoomEventListenters({ socket, roomId });
    attachChatEventListeners({ socket, roomId });
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

    // Apparently this side knows that data is just a username str
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
      console.log(socket.client.id, " SENDING DATA TO PEER ", id)
      socket.to(id).emit('canvasDataReceived', { data })
    });
    ;
    socket.on('disconnect', () => {
      socket.broadcast.to(roomId).emit('peerLeft', { id: socket.client.id });
    });

  }

  function attachChatEventListeners({ socket, roomId }) {
    socket.on('chatMessageSent', ({ data }) => {
      socket.broadcast.to(roomId)
        .emit('peersChatMessageSent', { id: socket.client.id, data });
    })
  }

  function getAnonName() {
    return "anon_" + Math.random().toString(36).substring(7);
  }

})


