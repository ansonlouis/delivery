// tracker.js

const BaseTracker = require('./base');


module.exports = class Trackers{

  constructor(trackers){
    this.trackers = trackers;
  };

  eachTracker(callback){
    for(var key in this.trackers){
      callback(this.trackers[key], key);
    }
  };

  async track(trackingString){
    
    if(!trackingString){
      return Promise.reject({error:'You must provide a tracking number or url'});
    }

    let orderedTrackers = this.findBestMatches(trackingString);
    for(let tracker of orderedTrackers){
      let data = await tracker.track(trackingString);
      if(data){
        return data;
      }
    }
    return Promise.reject({error:'None of the trackers could find a valid response'});
  };

  trackWithCarrier(trackingString, carrierKey){
    let tracker = this.trackers[carrierKey];
    if(tracker){
      return tracker.track(trackingString);
    }
    return Promise.reject({error:`No tracker found with key ${carrierKey}`});
  };

  parseTrackingNumber(trackingString){
    for(let key in this.trackers){
      let match = this.trackers[key].parseTrackingNumber(trackingString);
      if(match){
        return {
          carrierKey : key,
          trackingNumber : match
        };
      }
    }
    return null;
  };

  findBestMatches(trackingString){
    let orderedTrackers = [];
    for(let key in this.trackers){
      let tracker = this.trackers[key];
      let match = tracker.parseTrackingNumber(trackingString);
      if(match){
        console.log("Found good match:", key);
        orderedTrackers.unshift(tracker);
      }else{
        console.log("Not a match:", key);
      }
    }
    return orderedTrackers;
  };

};