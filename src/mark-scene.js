import {Scene,Group,Mesh,ExtrudeGeometry,MeshPhysicalMaterial,WebGLRenderer,OrthographicCamera,DirectionalLight,AmbientLight,PMREMGenerator,ACESFilmicToneMapping,SRGBColorSpace} from 'three';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

/** Extrude the approved vector path. No generated or hand-drawn replacement silhouette. */
export async function mountMark(frame){
 const response=await fetch(frame.dataset.markSource);if(!response.ok)throw Error('Mark unavailable');
 const paths=new SVGLoader().parse(await response.text()).paths;
 const shapes=paths.flatMap(path=>path.toShapes());if(!shapes.length)throw Error('Mark unavailable');
 const renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 const scene=new Scene(),group=new Group(),camera=new OrthographicCamera(-125,125,100,-100,.1,1000);
 let animation=0,disposed=false,visible=true,active=!document.hidden,last=0;
 const hero=frame.closest('.agency-hero'),fine=matchMedia('(pointer: fine)'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const target={x:0,y:0},rotation={x:0,y:0};
 const geometry=new ExtrudeGeometry(shapes,{depth:5,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.24,bevelThickness:.35,curveSegments:24});
 geometry.rotateX(Math.PI);geometry.center();
 const front=new MeshPhysicalMaterial({color:0x1243df,metalness:.96,roughness:.2,clearcoat:1,clearcoatRoughness:.18,envMapIntensity:1.45});
 // A shallow physical fold changes depth and reflection, while leaving the SVG's XY outline intact.
 front.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z += sin(position.x * .028) * 4.0 + cos(position.y * .04) * 2.0;');
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nif(abs(objectNormal.z) > .95){float facing=sign(objectNormal.z);objectNormal=normalize(vec3(-cos(position.x*.028)*.112,sin(position.y*.04)*.08,1.0))*facing;}');
 };
 const edge=new MeshPhysicalMaterial({color:0x0c1737,metalness:.88,roughness:.3,envMapIntensity:1.3});
 const mesh=new Mesh(geometry,[front,edge]);group.add(mesh);scene.add(group);
 group.rotation.set(-.07,-.22,-.085);
 renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 renderer.setClearColor(0x0B0B0E,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 const pmrem=new PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);
 scene.environment=environment.texture;room.dispose();pmrem.dispose();
 const key=new DirectionalLight(0xe5edff,3.5);key.position.set(-80,130,170);scene.add(key);
 const rim=new DirectionalLight(0x1B4DFF,5);rim.position.set(110,-10,90);scene.add(rim);
 const fill=new AmbientLight(0xffffff,.7);scene.add(fill);camera.position.set(0,0,300);
 renderer.domElement.className='mark-canvas';renderer.domElement.setAttribute('aria-hidden','true');
 function resize(){if(disposed)return;const {width,height}=frame.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);const halfHeight=Math.max(86,112/(width/height));camera.left=-halfHeight*width/height;camera.right=halfHeight*width/height;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();renderer.render(scene,camera)}
 function draw(now){animation=0;if(disposed||!visible||!active)return;if(now-last<1000/30){animation=requestAnimationFrame(draw);return}last=now;rotation.x+=(target.x-rotation.x)*.065;rotation.y+=(target.y-rotation.y)*.065;group.rotation.x=-.07+rotation.x;group.rotation.y=-.22+rotation.y;renderer.render(scene,camera);if(Math.abs(target.x-rotation.x)+Math.abs(target.y-rotation.y)>.0001)animation=requestAnimationFrame(draw)}
 function start(){if(!disposed&&visible&&active&&!animation)animation=requestAnimationFrame(draw)}
 function pause(){cancelAnimationFrame(animation);animation=0}
 function move(event){if(!fine.matches||reduce.matches)return;const r=hero.getBoundingClientRect();target.x=-((event.clientY-r.top)/r.height-.5)*.08;target.y=((event.clientX-r.left)/r.width-.5)*.14;start()}
 function leave(){target.x=0;target.y=0;start()}
 function visibility(){active=!document.hidden;if(active)start();else pause()}
 function lost(event){event.preventDefault();dispose()}
 const size=new ResizeObserver(resize),intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else pause()});
 function dispose(){if(disposed)return;disposed=true;pause();size.disconnect();intersection.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('webglcontextlost',lost);geometry.dispose();front.dispose();edge.dispose();environment.dispose();renderer.dispose();renderer.domElement.remove();frame.classList.remove('mark-ready')}
 try{resize();frame.append(renderer.domElement);frame.classList.add('mark-ready');size.observe(frame);intersection.observe(frame);hero.addEventListener('pointermove',move,{passive:true});hero.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);renderer.domElement.addEventListener('webglcontextlost',lost);start();return dispose}
 catch(error){dispose();throw error}
}
