const fs = require('fs');
const express = require('express');
const mysql = require('mysql');
const JWT = require('jsonwebtoken');
const { JWT_SECRET, dbConfig } = require('./configurations')
const RoomManager = require('./roomManager')

const app = express()
const server = app.listen(5000, () => {
  console.log("LISTENING")
})

const connection = mysql.createConnection(dbConfig);
connection.connect(function (err) {
  if (err) {
    console.error('error connecting: ' + err.stack);
    return;
  }
  console.log('connected as id ' + connection.threadId);
});


const io = require('socket.io')(server);

// TODO: Room index shouldn't be stored in memory
let rooms = {};

io.on('connection', function (socket) {

  const socketId = socket.client.id;
  let roomKey;

  
    // Joining/ Disconnecting logic

  // Side effects: roomKey
  // Captured: connection
  socket.on('join', async data => {
    const roomId = data.roomId;
    roomKey = `${roomId}`;
    try {
      // Database interaction
      const { created_at : createdAt ,  expires_at: expiresAt } = await checkRoomStatus(connection, roomId);
      if (new Date().getTime() > expiresAt) {
        throw new Error("Room already expired on " + new Date(expiresAt));
      }

      let username;
      let id;
      const tokenData = await decodeToken(data.token);
      if (tokenData) {
        username = tokenData.sub.username;
        id = tokenData.sub.id;
        // Database interaction
        await recordJoinEvent(connection, id, roomId);
      }
      username = username || "Guest";

      if (!rooms[roomKey]) {
        const newRoom = new RoomManager(roomKey, createdAt, expiresAt);
        newRoom.onNewToken = () => { io.to(roomKey).emit('newToken'); };
        newRoom.onExpire = () => { io.to(roomKey).emit('roomExpired'); }
        newRoom.host = socketId;
        socket.emit('setAsHost');
        rooms[roomKey] = newRoom;
      }

      if (rooms[roomKey].roomIsEmpty()) {
        const strokeLogPath = __dirname + `/../strokeLogs/${roomKey}.txt`;
        fs.readFile(strokeLogPath, 'utf8', (err, data) => {
          socket.emit('strokeLog', { data });
        })
      }

      socket.emit('roomInfo', rooms[roomKey].getRoomInfo());
      socket.broadcast.to(roomKey)
        .emit('userJoined', { id: socketId, username });

      socket.join(roomKey);
      rooms[roomKey].addUser(socketId, username)
      socket.emit('setUsername', { username });

    } catch (error) {
      console.error(error);
      socket.emit('roomUnavailable');
      socket.disconnect();
      return;
    }
  })

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
        function (error, results) {
          if (error) { reject(error) }
          resolve(results);
        })
    })
  }


  socket.on('canvasShare', data => {
    io.to(data.target).emit('canvasData', { data: data.dataURI });
  })

  socket.on('exitClicked', () => {
    socket.disconnect();
  })

  socket.on('disconnect', () => {
    socket.broadcast.to(roomKey).emit('userDisconnected', { id: socketId });
    if (!rooms[roomKey]) { return };
    rooms[roomKey].removeUser(socketId);
    io.to(rooms[roomKey].host).emit('setAsHost');
  })


  // Drawing logic

  socket.on('strokeStart', data => {
    const emitData = { id: socketId, strokeData: data }
    socket.broadcast.to(roomKey).emit('otherStrokeStart', emitData)
  })

  socket.on('strokeUpdate', data => {
    const emitData = { id: socketId, newPoints: data };
    socket.broadcast.to(roomKey).emit('otherStrokeUpdate', emitData)
  })

  socket.on('strokeEnd', data => {
    rooms[roomKey].record(data.strokeData);
    const emitData = { id: socketId, newPoints: data.newPoints }
    socket.broadcast.to(roomKey).emit('otherStrokeEnd', emitData)
  })

  socket.on('cursorMovedOnCanvas', data => {
    const emitData = { id: socketId, newPoint: data }
    socket.broadcast.to(roomKey).emit('otherCursorMovedOnCanvas', emitData);
  })

})


