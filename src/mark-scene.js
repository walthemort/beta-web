import {Scene,Group,Mesh,ExtrudeGeometry,BufferGeometry,Float32BufferAttribute,MeshPhysicalMaterial,WebGLRenderer,PerspectiveCamera,DirectionalLight,AmbientLight,PMREMGenerator,ACESFilmicToneMapping,SRGBColorSpace,DataTexture,RepeatWrapping,LinearFilter,LinearMipmapLinearFilter} from 'three';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {TessellateModifier} from 'three/addons/modifiers/TessellateModifier.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Extrude the approved vector path. No generated or hand-drawn replacement silhouette. */
export async function mountMark(frame){
 const response=await fetch(frame.dataset.markSource);if(!response.ok)throw Error('Mark unavailable');
 const paths=new SVGLoader().parse(await response.text()).paths;
 const shapes=paths.flatMap(path=>path.toShapes());if(!shapes.length)throw Error('Mark unavailable');
 const renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 const scene=new Scene(),group=new Group(),camera=new PerspectiveCamera(30,1,.1,1000);
 let animation=0,disposed=false,visible=true,active=!document.hidden,last=0;
 const hero=frame.closest('.agency-hero'),fine=matchMedia('(pointer: fine)'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const target={x:0,y:0},rotation={x:0,y:0};
 const outline=new ExtrudeGeometry(shapes,{depth:12,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.4,bevelThickness:.8,curveSegments:32});
 outline.rotateX(Math.PI);outline.center();
 // Tessellate each material region separately: the modifier drops material groups.
 const tessellator=new TessellateModifier(7,5),parts=outline.groups.map(region=>{
  const part=new BufferGeometry();
  for(const [name,attribute] of Object.entries(outline.attributes))part.setAttribute(name,new Float32BufferAttribute(attribute.array.slice(region.start*attribute.itemSize,(region.start+region.count)*attribute.itemSize),attribute.itemSize));
  const refined=tessellator.modify(part);part.dispose();return refined;
 });
 const geometry=mergeGeometries(parts,true);geometry.groups.forEach((region,index)=>region.materialIndex=outline.groups[index].materialIndex);parts.forEach(part=>part.dispose());outline.dispose();
 // Seeded micrograin gives a satin surface without downloading another texture.
 const pixels=new Uint8Array(256*256*4);let seed=1927;
 for(let i=0;i<pixels.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=110+(seed>>>25);pixels[i]=pixels[i+1]=pixels[i+2]=value;pixels[i+3]=255}
 const grain=new DataTexture(pixels,256,256);grain.wrapS=grain.wrapT=RepeatWrapping;grain.repeat.set(.035,.035);grain.magFilter=LinearFilter;grain.minFilter=LinearMipmapLinearFilter;grain.generateMipmaps=true;grain.needsUpdate=true;
 const front=new MeshPhysicalMaterial({color:0x10121b,metalness:.9,roughness:.38,clearcoat:.4,clearcoatRoughness:.3,envMapIntensity:2.1,bumpMap:grain,bumpScale:.16});
 const edge=new MeshPhysicalMaterial({color:0x1B4DFF,emissive:0x082ed6,emissiveIntensity:.15,metalness:.88,roughness:.19,clearcoat:.8,envMapIntensity:2.2});
 // Both caps and edges receive the same depth fold, so their surfaces stay joined.
 // Normals use the fold's derivatives; the approved SVG's XY path stays unchanged.
 const fold=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z += sin(position.x * .025) * 30.0 + cos(position.y * .034) * 18.0;');
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nfloat foldDx=cos(position.x*.025)*.75;float foldDy=-sin(position.y*.034)*.612;objectNormal=normalize(vec3(objectNormal.x-foldDx*objectNormal.z,objectNormal.y-foldDy*objectNormal.z,objectNormal.z));');
 };
 front.onBeforeCompile=edge.onBeforeCompile=fold;
 const mesh=new Mesh(geometry,[front,edge]);group.add(mesh);scene.add(group);
 group.rotation.set(-.18,-.48,-.085);
 renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
 renderer.setClearColor(0x0B0B0E,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 const pmrem=new PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.025);
 scene.environment=environment.texture;room.dispose();pmrem.dispose();
 const key=new DirectionalLight(0xe5edff,5);key.position.set(-100,150,80);scene.add(key);
 const rim=new DirectionalLight(0x1B4DFF,8);rim.position.set(120,-15,50);scene.add(rim);
 const fill=new AmbientLight(0xb8c9ff,.3);scene.add(fill);
 renderer.domElement.className='mark-canvas';renderer.domElement.setAttribute('aria-hidden','true');
 function resize(){if(disposed)return;const {width,height}=frame.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);const halfHeight=Math.max(86,112/(width/height));camera.aspect=width/height;camera.position.z=halfHeight/Math.tan(Math.PI/12);camera.updateProjectionMatrix();renderer.render(scene,camera)}
 function draw(now){animation=0;if(disposed||!visible||!active)return;if(now-last<1000/30){animation=requestAnimationFrame(draw);return}last=now;rotation.x+=(target.x-rotation.x)*.055;rotation.y+=(target.y-rotation.y)*.055;group.rotation.x=-.18+rotation.x;group.rotation.y=-.48+rotation.y;renderer.render(scene,camera);if(Math.abs(target.x-rotation.x)+Math.abs(target.y-rotation.y)>.0001)animation=requestAnimationFrame(draw)}
 function start(){if(!disposed&&visible&&active&&!animation)animation=requestAnimationFrame(draw)}
 function pause(){cancelAnimationFrame(animation);animation=0}
 function move(event){if(!fine.matches||reduce.matches)return;const r=hero.getBoundingClientRect();target.x=-((event.clientY-r.top)/r.height-.5)*.08;target.y=((event.clientX-r.left)/r.width-.5)*.14;start()}
 function leave(){target.x=0;target.y=0;start()}
 function visibility(){active=!document.hidden;if(active)start();else pause()}
 function lost(event){event.preventDefault();dispose()}
 const size=new ResizeObserver(resize),intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else pause()});
 function dispose(){if(disposed)return;disposed=true;pause();size.disconnect();intersection.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('webglcontextlost',lost);geometry.dispose();front.dispose();edge.dispose();grain.dispose();environment.dispose();renderer.dispose();renderer.domElement.remove();frame.classList.remove('mark-ready')}
 try{resize();frame.append(renderer.domElement);frame.classList.add('mark-ready');size.observe(frame);intersection.observe(frame);hero.addEventListener('pointermove',move,{passive:true});hero.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);renderer.domElement.addEventListener('webglcontextlost',lost);start();return dispose}
 catch(error){dispose();throw error}
}
