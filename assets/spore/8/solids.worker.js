import{getSolid as a}from"../modules/polyhedra/solids.js";onmessage=({data:o})=>{for(const e of o){const{vertices:s,faces:t}=a(e);postMessage({name:e,vertices:s,faces:t})}};
