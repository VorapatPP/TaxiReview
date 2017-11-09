import { Component } from '@angular/core';
import { NavController, Platform } from 'ionic-angular';

import { TaxiDetailPage } from '../taxi-detail/taxi-detail';

//Fire
import { AngularFireDatabase } from 'angularfire2/database';

import firebase from 'firebase';

import { Camera, CameraOptions } from '@ionic-native/camera';

import { RestApiProvider } from '../../providers/rest-api/rest-api';

@Component({
  selector: 'page-find-taxi',
  templateUrl: 'find-taxi.html'
})
export class FindTaxiPage {

  public gotTaxiImage: boolean = false;
  public gotTaxiDatail: boolean = false;

  public taxiPhoto: string;
  public rawTaxiPhoto: string;
  public taxiDetail: any;

  public photoPath: string;
  public taxiPhotoURL: string;

  public taxiLicensePlate: string;

  public storage = firebase.storage();

  constructor(
    public navCtrl: NavController,
    private afDB:AngularFireDatabase,
    private camera: Camera,
    public restApiProvider: RestApiProvider,
    public platform: Platform 
  ) {
    console.log("FindTaxiPage");
  }

  resetValue(){
    this.gotTaxiImage = false;
    this.gotTaxiDatail = false;
    
    this.taxiPhoto = '';
    this.rawTaxiPhoto = '';
    this.taxiDetail = null;

    this.photoPath = '';
    this.taxiPhotoURL = '';

    this.taxiLicensePlate = '';
  }

  takePhotoViaHTML(event){
    let pic = event.target.files[0];
    console.log(pic);
    console.log(event.target.files[0]);
    var reader = new FileReader(); 
    reader.onload = this._handleReaderLoaded.bind(this); 
    reader.readAsBinaryString(pic);
  }

  _handleReaderLoaded(readerEvt) { 
    this.resetValue();

    var binaryString = readerEvt.target.result;
    let imageData = btoa(binaryString)
    this.taxiPhoto = 'data:image/jpeg;base64,' + imageData; 
    this.rawTaxiPhoto = imageData;

    this.gotTaxiImage = true;
    console.log("Took image");
    
    this.taxiLicensePlate = 'Please wait!';

    //search taxi detail
    this.searchTaxiDetail();
  } 

  takePhotoViaNative(){
    //reset input field and pic
    this.resetValue();    

    const options: CameraOptions = {
      quality: 50,
      destinationType: this.camera.DestinationType.DATA_URL,
      encodingType: this.camera.EncodingType.JPEG,
      mediaType: this.camera.MediaType.PICTURE,
      correctOrientation: true,
      saveToPhotoAlbum: true
    }
      
    this.camera.getPicture(options)
    .then((imageData) => {
      //set value
      this.taxiPhoto = 'data:image/jpeg;base64,' + imageData;
      this.rawTaxiPhoto = imageData;

      this.gotTaxiImage = true;
      console.log("Took image");
      
      this.taxiLicensePlate = 'Please wait!';

      //search taxi detail
      this.searchTaxiDetail();
    })
    .catch(error => console.log("Error taking photo",error));
  }

  searchTaxiDetail(){
     this.restApiProvider.getLicensePlate(this.rawTaxiPhoto)
     .then(data => {
       this.taxiDetail = data;
       console.log("Got taxiDetail",this.taxiDetail);
       //check that taxi detail is valid
       if(this.checkValidTaxiDetail()){
         this.gotTaxiDatail = true;
       }
     })
     .catch(error =>{
       console.log("Error using openalpr api",error);
     });
  }

  checkValidTaxiDetail(){
    if(this.taxiDetail.results.length == 0){
      this.taxiLicensePlate = 'Not found!';
      console.log("Invalid result from taxiDetail");
      return false;
    }else if(this.taxiDetail.results.length > 0){
      this.taxiLicensePlate = this.taxiDetail.results[0].plate;
      console.log("Valid result from taxiDetail");
      return true;
    }
  }

  uploadImage(){
    if((!this.gotTaxiImage) || (!this.gotTaxiDatail)){
      console.log("No image to upload or image did not contain any taxi");
      this.resetValue();
      return;
    }
    //set firestore path >> /images/taxis/<taxi-license-plate-number>/<file-name>.<format>
    this.photoPath = "images/taxis/"+this.taxiLicensePlate+"/"+new Date().getTime()+".jpg";
    const storageRef = this.storage.ref(this.photoPath);
    storageRef.putString(this.taxiPhoto,"data_url")
    .then(() =>{
      console.log("Uploaded image");
    })
    .then(() => {
      //get image URL
      const storageRef = this.storage.ref(this.photoPath);
      storageRef.getDownloadURL()
      .then(url =>{
        this.taxiPhotoURL = url;
        console.log("Got image URL",this.taxiPhotoURL);
      })
      .then(() => {
        //add image to taxi in firedatabase
        this.addTaxiImageToFiredatabase();
      });
    })
    .catch(error => console.log("Error",error));
  }

  addTaxiImageToFiredatabase(){
    const dbTaxiRef = this.afDB.object('Taxis/'+this.taxiLicensePlate);
    let dbTaxi = dbTaxiRef.valueChanges();
    let sub = dbTaxi.subscribe(taxiData => {

      const dbTaxiImageRef = this.afDB.list('Taxis/'+this.taxiLicensePlate+'/Images/');

        if(taxiData == null){
          console.log("Taxi not exist");
          
          dbTaxiImageRef.set(''+new Date().getTime(),this.taxiPhotoURL)
          .then(res=>console.log("Create and add new Image url to taxi in firedatabase"));
        }else{
          console.log("Taxi already exist");

          dbTaxiImageRef.set(''+new Date().getTime(),this.taxiPhotoURL)
          .then(res=>console.log("Append new Image url to taxi in firedatabase"));
        }

        sub.unsubscribe();
        //reset
        this.resetValue();
    });
  }

  isValidTaxiInfo(){
    //TODO - find a better way to valid this
    if(this.taxiLicensePlate && (this.taxiLicensePlate!='Please wait!') && (this.taxiLicensePlate!='Not found!')){
      return true;
    }
  }

  goToTaxiDetail(params){
    //store data before reset
    let tlp = this.taxiLicensePlate;
    //TODO - give user option whether they want to upload image or not
    this.uploadImage();
    
    if (!params) params = {};
    this.navCtrl.push(TaxiDetailPage,{taxiLicensePlate: tlp});
  }

}
