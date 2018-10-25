const express = require('express');
const mysql = require('mysql');
const JWT = require('jsonwebtoken');
const { JWT_SECRET, dbConfig } = require('./configurations')

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
          const {created_at, expires_at, is_active} = results[0];
          console.log((expires_at - created_at) > ONE_DAY_IN_MS);
          // if (!results || !results[0]) { resolve(false) };
          console.log("ROOM IS AVAILABLE YAY")
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
        }
      )
    })
  }

  function newExpirationCheckback(room) {
    let now = new Date();
    let remainingTime = room.expiresAt - now;
    if (remainingTime > 2000) {
      room.exprPromise = new Promise(function (resolve, reject) {
        setTimeout(() => { resolve(room) }, remainingTime)
      }).then(newExpirationCheckback)
    } else {
      console.log("ENDING ROOM")
    }
  }

  function tokenCheckback(room) {
    if (room.tokens > 0) {
      room.expiresAt += ONE_DAY_IN_MS / 6;
      room.tokens--;
      room.tokenPromise = new Promise((resolve, reject) => {
        setTimeout(() => { resolve(room) }, ONE_DAY_IN_MS / 12)
      }).then(tokenCheckback)
    }
  }


  function initializeRoom(currHost, exprAt, createdAt) {
    let now = new Date().getTime();
    const consumedTokens = Math.round((exprAt - createdAt) / (1000 * 60 * 60 * 4)) - 1;
    const remainingTokens = 5 - consumedTokens;
    let room = {};
    room.users = {};
    room.tokens = remainingTokens;
    room.expiresAt = exprAt;
    room.createdAt = createdAt;
    room.host = currHost;
    room.exprPromise = new Promise(resolve => {
      setTimeout(() => resolve(room) , room.expr - now)
    }).then(newExpirationCheckback)

    room.tokenPromise = new Promise(resolve => {
      setTimeout(() => resolve(room) , 1000 * 60 * 60 * 4)
    }).then(tokenCheckback)
    return room;
  }

  function roomIsEmpty(room) {
    return !room || !Object.keys(room.users).length;
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
        const {is_active} = data;
        createdAt = data.created_at;
        expiresAt = data.expires_at;
        if (!is_active) {
          return Promise.reject(`ROOM ${roomId} NOT AVAIABLE`)
        }
        return decodeToken(token)
      }).then(result => {
        if (result) {
          username = result.sub.username;
          const id = result.sub.id;
          return recordJoinEvent(connection, id, roomId);
        }
        return Promise.resolve();
      }).then(() => {
        if (roomIsEmpty(rooms[roomKey])) {
          rooms[roomKey] = initializeRoom(socketId, expiresAt, createdAt);
          // rooms[roomKey].host = socketId;
          socket.emit('setAsHost');
        }
        // Give new user a current list of other users
        let otherUsers = rooms[roomKey].users;
        socket.emit('otherUsers', otherUsers);

        // Tell other users we have joined
        socket.broadcast.to(roomKey)
          .emit('userJoined', { id: socketId, username });

        // Join
        socket.join(roomKey);
        rooms[roomKey]['users'][socketId] = { username };
        socket.emit('setUsername', { username });

        console.log(JSON.stringify(rooms, 0, 2));

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
    if (rooms[roomKey]['users'][socketId]) {
      delete rooms[roomKey][users][socketId];
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
    socket.broadcast.to(roomKey)
      .emit('otherStrokeEnd', { id: socketId, newPoints: data })
  })
  // Expected: { mousepos: {x, y}, size }
  socket.on('cursorMovedOnCanvas', data => {
    socket.broadcast.to(roomKey)
      .emit('otherCursorMovedOnCanvas', { id: socketId, newPoint: data });
  })

})

