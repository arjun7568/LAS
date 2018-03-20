var polygons = [];
function clearPolygons() {
  for (var i = 0; i < polygons.length; i++) {
    polygons[i].setMap(null);
  }
  polygons = [];
}
var textLabels = [];
function clearTextLabels() {
  for (var i = 0; i < textLabels.length; i++) {
    textLabels[i].setMap(null);
  }
  textLabels = [];
}
function zoomTo(code, zoomLevel) {
  var codeArea = OpenLocationCode.decode(code);
  var center = new google.maps.LatLng(
      codeArea.latitudeCenter, codeArea.longitudeCenter);
  map.setCenter(center);
  if (typeof zoomLevel != 'undefined') {
    map.setZoom(zoomLevel);
    return;
  }
  var oldZoom = map.getZoom();
  var sw = new google.maps.LatLng(codeArea.latitudeLo, codeArea.longitudeLo);
  var ne = new google.maps.LatLng(codeArea.latitudeHi, codeArea.longitudeHi);
  map.fitBounds(new google.maps.LatLngBounds(sw, ne));
  var newZoom = map.getZoom();
  if (newZoom < oldZoom) {
    return;
  }
  if (oldZoom > 14 && newZoom > 17) {
    map.setZoom(oldZoom);
  }
}
function formatCode(code) {
  var codeArea = OpenLocationCode.decode(code);
  return OpenLocationCode.encode(
      codeArea.latitudeCenter, codeArea.longitudeCenter, codeArea.codeLength);
}
function displayOlcArea(map, code, fill) {
    if (typeof fill == 'undefined') {
      fill = '#e51c23';
    }
  var codeArea = OpenLocationCode.decode(code);
  var sw = new google.maps.LatLng(codeArea.latitudeLo, codeArea.longitudeLo);
  var ne = new google.maps.LatLng(codeArea.latitudeHi, codeArea.longitudeHi);
  var bounds = new google.maps.LatLngBounds(sw, ne);

  var rectangle = new google.maps.Rectangle({
      bounds: bounds,
      strokeColor: fill,
      strokeOpacity: 1.0,
      strokeWeight: 2,
      fillColor: fill,
      fillOpacity: 0.3,
      clickable: false,
      map: map
  });
  return rectangle;
}

function geocodeAddress(olcCode, address, callbackFunction) {
  if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
    return false;
  }
  var geocoder = new google.maps.Geocoder();
  geocoder.geocode(
      {'address': address},
      function(results, status) {
        if (status != google.maps.GeocoderStatus.OK) {
          document.getElementById('address').innerHTML = 'Geocoder failed';
          return;
        }
        var addressLocation = results[0].geometry.location;
        callbackFunction(
            olcCode, address, addressLocation.lat(), addressLocation.lng());
      });
}

function geocodeLatLng(lat, lng, olcCode, callbackFunction) {
  if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
    return false;
  }
  var geocoder = new google.maps.Geocoder();
  var latlng = new google.maps.LatLng(lat, lng);
  geocoder.geocode(
      {'latLng': latlng},
      function(results, status) {
        if (status != google.maps.GeocoderStatus.OK) {
          document.getElementById('address').innerHTML = 'Geocoder failed';
          return;
        }
        var addressNames = [];
        var addressComponents = [];
        var postal_code = '';
        var componentTypes = [
            'neighborhood',
            'sublocality_level_2',
            'sublocality_level_1',
            'locality',
            'administrative_area_level_4',
            'administrative_area_level_3',
            'administrative_area_level_2',
            'administrative_area_level_1'];
        for (var i = 0; i < results.length; i++) {
          for (var j = 0; j < results[i].address_components.length; j++) {
            var component = results[i].address_components[j];
            for (var k = 0; k < component.types.length; k++) {
              if (componentTypes.indexOf(component.types[k]) > -1 &&
                  addressComponents.indexOf(component.types[k]) == -1 &&
                  addressNames.indexOf(component.long_name) == -1 &&
                  component.long_name.indexOf(',') == -1) {
                addressNames.push(component.long_name);
                addressComponents.push(component.types[k]);
              }
            }
          }
        }
        var geocodedAddress = [];
        for (var i = 0; i < componentTypes.length; i++) {
          var componentIndex = addressComponents.indexOf(componentTypes[i]);
          if (componentIndex != -1) {
            geocodedAddress.push(addressNames[componentIndex]);
          }
          if (geocodedAddress.length == 3) {
            break;
          }
        }
        if (postal_code !== '') {
          geocodedAddress.push(postal_code);
        }
        callbackFunction(olcCode, geocodedAddress.join(', '));
      });
}
var OlcStandardGrid = function(olcCode, lineColor, map) {
  var latLo, latHi, lngLo, lngHi;
  var latSteps = 26;
  var lngSteps = 26;
  var stepDegrees;
  if (olcCode != '') {
    var codeArea = OpenLocationCode.decode(olcCode);
    latLo = codeArea.latitudeLo;
    latHi = codeArea.latitudeHi;
    lngLo = codeArea.longitudeLo;
    lngHi = codeArea.longitudeHi;
    stepDegrees = (latHi - latLo) / latSteps;
    steps = 26;
  } else {
    latLo = -90;
    latHi = 90;
    lngLo = -180;
    lngHi = 180;
    stepDegrees = 1;
    latSteps = 180;
    lngSteps = 360;
  }
  var quarterStep = stepDegrees / 2;
  var halfStep = stepDegrees / 2;

  this.gridlines_ = [];
  this.labels_ = [];
  for (var step = 0; step <= lngSteps; step++) {
    var lng = lngLo + step * stepDegrees;
    var path = [new google.maps.LatLng(latLo, lng),
                new google.maps.LatLng((latLo + latHi) / 2, lng),
                new google.maps.LatLng(latHi, lng)];
    var line = new google.maps.Polyline({
      path: path,
      strokeColor: lineColor,
      strokeOpacity: 1,
      strokeWeight: 2,
      clickable: false,
      map: map
    });
    this.gridlines_.push(line);
    if (step < lngSteps) {
      var label = new TextOverlay(
          new google.maps.LatLng(latHi - quarterStep, lng + halfStep),
          OpenLocationCode.getAlphabet().charAt(step),
          map);
      this.labels_.push(label);
      var label = new TextOverlay(
        new google.maps.LatLng(latLo + quarterStep, lng + halfStep),
        OpenLocationCode.getAlphabet().charAt(step),
        map);
      this.labels_.push(label);
    }
  }
  for (var step = 0; step <= latSteps; step++) {
    var lat = latLo + step * stepDegrees;
    var path = [new google.maps.LatLng(lat, lngLo),
                new google.maps.LatLng(lat, (lngLo + lngHi) / 2),
                new google.maps.LatLng(lat, lngHi)];
    var line = new google.maps.Polyline({
      path: path,
      strokeColor: lineColor,
      strokeOpacity: 1,
      strokeWeight: 2,
      clickable: false,
      map: map
    });
    this.gridlines_.push(line);
    if (step < latSteps) {
      var label = new TextOverlay(
          new google.maps.LatLng(lat + halfStep, lngLo + quarterStep),
          OpenLocationCode.getAlphabet().charAt(step),
          map);
      this.labels_.push(label);
      var label = new TextOverlay(
        new google.maps.LatLng(lat + halfStep, lngHi - quarterStep),
        OpenLocationCode.getAlphabet().charAt(step),
        map);
      this.labels_.push(label);
    }
  }
};

OlcStandardGrid.prototype.clear = function() {
  for (var i = 0; i < this.gridlines_.length; i++) {
    this.gridlines_[i].setMap(null);
  }
  this.gridlines_ = [];
  for (var i = 0; i < this.labels_.length; i++) {
    this.labels_[i].setMap(null);
  }
  this.labels_ = [];
};

function OlcRefinedGrid(olcCode, lineColor, map) {
  var codeArea = OpenLocationCode.decode(olcCode);
  var sw = new google.maps.LatLng(codeArea.latitudeLo, codeArea.longitudeLo);
  var ne = new google.maps.LatLng(codeArea.latitudeHi, codeArea.longitudeHi);
  var bounds = new google.maps.LatLngBounds(sw, ne);

  this.gridlines_ = [];
  this.labels_ = [];
  var lngStep = (codeArea.longitudeHi - codeArea.longitudeLo) / 4;
  var lngHalfStep = lngStep / 2;
  var latStep = (codeArea.latitudeHi - codeArea.latitudeLo) / 5;
  var latHalfStep = latStep / 2;
  for (var i = 0; i <= 4; i++) {
    var lower = new google.maps.LatLng(
        codeArea.latitudeLo, codeArea.longitudeLo + i * lngStep);
    var upper = new google.maps.LatLng(
        codeArea.latitudeHi, codeArea.longitudeLo + i * lngStep);
    var line = new google.maps.Polyline({
      path: [lower, upper],
      strokeColor: lineColor,
      strokeOpacity: 1,
      strokeWeight: 2,
      clickable: false,
      map: map
    });
    this.gridlines_.push(line);
  }
  for (var i = 0; i <= 5; i++) {
    var left = new google.maps.LatLng(
        codeArea.latitudeLo + i * latStep, codeArea.longitudeLo);
    var right = new google.maps.LatLng(
        codeArea.latitudeLo + i * latStep, codeArea.longitudeHi);
    var line = new google.maps.Polyline({
      path: [left, right],
      strokeColor: lineColor,
      strokeOpacity: 1,
      strokeWeight: 2,
      clickable: false,
      map: map
    });
    this.gridlines_.push(line);
  }
  for (var col = 0; col < 4; col++) {
    for (var row = 0; row < 5; row++) {
      var center = new google.maps.LatLng(
          codeArea.latitudeLo + latHalfStep + row * latStep,
          codeArea.longitudeLo + lngHalfStep + col * lngStep);
      var label = new TextOverlay(
          center,
          OpenLocationCode.getAlphabet().charAt(row * 4 + col),
          map);
      this.labels_.push(label);
    }
  }
}

OlcRefinedGrid.prototype.clear = function() {
  for (var i = 0; i < this.gridlines_.length; i++) {
    this.gridlines_[i].setMap(null);
  }
  this.gridlines_ = [];
  for (var i = 0; i < this.labels_.length; i++) {
    this.labels_[i].setMap(null);
  }
  this.labels_ = [];
};

TextOverlay.prototype = new google.maps.OverlayView();

function TextOverlay(latLng, displayText, map) {
  this.latLng_ = latLng;
  this.displayText_ = displayText;
  this.className_ = 'map_label';
  this.map_ = map;
  this.div_ = null;
  this.heightOffset_ = 0;
  this.widthOffset_ = 0;
  this.setMap(map);
}

TextOverlay.prototype.onAdd = function() {
  var div = document.createElement('DIV');
  div.className = this.className_;
  div.innerHTML = this.displayText_;
  div.style.position = 'absolute';
  this.div_ = div;
  var panes = this.getPanes();
  panes.overlayLayer.appendChild(div);
  this.heightOffset_ = this.div_.offsetHeight / 2;
  this.widthOffset_ = this.div_.offsetWidth / 2;
};
TextOverlay.prototype.draw = function() {
  var overlayProjection = this.getProjection();
  var position = overlayProjection.fromLatLngToDivPixel(this.latLng_);
  this.div_.style.left = (position.x - this.widthOffset_) + 'px';
  this.div_.style.top = (position.y - this.heightOffset_) + 'px';
};
TextOverlay.prototype.onRemove = function() {
  this.div_.parentNode.removeChild(this.div_);
  this.div_ = null;
};

