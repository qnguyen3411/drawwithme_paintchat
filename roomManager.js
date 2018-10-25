const TOKEN_REFRESH_TIME = 1000 * 60 * 60 * 2;
const TOKEN_TIME_VALUE = 1000 * 60 * 60 * 4;

class RoomManager {
  constructor(createdAt, expiresAt) {
    const now = new Date().getTime();
    this.host = "";
    this.users = {};
    this.expiresAt = expiresAt;
    this.createdAt = createdAt;
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
        return;
      }
      this.expireTimer = this.newExpireTimer(createdAt, expiresAt);
    }, remainingTime);
    
  }

  removeUser(socketId) {
    delete this.users[socketId];
    if (this.roomIsEmpty()) { return; }
    if (socketId === this.host) {
      this.host = Object.keys(this.users)[0];
    }
  }

  roomIsEmpty() {
    return !Object.keys(this.users).length
  }
  
  getRoomInfo() {
    return {
      host: this.host,
      expiresAt: this.expiresAt,
      tokens: this.availableTokens,
      users: this.users,
    }
  }

}