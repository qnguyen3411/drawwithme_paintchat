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

  console.log("SOCKET CONNECTED")
  let currRoom;

  socket.on('join', function(data) {
    // Authenticate join info
    const roomId = data.room;
    const room = hubServer.getRoomInfo();
    if (!room) {
      forceDisconnect();
    }
    socket.emit('roomInfo', room);
    
    currRoom = roomId;
    rooms[roomId] = rooms[roomId] || {};
    console.log("ROOM: ")
    console.log(rooms[roomId])
    socket.emit('userList', rooms[roomId]);
    // Get username, roomId
    let user = hubServer.getUserIdentity(data.token);
    if (user) {
      hubServer.recordJoin(user.id, roomId);
    } else {
      user = {username: getAnonName()};
    }
    rooms[roomId][socket.client.id] = { username: user.username };
    socket.broadcast.to(currRoom).emit('peerJoined', { username: user.username, id: socket.client.id });
    socket.join(currRoom);
  })

  socket.on('disconnect', () => {
    console.log("Socket disconnected")
    if (rooms[currRoom] && rooms[currRoom][socket.client.id]) {
      delete rooms[currRoom][socket.client.id];
    }
  })


  socket.on('cursorSizeUpdate',({data}) => {
    socket.broadcast.to(currRoom).emit('peersCursorSizeUpdate', { id: socket.client.id, data });
  })

  socket.on('mousePosUpdate',({data}) => {
    socket.broadcast.to(currRoom).emit('peersMousePosUpdate', { id: socket.client.id, data });
  })

  socket.on('canvasActionStart',({data}) => {
    socket.broadcast.to(currRoom).emit('peersCanvasActionStart', { id: socket.client.id, data });
  }) 

  socket.on('canvasActionEnd',({data}) => {
    socket.broadcast.to(currRoom).emit('peersCanvasActionEnd', { id: socket.client.id, data });
  }) 

  function forceDisconnect() {

  }

  function getAnonName() {
    return "Anon_" + Math.random().toString(36).substring(7);
  }

})

// function getRoom(socket) {
//   return findKey(socket.rooms, (roomName) => roomName !== socket.client.id )
// }


