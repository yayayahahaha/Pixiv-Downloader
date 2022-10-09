const MasterHouse = require('MasterHouse')
const masterHouse = new MasterHouse({ workerNumber: 10, basicDelay: 500, randomDelay: 500 })

module.exports = { masterHouse }
