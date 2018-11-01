const express = require('express');

const hubServer = require('./hub_api');

const app = express()
const server = app.listen(5000, () => {
  console.log("LISTENING")
})


const io = require('socket.io')(server);
// TODO: downgrade to lower socket version
let rooms = {};

io.on('connection', function (socket) {

  let currRoom;

  socket.on('join', async function (data) {
    try {
      // Authenticate join info
      const roomId = data.room;
      const room = await hubServer.getRoomInfo(roomId);
      if (!room) { throw new Error('Room not found') }

      socket.emit('roomInfo', room);

      currRoom = roomId;
      rooms[roomId] = rooms[roomId] || {};
      // TODO: maybe is possible to have another socket give userlist to us
      socket.emit('userList', rooms[roomId]);
      let user = await hubServer.getUserIdentity(data.token);
      if (user) {
        // TODO: implement recordJoin
        hubServer.recordJoin(user.id, roomId);
      } else {
        user = {username: getAnonName()};
      }


      rooms[roomId][socket.client.id] = { username: user.username };
      socket.emit('assignedUsername', { username: user.username });
      socket.broadcast.to(currRoom).emit('peerJoined', {
         username: user.username, id: socket.client.id 
        });

      socket.join(currRoom);
      
    } catch (err) {
      forceDisconnect()
      console.log(err)
    }
  })



  socket.on('disconnect', () => {
    socket.broadcast.to(currRoom).emit('peerLeft', { id: socket.client.id });
    if (rooms[currRoom] && rooms[currRoom][socket.client.id]) {
      delete rooms[currRoom][socket.client.id];
    }
  })

  socket.on('tokenConsumed', () => {
    hubServer.consumeTimeToken(currRoom)
      .then(data => {
        io.to(currRoom).emit('tokenConsumed', data)
      })
      .catch(err => {
        console.log(err)
      })
  })


  socket.on('cursorSizeUpdate', ({ data }) => {
    socket.broadcast.to(currRoom).emit('peersCursorSizeUpdate', { id: socket.client.id, data });
  })

  socket.on('mousePosUpdate', ({ data }) => {
    socket.broadcast.to(currRoom).emit('peersMousePosUpdate', { id: socket.client.id, data });
  })
  socket.on('canvasActionStart', ({ data }) => {
    socket.broadcast.to(currRoom).emit('peersCanvasActionStart', { id: socket.client.id, data });
  })
  socket.on('canvasActionEnd', ({ data }) => {
    socket.broadcast.to(currRoom).emit('peersCanvasActionEnd', { id: socket.client.id, data });
  })


  socket.on('chatMessageSent', ({ data }) => {
    socket.broadcast.to(currRoom).emit('peersChatMessageSent', { id: socket.client.id, data });
  })


  function forceDisconnect() {
    socket.emit('forceDisconnect');
    socket.disconnect();
  }

  function getAnonName() {
    return "anon_" + Math.random().toString(36).substring(7);
  }

})


// On join:
// part a
// authenticate room
// identify user

// part b
// Pick random client from room
// request canvas data
// or fetch strokelog?
// request user list


// part c
// attach all other event listeners