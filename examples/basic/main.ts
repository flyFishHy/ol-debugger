import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import LayerGroup from 'ol/layer/Group.js';
import VectorLayer from 'ol/layer/Vector.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import { createDebugger } from '../../src/index.js';
import './style.css';

const base = new TileLayer({ source: new OSM(), properties: { title: 'OpenStreetMap' } });
const roadsSource = new VectorSource();
const roads = new VectorLayer({
  source: roadsSource,
  properties: { title: 'Road annotations' },
});
const hiddenLayer = new VectorLayer({
  source: new VectorSource(),
  visible: false,
  properties: { title: 'Hidden example layer' },
});
const outsideLayer = new VectorLayer({
  source: new VectorSource(),
  extent: [20_000_000, 20_000_000, 21_000_000, 21_000_000],
  properties: { title: 'Outside current view' },
});

const map = new Map({
  target: 'map',
  layers: [base, new LayerGroup({ layers: [roads, hiddenLayer, outsideLayer], properties: { title: 'Examples' } })],
  view: new View({ center: [0, 0], zoom: 2 }),
});

createDebugger({ map, position:'left', theme:'light' ,toggleShortcut: 'Ctrl+Shift+.'});

document.querySelector('#toggle-hidden')?.addEventListener('click', () => {
  hiddenLayer.setVisible(!hiddenLayer.getVisible());
});
document.querySelector('#trigger-source-error')?.addEventListener('click', () => {
  // Deterministic public source event; no failing network request is needed.
  roadsSource.dispatchEvent('featuresloaderror');
});
