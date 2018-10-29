const express = require('express');
const findKey = require('lodash/findKey');

const app = express()
const server = app.listen(5000, () => {
  console.log("LISTENING")
})


const io = require('socket.io')(server);

// TODO: Room index shouldn't be stored in memory
let rooms = {};

io.on('connection', function (socket) {

  console.log("SOCKET CONNECTED")
  let currRoom;

  socket.on('join', function(data) {
    // Authenticate join info

    // Get username, roomId
    const username = "bob";
    currRoom = data.room;
    socket.broadcast.to(currRoom).emit('peerJoined', { username, id: socket.client.id });
    socket.join(currRoom);
  })

  socket.on('disconnect', () => {
    console.log("SOCKET DISCONNECTED")
    // console.log(socket.disconnected);
  })

  socket.on('cursorSizeUpdate',({data}) => {
    console.log("CURSOR SIZE UPDATE")
    console.log(data)
    socket.broadcast.to(currRoom).emit('peersCursorSizeUpdate', { id: socket.client.id, data });
  })

  socket.on('mousePosUpdate',({data}) => {
    socket.broadcast.to(currRoom).emit('peersMousePosUpdate', { id: socket.client.id, data });
  })

  socket.on('canvasActionStart',({data}) => {
    socket.broadcast.to(currRoom).emit('peersCanvasActionStart', { id: socket.client.id, data });
  }) 

  socket.on('canvasActionEnd',({data}) => {
    console.log("CANVAS ACTION END SIGNAL")
    socket.broadcast.to(currRoom).emit('peersCanvasActionEnd', { id: socket.client.id, data });
  }) 

})

// function getRoom(socket) {
//   return findKey(socket.rooms, (roomName) => roomName !== socket.client.id )
// }


