import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'; // used for Geocoding
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as XLSX from 'xlsx';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'; // Geocoding
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'; // Drawing
import './App.css'
import { readExcel, readExcelFromUrl } from "./utils/readExcel";

const forbidden = {
  CEDILLA: 'ç',
}

const excelFileUrl = '/Users/maxvelasco/Desktop/PortugueseMapData.xlsx'

// NOTE: to find the coordinate info for a location, see: https://labs.mapbox.com/location-helper/#3/40.78/-73.97
const location_coords = {
  brazil_default: [-51.37135, -14.75244],
  rio: [-43.21043, -22.90947],
  sao_paulo: [-46.59564, -23.68277],
  brasilia: [-47.79709, -15.77545],
  vitoria: [-40.33564, -20.30453],
  niteroi: [-43.119678, -22.893564],
  minas_gerais: [-44.287671, -18.26705],
  portugal: [-8.562731, 39.600995],
  serra_leoa: [-11.791922, 8.560284],
  roraima: [-61.40579, 2.065531],
  porto_alegre: [-51.22773, -30.02812],
  ibiuna: [-47.18121, -23.65516],
  olinda: [-34.83907, -7.99931],
  cova_da_moura: [-9.16682, 38.70759],
  havana: [-82.35958, 23.13689],
  paris: [2.34365, 48.85059],
  lisbon: [-9.13719, 38.70716],
}

const MARKER_TYPES = {
  text: "TEXT",
  video: "VIDEO",
  person: "PERSON",
  other: "OTHER",
}

const MarkerInterface = {
  title: "Title text",
  description: "Description text",
  coordinates: "Coordinates array",
  popups: "Array of popup objects",
}



const markerGroups = {};
const popupGroups = {};
let currentIndexes = {}; // Tracks the current index for each marker group

const markerStorage = {}; // use coordinates as the key



function createPopupObject({
  title = "",
  locationName = "",
  description = "",
  coordinates = [0, 0],
  url = null, // default to null if no url is passed in
  urlLabel = "Ver mais", // Default label for URLs
  shouldEmbed = true,
} = {}) {

  const formattedUrl = url ? (
    shouldEmbed 
      ? `<iframe src="${url}" width="100%" height="200" frameborder="0" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`
      : `<a href="${url}" target="_blank">${urlLabel}</a>` 
  ) : null;

  return {
    title,
    locationName,
    description,
    coordinates,
    url: formattedUrl,
  };
}


function new_togglePopup(map, coordinates, markerInstance, direction = 1) {
  let currentPopupIndex = 0;
  const coordinatesKey = coordinates.join(',');
  const group = markerGroups[coordinatesKey];
  const isMulti = group.length > 1 ? true : false;

  console.log("group.length: " + group.length + ", isMulti? " + isMulti);

  if (!group || group.length === 0) return;

  if (!currentIndexes[coordinatesKey]) {
    currentIndexes[coordinatesKey] = 0;
  }

  const attachEventListeners = () => {
    const nextButton = document.getElementById('next-popup');
    const prevButton = document.getElementById('prev-popup');

    if (nextButton) {
      nextButton.addEventListener('click', () => {
        currentPopupIndex = (currentPopupIndex + 1 + group.length) % group.length;
        updatePopupContent();
      });
    }

    if (prevButton) {
      prevButton.addEventListener('click', () => {
        currentPopupIndex = (currentPopupIndex - 1 + group.length) % group.length;
        updatePopupContent();
      });
    }
  };

  const updatePopupContent = () => {
    const popup = group[currentPopupIndex];
    markerInstance.getPopup().setHTML(`
      <h3>${popup.title}</h3>
      <p>${popup.description}</p>
      ${popup.url ? popup.url : ''}
      <div>
        <button id="prev-popup">Previous</button>
        <button id="next-popup">Next</button>
      </div>
    `);

    // Re-attach event listeners for the new buttons
    attachEventListeners();
  };

  const popup = group[currentIndexes[coordinatesKey]];

  const popupInstance = isMulti ? (
    new mapboxgl.Popup({ offset: 25, closeOnClick: false })
    .setLngLat(coordinates)
    .setHTML(`
      <h3>${popup.title}</h3>
      <p>${popup.description}</p>
      ${popup.url ? popup.url : ''}
      <div>
        <button id="prev-popup">Previous</button>
        <button id="next-popup">Next</button>
      </div>
    `)
  ) : (
    new mapboxgl.Popup({ offset: 25, closeOnClick: false })
    .setLngLat(coordinates)
    .setHTML(`
      <h3>${popup.title}</h3>
      <p>${popup.description}</p>
      ${popup.url ? popup.url : ''}
    `)
  );
    

  markerInstance.setPopup(popupInstance);

  popupInstance.on('open', () => {
    attachEventListeners();
  });

  popupInstance.on('close', () => {
    console.log("popup closed: " + popup.title);
  });
}

const addMarkerWithPopupObject = (map, popup, markerType) => {
  const markerElement = document.createElement('div');

  markerElement.className = 'marker';

  // set icon
  if (markerType === MARKER_TYPES.person) {
    markerElement.className = 'person-marker';
  } else if (markerType === MARKER_TYPES.video) {
    markerElement.className = 'video-marker';
  } else if (markerType === MARKER_TYPES.text) {
    markerElement.className = 'text-marker';
  }

  // console.log("Adding NEW marker for: ", popup.title);

  const coordinatesKey = popup.coordinates.join(',');
  if (!markerGroups[coordinatesKey]) {
    markerGroups[coordinatesKey] = [];
    popupGroups[coordinatesKey] = [];
  }
  markerGroups[coordinatesKey].push(popup);

  const markerInstance = new mapboxgl.Marker(markerElement, { draggable: false })
    .setLngLat(popup.coordinates)
    .addTo(map);

  markerElement.addEventListener('click', () => {
    new_togglePopup(map, popup.coordinates, markerInstance);
  });


  // Save to localStorage
  let markers = JSON.parse(localStorage.getItem('markers')) || [];
  const markerCoords = popup.coordinates;
  const markerTitle = popup.title;
  const markerDescription = popup.description;

  markers.push({ markerCoords, markerTitle, markerDescription });
  localStorage.setItem('markers', JSON.stringify(markers));  
};



const addMarkerWithPopup = (map, coordinates, title, description, markerType, isSaved=false) => {
  const markerElement = document.createElement('div');

  markerElement.className = 'marker';

  // set icon
  if (markerType === MARKER_TYPES.person) {
    markerElement.className = 'person-marker';
  } else if (markerType === MARKER_TYPES.video) {
    markerElement.className = 'video-marker';
  } else if (markerType === MARKER_TYPES.text) {
    markerElement.className = 'text-marker';
  }

  new mapboxgl.Marker(markerElement, { draggable: false })
    .setLngLat(coordinates)
    .setPopup(
      new mapboxgl.Popup({ offset: 25 })
        .setHTML(`<h3>${title}</h3><p>${description}</p>`)
    )
    .addTo(map);

  if (!isSaved) {
    // Save to localStorage
    let markers = JSON.parse(localStorage.getItem('markers')) || [];    
    markers.push({ coordinates, title, description });
    localStorage.setItem('markers', JSON.stringify(markers));
  }
  
};


const addLineConnectionWithPopup = (map, coordinatesArray, popup) => {
  const lineSource = {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: coordinatesArray
          },
          properties: {}
        }
      ]
    }
  };

  const lineLayerId = `route-${Math.random()}`; // TODO: make lineLayerId based on
  const solidLineLayerId = `route-${Math.random()}`;
  const dashedLineLayerId = `route-${Math.random()}`;
  
  map.addSource(lineLayerId, lineSource);
  map.addLayer({
    id: solidLineLayerId,
    type: 'line',
    source: lineLayerId,
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': 'green',
      'line-width': 6,
      'line-opacity': 0.4
    }
  });

  map.addLayer({
    type: 'line',
    source: lineLayerId,
    id: dashedLineLayerId,
    paint: {
      'line-color': 'yellow',
      'line-width': 2,
      'line-dasharray': [0, 4, 3],
      'line-opacity': 0.9
    }
  });

  const linePopup = new mapboxgl.Popup({ offset: 25 })
    .setHTML(`
      <h3>${popup.title}</h3>
      <p>${popup.description}</p>
      ${popup.url ? `<p>${popup.url}</p>` : ""}`
    );

    map.on('click', solidLineLayerId, (e) => {
    linePopup.setLngLat(e.lngLat).addTo(map);
  });
  

  // Change cursor style on hover
  map.on('mouseenter', solidLineLayerId, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', solidLineLayerId, () => {
    map.getCanvas().style.cursor = '';
  });

  const dashArraySequence = [
    [0, 4, 3],
    [0.5, 4, 2.5],
    [1, 4, 2],
    [1.5, 4, 1.5],
    [2, 4, 1],
    [2.5, 4, 0.5],
    [3, 4, 0],
    [0, 0.5, 3, 3.5],
    [0, 1, 3, 3],
    [0, 1.5, 3, 2.5],
    [0, 2, 3, 2],
    [0, 2.5, 3, 1.5],
    [0, 3, 3, 1],
    [0, 3.5, 3, 0.5]
  ];

  let step = 0;

  function animateDashArray(timestamp) {
    const newStep = parseInt((timestamp / 50) % dashArraySequence.length);

    if (newStep !== step) {
      if (map) {
        map.setPaintProperty(
          dashedLineLayerId,
          'line-dasharray',
          dashArraySequence[step]
        );
        step = newStep;
      }
    }

    requestAnimationFrame(animateDashArray);
  }

  animateDashArray(0);

};

// ----- LOADING HELPERS -----
// Load markers from localStorage on page load
function loadMarkers(map) {
  const markers = JSON.parse(localStorage.getItem('markers')) || [];
  markers.forEach(({ coordinates, title, description }) => {
    if (!(title === "Rio de Janiero" && coordinates !== location_coords.rio)) {
      addMarkerWithPopup(map, coordinates, title, description, "OTHER", true); // set isSaved to true, so it doesn't add a new marker to storage
    }
  });
}

function clearAllMarkers() {
  localStorage.setItem('markers', JSON.stringify([]));
}

// function used to manually make the calls to draw the markers + connections
// TODO: automate this by allowing users to add, edit, and remove markers and/or connections
function addMap1Collection(map) {

  const markerPopup0 = createPopupObject({ title: "Aline Motta", locationName: "Niterói, RJ", description: "Aline Motta nasceu em Niterói, RJ", coordinates: location_coords.niteroi, url: "https://player.vimeo.com/video/486936176" });
  const markerPopup1 = createPopupObject({ title: '"Pontes Sobre Abismos" (2017) de Aline Motta', description: 'Aline Motta viajou para o Rio de Janeiro para produzir o filme “Pontes Sobre Abismos”', coordinates: location_coords.rio, url: "https://player.vimeo.com/video/486936176"});
  const markerPopup2 = createPopupObject({ title: '"Pontes Sobre Abismos" (2017) de Aline Motta', description: 'Aline Motta viajou para Minas Gerais para produzir o filme “Pontes Sobre Abismos”', coordinates: location_coords.minas_gerais, url: "https://player.vimeo.com/video/486936176"});
  const markerPopup3 = createPopupObject({ title: '"Pontes Sobre Abismos" (2017) de Aline Motta', description: 'Aline Motta viajou para Portugal para produzir o filme “Pontes Sobre Abismos”', coordinates: location_coords.portugal, url: "https://player.vimeo.com/video/486936176"});
  const markerPopup4 = createPopupObject({ title: '"Pontes Sobre Abismos" (2017) de Aline Motta', description: 'Aline Motta viajou para Serra Leoa para produzir o filme “Pontes Sobre Abismos”', coordinates: location_coords.serra_leoa, url: "https://player.vimeo.com/video/486936176"});
  const markerPopup5 = createPopupObject({ title: 'A lenda da On\u00E7a pintada', description: 'As origens da lenda do leopardo e do fogo são dos povos indígenas brasileiros. O Cristino Wapichana é a pessoa que é mais associada com esse conto, e ele é do estado de Roraima.', coordinates: location_coords.roraima, url: "https://www.youtube.com/embed/Mi1q3mVRhHk"});
  
  addMarkerWithPopupObject(map, markerPopup0, MARKER_TYPES.person);
  addMarkerWithPopupObject(map, markerPopup1, MARKER_TYPES.video);
  addMarkerWithPopupObject(map, markerPopup2, MARKER_TYPES.video);
  addMarkerWithPopupObject(map, markerPopup3, MARKER_TYPES.video);
  addMarkerWithPopupObject(map, markerPopup4, MARKER_TYPES.video);
  addMarkerWithPopupObject(map, markerPopup5, MARKER_TYPES.text);

  const popup1 = createPopupObject({ title: '"Pontes Sobre Abismos" (2017) de Aline Motta', description: 'Aline Motta viajou para o Rio de Janeiro para produzir o filme “Pontes Sobre Abismos”' })
  const popup2 = createPopupObject({ title: '"Pontes Sobre Abismos" (2017) de Aline Motta', description: 'Aline Motta viajou para Minas Gerais para produzir o filme “Pontes Sobre Abismos”' })
  const popup3 = createPopupObject({ title: '"Pontes Sobre Abismos" (2017) de Aline Motta', description: 'Aline Motta viajou para Portugal para produzir o filme “Pontes Sobre Abismos”' })
  const popup4 = createPopupObject({ title: '"Pontes Sobre Abismos" (2017) de Aline Motta', description: 'Aline Motta viajou para Serra Leoa para produzir o filme “Pontes Sobre Abismos”' })
  const popup5 = createPopupObject({ title: "A lenda da On\u00E7a pintada", description: 'Alina Motta usa a lenda da onça pintada como alegoria da sua própria história no filme "Pontes Sobre Abismos" (2017).'});

  addLineConnectionWithPopup(map, [location_coords.niteroi, location_coords.rio], popup1);
  addLineConnectionWithPopup(map, [location_coords.niteroi, location_coords.minas_gerais], popup2);
  addLineConnectionWithPopup(map, [location_coords.niteroi, location_coords.portugal], popup3);
  addLineConnectionWithPopup(map, [location_coords.niteroi, location_coords.serra_leoa], popup4);
  addLineConnectionWithPopup(map, [location_coords.niteroi, location_coords.roraima], popup5);


  // charlotte
  const markerPopup7 = createPopupObject({ title: '"Diário de uma busca" (2010) de Flávia Castro', description: 'A cidade onde nasceu Flávia Castro', coordinates: location_coords.porto_alegre, url: 'https://yale.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=187b9123-e6fe-4047-935d-b205010870be' });
  addMarkerWithPopupObject(map, markerPopup7, MARKER_TYPES.video);

  const markerPopup8 = createPopupObject({ title: '"Que bom te ver viva" de Lúcia Murat', description: 'A cidade onde nasceu Lúcia Murat', coordinates: location_coords.rio, url: 'https://yale.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=2dec8a4a-b5e9-4a86-ada6-b20200340cdc' }); // TODO: add url
  addMarkerWithPopupObject(map, markerPopup8, MARKER_TYPES.video);

  // alicia
  const markerPopup10 = createPopupObject({ title: '"FotogrÁFRICA" (2016), de Tila Chitunda', description: 'A cidade onde nasceu Tila Chitunda, filha de pais angolanos', coordinates: location_coords.olinda, url: 'https://player.vimeo.com/video/190026474'});
  addMarkerWithPopupObject(map, markerPopup10, MARKER_TYPES.video);

  const markerPopup11 = createPopupObject({ title: '"FotogrÁFRICA" (2016), de Tila Chitunda', description: 'A cidade onde o filme é premiado como melhor filme na III Mostra Internacional de Cinema na Cova da Moura, 2018', coordinates: location_coords.cova_da_moura, url: 'https://player.vimeo.com/video/190026474'});
  addMarkerWithPopupObject(map, markerPopup11, MARKER_TYPES.video);

  const markerPopup13 = createPopupObject({ title: '"Trago Comigo" (2016), de Tata Amaral', description: 'A cidade onde nasceu Tata Amaral', coordinates: location_coords.sao_paulo, url: 'https://yale.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=a3b8a1b2-aee4-4714-a87c-b1ff00124103' });
  addMarkerWithPopupObject(map, markerPopup13, MARKER_TYPES.video);

  const markerPopup14 = createPopupObject({ title: '36º Festival del Nuevo Cinema Latino-Americano de Havana, Cuba (2014)', description: 'A cidade onde o filme de Tata Amaral estreou', coordinates: location_coords.havana, url: ''});
  addMarkerWithPopupObject(map, markerPopup14, MARKER_TYPES.video);


  // nina
  const markerPopup16 = createPopupObject({ title: '"Diário de uma busca" (2010) de Flávia Castro', description: 'A cidade onde Flávia Castro se exila de criança com sua família durante o regime militar', coordinates: location_coords.paris });
  addMarkerWithPopupObject(map, markerPopup16, MARKER_TYPES.person);

  const markerPopup17 = createPopupObject({ title: '"Lusófonas" (2019), Carolina Paiva', description: 'Uma das cidades retratadas por Carolina Paiva no seu documentário', coordinates: location_coords.lisbon, url: 'https://video-alexanderstreet-com.yale.idm.oclc.org/watch/tecendo-nossos-caminhos-weaving-our-paths-3' });
  addMarkerWithPopupObject(map, markerPopup17, MARKER_TYPES.video);


  const markerPopup19 = createPopupObject({ title: '"Divinas Divas" (2016), de Leandra Leal', description: 'O Teatro Rival, no Rio de Janeiro, é o local onde a primeira geração de artistas drag queens se apresentaram.', coordinates: location_coords.rio, url: 'https://yale.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=3496cbe8-c44e-48a7-8bad-b21000f9bea7' });
  addMarkerWithPopupObject(map, markerPopup19, MARKER_TYPES.video);

  const markerPopup20 = createPopupObject({ title: '"Machimbrao" (2016), de Lara Sousa', description: 'A cidade onde se passa a história do documentário em curta-metragem', coordinates: location_coords.havana, url: 'https://player.vimeo.com/video/196610729'});
  addMarkerWithPopupObject(map, markerPopup20, MARKER_TYPES.video);

  const markerPopup21 = createPopupObject({ title: '"Bixa Travesty" (2018), de Claudia Priscilla & Kiko Goifman. Roteiro de Linn da Quebrada, Claudia Priscilla & Kiko Goifman', description: 'A cidade onde se passa a historia do documentário sobre Linn da Quebrada, mais especificamente na zona leste, periferia de São Paulo', coordinates: location_coords.sao_paulo, url: 'https://docuseek2-com.yale.idm.oclc.org/cart/product/4715' });
  addMarkerWithPopupObject(map, markerPopup21, MARKER_TYPES.video);


  const markerPopup27 = createPopupObject({ title: "Sítio Soares", description: "Foi a lugar do 20° Congresso da União Nacional dos Estudantes (UNE), onde a polícia paulista prende Vladimir Palmeira e mais 1239", coordinates: location_coords.ibiuna });
  const popup27 = createPopupObject({ title: '“Que bom te ver viva” de Lúcia Murat', description: 'Sítio Soares em Ibiúna, São Paulo foi uma das demonstra\u00E7ões mencionadas no filme “Que bom te ver viva” de Lúcia Murat'});
  addMarkerWithPopupObject(map, markerPopup27, MARKER_TYPES.video); // TODO: add event marker type
  addLineConnectionWithPopup(map, [location_coords.rio, location_coords.ibiuna], popup27);


  const popup7_8 = createPopupObject({ title: "Memória e resistência das mulheres na luta contra a ditadura no Brasil", description: 'Os filmes "Diário de uma busca" e "Que bom te ver viva" estão unidos pelo foco comum na história sombria do Brasil e no impacto da ditadura militar na memória pessoal e coletiva. Ambos exploram as experiências de militância, prisão e ativismo, com ênfase especial nas mulheres. Que Bom Te Ver Viva, de Lúcia Murat, destaca mulheres que resistiram e suportaram torturas, enquanto Diário de Uma Busca, de Flávia Castro, retrata a resiliência de mulheres lidando com a perda e perguntas sem resposta depois perderem a família para a resistência.' })
  addLineConnectionWithPopup(map, [location_coords.porto_alegre, location_coords.rio], popup7_8);

  const popup10_11 = createPopupObject({ title: 'Retratos da diáspora', description: 'Durante a III Mostra Internacional de Cinema na Cova, em 2018, o documentário FotogrÁFRICA foi exibido em um contexto que destaca produções relacionadas à diáspora africana, reforçando sua relevância para comunidades negras no cenário global.' });
  addLineConnectionWithPopup(map, [location_coords.olinda, location_coords.cova_da_moura], popup10_11);
  
  const popup13_14 = createPopupObject({ title: 'Representação da ditadura militar no cinema e estreia em Cuba', description: 'O filme teve sua estreia mundial na Seleção Oficial deste festival, que é um dos mais importantes para o cinema latino-americano. A exibição em Havana marcou o início de uma jornada internacional para a obra, colocando o Brasil em destaque no cenário cinematográfico global.' });
  addLineConnectionWithPopup(map, [location_coords.sao_paulo, location_coords.havana], popup13_14);

  const popup16_17 = createPopupObject({ title: 'Perspectivas das mulheres sobre o  mundo lusófono', description: 'Os filmes "Diário de Uma Busca" e "Lusófonas" conectam as experiências das brasileiras com o mundo exterior. O documentário de Castro, com os lugares de exílio (ela se exila de criança com sua família durante a ditadura militar), e o de Paiva, com as ligações de diferentes história de mulheres no mundo lusófono (realidades semelhantes independete de países). As duas diretoras exploram o legado das estruturas políticas e sociais do Brasil e de Portugal, revelando as dificuldades de resistência em contextos e lugares variados, resultado do legado da violência de classe, de gênero e de raça. Há uma violência colonial que se repete na modernidade tornando difícil o empoderamento feminino ou a busca por justiça e memória. A realidade do exílio ou as leis restritas sobre o corpo feminino têm um núcleo comum que é a repressão para silenciar o povo. Fica claro, em filmes diferentes, como as ideias coloniais e repressivas continuam impactando as brasileiras e as mulheres lusófonas em geral.' });
  addLineConnectionWithPopup(map, [location_coords.paris, location_coords.lisbon], popup16_17);
  
  const popup19_20_21 = createPopupObject({ title: 'A questão de gênero em diferentes perspectivas', description: 'Os filmes "Bixa Travesty," "Divinas Divas" e "Machimbrao" se conectam com a questão de gênero, explorando temas também similares sobre privilégio, segurança e beleza. Cada filme traz as expectativas sociais ou das suas próprias comunidades. Em Machimbrao, filmado em Cuba, as pessoas que frequentam a barbearia, sobretudo homens, reforçam, na entrevista com a diretora, suas expectativas da heteronormatividade, enquanto que em Bixa Travesty e Divinas Divas questiona-se o que se entende por identidade.' });
  addLineConnectionWithPopup(map, [location_coords.rio, location_coords.havana], popup19_20_21);
  addLineConnectionWithPopup(map, [location_coords.havana, location_coords.sao_paulo], popup19_20_21);
}


function App() {
  const mapRef = useRef();  
  const mapContainerRef = useRef();

  // new 
  const mapRefs = useRef({});
  const mapContainers = useRef({});
  const [showSidebar, setShowSidebar] = useState(false);
  // const [maps, setMaps] = useState([{ id: "map-1", name: "Default Map" }]);
  const [maps, setMaps] = useState([]);
  const [activeMapId, setActiveMapId] = useState("map-1");
  const [activeMapIdx, setActiveMapIdx] = useState(0); // Indexing the Excel sheet number

  const [selectedLocation, setSelectedLocation] = useState(null); // Stores selected location coordinates
  const [showForm, setShowForm] = useState(false); // Controls form visibility
  const [title, setTitle] = useState(''); // Stores marker title input
  const [description, setDescription] = useState(''); // Stores marker description input

  const [excelData, setExcelData] = useState([]);


  useEffect(() => {
    mapboxgl.accessToken = 'pk.eyJ1IjoibWF4dmVsYXNjbyIsImEiOiJjbTI5ZzUzcTAwNHo0Mm9wcnBrZXRreTZmIn0.O_6ddjd2A8QEY4eFFuWvAQ'
    
    // Load GeoJSON data
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: location_coords.rio
          },
          properties: {
            title: 'Rio de Janeiro',
            description: 'A Cidade Maravilhosa'
          }
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: location_coords.sao_paulo
          },
          properties: {
            title: 'São Paulo',
            description: 'A cidade de negócios'
          }
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: location_coords.brasilia
          },
          properties: {
            title: 'Brasília',
            description: 'A capital do Brasil'
          }
        }

      ]
    };



    // -------- Map Initialization --------
    // for more Options, see: https://docs.mapbox.com/mapbox-gl-js/api/map/#map-parameters
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: location_coords.brazil_default,
      style: 'mapbox://styles/mapbox/streets-v11',
      zoom: 3.5,
      language: "pt",
    });


    // Add line connections between markers
    mapRef.current.on('load', () => {
      clearAllMarkers();
      
      // add collections
      addMap1Collection(mapRef.current);
      

    });


    // NOTE: idt this is even being used currently, but it causes errors if I delete
    mapRef.current.on('load', () => {
      mapRef.current.addSource('line', {
        type: 'geojson',
        data: geojson
      });

      mapRef.current.addLayer({
        type: 'line',
        source: 'line',
        id: 'line-background',
        paint: {
          'line-color': 'yellow',
          'line-width': 6,
          'line-opacity': 0.4
        }
      });

      mapRef.current.addLayer({
        type: 'line',
        source: 'line',
        id: 'line-dashed',
        paint: {
          'line-color': 'yellow',
          'line-width': 3,
          'line-dasharray': [0, 4, 3]
        }
      });
    });

    // enable Geocoding search
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      marker: true,
    });
    mapRef.current.addControl(geocoder);

    // enable navigation
    mapRef.current.addControl(new mapboxgl.NavigationControl());

    // Add marker when user selects a result from Geocoder
    geocoder.on('result', (e) => {
      const { center, place_name } = e.result;
      setSelectedLocation(center);
      setTitle(place_name);
    });
    


    return () => {
      mapRef.current.remove()
    }
  }, [activeMapId]);

  useEffect(() => {
    const fetchAndParseExcel = async () => {
      try {
        const response = await fetch('src/data/PortugueseMapData.xlsx');

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log('Content-Type:', response.headers.get('Content-Type'));
        const arrayBuffer = await response.arrayBuffer();

        // Read the file using xlsx
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Assuming data is in the first sheet:
        const sheetName = workbook.SheetNames[activeMapId]; // NOTE: use active map ID for this
        const worksheet = workbook.Sheets[sheetName];

        const numMapSheets = workbook.SheetNames.length;

        let mapsTemp = [];
        for (let i = 0; i < numMapSheets; i++) {
          mapsTemp.push({ id: i, name: workbook.SheetNames[i] });
        }
        setMaps(mapsTemp);

        console.log("sheet name: " + sheetName);

        // Convert the sheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log("JSON data: ", jsonData);

        // v2
        const jsonDataAsArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        console.log('Parsed Data as Array:', jsonDataAsArray);

        // jsonData now is an array of objects with your columns as keys
        setExcelData(jsonData);
      } catch (error) {
        console.error('Error reading Excel file:', error);
      }
    };

    fetchAndParseExcel();
  }, [activeMapId]);

  // Function to add a new map instance
  const createNewMap = () => {
    const newMapId = maps.length + 1;
    setMaps([...maps, { id: newMapId, name: `Map ${maps.length + 1}` }]);
    // setActiveMapId(newMapId);


    // TODO: add functionality to actually create a new map -- onClick, open that map
    // could just cause the useEffect block to run again (using a state variable) 
    // and then whenever it runs, check which map instance is active + add points
  };

  const toggleActiveMap = (mapId) => {
    console.log("toggling active map to: " + mapId + ", idx: " + activeMapIdx);
    setActiveMapId(mapId);
    console.log("activeMapId: " + mapId);
    clearAllMarkers();
  };



  // Handler for "Add to Map" button click
  const handleAddToMapClick = () => {
    setShowForm(true); // Show the form when "Add to Map" is clicked
  };

  // Handler for form submission
  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (selectedLocation && title && description) {
      addMarkerWithPopup(mapRef.current, selectedLocation, title, description);
      setShowForm(false); // Hide the form after submission
      setTitle(''); // Reset the title input
      setDescription(''); // Reset the description input
      setSelectedLocation(null); // Reset the selected location
    }
  };




  return (
    <>
      {/* Sidebar Toggle Button */}
      <button className="sidebar-toggle" onClick={() => setShowSidebar(!showSidebar)}>☰</button>

      {/* Sidebar */}
      <div className={`sidebar ${showSidebar ? "visible" : "hidden"}`}>
        <div className="sidebar-header">
          <h3>Mapas</h3>
          {/* <button className="add-map-btn" onClick={createNewMap}>+</button> */}
        </div>
        <ul>
          {maps.map((map) => (
            <li 
              key={map.id} 
              className={activeMapId === map.id ? "active" : ""}
              onClick={() => toggleActiveMap(map.id)}
              >
                {map.name}
            </li>
          ))}
        </ul>
      </div>

      <div id='map-container' ref={mapContainerRef}/>

      {showForm && (
        <div className="popup-form">
          <form onSubmit={handleFormSubmit}> 
            <label>
              Title:
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label>
              Description:
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </label>
            <button 
              type="button"
              // onClick={setShowForm(false)}
              onClick={() => {
                setShowForm(false)
                setTitle('');
                setDescription('');
                setSelectedLocation(null);
              }}
            >
              Cancel
            </button>
            <button type="submit">Submit</button>
          </form>
        </div>
      )}

    </>
  )
}

export default App
