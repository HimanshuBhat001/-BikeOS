'use strict';
(()=>{
const $=id=>document.getElementById(id);
const safe=(id,fn)=>{const el=$(id);if(el)fn(el)};
const store={get(k,d=''){try{return localStorage.getItem('bikeos-'+k)??d}catch(_){return d}},set(k,v){try{localStorage.setItem('bikeos-'+k,String(v))}catch(_){}}};
const s={watch:null,pos:null,riding:false,start:0,elapsed:0,timer:null,dist:0,max:0,samples:[],last:null,mode:store.get('mode','URBAN')};
function toast(msg){safe('toast',e=>{e.textContent=msg;e.classList.add('show');clearTimeout(e._timer);e._timer=setTimeout(()=>e.classList.remove('show'),2400)})}
function duration(v){const n=Math.max(0,Math.floor(v)),m=Math.floor(n/60),sec=n%60;return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0')}
function hav(a,b){const r=x=>x*Math.PI/180,R=6371,d1=r(b.lat-a.lat),d2=r(b.lon-a.lon),x=Math.sin(d1/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
let activeTab='dashboard';const tabHistory=[];
function tab(name,record=true){
 if(!document.getElementById('view-'+name))return;
 if(record&&name!==activeTab)tabHistory.push(activeTab);
 activeTab=name;
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));
 document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
 document.querySelectorAll('.v2-rail-btn[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
 safe('globalBack',e=>e.hidden=name==='dashboard');
 if(name==='navigation'){initMap();setTimeout(()=>nav.map&&nav.map.resize(),120)}
 if(name==='dashboard'){initHomeMap();setTimeout(()=>nav.homeMap&&nav.homeMap.resize(),120)}
}
function goBack(){
 if(tabHistory.length){tab(tabHistory.pop(),false);return true}
 if(activeTab!=='dashboard'){tab('dashboard',false);return true}
 return false;
}
window.BikeOSHandleBack=goBack;
bind('globalBack',goBack);
function mode(name){s.mode=name;store.set('mode',name);safe('urbanMode',e=>e.classList.toggle('active',name==='URBAN'));safe('rainMode',e=>e.classList.toggle('active',name==='RAIN'));document.body.classList.toggle('rain-mode',name==='RAIN');safe('telemetryNote',e=>e.textContent=name==='RAIN'?'RAIN PROFILE • CAUTION DISPLAY ENABLED':'URBAN PROFILE • CITY DISPLAY');toast(name+' profile selected. Bike ECU unchanged.')}
function updateGauge(speed){const gauge=document.querySelector('.gauge');if(!gauge)return;const max=220;const fraction=Math.max(0,Math.min(speed/max,1));const end=225+270*fraction;gauge.style.background='conic-gradient(from 225deg, #e31b2f 0deg '+(270*fraction)+'deg, #343941 '+(270*fraction)+'deg 270deg, transparent 270deg 360deg)';gauge.style.setProperty('--speed-progress',String(fraction))}
function stats(){const seconds=s.elapsed+(s.riding?(Date.now()-s.start)/1000:0),avg=s.samples.length?s.samples.reduce((a,b)=>a+b,0)/s.samples.length:0;const speed=s.pos&&s.pos.coords.speed!=null?Math.round(s.pos.coords.speed*3.6):0;[['speed',speed],['tripValue',s.dist.toFixed(1)],['avgSpeedValue',Math.round(avg)],['maxSpeedValue',Math.round(s.max)],['rideTimeValue',duration(seconds)],['statDistance',s.dist.toFixed(2)+' km'],['statAvg',Math.round(avg)+' km/h'],['statMax',Math.round(s.max)+' km/h'],['statTime',duration(seconds)]].forEach(([id,v])=>safe(id,e=>e.textContent=v));updateGauge(speed)}
function position(p){s.pos=p;const c=p.coords;updateUserMarker(c);safe('gpsStatusIcon',e=>e.classList.add('green'));safe('gpsStatus',e=>e.classList.add('green'));safe('bikeConnection',e=>e.textContent='GPS LOCKED');safe('locationDetails',e=>e.textContent='GPS: '+c.latitude.toFixed(5)+', '+c.longitude.toFixed(5)+' • accuracy '+Math.round(c.accuracy)+' m');safe('navRemaining',e=>e.textContent='GPS ACCURACY '+Math.round(c.accuracy)+' m');syncHomeNavigation();if(s.riding){const v=(c.speed||0)*3.6;s.samples.push(v);s.max=Math.max(s.max,v);const q={lat:c.latitude,lon:c.longitude};if(s.last){const d=hav(s.last,q);if(d<.5)s.dist+=d}s.last=q}stats()}
function gps(){if(!navigator.geolocation){toast('GPS is not available in this WebView');return}if(s.watch!==null){navigator.geolocation.clearWatch(s.watch);s.watch=null}s.watch=navigator.geolocation.watchPosition(position,e=>{safe('gpsStatusIcon',x=>x.classList.remove('green'));safe('gpsStatus',x=>x.classList.remove('green'));toast('GPS: '+e.message)},{enableHighAccuracy:true,maximumAge:1000,timeout:20000})}
function history(){let items=[];try{items=JSON.parse(store.get('history','[]'))}catch(_){}safe('historyList',e=>{e.textContent='';if(!items.length){e.textContent='No rides recorded yet.';return}items.forEach(x=>{const row=document.createElement('div');row.className='call-state';row.textContent=x.date+' • '+Number(x.distance).toFixed(2)+' km • max '+Math.round(x.max)+' km/h';e.appendChild(row)})})}
function startRide(){if(s.riding)return;gps();s.riding=true;s.start=Date.now();s.last=s.pos?{lat:s.pos.coords.latitude,lon:s.pos.coords.longitude}:null;s.timer=setInterval(stats,1000);toast('Ride recording started. Ride safely.')}
function endRide(){if(!s.riding){toast('No active ride');return}s.elapsed+=(Date.now()-s.start)/1000;s.riding=false;clearInterval(s.timer);let items=[];try{items=JSON.parse(store.get('history','[]'))}catch(_){}items.unshift({date:new Date().toLocaleString(),distance:s.dist,max:s.max,time:s.elapsed});store.set('history',JSON.stringify(items.slice(0,20)));history();stats();toast('Ride saved on this device')}
function openUrl(url){try{window.location.href=url}catch(_){toast('Unable to open that app on this device')}}
function bind(id,fn){safe(id,e=>e.addEventListener('click',ev=>{ev.preventDefault();try{fn(ev)}catch(err){console.error(err);toast('Action failed. Check app permissions.')}}))}
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-tab]');if(b){ev.preventDefault();tab(b.dataset.tab)}});
bind('urbanMode',()=>mode('URBAN'));bind('rainMode',()=>mode('RAIN'));
bind('openNavigation',()=>{tab('navigation');safe('destination',e=>e.focus())});

/* In-app navigation: MapLibre + OSM tiles + Nominatim geocoding + OSRM routing */
const nav={map:null,homeMap:null,ready:false,homeReady:false,destination:null,route:null,steps:[],active:false,watch:null,userMarker:null,destMarker:null,routeLayer:false,lastStep:-1};
function mapStyleUrl(){const key=store.get('maptilerKey','').trim();const style=store.get('mapStyle','streets-v2-dark');return key?'https://api.maptiler.com/maps/'+encodeURIComponent(style)+'/style.json?key='+encodeURIComponent(key):null}
function createPremiumMap(container,zoom){const style=mapStyleUrl();if(!style){toast('Add your MapTiler API key in Settings to enable premium vector maps');tab('settings');return null}return new maplibregl.Map({container,style,center:[73.8567,18.5204],zoom,attributionControl:true,renderWorldCopies:false,fadeDuration:150, maxPitch:65});}
function navToast(message){toast(message)}
function initHomeMap(){
 if(nav.homeMap||!window.maplibregl||!$('homeBikeMap'))return;
 nav.homeMap=createPremiumMap('homeBikeMap',11);if(!nav.homeMap)return;
 nav.homeMap.on('load',()=>{nav.homeReady=true;if(s.pos)updateUserMarker(s.pos.coords);if(nav.route)drawRoute()});
}
function homeText(id,value){safe(id,e=>e.textContent=value)}
function syncHomeNavigation(){
 const instruction=$('navInstruction')?.textContent||'Search a destination below';
 const distance=$('navDistance')?.textContent||'Navigation ready';
 const remaining=$('navRemaining')?.textContent||'GPS WAITING';
 const eta=$('eta')?.textContent||'ETA --';
 homeText('homeNavInstruction',instruction);homeText('homeNavDistance',distance);
 homeText('homeNavRemaining',remaining);homeText('homeEta',eta);safe('homeStartNavigation',e=>{e.disabled=!nav.route||nav.active;e.textContent=nav.active?'NAVIGATING':'START ROUTE'});safe('homeEndNavigation',e=>e.disabled=!nav.active);
}
function initMap(){
 if(nav.map||!window.maplibregl||!$('bikeMap'))return;
 nav.map=createPremiumMap('bikeMap',12);if(!nav.map)return;
 nav.map.addControl(new maplibregl.NavigationControl({showCompass:true}),'top-right');
 nav.map.on('load',()=>{nav.ready=true;if(s.pos)updateUserMarker(s.pos.coords);if(nav.route)drawRoute()});
 nav.map.on('error',e=>console.warn('Map tile error',e));
}
function updateUserMarker(c){
 const ll=[c.longitude,c.latitude];
 if(nav.homeMap&&nav.homeReady){
  if(!nav.homeUserMarker){const el=document.createElement('div');el.className='user-map-marker';nav.homeUserMarker=new maplibregl.Marker({element:el}).setLngLat(ll).addTo(nav.homeMap)}
  else nav.homeUserMarker.setLngLat(ll);
 }
 if(!nav.map||!nav.ready)return;
 if(!nav.userMarker){const el=document.createElement('div');el.className='user-map-marker';nav.userMarker=new maplibregl.Marker({element:el}).setLngLat(ll).addTo(nav.map)}
 else nav.userMarker.setLngLat(ll);
 if(nav.active){advanceGuidance(ll);nav.map.easeTo({center:ll,duration:450,essential:true})}
}
function drawRoute(){
 if(!nav.route)return;
 const data={type:'Feature',properties:{},geometry:nav.route.geometry};
 if(nav.homeMap&&nav.homeReady){
  if(nav.homeMap.getSource('home-route'))nav.homeMap.getSource('home-route').setData(data);
  else{nav.homeMap.addSource('home-route',{type:'geojson',data});nav.homeMap.addLayer({id:'home-route-line',type:'line',source:'home-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ed2638','line-width':5}})}
  const hc=nav.route.geometry.coordinates;nav.homeMap.fitBounds(hc.reduce((b,p)=>b.extend(p),new maplibregl.LngLatBounds(hc[0],hc[0])),{padding:20,duration:350});
 }
 if(!nav.map||!nav.ready)return;
 if(nav.map.getSource('bikeos-route'))nav.map.getSource('bikeos-route').setData(data);
 else{nav.map.addSource('bikeos-route',{type:'geojson',data});nav.map.addLayer({id:'bikeos-route-casing',type:'line',source:'bikeos-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#08090b','line-width':11,'line-opacity':.85}});nav.map.addLayer({id:'bikeos-route-line',type:'line',source:'bikeos-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#f21d32','line-width':6}})}
 const coords=nav.route.geometry.coordinates;nav.map.fitBounds(coords.reduce((b,p)=>b.extend(p),new maplibregl.LngLatBounds(coords[0],coords[0])),{padding:{top:70,bottom:70,left:50,right:50},duration:700});
}
async function searchDestination(source='navigation'){
 const home=source==='home';const input=$(home?'homeDestination':'destination');const q=input?.value.trim();if(!q){navToast('Enter a destination first');return}
 const btn=$(home?'homeDestinationGo':'destinationGo');if(btn){btn.disabled=true;btn.textContent='SEARCHING'}
 try{
  const box=$(home?'homePlaceResults':'placeResults');box.hidden=false;box.textContent='Searching places…';
  let places=[];
  const bias=s.pos?('&lat='+s.pos.coords.latitude+'&lon='+s.pos.coords.longitude):'&lat=18.5204&lon=73.8567';
  try{
   const pr=await fetch('https://photon.komoot.io/api/?q='+encodeURIComponent(q)+bias+'&bbox=68.1,6.5,97.4,35.7&limit=8&lang=en');
   if(pr.ok){const pd=await pr.json();places=(pd.features||[]).map(f=>({display_name:[f.properties.name,f.properties.street,f.properties.city||f.properties.district,f.properties.state,f.properties.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', '),lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0]})).filter(p=>p.display_name)}
  }catch(_){}
  if(!places.length){
   try{const nr=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&countrycodes=in&q='+encodeURIComponent(q),{headers:{Accept:'application/json'}});if(nr.ok)places=await nr.json()}catch(_){}
  }
  if(!places.length){box.textContent='No matching places in India. Try a nearby landmark or a shorter search.';return}
  box.innerHTML='';places.forEach(p=>{const b=document.createElement('button');b.type='button';b.textContent=p.display_name;b.addEventListener('click',()=>{nav.destination={name:p.display_name,lat:Number(p.lat),lon:Number(p.lon)};if(input)input.value=p.display_name;const other=$(home?'destination':'homeDestination');if(other)other.value=p.display_name;box.hidden=true;buildRoute()});box.appendChild(b)});box.hidden=false;
 }catch(e){navToast(e.message+'; check your internet connection.')}finally{if(btn){btn.disabled=false;btn.textContent='GO'}}
}
async function buildRoute(){
 if(!nav.destination){navToast('Choose a destination from search results');return}
 if(!s.pos){gps();navToast('Waiting for GPS location. Allow location access and try again.');return}
 initMap();const c=s.pos.coords;const from=c.longitude+','+c.latitude,to=nav.destination.lon+','+nav.destination.lat;
 try{
  navToast('Calculating route…');
  const r=await fetch('https://router.project-osrm.org/route/v1/driving/'+from+';'+to+'?overview=full&geometries=geojson&steps=true');
  if(!r.ok)throw new Error('Routing service unavailable');const data=await r.json();if(data.code!=='Ok'||!data.routes?.length)throw new Error('No driving route found');
  nav.route=data.routes[0];nav.steps=[];nav.route.legs.forEach(leg=>leg.steps.forEach(step=>nav.steps.push(step)));
  nav.lastStep=-1;nav.active=false;
  if(nav.destMarker)nav.destMarker.remove();
  nav.destMarker=new maplibregl.Marker({color:'#f21d32'}).setLngLat([nav.destination.lon,nav.destination.lat]).addTo(nav.map);
  drawRoute();renderSteps();safe('navRemaining',e=>e.textContent=(nav.route.distance/1000).toFixed(1)+' km');safe('eta',e=>e.textContent=new Date(Date.now()+nav.route.duration*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
  safe('navInstruction',e=>e.textContent='Route preview ready');safe('navDistance',e=>e.textContent=(nav.route.duration/60).toFixed(0)+' min • '+(nav.route.distance/1000).toFixed(1)+' km');syncHomeNavigation();
  safe('startNavigation',e=>{e.disabled=false;e.textContent='START ROUTE'});navToast('Route ready. Start when safely stationary.');syncHomeNavigation();
 }catch(e){navToast(e.message)}
}
function instructionText(step){
 const m=step.maneuver||{},type=m.type||'continue',mod=m.modifier?(' '+m.modifier):'';
 const road=step.name?' onto '+step.name:'';
 const map={turn:'Turn'+mod,continue:'Continue','new name':'Continue',merge:'Merge'+mod,roundabout:'At the roundabout, take the exit',rotary:'At the roundabout, take the exit',depart:'Head'+mod,arrive:'You have arrived',fork:'Keep'+mod,'off ramp':'Take the exit'+mod,'on ramp':'Take the ramp'+mod};
 return (map[type]||type.replace(/_/g,' '))+road;
}
function renderSteps(){
 const list=$('routeSteps');if(!list)return;list.innerHTML='';
 nav.steps.forEach((step,i)=>{const li=document.createElement('li');li.dataset.step=String(i);const name=document.createElement('b');name.textContent=instructionText(step);const dist=document.createElement('small');dist.textContent=step.distance>=1000?(step.distance/1000).toFixed(1)+' km':Math.round(step.distance)+' m';li.append(name,dist);list.appendChild(li)});
}
function distanceMeters(a,b){const R=6371000,rad=x=>x*Math.PI/180,dLat=rad(b[1]-a[1]),dLon=rad(b[0]-a[0]),v=Math.sin(dLat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dLon/2)**2;return 2*R*Math.atan2(Math.sqrt(v),Math.sqrt(1-v))}
function advanceGuidance(ll){
 if(!nav.active||!nav.steps.length)return;
 let best=nav.lastStep<0?0:nav.lastStep,bestD=Infinity;
 for(let i=Math.max(0,nav.lastStep);i<nav.steps.length;i++){const loc=nav.steps[i].maneuver.location,d=distanceMeters(ll,loc);if(d<bestD){bestD=d;best=i}if(i>best+3)break}
 nav.lastStep=Math.max(nav.lastStep,best);
 const step=nav.steps[nav.lastStep];if(!step)return;
 const target=step.maneuver.location,remaining=distanceMeters(ll,target);
 safe('navInstruction',e=>e.textContent=instructionText(step));safe('navDistance',e=>e.textContent=remaining>1000?(remaining/1000).toFixed(1)+' km':'In '+Math.max(0,Math.round(remaining))+' m');
 safe('turnIcon',e=>e.textContent=(step.maneuver.modifier||'straight').includes('left')?'↰':(step.maneuver.modifier||'').includes('right')?'↱':'↑');
 document.querySelectorAll('#routeSteps li').forEach((li,i)=>li.classList.toggle('current',i===nav.lastStep));
 const remainingSteps=nav.steps.slice(nav.lastStep);const left=remainingSteps.reduce((sum,x)=>sum+x.distance,0);const seconds=remainingSteps.reduce((sum,x)=>sum+x.duration,0);safe('navRemaining',e=>e.textContent=(left/1000).toFixed(1)+' km');safe('eta',e=>e.textContent=new Date(Date.now()+seconds*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));syncHomeNavigation();
}
function startGuidance(){if(!nav.route){navToast('Calculate a route first');return}if(!s.pos){gps();navToast('GPS location is required');return}nav.active=true;nav.lastStep=0;advanceGuidance([s.pos.coords.longitude,s.pos.coords.latitude]);safe('startNavigation',e=>{e.textContent='NAVIGATING';e.disabled=true});syncHomeNavigation();navToast('Navigation started. Keep your attention on the road.')}
function stopGuidance(){nav.active=false;safe('startNavigation',e=>{e.textContent='START ROUTE';e.disabled=false});syncHomeNavigation();navToast('Navigation ended')}
bind('destinationGo',()=>searchDestination('navigation'));bind('startNavigation',startGuidance);bind('stopNavigation',stopGuidance);bind('homeStartNavigation',startGuidance);bind('homeEndNavigation',stopGuidance);bind('centerMap',()=>{if(s.pos&&nav.map)nav.map.flyTo({center:[s.pos.coords.longitude,s.pos.coords.latitude],zoom:16})});bind('recenterMap',()=>{if(s.pos&&nav.map)nav.map.flyTo({center:[s.pos.coords.longitude,s.pos.coords.latitude],zoom:16})});
const suggestionTimers={};
async function suggestPlaces(id){
 const input=$(id),box=$(id==='homeDestination'?'homePlaceResults':'placeResults');if(!input||!box)return;
 const q=input.value.trim();if(q.length<2){box.hidden=true;box.textContent='';return}
 const bias=s.pos?('&lat='+s.pos.coords.latitude+'&lon='+s.pos.coords.longitude):'&lat=18.5204&lon=73.8567';
 box.hidden=false;box.textContent='Finding places…';
 try{
  const r=await fetch('https://photon.komoot.io/api/?q='+encodeURIComponent(q)+bias+'&bbox=68.1,6.5,97.4,35.7&limit=6&lang=en');
  if(!r.ok)throw new Error('Search unavailable');const data=await r.json();
  const items=(data.features||[]).map(f=>({name:[f.properties.name,f.properties.street,f.properties.city||f.properties.district,f.properties.state].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', '),lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0]})).filter(x=>x.name);
  box.replaceChildren();
  if(!items.length){box.textContent='No suggestions found';return}
  items.forEach(p=>{const b=document.createElement('button');b.type='button';b.textContent=p.name;b.addEventListener('click',()=>{nav.destination={name:p.name,lat:Number(p.lat),lon:Number(p.lon)};input.value=p.name;const other=$(id==='homeDestination'?'destination':'homeDestination');if(other)other.value=p.name;box.hidden=true;buildRoute()});box.appendChild(b)});
  box.hidden=false;
 }catch(_){box.textContent='Search suggestions unavailable. Check internet connection.'}
}
['destination','homeDestination'].forEach(id=>safe(id,e=>{
 e.addEventListener('input',()=>{clearTimeout(suggestionTimers[id]);suggestionTimers[id]=setTimeout(()=>suggestPlaces(id),280)});
 e.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();searchDestination(id==='homeDestination'?'home':'navigation')}if(ev.key==='Escape'){const box=$(id==='homeDestination'?'homePlaceResults':'placeResults');if(box)box.hidden=true}});
}));
bind('homeDestinationGo',()=>searchDestination('home'));

bind('openPhone',()=>openUrl('tel:'));
function launchYouTubeMusic(){if(window.BikeOSNative&&window.BikeOSNative.openYouTubeMusic){window.BikeOSNative.openYouTubeMusic();return}openUrl('https://music.youtube.com')}

function mediaTime(ms){const n=Math.max(0,Math.floor((Number(ms)||0)/1000));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function refreshYT(){if(window.BikeOSNative&&window.BikeOSNative.refreshMedia)window.BikeOSNative.refreshMedia()}
function mediaCommand(command){if(window.BikeOSNative&&window.BikeOSNative.mediaCommand)window.BikeOSNative.mediaCommand(command);else toast('Media controls require the Android app')}
window.BikeOSMediaUpdate=function(m){
 safe('ytTitle',e=>e.textContent=m.title||'Nothing playing');
 safe('ytArtist',e=>e.textContent=m.artist||'Start YouTube Music on this phone');
 safe('ytAlbum',e=>e.textContent=m.album||'');
 safe('ytPlayPause',e=>{e.textContent=m.playing?'Ⅱ':'▶';e.setAttribute('aria-label',m.playing?'Pause':'Play')});
 safe('ytPosition',e=>e.textContent=mediaTime(m.position));
 safe('ytDuration',e=>e.textContent=mediaTime(m.duration));
 safe('ytProgressBar',e=>e.style.width=(m.duration?Math.min(100,100*(m.position||0)/m.duration):0)+'%');
 safe('ytStatus',e=>e.textContent=!m.permission?'Enable notification access to connect the media session':(m.available?'Connected to YouTube Music playback':'Waiting for an active YouTube Music session'));
 safe('ytPermission',e=>{e.hidden=!!m.permission;e.textContent='ENABLE MEDIA ACCESS'});
};
bind('ytPrevious',()=>mediaCommand('previous'));
bind('ytNext',()=>mediaCommand('next'));
bind('ytPlayPause',()=>mediaCommand('toggle'));
bind('ytPermission',()=>{if(window.BikeOSNative&&window.BikeOSNative.requestMediaAccess)window.BikeOSNative.requestMediaAccess();else toast('Open the Android app to enable media access')});
bind('openYouTubeMusic',launchYouTubeMusic);

bind('playMusic',launchYouTubeMusic);bind('prevTrack',()=>toast('Use previous track in your music app'));bind('nextTrack',()=>toast('Use next track in your music app'));
bind('startRide',startRide);bind('endRide',endRide);
bind('resetTrip',()=>{if(s.riding){toast('End the ride before resetting');return}s.dist=0;s.max=0;s.samples=[];s.elapsed=0;s.last=null;stats();toast('Trip A reset')});
bind('saveEmergency',()=>{const n=$('emergencyContact')?.value.trim()||'';if(!/^[+0-9 ()-]{7,20}$/.test(n)){safe('sosStatus',e=>e.textContent='Enter a valid phone number.');return}store.set('emergency',n);safe('sosStatus',e=>e.textContent='Emergency contact saved on this device.');toast('Emergency contact saved')});
bind('call112',()=>{if(confirm('Open your phone dialler to call India emergency number 112?'))openUrl('tel:112')});
bind('shareSOS',()=>{const n=store.get('emergency');if(!n){safe('sosStatus',e=>e.textContent='Save an emergency contact first.');tab('settings');return}if(!s.pos){gps();safe('sosStatus',e=>e.textContent='Waiting for GPS lock. Try again once location is available.');return}const c=s.pos.coords,body='Emergency. I need assistance. My location: https://maps.google.com/?q='+c.latitude+','+c.longitude;openUrl('sms:'+encodeURIComponent(n)+'?body='+encodeURIComponent(body))});

bind('gpsRefresh',()=>{s.watch=null;gps();toast('Refreshing GPS')});
bind('saveBikeSettings',()=>{safe('mapTilerKey',e=>store.set('maptilerKey',e.value.trim()));safe('settingHelmet',e=>store.set('helmet',e.value));safe('settingGopro',e=>store.set('gopro',e.value));safe('settingMapStyle',e=>store.set('mapStyle',e.value));safe('settingUnits',e=>store.set('units',e.value));safe('settingVoice',e=>store.set('voice',e.checked));safe('helmetState',e=>e.textContent=store.get('helmet','NOT LINKED'));safe('goproState',e=>e.textContent=store.get('gopro','NOT LINKED'));safe('settingsStatus',e=>e.textContent='Bike profile saved on this device. Premium map style will reload when you reopen Navigation.');if(nav.map){nav.map.remove();nav.map=null;nav.ready=false}if(nav.homeMap){nav.homeMap.remove();nav.homeMap=null;nav.homeReady=false}toast('Settings saved. Reopen the map to apply the premium style.')});
safe('mapTilerKey',e=>e.value=store.get('maptilerKey',''));safe('settingHelmet',e=>e.value=store.get('helmet','NOT LINKED'));safe('settingGopro',e=>e.value=store.get('gopro','NOT LINKED'));safe('settingMapStyle',e=>e.value=store.get('mapStyle','streets-v2-dark'));safe('settingUnits',e=>e.value=store.get('units','km'));safe('settingVoice',e=>e.checked=store.get('voice','false')==='true');safe('goproState',e=>e.textContent=store.get('gopro','NOT LINKED'));
safe('emergencyContact',e=>e.value=store.get('emergency',''));
safe('phoneBattery',e=>e.textContent='PHONE');safe('btStatus',e=>{e.title='Waiting for native Android Bluetooth status';e.classList.remove('green')});
window.BikeOSBluetoothUpdate=function(status){const label=status.connected?'CONNECTED':(status.enabled?'NO DEVICE':'BLUETOOTH OFF');safe('btStatus',e=>{e.textContent='ᛒ';e.title='Bluetooth: '+label;e.classList.toggle('green',!!status.connected);e.classList.toggle('blue',!status.connected)});safe('helmetState',e=>e.textContent=status.connected?'CONNECTED':'NOT CONNECTED');safe('bikeConnection',e=>e.textContent=status.connected?'BLUETOOTH LINKED':'PHONE GPS READY');safe('homeConnection',e=>e.textContent=status.connected?'BLUETOOTH CONNECTED':'BLUETOOTH READY')};
bind('bluetoothHelp',()=>{if(window.BikeOSNative&&window.BikeOSNative.refreshBluetooth){window.BikeOSNative.refreshBluetooth();toast('Refreshing Android Bluetooth status')}else toast('Native Bluetooth status is available in the Android APK')});
if(window.BikeOSNative&&window.BikeOSNative.refreshBluetooth)window.BikeOSNative.refreshBluetooth();refreshYT();safe('phoneStatus',e=>e.title='Phone call bridge not connected');safe('homePhoneLink',e=>e.textContent='Bluetooth / Wi-Fi');safe('eta',e=>e.textContent='--:--');
if(navigator.getBattery)navigator.getBattery().then(b=>{const f=()=>safe('phoneBattery',e=>e.textContent=Math.round(b.level*100)+'%');f();b.addEventListener('levelchange',f)}).catch(()=>{});
function tick(){const d=new Date();safe('clock',e=>e.textContent=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));safe('date',e=>e.textContent=d.toLocaleDateString([],{weekday:'short',day:'2-digit',month:'short',year:'numeric'}))}
mode(s.mode);history();tick();setInterval(tick,1000);gps();stats();initHomeMap();syncHomeNavigation();
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&goBack())e.preventDefault()});window.addEventListener('error',e=>toast('Dashboard error: '+(e.message||'unknown')));
})();