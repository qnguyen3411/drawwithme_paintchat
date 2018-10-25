const express = require('express');
const mysql = require('mysql');
const JWT = require('jsonwebtoken');
const { JWT_SECRET, dbConfig } = require('./configurations')

const RoomManager = require('./roomManager')

const ONE_DAY_IN_MS = 1000 * 60 * 60 * 24;


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
let rooms = {};

io.on('connection', function (socket) {

  const socketId = socket.client.id;
  let roomKey;

  function checkRoomStatus(connection, roomId) {
    return new Promise((resolve, reject) => {
      connection.query(
        'SELECT created_at, expires_at, is_active FROM rooms WHERE id = ?',
        [roomId],
        function (error, results, fields) {
          if (error) { reject(error) };
          if (!results) { resolve(false) };
          resolve(results[0]);
        })
    });
  }

  function decodeToken(token) {
    // Decode token wirhout catching
    return new Promise(function (resolve, reject) {
      JWT.verify(token, JWT_SECRET, function (err, decoded) {
        if (err) resolve(null);
        resolve(decoded);
      })
    })
  }

  function recordJoinEvent(connection, userId, roomId) {
    return new Promise((resolve, reject) => {
      connection.query(
        'INSERT INTO users_rooms (room_id, user_id, created_at, updated_at)'
        + ' VALUES (?,?, NOW(), NOW())'
        + ' ON DUPLICATE KEY UPDATE updated_at = NOW()',
        [roomId, userId],
        function (error, results, fields) {
          if (error) { reject(error) }
          resolve(results);
        })
    })
  }


  socket.on('join', data => {
    const roomId = data.roomId;
    const token = data.token;
    let username;
    roomKey = `${roomId}`;
    let createdAt;
    let expiresAt;

    checkRoomStatus(connection, roomId)
      .then(data => {
        const { is_active } = data;
        createdAt = data.created_at;
        expiresAt = data.expires_at;
        if (!is_active) {
          return Promise.reject(`ROOM ${roomId} NOT AVAIABLE`)
        }
        return decodeToken(token)

      }).then(result => {
        // If failed to decode token, don't record join and set user as guest
        if (!result) { return Promise.resolve(); }
        username = result.sub.username;
        const id = result.sub.id;
        return recordJoinEvent(connection, id, roomId);

      }).then(() => {
        username = username || "Guest";
        if (!rooms[roomKey]) {
          const newRoom = new RoomManager(createdAt, expiresAt);
          newRoom.onNewToken = () => { io.to(roomKey).emit('newToken') };
          newRoom.onExpire = () => {
            io.to(roomKey).emit('roomExpired');
          }
          newRoom.host = socketId;
          socket.emit('setAsHost');
          rooms[roomKey] = newRoom;
        }

        // Give new user a current list of other users
        let roomInfo = rooms[roomKey].getRoomInfo();
        socket.emit('roomInfo', roomInfo);

        // Tell other users we have joined
        socket.broadcast.to(roomKey)
          .emit('userJoined', { id: socketId, username });

        // Join
        socket.join(roomKey);
        rooms[roomKey].addUser(socketId, username)
        socket.emit('setUsername', { username });

        console.log(rooms)

      }).catch(err => {
        console.log(err);
        socket.emit('roomUnavailable');
        socket.disconnect();
        return;
      })

  })


  socket.on('canvasShare', data => {
    io.to(data.target).emit('canvasData', { data: data.dataURI });
  })

  socket.on('disconnect', () => {
    socket.broadcast.to(roomKey).emit('userDisconnected', { id: socketId });
    if (!rooms[roomKey]) { return };
    rooms[roomKey].removeUser(socketId);
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
    socket.broadcast.to(roomKey)
      .emit('otherStrokeEnd', { id: socketId, newPoints: data })
  })
  // Expected: { mousepos: {x, y}, size }
  socket.on('cursorMovedOnCanvas', data => {
    socket.broadcast.to(roomKey)
      .emit('otherCursorMovedOnCanvas', { id: socketId, newPoint: data });
  })

})

