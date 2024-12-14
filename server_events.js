const EventEmitter = require('events');

class MyEmitter extends EventEmitter {}
// Create a new instance of EventEmitter
const serverEvents = new MyEmitter();

// Export the instance to be used in other files
module.exports = serverEvents;
