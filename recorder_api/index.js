require('dotenv').config()
const axios = require('axios');
const recorderInstance = axios.create({ baseURL: process.env.RECORDER_ENDPOINT })

module.exports = {

  recordStroke(roomId, data) {
    return recorderInstance.post('/write/' + roomId, {data})
    .catch(err => {
      console.log(err);
    })
  },

  signalSnapshot({roomId, data}) {
    return recorderInstance.post('/snapshot/' + roomId, {data})
    .catch(err => {
      console.log(err);
    })
  },

  signalEnd(roomId) {
    return recorderInstance.post('/end/' + roomId, {})
    .catch(err => {
      console.log(err);
    })
  }




}