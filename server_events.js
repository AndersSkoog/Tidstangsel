const EventEmitter = require('events');

// Create a new instance of EventEmitter
const serverEvents = new EventEmitter();

// Export the instance to be used in other files
module.exports = serverEvents;

