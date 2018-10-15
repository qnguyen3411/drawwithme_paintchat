const express = require('express');

const app = express()
app.use(express.static( __dirname + '/./public' ));

// const hostname = '192.168.1.132'
const hostname = '127.0.0.1'

const server = app.listen(8000, () => {
  console.log("LISTENING")
})
const io = require('socket.io')(server);
let userDict = {};
let host;
let needsCanvasShare = [];
io.on('connection', function (socket) { //2
  
  
  if(Object.keys(userDict).length == 0) {
    host = socket;
    console.log('SETTING HOST');
  } else {
    needsCanvasShare.push(socket);
    host.emit('canvasShareRequest');
  }


  socket.emit('otherUsers', userDict)
  socket.broadcast.emit('userJoined', {id: socket.client.id})
  userDict[socket.client.id] = {username:"Guest", stroke: null}
  

  socket.on('canvasShare', data => {
    console.log(Buffer.byteLength(data.dataURI, 'base64'))
    // console.log("SHARING CANVAS")
    
    while(needsCanvasShare.length != 0) {
      const queuedSocket = needsCanvasShare.pop();
      queuedSocket.emit('canvasData', {data: data.dataURI});
    }
  })

  socket.on('strokeStart', (data) => {
    // console.log(data)
    socket.broadcast.emit('otherStrokeStart', 
      {id: socket.client.id, strokeData: data})
  })

  socket.on('strokeUpdate', (data) => {
    // console.log(data)
    socket.broadcast.emit('otherStrokeUpdate',
      {id: socket.client.id, newPoint: data})
  })

  socket.on('strokeEnd', () => {
    // console.log(data)
    socket.broadcast.emit('otherStrokeEnd', {id: socket.client.id})
  })

  socket.on('disconnect', () => {

    socket.broadcast.emit('userDisconnected', {id: socket.client.id})
    delete userDict[socket.client.id];
    if(socket === host) {
      // console.log("HOST DISCONNECTED")
      const remainingUsers = Object.values(io.sockets.connected)
      if (remainingUsers) {
        host = remainingUsers[0]; 
      } else {
        host = null;
      }
    }
  })
  
})