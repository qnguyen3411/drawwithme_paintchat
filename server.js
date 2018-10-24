const express = require('express');
const mysql = require('mysql');
const JWT = require('jsonwebtoken');
const { JWT_SECRET, dbConfig } = require('./configurations')

const app = express()
app.use(express.static(__dirname + '/./public'));

const connection = mysql.createConnection(dbConfig);
connection.connect(function (err) {
  if (err) {
    console.error('error connecting: ' + err.stack);
    return;
  }
  console.log('connected as id ' + connection.threadId);
});

const server = app.listen(5000, () => {
  console.log("LISTENING")
})

const io = require('socket.io')(server);

// Format: 
//{roomkey1: {host, socketid1, socketid2, ...}, 
// roomkey2: {....}}
let rooms = {};
// let host;
// let needsCanvasShare = [];

io.on('connection', function (socket) {

  const socketId = socket.client.id;
  let roomKey;

  function checkRoomStatus(connection, roomId) {
    return new Promise((resolve, reject) => {
      connection.query(
        'SELECT is_active FROM rooms WHERE id = ?',
        [roomId],
        function (error, results, fields) {
          if (error) { reject(error) };
          if (!results || !results[0]) { resolve(false) };
          console.log("ROOM IS AVAILABLE YAY")
          resolve(true);
        })
    });
  }

  function decodeUsername(token) {
    if (!token) return "Guest";
    try {
      const decoded = JWT.verify(token, JWT_SECRET);
      console.log(decoded);
      return decoded.sub.username;
    } catch (err) {
      return "Guest";
    }
  }

  function roomIsEmpty(room) {
    return !room || Object.keys(room).length === 1;
  }

  socket.on('join', data => {
    const roomId = data.roomId;
    const username = decodeUsername(data.token);
    roomKey = `${roomId}`;

    checkRoomStatus(connection, roomId)
      .then(isAvailable => {
        if (!isAvailable) {
          socket.emit('roomUnavailable');
          socket.disconnect();
          return;
        }
        if (roomIsEmpty(rooms[roomKey])) {
          rooms[roomKey] = { host: socketId, users: {} };
          socket.emit('setAsHost');
        }
        // Give new user a current list of other users
        let otherUsers = rooms[roomKey].users;
        // delete otherUsers['host'];
        socket.emit('otherUsers', otherUsers);

        // Tell other users we have joined
        socket.broadcast.to(roomKey)
          .emit('userJoined', { id: socketId, username });

        // Join
        socket.join(roomKey);
        rooms[roomKey]['users'][socketId] = { username };
        socket.emit('setUsername', { username });

        // console.log(JSON.stringify(rooms, 0, 2));

      }).catch(err => {
        console.log(err);
        return;
      })

  })


  socket.on('canvasShare', data => {
    io.to(data.target).emit('canvasData', { data: data.dataURI });
  })

  socket.on('disconnect', () => {
    socket.broadcast.to(roomKey).emit('userDisconnected', { id: socketId });
    if (!rooms[roomKey]) { return };
    if (rooms[roomKey][socketId]) {
      delete rooms[roomKey][socketId];
    }
    // If host disconnecting, set a new host
    if (socketId === rooms[roomKey].host) {
      io.in(roomKey).clients((err, clients) => {
        if (err) { console.log(err) };
        rooms[roomKey].host = clients[0];
        io.to(clients[0]).emit('setAsHost');
      })
    }
  })

  socket.on('strokeStart', data => {
    socket.broadcast.to(roomKey).emit('otherStrokeStart',
      { id: socketId, strokeData: data })
  })

  socket.on('strokeUpdate', data => {
    socket.broadcast.to(roomKey).emit('otherStrokeUpdate',
      { id: socketId, newPoints: data })
  })

  socket.on('strokeEnd', data => {
    // console.log(data)
    socket.broadcast.to(roomKey)
      .emit('otherStrokeEnd', { id: socketId, newPoints: data })
  })
  // Expected: { mousepos: {x, y}, size }
  socket.on('cursorMovedOnCanvas', data => {
    socket.broadcast.to(roomKey)
      .emit('otherCursorMovedOnCanvas', { id: socketId, newPoint: data });
  })

})