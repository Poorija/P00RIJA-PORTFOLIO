import * as THREE from "three";
import { makePlanetTexture, type ResourcePool } from "./materials";

export function createSpaceEnvironment(scene: THREE.Scene, pool: ResourcePool, lowPower: boolean) {
  const group = new THREE.Group();
  scene.add(group);
  const skyMaterial = pool.track(new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vDirection; void main(){ vDirection = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      precision highp float;
      varying vec3 vDirection;
      uniform float uTime;
      float hash(vec3 p){ p = fract(p * .3183099 + vec3(.1,.2,.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 p){
        vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float fbm(vec3 p){ float v=0.0,a=.5; for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+1.7;a*=.5;}return v; }
      void main(){
        vec3 d=normalize(vDirection);
        float cloud=fbm(d*3.4+vec3(2.0,1.0,4.0));
        float filament=fbm(d*8.0-cloud*2.0);
        float band=pow(max(0.0,1.0-abs(d.y*.85+d.x*.28)),5.0);
        vec3 nebula=mix(vec3(.008,.014,.035),vec3(.075,.035,.16),cloud)*band;
        nebula+=vec3(.015,.09,.15)*filament*band*.8;
        float cell=hash(floor(d*920.0));
        float star=smoothstep(.9945,1.0,cell);
        float bright=pow(hash(floor(d*920.0)+4.2),8.0);
        vec3 starColor=mix(vec3(.55,.72,1.0),vec3(1.0,.82,.62),hash(floor(d*920.0)+8.1));
        gl_FragColor=vec4(vec3(.0015,.003,.009)+nebula+starColor*star*(1.0+bright*4.0),1.0);
      }`,
  }));
  const sky = new THREE.Mesh(pool.track(new THREE.SphereGeometry(180, lowPower ? 24 : 40, lowPower ? 16 : 24)), skyMaterial);
  group.add(sky);

  const starCount = lowPower ? 500 : 1500;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const direction = new THREE.Vector3().randomDirection().multiplyScalar(95 + Math.random() * 55);
    positions.set([direction.x, direction.y, direction.z], i * 3);
    const color = new THREE.Color().setHSL(0.53 + Math.random() * 0.12, 0.2 + Math.random() * 0.35, 0.65 + Math.random() * 0.35);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  const starGeometry = pool.track(new THREE.BufferGeometry());
  starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(starGeometry, pool.track(new THREE.PointsMaterial({ size: 0.22, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })));
  group.add(stars);

  const planet = new THREE.Group();
  planet.position.set(34, 16, -74);
  const planetMaterial = pool.track(new THREE.MeshStandardMaterial({ map: pool.track(makePlanetTexture()), roughness: 0.92, metalness: 0.02, emissive: 0x0c1628, emissiveIntensity: 0.22 }));
  const globe = new THREE.Mesh(pool.track(new THREE.SphereGeometry(9, lowPower ? 32 : 64, lowPower ? 20 : 40)), planetMaterial);
  globe.rotation.z = -0.24;
  planet.add(globe);
  const atmosphere = new THREE.Mesh(
    pool.track(new THREE.SphereGeometry(9.35, 40, 24)),
    pool.track(new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: `varying vec3 vNormal; varying vec3 vWorld; void main(){vNormal=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader: `varying vec3 vNormal;varying vec3 vWorld;void main(){vec3 viewDir=normalize(cameraPosition-vWorld);float rim=pow(1.0-abs(dot(vNormal,viewDir)),2.4);gl_FragColor=vec4(vec3(.15,.48,1.0)*rim,rim*.52);}`,
    }))
  );
  planet.add(atmosphere);
  group.add(planet);

  return (time: number, dt: number) => {
    skyMaterial.uniforms.uTime.value = time;
    stars.rotation.y += dt * 0.0007;
    globe.rotation.y += dt * 0.004;
  };
}
