// index.js

module.exports = {
  Trackers : require('./trackers'),
  Base : require('./base'),
  carriers : {
    DHL : require('./carriers/dhl'),
    UPS : require('./carriers/ups'),
    USPS : require('./carriers/usps'),
  }
};