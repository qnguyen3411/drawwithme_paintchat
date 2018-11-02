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
      let user = await hubServer.getUserIdentity(data.token);
      if (user) {
        hubServer.recordJoin(roomId, user.id)
      };
      user = user || { username: getAnonName() };

      socket.join(roomId);
      socket.emit('roomInfo', room)
      socket.emit('assignedUsername', { username: user.username });
      socket.broadcast.to(roomId).emit('peerJoined',
        { username: user.username, id: socket.client.id })

      attachSocketEventListeners({ socket, roomId });

    } catch (err) {
      socket.emit('forceDisconnect');
      socket.disconnect();
      console.error(err)
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
      })

      socket.on('tokenConsumed', () => {
        hubServer.consumeTimeToken(roomId)
          .then(data => {
            io.to(roomId).emit('roomTokenConsumed', data)
          })
          .catch(err => {
            throw err;
          })
      })

      socket.on('disconnect', () => {
        socket.broadcast.to(roomId).emit('peerLeft', { id: socket.client.id });
      })
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

})


