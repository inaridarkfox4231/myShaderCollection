let gl;
let buf; // bufは必要

let fox;

let count = 0;

let myShader;
let vs =
`
precision mediump float; // これがないと両方でuCount使えなくてエラーになる
attribute vec3 aPosition;
uniform float uPointSize;
uniform float uCount;
uniform float uDistanceFactor;
const float TAU = 6.28318;
varying float vStrokeWeight;
varying vec3 vPosition;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
void main() {
  vec3 p = aPosition;
  p = -1.0 + 2.0 * p;
  vPosition = p;
  float properCount = uCount + abs(sin(p.x * 4321.579)) * 240.0;
  float theta = properCount * TAU / 183.0;
  float phi = properCount * TAU / 237.0;
  p.x += 0.05 * sin(theta) * cos(phi);
  p.y += 0.05 * sin(theta) * sin(phi);
  p.z += 0.05 * cos(theta);
  vec4 positionVec4 =  vec4(p * uDistanceFactor, 1.0);
  gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;
  gl_PointSize = uPointSize;
  vStrokeWeight = uPointSize;
}
`
let fs =
`
precision mediump float;
precision mediump int;
uniform vec4 uMaterialColor;
uniform float uCount;
uniform sampler2D uFox;
const float TAU = 6.28318;
varying float vStrokeWeight;
varying vec3 vPosition;

const vec3 red = vec3(0.95, 0.2, 0.25);
const vec3 orange = vec3(0.98, 0.49, 0.13);
const vec3 yellow = vec3(0.95, 0.98, 0.2);
const vec3 green = vec3(0.1, 0.9, 0.2);

// getRGB,参上！
vec3 getRGB(float h, float s, float b){
    vec3 c = vec3(h, s, b);
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    rgb = rgb * rgb * (3.0 - 2.0 * rgb);
    return c.z * mix(vec3(1.0), rgb, c.y);
}

void main(){
  float mask = 0.0;

  // make a circular mask using the gl_PointCoord (goes from 0 - 1 on a point)
  // might be able to get a nicer edge on big strokeweights with smoothstep but slightly less performant

  mask = step(0.98, length(gl_PointCoord * 2.0 - 1.0));

  // if strokeWeight is 1 or less lets just draw a square
  // this prevents weird artifacting from carving circles when our points are really small
  // if strokeWeight is larger than 1, we just use it as is

  mask = mix(0.0, mask, clamp(floor(vStrokeWeight - 0.5),0.0,1.0));

  // throw away the borders of the mask
  // otherwise we get weird alpha blending issues

  if(mask > 0.98){
    discard;
  }
  //gl_FragColor = vec4(getRGB(0.55, length(gl_PointCoord.xy - vec2(0.5)), 1.0), 1.0);
  vec2 p = vPosition.xy;
  float idX = floor(abs(sin(p.x * 4319.35)) * 2.0);
  float idY = floor(abs(sin(p.y * 3152.29)) * 2.0);
  vec4 col = texture2D(uFox, vec2(0.5 * idX, 0.5 * idY) + gl_PointCoord.xy * 0.5);
  if(col.a < 0.01){ discard; }
	if(mod(idX + idY, 2.0) == 0.0){ col = mix(col, vec4(red, 1.0), 0.5); }else{ col = mix(col, vec4(green, 1.0), 0.5); }
  gl_FragColor = col;
}
`

function setup(){
  let _gl=createCanvas(windowWidth, windowHeight, WEBGL);
  gl = this._renderer.GL
  pixelDensity(1);
  myShader = createShader(vs, fs);
  shader(myShader);
  stroke(255);
  strokeWeight(floor(min(width, height) * 0.08));
  myShader.isPointShader = () => true;
  _gl.userPointShader = myShader;

  fox = createGraphics(200, 200);
  fox.textSize(50);
  //fox.background(0, 128, 255);
  fox.textAlign(CENTER, CENTER);
	const zoo = ["🦊", "🦝", "🦝", "🦊"];
	for(let x = 0; x < 2; x++){
		for(let y = 0; y < 2; y++){
			fox.text(zoo[x + 2 * y], x * 100 + 50, y * 100 + 50);
		}
	}
}

function draw(){
  let start = millis();
  background(0);
  rotateX(TAU * count / 241);
  rotateZ(TAU * count / 353);
  myShader.setUniform("uCount", count);
  const DISTANCE_FACTOR = min(width, height) * 0.7;
  myShader.setUniform("uDistanceFactor", DISTANCE_FACTOR);
  myShader.setUniform("uFox", fox);
  myPoints(5000);
  count++;
  let end = millis();
  //if(count%60==0){console.log((end-start)*60/1000);}
}

function myPoints(num){
  const gId = `myPoints|${num}`;
  if(!this._renderer.geometryInHash(gId)){
    const myPointsGeom = new p5.Geometry();
    let v = createVector();
    for(let i = 0; i < num; i++){
      // もはやただのノイズ
      // 1より大きい値にすればidにできるね・・0.01～0.99に落とすとかして。何でもできる。自由自在。
      let x = noise(i, 0, 0);
      let y = noise(0, i, 0);
      let z = noise(0, 0, i);
      myPointsGeom.vertices.push(v.set(x, y, z).copy());
    }
    buf = this._renderer.createBuffers(gId, myPointsGeom);
  }
  // これでいいんだ
  this._renderer._drawPoints(buf.model.vertices, this._renderer.immediateMode.buffers.point);
}
