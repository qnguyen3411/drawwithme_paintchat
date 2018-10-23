const express = require('express');

const app = express()
app.use(express.static( __dirname + '/./public' ));


const server = app.listen(5000, () => {
  console.log("LISTENING")
})

const io = require('socket.io')(server);
let userDict = {};
let host;
let needsCanvasShare = [];

io.on('connection', function (socket) { //2
  const id = socket.client.id;
  if(Object.keys(userDict).length == 0) {
    host = socket;
  } else {
    needsCanvasShare.push(socket);
    host.emit('canvasShareRequest');
  }

  socket.on('join', data => {
    console.log(data.token);
  })

  socket.emit('otherUsers', userDict)
  socket.broadcast.emit('userJoined', { id })
  userDict[id] = { username:"Guest" }
  
  socket.on('canvasShare', data => {
    while(needsCanvasShare.length != 0) {
      const queuedSocket = needsCanvasShare.pop();
      queuedSocket.emit('canvasData', {data: data.dataURI});
    }
  })

  socket.on('disconnect', () => {
    socket.broadcast.emit('userDisconnected', { id });
    console.log("DISCONNECTED")
    delete userDict[id];
    if(socket === host) {
      const remainingUsers = Object.values(io.sockets.connected);
      host = (remainingUsers) ?
        remainingUsers[0] :
        null;
    }
  })

  socket.on('strokeStart', (data) => {
    socket.broadcast.emit('otherStrokeStart', 
      {id: id , strokeData: data})
  })

  socket.on('strokeUpdate', (data) => {
    socket.broadcast.emit('otherStrokeUpdate',
      {id: id, newPoints: data})
  })

  socket.on('strokeEnd', (data) => {
    socket.broadcast.emit('otherStrokeEnd', { id, newPoints: data })
  })
  
})