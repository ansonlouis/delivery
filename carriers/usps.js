// usps.js

const BaseTracker = require('../base');
const axios = require('axios');
const xml2js = require('xml2js');


module.exports = class USPSTracker extends BaseTracker{

  constructor(userId){
    super();
    this.carrier = "usps";
    this.userId = userId || null;
  };

  getTrackingData(trackingNumber){

    let xml = `<?xml version="1.0" encoding="UTF-8" ?><TrackRequest USERID="${this.userId}"><TrackID ID="${trackingNumber}"></TrackID></TrackRequest>`;
    xml = `<?xml version="1.0" encoding="UTF-8"?><TrackFieldRequest USERID="${this.userId}"><Revision>1</Revision><ClientIp>127.0.0.1</ClientIp><SourceId>myself</SourceId><TrackID ID="${trackingNumber}" /></TrackFieldRequest>`;
    
    let url = `https://secure.shippingapis.com/ShippingAPI.dll?API=TrackV2&XML=${xml}`;

    return axios({
      type : 'GET',
      url  : url
    })
    .then(response => response.data)
    .then(this.convertXML.bind(this))
    .then(this.reformat.bind(this))
    .then(this.validate.bind(this));
  };

  parseTrackingNumber(trackingString){
    let trackingNumber = null;
    if(trackingString.search(/https?:/i) > -1){
      let match = trackingString.match(/labels=([^&]*)/i);
      if(match && match.length){
        trackingNumber = match[1];
      }
    }else{
      if(trackingString.search(/^(\d+){20,22}$/) === 0){
        trackingNumber = trackingString;
      }
    }
    return trackingNumber;
  };

  convertXML(response){
    return new Promise((resolve, reject) => {
      xml2js.parseString(response, (err, data) => {
        if(err){
          return reject(err);
        }
        resolve(data);
      });
    });
  };

  reformat(jsonResponse){
    console.log("og:", JSON.stringify(jsonResponse, null, 2));
    let response = this.getDefaultResponse();

    try{
      if(jsonResponse.TrackResponse && jsonResponse.TrackResponse.TrackInfo){
        let matchingData = jsonResponse.TrackResponse.TrackInfo[0];
        if(matchingData){

          // response error checking
          if(matchingData.Error && matchingData.Error.length){
            let error = matchingData.Error[0];
            let errorText = "Unknown Error";
            let code = undefined;

            if(error && error.Description && error.Description.length){
              errorText = error.Description[0];
            }
            if(error && error.Number && error.Number.length){
              code = error.Number[0];
            }

            return Promise.reject({
              error : errorText,
              code  : code
            });
          }

          // response success formatting
          response.trackingNumber = matchingData.$.ID;
          response.url = this.getUrl(response.trackingNumber);

          if(matchingData.TrackSummary && matchingData.TrackSummary.length){
            let description = matchingData.TrackSummary[0];
            response.currentStatus = this.parseStatus(description);
          }

          if(matchingData.TrackDetail){
            response.history = matchingData.TrackDetail.map((history) => {
              return this.parseStatus(history);
            });
          }

          if(matchingData.DestinationZip && matchingData.DestinationZip[0]){
            response.destination = `${this.toSentenceCase(matchingData.DestinationCity[0])}, ${matchingData.DestinationState[0]} ${matchingData.DestinationZip[0]}`;
          }

          if(response.currentStatus.description.search(/delivered/i) > -1){
            response.delivered = true;
            response.deliveryDate = response.currentStatus.date;
          }

        }
      }
    }
    catch(error){
      return Promise.reject({error : error});
    };

    return response;
  };

  parseStatus(detail){
    if(typeof(detail) === "string"){
      return this.parseStringDescription(detail);
    }else{
      return this.parseDetailedDescription(detail);
    }
  };

  parseDetailedDescription(detail){
    let status = {
      description : detail.Event[0],
      date : this.createDateString(`${detail.EventDate[0]} ${detail.EventTime[0]}`, 'MMMM DD, YYYY H:mm a'),
      location : null
    };

    if(detail.EventState[0] && detail.EventZIPCode[0]){
      status.location = `${this.toSentenceCase(detail.EventCity[0])}, ${detail.EventState[0]} ${detail.EventZIPCode[0]}`;
    }else{
      status.location = detail.EventCity[0] || null;
    }
    return status;
  };

  parseStringDescription(desc){
    let status = {
      description : desc,
      date : this.parseDate(desc),
      location : this.parseLocation(desc)
    };
    return status;
  };

  validate(data){
    if(!data || !data.currentStatus || data.currentStatus.description.search('could not locate') > -1){
      return Promise.reject({
        code : undefined,
        error : data.currentStatus.description
      });
    }
    return data;
  };

  parseDate(str){
    let date = null;
    let time = null;
    let dateStr = "";
    let format = "";

    let dateMatch = str.match(/[a-z]+\s\d{1,2},\s\d{4}/i);
    if(dateMatch){
      dateStr = dateMatch[0];
      format = "MMMM DD, YYYY";
    }else{
      dateMatch = str.match(/\d{2}\/\d{2}\/\d{4}/i);
      if(dateMatch){
        dateStr = dateMatch[0];
        format = 'MM/DD/YYYY';
      }
    }

    let timeMatch = str.match(/\d:\d{2}\s(am|pm)/i);
    if(timeMatch){
      time = timeMatch[0];
      if(dateMatch){
        dateStr += ' ' + time;
        format += ' h:mm a';
      }
    }

    if(dateStr){
      return this.createDateString(dateStr, format);
    }

  };

  parseLocation(str){
    let match = str.match(/[A-Z\s-]+,\s[A-Z]{2}\s[\d-]+/);
    if(match){
      return match[0].trim();
    }
  };

  getUrl(trackingNumber){
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
  };

};