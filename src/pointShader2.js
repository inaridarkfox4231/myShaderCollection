// トーラスの周りにパーティクルを回転させる感じのやつをやりたいです

// gl_PointCoordって何だろ？？

let gl;
let buf; // bufは必要

let count = 0;
const PARTICLE_NUM = 10000;

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
  vPosition = aPosition;
  vec3 p = aPosition;
  // 位置を決める
  float properCountX = uCount * (1.0 + 0.5 * aPosition.x) + floor(abs(sin(aPosition.x * 4321.579)) * 321.0);
  float properCountY = uCount * (1.0 + 0.5 * aPosition.y) + floor(abs(sin(aPosition.y * 3127.493)) * 269.0);
  float properCountZ = uCount * (1.0 + 0.5 * aPosition.z) + floor(abs(sin(aPosition.z * 2522.841)) * 293.0);
  vec3 q;
  float theta = TAU * properCountX / 321.0;
  float phi = TAU * properCountY / 269.0;
  float r = 0.5 * sqrt(p.z) * 0.5 * (1.0 + sin(TAU * properCountZ / 293.0));
  if(aPosition.x > 0.5){ r = 1.0; }
  q.x = 1.5 * (cos(theta) + r * cos(theta) * cos(phi));
  q.y = sin(theta) + r * sin(theta) * cos(phi);
  q.z = sin(phi);

  vec4 positionVec4 =  vec4(q * uDistanceFactor, 1.0);
  gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;
  float sizeFactor = 0.5 + abs(sin(aPosition.y * 3371.412));
  gl_PointSize = uPointSize * sizeFactor;
  vStrokeWeight = uPointSize * sizeFactor;
}
`
let fs =
`
precision mediump float;
precision mediump int;
uniform vec4 uMaterialColor;
uniform float uCount;
const float TAU = 6.28318;
varying float vStrokeWeight;
varying vec3 vPosition;

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
  float properCount = uCount + abs(sin(vPosition.x * 3312.749)) * 360.0;
  float hue = fract(uCount / 600.0);
  float sat = 0.5 + 0.5 * sin(TAU * properCount / 360.0);
  gl_FragColor = vec4(getRGB(hue, sat, 1.0) * (1.0 - mask), 1.0);
}
`

function setup(){
  let _gl=createCanvas(windowWidth, windowHeight, WEBGL);
  gl = this._renderer.GL
  pixelDensity(1);
  myShader = createShader(vs, fs);
  shader(myShader);
  stroke(255);
  strokeWeight(3);
  myShader.isPointShader = () => true;
  _gl.userPointShader = myShader;
}

function draw(){
  let start = millis();
  background(0);
  rotateX(TAU * count / 941);
  rotateZ(TAU * count / 1253);
  myShader.setUniform("uCount", count);
  const DISTANCE_FACTOR = min(width, height) * 0.3;
  myShader.setUniform("uDistanceFactor", DISTANCE_FACTOR);
  myPoints(PARTICLE_NUM);
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
