const axios = require('axios');
const serverInstance = axios.create({ baseURL: 'http://localhost:1337' })
const recorderInstance = axios.create({ baseURL: 'http://localhost:9000' })

module.exports = {
  // Fetch the latest snapshot for a given roomId
  // return s promise that resolves to the image if succeed, null if fail

  fetchSnapshot(roomId) {
    return serverInstance.get(`/snapshots/${roomId}_snapshot.txt`)
      .then(({ status, data }) => {
        if (status !== 200) { return null }
        return data;
      }).catch(err => {
        return null;
      })
  },

  recordStroke(roomId, data) {
    return recorderInstance.post('/write/' + roomId, {data})
    .catch(err => {
      console.log(err);
    })
  },

  signalSnapshot(roomId) {
    return recorderInstance.post('/snapshot/' + roomId, {})
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