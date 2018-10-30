const config =  require('./config')
module.exports =  {
  
  baseUrl : config.root,
  

  // Writing operations

  recordJoin(roomId, userId) {

  },

  consumeTimeToken(timeToken) {

  },

  // Reading operations

  getRoomInfo(roomId) {

  },

  // Return username & id if valid, null if not
  getUserIdentity(token) {

  },


}