const axios = require('axios');
const instance = axios.create({ baseURL: 'http://localhost:1337' })

module.exports = {
  // Fetch the latest snapshot for a given roomId
  // returns promise that resolves to the image if succeed, null if fail

  fetchSnapshot(roomId) {
    console.log("OK")
    return instance.get(`/snapshots/${roomId}_snapshot.txt`)
    .then(({ status, data }) => {
      console.log("GOT IT,", status)
      if (status !== 200) { return null }
      return data;
    }).catch(err => {
      return null;
    })
  }
}