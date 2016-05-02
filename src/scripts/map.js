var map = (function() {

  var $map, $tileLayer, $topoLayer, $currentLayer, mapContainer, districtGeo, districtData, scale, popup, dimmed, timeout;

  var defaultDistrict = validateHash(location.hash.match(/#(\w+)/)[1]) || '09475';

  var highlight = {
    color: 'black',
    weight: 2.5,
    fillOpacity: 1,
    opacity: 1
  };

  var lowlight = {
    color: 'black',
    weight: 0.5,
    fillOpacity: 0.4,
    opacity: 1
  };

  function init() {

    extendLeaflet();
    draw();
  }

  function draw() {

    mapContainer = document.getElementById('map-wrapper');

    getGeometry(getData);
  }

  function getGeometry(callback) {

    utils.getJson('./data/landkreise.topo.json', function (features) {

      $map = L.map('map', {

        scrollWheelZoom: false,
        zoomControl: false,
        zoom: 7
      });

      L.control.zoom({

        position:'bottomright'
      }).addTo($map);

      $tileLayer = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {

        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
      }).addTo($map);

      $map.on('click', resize);
      $map.on('dblclick', resize);

      districtGeo = features;

      callback();
    });
  }

  function getData() {

    utils.getJson('./data/landkreise.json', function (features) {

      districtData = features;
      scale = constructScale(districtData, 6);

      $topoLayer = new L.TopoJSON();
      $topoLayer.addData(districtGeo);
      $topoLayer.addTo($map);

      text.init(districtData, scale);
      text.render(defaultDistrict);

      getColors();
    });
  }

  function getColors() {

    popup = L.popup({ closeButton: false });

    $topoLayer.eachLayer(function (layer) {

      var currentDistrict = districtData.filter(function (element) {

        return element.id === layer.feature.id;
      })[0];

      layer.setStyle({

        fillColor: getColor(getCategory(currentDistrict.shopCountDeltaPrc, scale))
      });

      layer.setStyle(lowlight);

      layer.on('mouseover', handleMouseenter);
      layer.on('mouseout', handleMouseout);
      layer.on('click', handleClick);
      layer.on('dblclick', resize);
    });

    $topoLayer.eachLayer(function (layer) {

      if (layer.feature.id === defaultDistrict) {

        highlightLayer(layer);
      }
    });

    resize();
  }

  function handleMouseenter(e) {

    var layer = e.target;

    popup
      .setLatLng([layer.getBounds().getNorth(), layer.getBounds().getCenter().lng])
      .setContent(function () {

        var result;
        var name = '';
        var currentDistrict = districtData.filter(function (element) {

          return element.id === layer.feature.id;
        })[0];

        if (currentDistrict.admDistrictShort) {

          name = name + currentDistrict.admDistrictShort;
        } else {

          name = name + currentDistrict.admDistrict;
        }

        if (currentDistrict.shopCountDeltaPrc === 0) {

          result = '<strong>' + name + ':</strong> Keine Veränderung';
        } else {

          result = '<strong>' + name + ':</strong> ' + Math.round(currentDistrict.shopCountDeltaPrc * 10) / 10 + '%';
        }

        return result;
      }());

    popup.openOn($map);

    layer.setStyle(highlight);

    if (!L.Browser.ie && !L.Browser.opera) {

      layer.bringToFront();
    }
  }

  function handleMouseout(e) {

    var layer = e.target;

    if (layer !== $currentLayer && !dimmed) {

      layer.setStyle(lowlight);
    } else if (layer !== $currentLayer && dimmed) {

      layer.setStyle(lowlight);
    }

    $map.closePopup();
  }

  function handleClick(e) {

    dimmed = true;

    var layer = e.target;

    highlightLayer(layer);
    //zoomToFeature(e);
    scrollToMap();

    location.hash = layer.feature.id;

    text.render(layer.feature.id, scale);
  }

  function highlightLayer(layer) {

    if ($currentLayer) $currentLayer.setStyle(lowlight);
    $currentLayer = layer;

    $topoLayer.eachLayer(function (layer) {

      layer.setStyle(lowlight);
    });

    layer.setStyle(lowlight);
    layer.setStyle(highlight);
  }

  function resize() {

    $map.fitBounds($topoLayer.getBounds(), {

      maxZoom: 10
    });
  }

  function zoomToFeature(e) {

    $map.fitBounds(e.target.getBounds(), {

      maxZoom: 9
    });
  }

  function getColor(cat) {

    return [
      '#d81d09',
      '#f9842d',
      '#ffc166',
      '#f7eec1',
      '#dfedf7',
      '#a7c9ea'
    ][cat];
  }

  function getCategory(d, scale) {

    for (var i = 0; i <= scale.length; i++) {

      if (d <= scale[i+1]) {

        return i;
      }
    }
  }

  function constructScale(data, categories) {

    var result = [];

    var min = Math.min.apply(Math, data.map(function (obj) { return obj.shopCountDeltaPrc; }));
    var max = Math.max.apply(Math, data.map(function (obj) { return obj.shopCountDeltaPrc; }));
    var range = Math.abs(min) + Math.abs(max);
    var dist = range / categories;

    for (var i = 0; i <= categories; i++) {

      result[i] = min + i * dist;
    }

    return result;
  }

  function scrollToMap() {

    var offsetTop = mapContainer.offsetTop - 60;

    scroll.to(document.body, offsetTop, 500);
  }

  function validateHash(str) {

    return /\d{5}/.test(str) ? str : false;
  }

  function disableEventsOnScoll() {

    clearTimeout(timeout);
    mapContainer.style.pointerEvents = 'none';

    timeout = setTimeout(function () {

      mapContainer.style.pointerEvents = 'all';
    }, 700);
  }

  function extendLeaflet() {

    L.TopoJSON = L.GeoJSON.extend({

      addData: function(jsonData) {

        if (jsonData.type === 'Topology') {

          for (var key in jsonData.objects) {

            var geojson = topojson.feature(jsonData, jsonData.objects[key]);
            L.GeoJSON.prototype.addData.call(this, geojson);
          }
        }
        else {

          L.GeoJSON.prototype.addData.call(this, jsonData);
        }
      }
    });
  }

  // Export global functions
  return {

    init: init,
    resize: resize,
    highlight: highlightLayer,
    disable: disableEventsOnScoll
  };
})();
