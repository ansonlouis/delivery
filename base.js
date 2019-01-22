// base.js
const moment = require('moment');


module.exports = class BaseTracker{

  constructor(){

  };

  getDefaultResponse(){
    return {

      carrier : this.carrier,
      
      // the tracking number
      trackingNumber : null,

      // whether package has been delivery or not
      delivered : false,

      // its current status meta data
      currentStatus : "",

      // the scheduled delivery date
      deliveryDate : null,

      // any history statuses the api returned
      history : []
    }
  };

  parseTrackingNumber(trackingString){
    
  };

  getTrackingData(trackingNumber){
    return Promise.reject({error : null})
  };

  track(trackingString){
    let trackingNumber = this.parseTrackingNumber(trackingString);
    return this.getTrackingData(trackingNumber).catch(error => {
      if(typeof(error) === "string"){
        error = { error : error };
      }
      error.trackingNumber = trackingNumber;
      error.carrier = this.carrier;
      return Promise.reject(error);
    });
  };

  createDateString(date, format){
    return new moment(date, format || undefined).format();
  };

  getUrl(trackingNumber){

  };

  toSentenceCase(str){
    return str.substr(0, 1).toUpperCase() + str.substr(1).toLowerCase();
  };
}