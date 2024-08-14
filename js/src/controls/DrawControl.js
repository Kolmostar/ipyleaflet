// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

const widgets = require('@jupyter-widgets/base');
const L = require('../leaflet.js');
const control = require('./Control.js');

export class LeafletDrawControlModel extends control.LeafletControlModel {
  defaults() {
    return {
      ...super.defaults(),
      _view_name: 'LeafletDrawControlView',
      _model_name: 'LeafletDrawControlModel',
      polyline: { shapeOptions: {} },
      polygon: { shapeOptions: {} },
      circle: {},
      circlemarker: {},
      rectangle: {},
      marker: {},
      data: [],
      edit: true,
      remove: true
    };
  }
}

LeafletDrawControlModel.serializers = {
  ...control.LeafletControlModel.serializers,
  layer: { deserialize: widgets.unpack_models }
};

export class LeafletDrawControlView extends control.LeafletControlView {
  initialize(parameters) {
    super.initialize(parameters);
    this.map_view = this.options.map_view;
  }

  layer_to_json(layer) {
    let res = {}
    if (layer instanceof L.Circle) {
      res.type = 'Circle';
      res.center = layer.getLatLng();
      res.radius = layer.getRadius();
    } else if (layer instanceof L.Rectangle) {
      res.type = 'Rectangle';
      res.bounds = layer.getBounds();
    } else if (layer instanceof L.Marker) {
      res.type = 'Marker';
      res.position = layer.getLatLng();
    }
    return res;
  }

  create_obj() {
    this.feature_group = L.featureGroup()
    this.map_view.obj.addLayer(this.feature_group);
    let circle = this.model.get('circle');
    if (!Object.keys(circle).length) {
      circle = false;
    }
    let rectangle = this.model.get('rectangle');
    if (!Object.keys(rectangle).length) {
      rectangle = false;
    }
    let marker = this.model.get('marker');
    if (!Object.keys(marker).length) {
      marker = false;
    }
    this.obj = new L.Control.Draw({
      position: this.model.get('position'),
      edit: {
        featureGroup: this.feature_group,
        edit: this.model.get('edit'),
        remove: this.model.get('remove')
      },
      draw: {
        polyline: false,
        polygon: false,
        circle: circle,
        circlemarker: false,
        rectangle: rectangle,
        marker: marker
      }
    });
    this.map_view.obj.on(L.Draw.Event.CREATED, e => {
      let layer = e.layer;
      this.send({
        event: 'draw:created',
        geo_json: this.layer_to_json(layer)
      });
      this.feature_group.addLayer(layer);
    });
    this.map_view.obj.on(L.Draw.Event.EDITED, e => {
      let layers = e.layers;
      layers.eachLayer(layer => {
        this.send({
          event: 'draw:edited',
          geo_json: layer.toGeoJSON()
        });
      });
    });
    this.map_view.obj.on(L.Draw.Event.DELETED, e => {
      let layers = e.layers;
      layers.eachLayer(layer => {
        let geo_json = layer.toGeoJSON();
        geo_json.properties.style = layer.options;
        this.send({
          event: 'draw:deleted',
          geo_json: this.layer_to_json(layer)
        });
      });
    });
    this.model.on('msg:custom', this.handle_message.bind(this));
    this.model.on('change:data', this.data_to_layers.bind(this));
  }

  remove() {
    this.map_view.obj.removeLayer(this.feature_group);
    this.map_view.obj.off('draw:created');
    this.map_view.obj.off('draw:edited');
    this.map_view.obj.off('draw:deleted');
    this.model.off('msg:custom');
    this.model.off('change:data');
  }

  data_to_layers() {
    const data = this.model.get('data');
    this.feature_group.clearLayers();
    this.feature_group.addData(data);
  }

  layers_to_data() {
    let newData = [];
    this.feature_group.eachLayer(layer => {
      const geoJson = layer.toGeoJSON();
      geoJson.properties.style = layer.options;
      newData.push(geoJson);
    });
    this.model.set('data', newData);
    this.model.save_changes();
  }

  handle_message(content) {
    if (content.msg == 'clear') {
      this.feature_group.eachLayer(layer => {
        this.feature_group.removeLayer(layer);
      });
    } else if (content.msg == 'clear_polylines') {
      this.feature_group.eachLayer(layer => {
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
          this.feature_group.removeLayer(layer);
        }
      });
    } else if (content.msg == 'clear_polygons') {
      this.feature_group.eachLayer(layer => {
        if (layer instanceof L.Polygon && !(layer instanceof L.Rectangle)) {
          this.feature_group.removeLayer(layer);
        }
      });
    } else if (content.msg == 'clear_circles') {
      this.feature_group.eachLayer(layer => {
        if (layer instanceof L.CircleMarker) {
          this.feature_group.removeLayer(layer);
        }
      });
    } else if (content.msg == 'clear_circle_markers') {
      this.feature_group.eachLayer(layer => {
        if (layer instanceof L.CircleMarker && !(layer instanceof L.Circle)) {
          this.feature_group.removeLayer(layer);
        }
      });
    } else if (content.msg == 'clear_rectangles') {
      this.feature_group.eachLayer(layer => {
        if (layer instanceof L.Rectangle) {
          this.feature_group.removeLayer(layer);
        }
      });
    } else if (content.msg == 'clear_markers') {
      this.feature_group.eachLayer(layer => {
        if (layer instanceof L.Marker) {
          this.feature_group.removeLayer(layer);
        }
      });
    }
    this.layers_to_data()
  }
}
