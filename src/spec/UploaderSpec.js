describe("uploader", function() {
  var fail = function(message) {
    throw message;    
  }
  if (!($.cloudinary.config().api_secret != null)) {
    return console.warn("**** Please setup environment for uploader test to run!");
  }
  beforeEach(function() {
    this.addMatchers({
      toBeBetween: function(lower, upper) {
        return this.actual >= lower && this.actual <= upper;
      }
    });
        
    $.cloudinary.config(true);
  });
  it("should successfully upload file", function(done) {
    var file = null, uresult = null, dresult = null;
    runs(function() {
      forge.file.getLocal("logo.png", function(result){file=result;}, function(result){fail(result.message);});
    });
    waitsFor(function() {return file;}, "File", 100);
    runs(function(){ 
      $.cloudinary.uploader.upload(file, function(result) {uresult = result;});
    });
    waitsFor(function() {return uresult;}, "Upload", 3000);
    runs(function(){
      if (uresult.error != null) {
        fail(uresult.error.message);
      }

      expect(uresult.width).toEqual(241);
      expect(uresult.height).toEqual(51);
      var expected_signature = $.cloudinary.uploader.api_sign_request({
        public_id: uresult.public_id,
        version: uresult.version
      }, $.cloudinary.config().api_secret);
      expect(uresult.signature).toEqual(expected_signature);
      $.cloudinary.uploader.destroy(uresult.public_id, function(result) { dresult = result; });
    });
    waitsFor(function() {return dresult;}, "Destroy", 3000);
    runs(function() {
      if (dresult.error != null) {
        fail(dresult.error.message);
      }
      expect(dresult.result).toEqual("ok");
    });
  });
  
  it("should successfully upload file in safe upload mode", function(done) {
    var file = null, uresult = null, dresult = null;
    runs(function() {
      forge.file.getLocal("logo.png", function(result){file=result;}, function(result){fail(result.message);});
    });
    waitsFor(function() {return file;}, "File", 100);
    var params = {
      timestamp: "" + Math.floor(new Date().getTime() / 1000),
      format: "jpg"
    };
    params.signature = $.cloudinary.uploader.api_sign_request(params, $.cloudinary.config().api_secret);      
    runs(function(){ 
      $.cloudinary.config('api_secret', '1234'); // Break api_secret. External timestamp and signature should be used anyway.
      $.cloudinary.uploader.upload(file, function(result) {uresult = result;}, params);
    });
    waitsFor(function() {return uresult;}, "Upload", 3000);
    runs(function(){
      if (uresult.error != null) {
        fail(uresult.error.message);
      }
      expect(uresult.width).toEqual(241);
      expect(uresult.height).toEqual(51);
      expect(uresult.format).toEqual("jpg");
    });
  });
  
  it("should successfully upload url", function(done) {
    var uresult = null;
    runs(function(){ 
      $.cloudinary.uploader.upload("http://cloudinary.com/images/logo.png", function(result) {uresult = result;});
    });
    waitsFor(function() {return uresult;}, "Upload", 3000);
    runs(function(){
      if (uresult.error != null) {
        fail(uresult.error.message);
      }
      expect(uresult.width).toEqual(241);
      expect(uresult.height).toEqual(51);
      var expected_signature = $.cloudinary.uploader.api_sign_request({
        public_id: uresult.public_id,
        version: uresult.version
      }, $.cloudinary.config().api_secret);
      expect(uresult.signature).toEqual(expected_signature);
    });
  });  
  it("should successfully call explicit api", function(done) {
    var uresult = null;
    runs(function(){ 
      $.cloudinary.uploader.explicit("cloudinary", function(result) {uresult = result;}, {
        type: "twitter_name",
        eager: [{ crop: "scale", width: 2.0}]
      });
    });
    waitsFor(function() {return uresult;}, "Explict", 3000);
    runs(function(){
      if (uresult.error != null) {
        fail(uresult.error.message);
      }
      var url = $.cloudinary.url("cloudinary", {
        type: "twitter_name",
        crop: "scale",
        width: 2.0,
        format: "png",
        version: uresult["version"]
      });
      expect(uresult.eager[0].url).toEqual(url);
    });
  });
  it("should successfully generate text image", function(done) {
    var uresult = null;
    runs(function(){ 
      $.cloudinary.uploader.text("hello world", function(result) {uresult = result;});
    });
    waitsFor(function() {return uresult;}, "Text", 3000);
    runs(function(){
      if (uresult.error != null) {
        fail(uresult.error.message);
      }
      expect(uresult.width).toBeBetween(50, 70);
      expect(uresult.height).toBeBetween(5, 15);
    });
  });
});
