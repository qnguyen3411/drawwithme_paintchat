require('dotenv').config()
const express = require('express');

const hubServer = require('./hub_api');
const recorderServer = require('./recorder_api');

const app = express();
const server = app.listen(5000, () => {
  console.log("LISTENING ON 5000")
});


const io = require('socket.io')(server);
// TODO: downgrade to lower socket version

setInterval(pollRooms, 20000)

function pollRooms() {
  Object.entries(io.sockets.adapter.rooms)
    .filter(([roomId, sockets]) => !isNaN(roomId))
    .map(([roomId, {sockets}]) => {
      // Pick random socket in room
      const socketsInRoom = Object.keys(sockets);
      const randomSid = socketsInRoom[Math.floor(Math.random() * socketsInRoom.length)];
      io.to(randomSid).emit('snapShotPoll', {roomId: roomId});
    });
    io.emit('snapShotPollFinish');
}

io.on('connection', function (socket) {

  socket.on('join', async function (data) {
    try {
      const roomId = data.room;
      const room = await hubServer.getRoomInfo(roomId);
      socket.emit('roomInfo', room);
      
      fetchCanvasData({ socket, roomId });
      hubServer.recordJoin(roomId, data.token);
      resolveUser(data.token)
        .then(user => {
          socket.emit('assignedUsername', { username: user.username });
          socket.broadcast.to(roomId).emit('peerJoined',
            { username: user.username, id: socket.client.id })
        })
        .catch(err => { console.log(err) })

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
        socket.emit('snapShotFetch', {url: process.env.SNAPSHOT_SERVER_ENDPOINT + `/snapshots/${roomId}_snapshot.png`});
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

  async function resolveUser(token) {
    try {
      let user = await hubServer.getUserIdentity(token);
      user = user || { username: getAnonName() };
      return user;

     } catch (err) {
      return { username: getAnonName() };
     }
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

      recorderServer.recordStroke(roomId, data)
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
        socket.to(id).binary(true).emit('canvasDataReceived', { data })
      });

      socket.on('timeOut', () => {

        recorderServer.signalEnd(roomId);
        socket.emit('forceDisconnect');
        socket.disconnect();
      })

      socket.on('disconnect', () => {
        socket.broadcast.to(roomId).emit('peerLeft', { id: socket.client.id });
      });

      socket.on('snapShot', ({data}) => {
        recorderServer.signalSnapshot({roomId, data});
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
