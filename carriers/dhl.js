// usps.js

const BaseTracker = require('./base');
const axios = require('axios');


module.exports = class DHLTracker extends BaseTracker{

  constructor(userId){
    super();
    this.carrier = "dhl";
    this.userId = userId || null;
  };

  getTrackingData(trackingNumber){

    let url = `http://www.dhl.com/shipmentTracking?AWB=${trackingNumber}&countryCode=g0&languageCode=en`;

    return axios({
      type : 'GET',
      url  : url
    })
    .then(response => response.data)
    .then(this.reformat.bind(this));
  };

  parseTrackingNumber(trackingString){
    let trackingNumber = null;
    if(trackingString.search(/^https?:\/\/(www\.)?dhl\.com\//) > -1){
      let match = trackingString.match(/[0-9]{10}/i);
      if(match && match.length){
        trackingNumber = match[1];
      }
    }else{
      if(trackingString.search(/^[0-9]{10}$/) === 0){
        trackingNumber = trackingString;
      }
    }
    return trackingNumber;
  };

  reformat(jsonResponse){
    console.log("og:", JSON.stringify(jsonResponse, null, 2));

    let formattedResponse = this.getDefaultResponse();

    try{

      if(jsonResponse.errors && jsonResponse.errors.length){
        let error = jsonResponse.errors[0];
        return Promise.reject({
          code : error.code,
          error : error.message
        });
      }

      if(jsonResponse.results && jsonResponse.results.length){
        let data = jsonResponse.results[0];
        formattedResponse.trackingNumber = data.id;
        formattedResponse.url = this.getUrl(formattedResponse.trackingNumber);

        if(data.checkpoints){
          if(data.checkpoints.length){
            let latest = data.checkpoints[0];
            formattedResponse.currentStatus = {
              description : latest.description,
              date : this.createDateString(latest.date, 'LLLL'),
              location : latest.location
            };
          }

          if(data.checkpoints.length > 1){
            for(let i=1; i<data.checkpoints.length; i++){
              let checkpoint = data.checkpoints[i];
              formattedResponse.history.push({
                description : checkpoint.description,
                date : this.createDateString(checkpoint.date, 'LLLL'),
                location : checkpoint.location
              });
            }
          }
        }


        if(data.edd){
          if(data.edd.date){
            formattedResponse.deliveryDate = this.createDateString(data.edd.date, 'LLLL');
          }
          else if(data.edd.product && data.edd.product.search(/today/i) > -1){
            formattedResponse.deliveryDate = this.createDateString(new Date());
          }
        }

        if(formattedResponse.currentStatus && formattedResponse.currentStatus.description === "Delivered"){
          formattedResponse.delivered = true;
          formattedResponse.deliveryDate = this.createDateString(formattedResponse.currentStatus.date);
          formattedResponse.destination = this.toSentenceCase(formattedResponse.currentStatus.location);
        }

      }
    }
    catch(error){
      return Promise.reject({error : error});
    };

    return formattedResponse;
  };

  getUrl(trackingNumber){
    return `http://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}&brand=DHL`;
  };

};