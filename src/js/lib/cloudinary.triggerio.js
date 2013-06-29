/*
 * Cloudinary's trigger.io library - v1.0.0 
 * Copyright Cloudinary
 * see https://github.com/cloudinary/cloudinary_triggerio
 */

(function( $ ) {
  var CF_SHARED_CDN = "d3jpl91pxevbkh.cloudfront.net";
  var AKAMAI_SHARED_CDN = "cloudinary-a.akamaihd.net";
  var SHARED_CDN = AKAMAI_SHARED_CDN;
  
  function option_consume(options, option_name, default_value) {
    var result = options[option_name];
    delete options[option_name];
    return typeof(result) == 'undefined' ? default_value : result;
  }
  function build_array(arg) {
    if (!arg) {
      return [];
    } else if ($.isArray(arg)) {
      return arg;
    } else { 
      return [arg];
    }
  }
  function present(value) {
    return typeof value != 'undefined' && ("" + value).length > 0;
  } 
  function generate_transformation_string(options) {
    var width = options['width'];
    var height = options['height'];
    var size = option_consume(options, 'size');
    if (size) {
      var split_size = size.split("x");
      options['width'] = width = split_size[0];
      options['height'] = height = split_size[1];  
    }       
    var has_layer = options.overlay || options.underlay;
     
    var crop = option_consume(options, 'crop');
    var angle = build_array(option_consume(options, 'angle')).join(".");

    var no_html_sizes = has_layer || present(angle) || crop == "fit" || crop == "limit";
     
    if (width && (no_html_sizes || parseFloat(width) < 1)) delete options['width'];
    if (height && (no_html_sizes || parseFloat(height) < 1)) delete options['height'];
    if (!crop && !has_layer) width = height = undefined;

    var background = option_consume(options, 'background');
    background = background && background.replace(/^#/, 'rgb:');

    var base_transformations = build_array(option_consume(options, 'transformation', []));
    var named_transformation = [];
    if ($.grep(base_transformations, function(bs) {return typeof(bs) == 'object';}).length > 0) {
      base_transformations = $.map(base_transformations, function(base_transformation) {
        return typeof(base_transformation) == 'object' ? generate_transformation_string($.extend({}, base_transformation)) : generate_transformation_string({transformation: base_transformation});
      });
    } else {
      named_transformation = $.grep(base_transformations, function() { return this != null && this != ""}).join(".");
      base_transformations = [];
    }
    var effect = option_consume(options, "effect");
    if ($.isArray(effect)) effect = effect.join(":");
    
    var border = option_consume(options, "border")
    if ($.isPlainObject(border)) { 
      var border_width = "" + (border.width || 2);
      var border_color = (border.color || "black").replace(/^#/, 'rgb:');
      border = border_width + "px_solid_" + border_color;
    }
    
    var flags = build_array(option_consume(options, 'flags')).join(".");

    var params = [['c', crop], ['t', named_transformation], ['w', width], ['h', height], ['b', background], ['e', effect], ['a', angle], ['bo', border], ['fl', flags]];
    var simple_params = {
      x: 'x',
      y: 'y',
      radius: 'r',
      gravity: 'g',
      quality: 'q',
      prefix: 'p',
      default_image: 'd',
      underlay: 'u',
      overlay: 'l',
      fetch_format: 'f',
      density: 'dn',
      page: 'pg',
      color_space: 'cl',
      delay: 'dl',
      opacity: 'o'
    };
    for (var param in simple_params) {
      params.push([simple_params[param], option_consume(options, param)]);
    }
    params.sort(function(a, b){return a[0]<b[0] ? -1  : (a[0]>b[0] ? 1 : 0);});
    params.push([option_consume(options, 'raw_transformation')]);
    var transformation = $.map($.grep(params, function(param) {
      var value = param[param.length-1];
      return present(value);
    }), function(param) {
      return param.join("_");
    }).join(",");
    base_transformations.push(transformation);
    return $.grep(base_transformations, present).join("/");
  }
  var dummyImg = undefined;
  function absolutize(url) {
    if (!dummyImg) dummyImg = document.createElement("img");
    dummyImg.src = url;
    url = dummyImg.src;
    dummyImg.src = null;
    return url;
  }
  function cloudinary_url(public_id, options) { 
    options = options || {};
    var type = option_consume(options, 'type', 'upload');
    if (type == 'fetch') {
      options.fetch_format = options.fetch_format || option_consume(options, 'format');
    }
    var transformation = generate_transformation_string(options);
    var resource_type = option_consume(options, 'resource_type', "image");
    var version = option_consume(options, 'version');
    var format = option_consume(options, 'format');
    var cloud_name = option_consume(options, 'cloud_name', $.cloudinary.config().cloud_name);
    if (!cloud_name) throw "Unknown cloud_name";
    var private_cdn = option_consume(options, 'private_cdn', $.cloudinary.config().private_cdn);    
    var secure_distribution = option_consume(options, 'secure_distribution', $.cloudinary.config().secure_distribution);    
    var cname = option_consume(options, 'cname', $.cloudinary.config().cname);
    var cdn_subdomain = option_consume(options, 'cdn_subdomain', $.cloudinary.config().cdn_subdomain);
    var shorten = option_consume(options, 'shorten', $.cloudinary.config().shorten);
    var secure = option_consume(options, 'secure', window.location.protocol == 'https:'); 
    secure_distribution = secure_distribution || SHARED_CDN; 

    if (type == 'fetch') {
      public_id = absolutize(public_id); 
    }
    
    if (public_id.match(/^https?:/)) {
      if (type == "upload" || type == "asset") return public_id;
      public_id = encodeURIComponent(public_id).replace(/%3A/g, ":").replace(/%2F/g, "/"); 
    } else if (format) {
      public_id += "." + format;
    }

    var prefix = secure ? 'https://' : 'http://';
    if (cloud_name.match(/^\//) && !secure) {    
      prefix = "/res" + cloud_name;
    } else {
	    var subdomain = cdn_subdomain ? "a" + ((crc32(public_id) % 5) + 1) + "." : "";
	    if (secure) {
	      prefix += secure_distribution;
	    } else {
	      host = cname || (private_cdn ? cloud_name + "-res.cloudinary.com" : "res.cloudinary.com" );
	      prefix += subdomain + host;
	    }
    	if (!private_cdn || (secure && secure_distribution == AKAMAI_SHARED_CDN)) prefix += "/" + cloud_name;
    }
    if (shorten && resource_type == "image" && type == "upload") {
      resource_type = "iu";
      type = undefined;
    }
    if (public_id.search("/") >= 0 && !public_id.match(/^v[0-9]+/) && !public_id.match(/^https?:\//) && !present(version)) {
      version = 1;
    }

    var url = [prefix, resource_type, type, transformation, version ? "v" + version : "",
               public_id].join("/").replace(/([^:])\/+/g, '$1/');
    return url;
  }
  function html_only_attributes(options) {
    var width = option_consume(options, 'html_width');
    var height = option_consume(options, 'html_height');
    if (width) options['width'] = width;
    if (height) options['height'] = height;    
  }
  
  function utf8_encode (argString) {
    // http://kevin.vanzonneveld.net
    // +   original by: Webtoolkit.info (http://www.webtoolkit.info/)
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   improved by: sowberry
    // +    tweaked by: Jack
    // +   bugfixed by: Onno Marsman
    // +   improved by: Yves Sucaet
    // +   bugfixed by: Onno Marsman
    // +   bugfixed by: Ulrich
    // +   bugfixed by: Rafal Kukawski
    // +   improved by: kirilloid
    // *     example 1: utf8_encode('Kevin van Zonneveld');
    // *     returns 1: 'Kevin van Zonneveld'

    if (argString === null || typeof argString === "undefined") {
        return "";
    }

    var string = (argString + ''); // .replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var utftext = '',
        start, end, stringl = 0;

    start = end = 0;
    stringl = string.length;
    for (var n = 0; n < stringl; n++) {
        var c1 = string.charCodeAt(n);
        var enc = null;

        if (c1 < 128) {
            end++;
        } else if (c1 > 127 && c1 < 2048) {
            enc = String.fromCharCode((c1 >> 6) | 192, (c1 & 63) | 128);
        } else {
            enc = String.fromCharCode((c1 >> 12) | 224, ((c1 >> 6) & 63) | 128, (c1 & 63) | 128);
        }
        if (enc !== null) {
            if (end > start) {
                utftext += string.slice(start, end);
            }
            utftext += enc;
            start = end = n + 1;
        }
    }

    if (end > start) {
        utftext += string.slice(start, stringl);
    }

    return utftext;
  }
  
  function crc32 (str) {
    // http://kevin.vanzonneveld.net
    // +   original by: Webtoolkit.info (http://www.webtoolkit.info/)
    // +   improved by: T0bsn
    // +   improved by: http://stackoverflow.com/questions/2647935/javascript-crc32-function-and-php-crc32-not-matching
    // -    depends on: utf8_encode
    // *     example 1: crc32('Kevin van Zonneveld');
    // *     returns 1: 1249991249
    str = utf8_encode(str);
    var table = "00000000 77073096 EE0E612C 990951BA 076DC419 706AF48F E963A535 9E6495A3 0EDB8832 79DCB8A4 E0D5E91E 97D2D988 09B64C2B 7EB17CBD E7B82D07 90BF1D91 1DB71064 6AB020F2 F3B97148 84BE41DE 1ADAD47D 6DDDE4EB F4D4B551 83D385C7 136C9856 646BA8C0 FD62F97A 8A65C9EC 14015C4F 63066CD9 FA0F3D63 8D080DF5 3B6E20C8 4C69105E D56041E4 A2677172 3C03E4D1 4B04D447 D20D85FD A50AB56B 35B5A8FA 42B2986C DBBBC9D6 ACBCF940 32D86CE3 45DF5C75 DCD60DCF ABD13D59 26D930AC 51DE003A C8D75180 BFD06116 21B4F4B5 56B3C423 CFBA9599 B8BDA50F 2802B89E 5F058808 C60CD9B2 B10BE924 2F6F7C87 58684C11 C1611DAB B6662D3D 76DC4190 01DB7106 98D220BC EFD5102A 71B18589 06B6B51F 9FBFE4A5 E8B8D433 7807C9A2 0F00F934 9609A88E E10E9818 7F6A0DBB 086D3D2D 91646C97 E6635C01 6B6B51F4 1C6C6162 856530D8 F262004E 6C0695ED 1B01A57B 8208F4C1 F50FC457 65B0D9C6 12B7E950 8BBEB8EA FCB9887C 62DD1DDF 15DA2D49 8CD37CF3 FBD44C65 4DB26158 3AB551CE A3BC0074 D4BB30E2 4ADFA541 3DD895D7 A4D1C46D D3D6F4FB 4369E96A 346ED9FC AD678846 DA60B8D0 44042D73 33031DE5 AA0A4C5F DD0D7CC9 5005713C 270241AA BE0B1010 C90C2086 5768B525 206F85B3 B966D409 CE61E49F 5EDEF90E 29D9C998 B0D09822 C7D7A8B4 59B33D17 2EB40D81 B7BD5C3B C0BA6CAD EDB88320 9ABFB3B6 03B6E20C 74B1D29A EAD54739 9DD277AF 04DB2615 73DC1683 E3630B12 94643B84 0D6D6A3E 7A6A5AA8 E40ECF0B 9309FF9D 0A00AE27 7D079EB1 F00F9344 8708A3D2 1E01F268 6906C2FE F762575D 806567CB 196C3671 6E6B06E7 FED41B76 89D32BE0 10DA7A5A 67DD4ACC F9B9DF6F 8EBEEFF9 17B7BE43 60B08ED5 D6D6A3E8 A1D1937E 38D8C2C4 4FDFF252 D1BB67F1 A6BC5767 3FB506DD 48B2364B D80D2BDA AF0A1B4C 36034AF6 41047A60 DF60EFC3 A867DF55 316E8EEF 4669BE79 CB61B38C BC66831A 256FD2A0 5268E236 CC0C7795 BB0B4703 220216B9 5505262F C5BA3BBE B2BD0B28 2BB45A92 5CB36A04 C2D7FFA7 B5D0CF31 2CD99E8B 5BDEAE1D 9B64C2B0 EC63F226 756AA39C 026D930A 9C0906A9 EB0E363F 72076785 05005713 95BF4A82 E2B87A14 7BB12BAE 0CB61B38 92D28E9B E5D5BE0D 7CDCEFB7 0BDBDF21 86D3D2D4 F1D4E242 68DDB3F8 1FDA836E 81BE16CD F6B9265B 6FB077E1 18B74777 88085AE6 FF0F6A70 66063BCA 11010B5C 8F659EFF F862AE69 616BFFD3 166CCF45 A00AE278 D70DD2EE 4E048354 3903B3C2 A7672661 D06016F7 4969474D 3E6E77DB AED16A4A D9D65ADC 40DF0B66 37D83BF0 A9BCAE53 DEBB9EC5 47B2CF7F 30B5FFE9 BDBDF21C CABAC28A 53B39330 24B4A3A6 BAD03605 CDD70693 54DE5729 23D967BF B3667A2E C4614AB8 5D681B02 2A6F2B94 B40BBE37 C30C8EA1 5A05DF1B 2D02EF8D";

    var crc = 0;
    var x = 0;
    var y = 0;

    crc = crc ^ (-1);
    for (var i = 0, iTop = str.length; i < iTop; i++) {
        y = (crc ^ str.charCodeAt(i)) & 0xFF;
        x = "0x" + table.substr(y * 9, 8);
        crc = (crc >>> 8) ^ x;
    }

    crc = crc ^ (-1);
    //convert to unsigned 32-bit int if needed
    if (crc < 0) {crc += 4294967296}
    return crc;
  }

  
  // parseUri 1.2.2
  // (c) Steven Levithan <stevenlevithan.com>
  // MIT License  
  function parseUri (str) {
    var o   = parseUri.options,
      m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
      uri = {},
      i   = 14;
  
    while (i--) uri[o.key[i]] = m[i] || "";
  
    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
      if ($1) uri[o.q.name][$1] = $2;
    });
  
    return uri;
  };
  
  parseUri.options = {
    strictMode: false,
    key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
    q:   {
      name:   "queryKey",
      parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
    parser: {
      strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
      loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
  };

  var cloudinary_config = undefined;
  $.cloudinary = {
    CF_SHARED_CDN: CF_SHARED_CDN,  
    AKAMAI_SHARED_CDN: AKAMAI_SHARED_CDN,
    SHARED_CDN: SHARED_CDN,    
    config: function(new_config, new_value) {
      if (new_config === true) { // Reset
        cloudinary_config = null; 
        new_config = null;
      } 
      if (!cloudinary_config) {
        cloudinary_config = {};
        if (forge.config.modules.parameters && forge.config.modules.parameters.CLOUDINARY_URL) {
          var uri = parseUri(forge.config.modules.parameters.CLOUDINARY_URL);
          cloudinary_config = {
            cloud_name: uri.host,
            api_key: uri.user,
            api_secret: uri.password,
            private_cdn: uri.path && uri.path != "/",
            secure_distribution: uri.path &&  uri.path.substring(1)
          };
          if (uri.query) {
            for (var k in uri.queryKey) {
              cloudinary_config[k] = uri.queryKey[k];
            }
          }
        }
        $('meta[name^="cloudinary_"]').each(function() {
          cloudinary_config[$(this).attr('name').replace("cloudinary_", '')] = $(this).attr('content');
        });
      }
      if (typeof(new_value) != 'undefined') {
        cloudinary_config[new_config] = new_value;
      } else if (typeof(new_config) == 'string') {
        return cloudinary_config[new_config];
      } else if (new_config) {
        cloudinary_config = new_config;
      }
      return cloudinary_config;
    },
    url: function(public_id, options) {
      options = $.extend({}, options);
      return cloudinary_url(public_id, options);    
    },
    url_internal: cloudinary_url,
    transformation_string: generate_transformation_string,
    image: function(public_id, options) {
      options = $.extend({}, options);
      var url = cloudinary_url(public_id, options);
      html_only_attributes(options);
      return $('<img/>').attr(options).attr('src', url);      
    },
    facebook_profile_image: function(public_id, options) {
      return $.cloudinary.image(public_id, $.extend({type: 'facebook'}, options));
    },
    twitter_profile_image: function(public_id, options) {
      return $.cloudinary.image(public_id, $.extend({type: 'twitter'}, options));
    },
    twitter_name_profile_image: function(public_id, options) {
      return $.cloudinary.image(public_id, $.extend({type: 'twitter_name'}, options));
    },
    gravatar_image: function(public_id, options) {
      return $.cloudinary.image(public_id, $.extend({type: 'gravatar'}, options));
    },
    fetch_image: function(public_id, options) {
      return $.cloudinary.image(public_id, $.extend({type: 'fetch'}, options));
    }, 
    utils: {
      present: present,
      build_array: build_array
    }
  };
  $.fn.cloudinary = function(options) {
    this.filter('img').each(function() {
      var img_options = $.extend({width: $(this).attr('width'), height: $(this).attr('height'),
                          src: $(this).attr('src')},
                         $.extend($(this).data(), options));
      var public_id = option_consume(img_options, 'source', option_consume(img_options, 'src')); 
      var url = cloudinary_url(public_id, img_options);
      html_only_attributes(img_options);
      $(this).attr({src: url, width: img_options['width'], height: img_options['height']});
    });
    return this;
  };
  $.fn.fetchify = function(options) {
    return this.cloudinary($.extend(options, {'type': 'fetch'}));
  };

  $.cloudinary.uploader = {};

  var timestamp = function() {
    return Math.floor(new Date().getTime() / 1000);
  };

  var build_eager = function(transformations) {
    transformations = build_array(transformations);
    var results = [];
    for (var _i = 0, _len = transformations.length; _i < _len; _i++) {
      var transformation = transformations[_i];
      transformation = _.clone(transformation);
      results.push(_.filter([$.cloudinary.transformation_string(transformation), transformation.format], present).join("/"));
    }
    return results.join("|");
  };

  var build_custom_headers = function(headers) {
    if (!(headers != null)) {
      return undefined;
    } else if (_.isArray(headers)) {
      return headers.join("\n");
    } else if (_.isObject(headers)) {
      var _results = [];
      for (var k in headers) {
        _results.push(k + ": " + headers[k]);
      }
      return _results.join("\n");
    } else {
      return headers;
    }
  };

  var build_upload_params = function(options) {
    var params;
    params = {
      transformation: $.cloudinary.transformation_string(options),
      public_id: options.public_id,
      callback: options.callback,
      format: options.format,
      backup: options.backup,
      faces: options.faces,
      exif: options.exif,
      image_metadata: options.image_metadata,
      colors: options.colors,
      type: options.type,
      eager: build_eager(options.eager),
      headers: build_custom_headers(options.headers),
      use_filename: options.use_filename,
      discard_original_filename: options.discard_original_filename,
      notification_url: options.notification_url,
      eager_notification_url: options.eager_notification_url,
      eager_async: options.eager_async,
      invalidate: options.invalidate,
      tags: options.tags && build_array(options.tags).join(",")
    };
    return params;
  };

  $.cloudinary.uploader.upload = function(file, callback, options) {
    if (options == null) { options = {}; }
    return call_api("upload", callback, options, function() {
      var params;
      params = build_upload_params(options);
      if (_.isString(file) && file.match(/^https?:|^s3:|^data:image\/\w*;base64,([a-zA-Z0-9\/+\n=]+)$/)) {
        return [params, {file: file}];
      } else {
        return [params, {}, file];
      }
    });
  };

  $.cloudinary.uploader.explicit = function(public_id, callback, options) {
    if (options == null) { options = {}; }
    return call_api("explicit", callback, options, function() {
      return [
        {
          type: options.type,
          public_id: public_id,
          callback: options.callback,
          eager: build_eager(options.eager),
          headers: build_custom_headers(options.headers),
          tags: options.tags && build_array(options.tags).join(",")
        }
      ];
    });
  };

  $.cloudinary.uploader.destroy = function(public_id, callback, options) {
    if (options == null) { options = {}; }
    return call_api("destroy", callback, options, function() {
      return [
        {
          type: options.type,
          invalidate: options.invalidate,
          public_id: public_id
        }
      ];
    });
  };

  var TEXT_PARAMS = ["public_id", "font_family", "font_size", "font_color", "text_align", "font_weight", "font_style", "background", "opacity", "text_decoration"];

  $.cloudinary.uploader.text = function(text, callback, options) {
    if (options == null) { options = {}; }
    return call_api("text", callback, options, function() {
      var k, params, _i, _len;
      params = { text: text };
      for (_i = 0, _len = TEXT_PARAMS.length; _i < _len; _i++) {
        k = TEXT_PARAMS[_i];
        if (options[k] != null) {
          params[k] = options[k];
        }
      }
      return [params];
    });
  };

  var build_api_url = function(action, options) {
    if (action == null) { action = 'upload'; }
    if (options == null) { options = {}; }
    var cloudinary = options.upload_prefix || $.cloudinary.config().upload_prefix || "https://api.cloudinary.com";
    var cloud_name = options.cloud_name || $.cloudinary.config().cloud_name;
    if (!cloud_name) throw "Must supply cloud_name";
    var resource_type = options.resource_type || "image";
    return [cloudinary, "v1_1", cloud_name, resource_type, action].join("/");
  };

  $.cloudinary.uploader.api_sign_request = function(params_to_sign, api_secret) {
    var to_sign = [];
    for (var k in params_to_sign) {
      var v = params_to_sign[k];
      if (v) {
        to_sign.push("" + k + "=" + (build_array(v).join(",")));
      }
    }
    to_sign.sort();
    return "" + CryptoJS.SHA1(to_sign.join("&") + api_secret);
  };

  var call_api = function(action, callback, options, get_params) {
    options = _.clone(options);
    var api_key = options.api_key || $.cloudinary.config().api_key;
    if (!api_key) throw "Must supply api_key";
    var tmp_params = get_params.call();
    var params = tmp_params[0];
    var unsigned_params = tmp_params[1];
    var file = tmp_params[2];
    if (options.signature && options.timestamp) {
      params.signature = options.signature;
      params.timestamp = options.timestamp;
    } else {
      var api_secret = options.api_key || $.cloudinary.config().api_secret;
      if (!api_secret) throw "Must supply api_secret";
      params.timestamp = timestamp();
      params.signature = $.cloudinary.uploader.api_sign_request(params, api_secret);
    }
    params = _.extend(params, unsigned_params);
    var api_url = build_api_url(action, options) + "?";
    for (var key in params) {
      var value = params[key];
      if (_.isArray(value)) {
        for (var _i = 0, _len = value.length; _i < _len; _i++) {
          api_url += encodeURIComponent(key+"[]") + "=" + encodeURIComponent(value[_i]) + "&";
        }
      } else if (present(value)) {
        api_url += encodeURIComponent(key) + "=" + encodeURIComponent(value) + "&";
      }
    }
    api_url += "api_key=" + api_key;
    var files = null;
    if (file) {
      file.name = "file";
      files = [file];
    } 
    forge.request.ajax({
      type: 'POST',
      url: api_url,
      dataType: 'json',
      data: {},
      files: files,
      timeout: options.timeout || 60000,
      success: function(data) {
        return callback(data);
      },
      error: function(error) {
        var result;
        if (_.include(["400", "401", "500"], error.statusCode)) {
          try {
            result = JSON.parse(error.content);
          } catch (e) {
            result = { error: { message: "Server return invalid JSON response. Status Code " + res.statusCode } };
          }
          if (result["error"]) {
            result["error"]["http_code"] = error.statusCode;
          }
          return callback(result);
        } else {
          return callback({ error: { message: "Server returned unexpected status code - " + error.statusCode + " " + error.message, http_code: error.statusCode } });
        }
      }
    });
    return true;
  };
})(jQuery);
