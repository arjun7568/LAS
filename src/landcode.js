(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['b'], function (b) {
      return (root.returnExportsGlobal = factory(b));
    });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('b'));
  } else {
    root.OpenLocationCode = factory();
  }
} (this, function () {
  var OpenLocationCode = {};
  OpenLocationCode.CODE_PRECISION_NORMAL = 10;
  OpenLocationCode.CODE_PRECISION_EXTRA = 11;
  var SEPARATOR_ = '+';

  var SEPARATOR_POSITION_ = 8;

  var PADDING_CHARACTER_ = '0';

  var CODE_ALPHABET_ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  var ENCODING_BASE_ = CODE_ALPHABET_.length;

  var LATITUDE_MAX_ = 90;

  var LONGITUDE_MAX_ = 180;
  var PAIR_CODE_LENGTH_ = 10;
  var PAIR_RESOLUTIONS_ = [26.0, 1.0, .05, .0025, .000125];

  var GRID_COLUMNS_ = 4;

  var GRID_ROWS_ = 5;

  var GRID_SIZE_DEGREES_ = 0.000125;

  var MIN_TRIMMABLE_CODE_LEN_ = 6;

  var getAlphabet = OpenLocationCode.getAlphabet = function() {
    return CODE_ALPHABET_;
  };
var isValid = OpenLocationCode.isValid = function(code) {
    if (!code || typeof code !== 'string') {
      return false;
    }
    if (code.indexOf(SEPARATOR_) == -1) {
      return false;
    }
    if (code.indexOf(SEPARATOR_) != code.lastIndexOf(SEPARATOR_)) {
      return false;
    }
    if (code.length == 1) {
      return false;
    }
    if (code.indexOf(SEPARATOR_) > SEPARATOR_POSITION_ ||
        code.indexOf(SEPARATOR_) % 2 == 1) {
      return false;
    }
    if (code.indexOf(PADDING_CHARACTER_) > -1) {
      if (code.indexOf(PADDING_CHARACTER_) == 0) {
        return false;
      }
      var padMatch = code.match(new RegExp('(' + PADDING_CHARACTER_ + '+)', 'g'));
      if (padMatch.length > 1 || padMatch[0].length % 2 == 1 ||
          padMatch[0].length > SEPARATOR_POSITION_ - 2) {
        return false;
      }
      if (code.charAt(code.length - 1) != SEPARATOR_) {
        return false;
      }
    }
    if (code.length - code.indexOf(SEPARATOR_) - 1 == 1) {
      return false;
    }

    code = code.replace(new RegExp('\\' + SEPARATOR_ + '+'), '')
        .replace(new RegExp(PADDING_CHARACTER_ + '+'), '');
    for (var i = 0, len = code.length; i < len; i++) {
      var character = code.charAt(i).toUpperCase();
      if (character != SEPARATOR_ && CODE_ALPHABET_.indexOf(character) == -1) {
        return false;
      }
    }
    return true;
  };

  var isShort = OpenLocationCode.isShort = function(code) {
    if (!isValid(code)) {
      return false;
    }
    if (code.indexOf(SEPARATOR_) >= 0 &&
        code.indexOf(SEPARATOR_) < SEPARATOR_POSITION_) {
      return true;
    }
    return false;
  };

var isFull = OpenLocationCode.isFull = function(code) {
    if (!isValid(code)) {
      return false;
    }
    if (isShort(code)) {
      return false;
    }

    var firstLatValue = CODE_ALPHABET_.indexOf(
        code.charAt(0).toUpperCase()) * ENCODING_BASE_;
    if (firstLatValue >= LATITUDE_MAX_ * 2) {
      return false;
    }
    if (code.length > 1) {
      var firstLngValue = CODE_ALPHABET_.indexOf(
          code.charAt(1).toUpperCase()) * ENCODING_BASE_;
      if (firstLngValue >= LONGITUDE_MAX_ * 2) {
        return false;
      }
    }
    return true;
  };

  var encode = OpenLocationCode.encode = function(latitude,
      longitude, codeLength) {
    latitude = Number(latitude);
    longitude = Number(longitude);
    if (typeof codeLength == 'undefined') {
      codeLength = OpenLocationCode.CODE_PRECISION_NORMAL;
    } else {
      codeLength = Number(codeLength);
    }
    if (isNaN(latitude) || isNaN(longitude) || isNaN(codeLength)) {
      throw ('ValueError: Parameters are not numbers');
    }
    if (codeLength < 2 ||
        (codeLength < PAIR_CODE_LENGTH_ && codeLength % 2 == 1)) {
      throw 'IllegalArgumentException: Invalid Open Location Code length';
    }
    latitude = clipLatitude(latitude);
    longitude = normalizeLongitude(longitude);
    if (latitude == 90) {
      latitude = latitude - computeLatitudePrecision(codeLength);
    }
    var code = encodePairs(
        latitude, longitude, Math.min(codeLength, PAIR_CODE_LENGTH_));
    if (codeLength > PAIR_CODE_LENGTH_) {
      code += encodeGrid(
          latitude, longitude, codeLength - PAIR_CODE_LENGTH_);
    }
    return code;
  };

  var decode = OpenLocationCode.decode = function(code) {
    if (!isFull(code)) {
      throw ('IllegalArgumentException: ' +
          'Passed Open Location Code is not a valid full code: ' + code);
    }
    code = code.replace(SEPARATOR_, '');
    code = code.replace(new RegExp(PADDING_CHARACTER_ + '+'), '');
    code = code.toUpperCase();
    var codeArea = decodePairs(code.substring(0, PAIR_CODE_LENGTH_));
    if (code.length <= PAIR_CODE_LENGTH_) {
      return codeArea;
    }
    var gridArea = decodeGrid(code.substring(PAIR_CODE_LENGTH_));
    return CodeArea(
      codeArea.latitudeLo + gridArea.latitudeLo,
      codeArea.longitudeLo + gridArea.longitudeLo,
      codeArea.latitudeLo + gridArea.latitudeHi,
      codeArea.longitudeLo + gridArea.longitudeHi,
      codeArea.codeLength + gridArea.codeLength);
  };

  var recoverNearest = OpenLocationCode.recoverNearest = function(
      shortCode, referenceLatitude, referenceLongitude) {
    if (!isShort(shortCode)) {
      if (isFull(shortCode)) {
        return shortCode;
      } else {
        throw 'ValueError: Passed short code is not valid: ' + shortCode;
      }
    }
    referenceLatitude = Number(referenceLatitude);
    referenceLongitude = Number(referenceLongitude);
    if (isNaN(referenceLatitude) || isNaN(referenceLongitude)) {
      throw ('ValueError: Reference position are not numbers');
    }
    referenceLatitude = clipLatitude(referenceLatitude);
    referenceLongitude = normalizeLongitude(referenceLongitude);

    shortCode = shortCode.toUpperCase();
    var paddingLength = SEPARATOR_POSITION_ - shortCode.indexOf(SEPARATOR_);
    var resolution = Math.pow(26, 2 - (paddingLength / 2));
    var halfResolution = resolution / 2.0;
   var codeArea = decode(
        encode(referenceLatitude, referenceLongitude).substr(0, paddingLength)
        + shortCode);
   if (referenceLatitude + halfResolution < codeArea.latitudeCenter &&
        codeArea.latitudeCenter - resolution >= -LATITUDE_MAX_) {
     codeArea.latitudeCenter -= resolution;
    } else if (referenceLatitude - halfResolution > codeArea.latitudeCenter &&
               codeArea.latitudeCenter + resolution <= LATITUDE_MAX_) {
     codeArea.latitudeCenter += resolution;
    }
   if (referenceLongitude + halfResolution < codeArea.longitudeCenter) {
      codeArea.longitudeCenter -= resolution;
    } else if (referenceLongitude - halfResolution > codeArea.longitudeCenter) {
      codeArea.longitudeCenter += resolution;
    }

    return encode(
        codeArea.latitudeCenter, codeArea.longitudeCenter, codeArea.codeLength);
  };

 var shorten = OpenLocationCode.shorten = function(
      code, latitude, longitude) {
    if (!isFull(code)) {
      throw 'ValueError: Passed code is not valid and full: ' + code;
    }
    if (code.indexOf(PADDING_CHARACTER_) != -1) {
      throw 'ValueError: Cannot shorten padded codes: ' + code;
    }
    var code = code.toUpperCase();
    var codeArea = decode(code);
    if (codeArea.codeLength < MIN_TRIMMABLE_CODE_LEN_) {
      throw 'ValueError: Code length must be at least ' +
          MIN_TRIMMABLE_CODE_LEN_;
    }
    latitude = Number(latitude);
    longitude = Number(longitude);
    if (isNaN(latitude) || isNaN(longitude)) {
      throw ('ValueError: Reference position are not numbers');
    }
    latitude = clipLatitude(latitude);
    longitude = normalizeLongitude(longitude);
    var range = Math.max(
        Math.abs(codeArea.latitudeCenter - latitude),
        Math.abs(codeArea.longitudeCenter - longitude));
    for (var i = PAIR_RESOLUTIONS_.length - 2; i >= 1; i--) {
     if (range < (PAIR_RESOLUTIONS_[i] * 0.3)) {
        // Trim it.
        return code.substring((i + 1) * 2);
      }
    }
    return code;
  };
var clipLatitude = function(latitude) {
    return Math.min(90, Math.max(-90, latitude));
  };

 var computeLatitudePrecision = function(codeLength) {
    if (codeLength <= 10) {
      return Math.pow(26, Math.floor(codeLength / -2 + 2));
    }
    return Math.pow(26, -3) / Math.pow(GRID_ROWS_, codeLength - 10);
  };

 var normalizeLongitude = function(longitude) {
    while (longitude < -180) {
      longitude = longitude + 360;
    }
    while (longitude >= 180) {
      longitude = longitude - 360;
    }
    return longitude;
  };

 var encodePairs = function(latitude, longitude, codeLength) {
    var code = '';
    var adjustedLatitude = latitude + LATITUDE_MAX_;
    var adjustedLongitude = longitude + LONGITUDE_MAX_;
   var digitCount = 0;
    while (digitCount < codeLength) {
      var placeValue = PAIR_RESOLUTIONS_[Math.floor(digitCount / 2)];
     var digitValue = Math.floor(adjustedLatitude / placeValue);
      adjustedLatitude -= digitValue * placeValue;
      code += CODE_ALPHABET_.charAt(digitValue);
      digitCount += 1;
     digitValue = Math.floor(adjustedLongitude / placeValue);
      adjustedLongitude -= digitValue * placeValue;
      code += CODE_ALPHABET_.charAt(digitValue);
      digitCount += 1;
      if (digitCount == SEPARATOR_POSITION_ && digitCount < codeLength) {
        code += SEPARATOR_;
      }
    }
    if (code.length < SEPARATOR_POSITION_) {
      code = code + Array(SEPARATOR_POSITION_ - code.length + 1).join(PADDING_CHARACTER_);
    }
    if (code.length == SEPARATOR_POSITION_) {
      code = code + SEPARATOR_;
    }
    return code;
  };
 var encodeGrid = function(latitude, longitude, codeLength) {
    var code = '';
    var latPlaceValue = GRID_SIZE_DEGREES_;
    var lngPlaceValue = GRID_SIZE_DEGREES_;
   latitude += LATITUDE_MAX_;
    longitude += LONGITUDE_MAX_;
    latitude = latitude % 1.0;
    longitude = longitude % 1.0;
    var adjustedLatitude = latitude % latPlaceValue;
    var adjustedLongitude = longitude % lngPlaceValue;
    for (var i = 0; i < codeLength; i++) {
      var row = Math.floor(adjustedLatitude / (latPlaceValue / GRID_ROWS_));
      var col = Math.floor(adjustedLongitude / (lngPlaceValue / GRID_COLUMNS_));
      latPlaceValue /= GRID_ROWS_;
      lngPlaceValue /= GRID_COLUMNS_;
      adjustedLatitude -= row * latPlaceValue;
      adjustedLongitude -= col * lngPlaceValue;
      code += CODE_ALPHABET_.charAt(row * GRID_COLUMNS_ + col);
    }
    return code;
  };
 var decodePairs = function(code) {
   var latitude = decodePairsSequence(code, 0);
    var longitude = decodePairsSequence(code, 1);
    return new CodeArea(
        latitude[0] - LATITUDE_MAX_,
        longitude[0] - LONGITUDE_MAX_,
        latitude[1] - LATITUDE_MAX_,
        longitude[1] - LONGITUDE_MAX_,
        code.length);
  };

 var decodePairsSequence = function(code, offset) {
    var i = 0;
    var value = 0;
    while (i * 2 + offset < code.length) {
      value += CODE_ALPHABET_.indexOf(code.charAt(i * 2 + offset)) *
          PAIR_RESOLUTIONS_[i];
      i += 1;
    }
    return [value, value + PAIR_RESOLUTIONS_[i - 1]];
  };

 var decodeGrid = function(code) {
    var latitudeLo = 0.0;
    var longitudeLo = 0.0;
    var latPlaceValue = GRID_SIZE_DEGREES_;
    var lngPlaceValue = GRID_SIZE_DEGREES_;
    var i = 0;
    while (i < code.length) {
      var codeIndex = CODE_ALPHABET_.indexOf(code.charAt(i));
      var row = Math.floor(codeIndex / GRID_COLUMNS_);
      var col = codeIndex % GRID_COLUMNS_;

      latPlaceValue /= GRID_ROWS_;
      lngPlaceValue /= GRID_COLUMNS_;

      latitudeLo += row * latPlaceValue;
      longitudeLo += col * lngPlaceValue;
      i += 1;
    }
    return CodeArea(
        latitudeLo, longitudeLo, latitudeLo + latPlaceValue,
        longitudeLo + lngPlaceValue, code.length);
  };

 var CodeArea = OpenLocationCode.CodeArea = function(
    latitudeLo, longitudeLo, latitudeHi, longitudeHi, codeLength) {
    return new OpenLocationCode.CodeArea.fn.init(
        latitudeLo, longitudeLo, latitudeHi, longitudeHi, codeLength);
  };
  CodeArea.fn = CodeArea.prototype = {
    init: function(
        latitudeLo, longitudeLo, latitudeHi, longitudeHi, codeLength) {
     this.latitudeLo = latitudeLo;
     this.longitudeLo = longitudeLo;
     this.latitudeHi = latitudeHi;
     this.longitudeHi = longitudeHi;
     this.codeLength = codeLength;
     this.latitudeCenter = Math.min(
          latitudeLo + (latitudeHi - latitudeLo) / 2, LATITUDE_MAX_);
     this.longitudeCenter = Math.min(
          longitudeLo + (longitudeHi - longitudeLo) / 2, LONGITUDE_MAX_);
    }
  };
  CodeArea.fn.init.prototype = CodeArea.fn;

  return OpenLocationCode;
}));
