// ups.js

const BaseTracker = require('../base');
const axios = require('axios');


module.exports = class UPSTracker extends BaseTracker{
  constructor(access){
    super();
    this.carrier = "ups";
    this.licenseNumber = access.licenseNumber || null;
    this.username = access.username || null;
    this.password = access.password || null;
  };

  getTrackingData(trackingNumber){

    var data = {
      "UPSSecurity": {
        "UsernameToken": {
          "Username": this.username,
          "Password": this.password
        },
        "ServiceAccessToken": {
          "AccessLicenseNumber": this.licenseNumber
        }
      },
      "TrackRequest": { 
        // "Request" : {
        //   "RequestOption" : "15"
        // },
        "InquiryNumber": trackingNumber
      }
    };

    var url = "https://onlinetools.ups.com/rest/Track";

    return axios({
      method : "POST",
      url  : url,
      data : data,
    })
    .then(response => response.data)
    .then(this.reformat.bind(this));

  };

  reformat(response){
    console.log("response", JSON.stringify(response, null, 2));
    
    let data = this.getDefaultResponse();
    try{

      if(response.Fault){
        let error = "Unknown Error";
        let code = undefined;
        try{
          error = response.Fault.detail.Errors.ErrorDetail.PrimaryErrorCode.Description;
          code = response.Fault.detail.Errors.ErrorDetail.PrimaryErrorCode.Code;
        }catch(e){
          error = response.Fault.faultstring;
        }
        return Promise.reject({error:error, code:code});
      }

      if(response.TrackResponse.Shipment){

        let shipment = response.TrackResponse.Shipment;

        if(shipment.ShipmentAddress){

          let destination = this.parseDestination(shipment.ShipmentAddress);
          if(destination){
            data.destination = destination;
          }
        }

        if(shipment.DeliveryDetail && shipment.DeliveryDetail.Date){
          data.deliveryDate = this.createDateString(shipment.DeliveryDetail.Date);
        }

        if(shipment.Package){

          let pkg = shipment.Package;
          data.trackingNumber = pkg.TrackingNumber;
          data.url = this.getUrl(data.trackingNumber);

          let activity = pkg.Activity;

          data.currentStatus = {
            description : activity.Status.Description,
            date : this.createDateString(activity.Date),
          };

          if(activity.ActivityLocation && activity.ActivityLocation.Address && activity.ActivityLocation.Address.City){
            data.currentStatus.location = activity.ActivityLocation.Address.City + ', ' + activity.ActivityLocation.Address.StateProvinceCode;
          }

          if(activity.Status.Description === "Delivered"){
            data.delivered = true;
            data.deliveryDate = this.createDateString(activity.Date);
          }
          else if(pkg.DeliveryDetail && pkg.DeliveryDetail.Date){
            data.deliveryDate = this.createDateString(pkg.DeliveryDetail.Date);
          }

        }
      }
      
    }
    catch(error){
      return Promise.reject({error : error});
    }

    return data;
  };

  parseDestination(shipmentAddresses){
    if(Array.isArray(shipmentAddresses)){
      let shipTo = shipmentAddresses.find(item => {
        return item.Type && item.Type.Description.search(/shipto/i) > -1;
      });
      if(shipTo && shipTo.Address && shipTo.Address.City){
        let city = this.toSentenceCase(shipTo.Address.City);
        let zip = shipTo.Address.PostalCode;
        let state = shipTo.Address.StateProvinceCode;
        return `${city}, ${state} ${zip}`;
      }
    }
  };

  parseTrackingNumber(trackingString){
    let trackingNumber = null;
    if(trackingString.search(/https?:/i) > -1){
      let match = trackingString.match(/trackNums=([^&]*)/i);
      if(match && match.length){
        trackingNumber = match[1];
      }
    }else{
      let match = trackingString.match(/1Z[a-z0-9]+/i);
      if(match){
        trackingNumber = match;
      }
    }
    return trackingNumber;
  };

  getUrl(trackingNumber){
    return `https://www.ups.com/track?loc=en_US&tracknum=${trackingNumber}`;
  };
  
};