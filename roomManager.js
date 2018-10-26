const fs = require('fs');

const TOKEN_REFRESH_TIME = 1000 * 60 * 60 * 2;
const TOKEN_TIME_VALUE = 1000 * 60 * 60 * 4;




module.exports = class RoomManager {
  constructor(roomKey, createdAt, expiresAt) {
    const now = new Date().getTime();
    this.host = "";
    this.users = {};
    this.roomKey = roomKey;
    this.expiresAt = expiresAt;
    this.createdAt = createdAt;
    
    const strokeLogPath = __dirname + `/../strokeLogs/${roomKey}.txt`;
    this.stream = fs.createWriteStream( strokeLogPath, {flags: 'a', mode: 777} );
    fs.chmodSync(strokeLogPath, '755');
    
    const consumedTokens = Math.round(
      (expiresAt - createdAt) / TOKEN_TIME_VALUE) - 1;
    this.remainingTokens = 5 - consumedTokens;
    this.availableTokens = Math.floor(
      (now - createdAt) / TOKEN_REFRESH_TIME) - consumedTokens;

    this.tokenTimer = this.newTokenTimer(createdAt, expiresAt);
    this.expireTimer = this.newExpireTimer(createdAt, expiresAt);
    this.onExpire = () => {};
    this.onNewToken = () => {};
  }

  addUser(socketId, username) {
    if (this.roomIsEmpty()) {
      this.host = socketId;
    }
    this.users[socketId] = {username};
  }

  removeUser(socketId) {
    delete this.users[socketId];
    if (this.roomIsEmpty()) { return; }
    if (socketId === this.host) {
      this.host = Object.keys(this.users)[0];
    }
  }

  newTokenTimer(createdAt, expiresAt) {
    const now = new Date().getTime();
    if (createdAt > now) throw "Creation date is in the future";
    if (expiresAt < now) throw "Expiration date is in the past";
    const timeSinceLastToken = (now - createdAt) % TOKEN_REFRESH_TIME;
    const timeTilNextToken = TOKEN_REFRESH_TIME - timeSinceLastToken;
    return setTimeout(() => {
      if (this.remainingTokens > 0) {
        this.availableTokens++;
        this.remainingTokens--;
        this.onNewToken(this.availableTokens);
        this.tokenTimer = this.newTokenTimer(createdAt, expiresAt)
      }
    }, timeTilNextToken)
  }

  newExpireTimer(createdAt, expiresAt) {
    const now = new Date().getTime();
    if (createdAt > now) throw "Creation date is in the future";
    const remainingTime = expiresAt - now;

    return setTimeout(() => {
      const now = new Date().getTime();
      if (this.expiresAt - now < 10000) {
        this.onExpire();
        this.stream.end();
        return;
      }
      this.expireTimer = this.newExpireTimer(createdAt, expiresAt);
    }, remainingTime);
    
  }

  roomIsEmpty() {
    return !Object.keys(this.users).length;
  }
  
  getRoomInfo() {
    return {
      host: this.host,
      expiresAt: this.expiresAt,
      tokens: this.availableTokens,
      users: this.users,
    }
  }

  record(stroke) {
    this.stream.write(JSON.stringify(stroke) + ',\n');
  }

}