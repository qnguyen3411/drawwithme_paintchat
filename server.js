const express = require('express');

const app = express()
app.use(express.static( __dirname + '/./public' ));

// const hostname = '192.168.1.132'
const hostname = '127.0.0.1'

const server = app.listen(8000, () => {
  console.log("LISTENING")
})
const io = require('socket.io')(server);
let userDict = {}
io.on('connection', function (socket) { //2

  socket.emit('otherUsers', userDict)
  userDict[socket.client.id] = {username:"Guest", stroke: null}
  socket.broadcast.emit('userJoined', {id: socket.client.id})
  socket.on('strokeStart', (data) => {
    console.log(data)
    socket.broadcast.emit('otherStrokeStart', 
      {id: socket.client.id, strokeData: data})
  })

  socket.on('strokeUpdate', (data) => {
    // console.log(data)
    socket.broadcast.emit('otherStrokeUpdate',
      {id: socket.client.id, newPoint: data})
  })

  socket.on('strokeEnd', (data) => {
    console.log(data)
    socket.broadcast.emit('otherStrokeEnd', {id: socket.client.id})
  })

  socket.on('disconnect', () => {
    socket.broadcast.emit('userDisconnected', {id: socket.client.id})
    delete userDict[socket.client.id];
  })
})