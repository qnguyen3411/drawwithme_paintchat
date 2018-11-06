const config = require('./config')
const axios = require('axios');
const instance = axios.create({ baseURL: 'http://localhost:8000' })

module.exports = {


  // Writing operations

  recordJoin(roomId, token) {
    if (!token) return Promise.resolve(null);
    return instance({
      method: 'get',
      url: '/rooms/join/' + roomId,
      headers: { 'Authorization': token }
    }).then(({ status, data }) => {
      if (status !== 200) { return Promise.reject('Server response error'); }
      return data.data;
    })
  },

  async consumeTimeToken(roomId) {
    return instance.get(`/rooms/token/${roomId}`)
      .then(({ status, data }) => {
        if (status !== 200) { return Promise.reject('Server response error'); }
        if (data.status === 'error') { return Promise.reject('Token consumption error') }
        return data.data;
      })
  },

  // Reading operations

  async getRoomInfo(roomId) {
    return instance.get('/rooms/' + roomId)
      .then(({ status, data }) => {
        if (status !== 200) { return Promise.reject('Server response error'); }
        if (!data.data) { return Promise.reject('Room not found error'); }
        return data.data;
      })
  },

  // Return username & id if valid, null if not
  getUserIdentity(token) {
    if (!token) return Promise.resolve(null);
    return instance({
      method: 'get',
      url: '/users/verify',
      headers: { 'Authorization': token }
    }).then(({ status, data }) => {
      if (status !== 200) { return Promise.reject('Server response error'); }
      return data.data;
    })
  },


}