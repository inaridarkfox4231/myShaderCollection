// ええ・・・
// Fox ParadiseはOKなのにこっちはダメってどゆことよ
// わかんねーーーーーーーーー

// これでもいいんだけど
// たとえばカーソルの周りにまとわりつくのとか
// そういうのの方がいいんだろうねー

let gl;
let buf; // bufは必要

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
const float PI = 3.14159;
varying float vStrokeWeight;
varying vec3 vPosition;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
void main() {
  vec3 p = aPosition;
  p = -1.0 + 2.0 * p;
  vPosition = p;
  float properCount = uCount + abs(sin(p.x * 4.3215 + p.y * 3.1329 + p.z * 3.2291)) * 240.0;
  float theta = properCount * TAU / 383.0;
  float phi = properCount * TAU / 447.0;
  float radius = 0.3 * cos(properCount * TAU / 400.0);
  p.x += radius * sin(theta) * cos(phi);
  p.y += radius * sin(theta) * sin(phi);
  p.z += radius * cos(theta);
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
const float TAU = 6.28318;
const float PI = 3.14159;
varying float vStrokeWeight;
varying vec3 vPosition;
const int STAR_ITER = 5;

// getRGB,参上！
vec3 getRGB(float h, float s, float b){
    vec3 c = vec3(h, s, b);
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    rgb = rgb * rgb * (3.0 - 2.0 * rgb);
    return c.z * mix(vec3(1.0), rgb, c.y);
}

// ベクトル取得関数
vec2 fromAngle(float t){ return vec2(cos(t), sin(t)); }

// 基本領域のはじっこに0がくるやつ（0～PI/n）
vec2 dihedral_bound(vec2 p, float n){
  float k = PI / n;
  vec2 e1 = vec2(0.0, 1.0);
  vec2 e2 = vec2(sin(k), -cos(k));
  for(float i = 0.0; i < 99.0; i += 1.0){
    if(i == n){ break; }
    p -= 2.0 * min(dot(p, e1), 0.0) * e1;
    p -= 2.0 * min(dot(p, e2), 0.0) * e2;
  }
  return p;
}

// 星型
float star(vec2 p, float r){
  p = dihedral_bound(p, 5.0);
  vec2 e = fromAngle(0.4 * PI);
  return dot(p - vec2(r, 0.0), e);
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
	vec3 v = vPosition;
	float properCount = uCount + abs(sin(v.x * 3.29145 + v.y * 2.18763 + v.z * 2.71451)) * 999.0;

	// -1.0～1.0に正規化する
	vec2 p = (gl_PointCoord.xy - vec2(0.5)) * 2.0;

	float speed = 0.01 + 0.02 * v.z;
	float t = properCount * TAU * speed * (mod(floor(v.x * 500.0), 2.0) == 0.0 ? 1.0 : -1.0);
	p *= mat2(cos(t), -sin(t), sin(t), cos(t));
	vec3 col;
	float d = star(p, 1.0);
	float hue = fract((uCount + 150.0 * v.y) / 600.0);
	if(d < 0.0){ col = getRGB(hue, 1.0 + d * 3.2, 0.8); }else{ discard; }

  gl_FragColor = vec4(col, 1.0);
}
`

let bg;
let bgShader;

let vsBG =
`
precision mediump float;
attribute vec3 aPosition;
void main(void){
  gl_Position = vec4(aPosition, 1.0);
}
`;

let fsBG =
`
precision mediump float;
uniform vec2 uResolution;
void main(void){
  vec2 p = gl_FragCoord.xy * 0.5 / uResolution.xy;
  gl_FragColor = vec4(0.0, 0.0, p.x * 2.0, 1.0);
}
`;

function setup(){
  let _gl=createCanvas(windowWidth, windowHeight, WEBGL);
  gl = this._renderer.GL
  pixelDensity(1);
  myShader = createShader(vs, fs);
  shader(myShader);
  stroke(255);
  strokeWeight(floor(min(width, height) * 0.06));
  myShader.isPointShader = () => true;
  _gl.userPointShader = myShader;
	gl.enable(gl.DEPTH_TEST);

  bg = createGraphics(800, 640, WEBGL);
  bgShader = bg.createShader(vsBG, fsBG);
  bg.shader(bgShader);
  bgShader.setUniform("uResolution", [width, height]);
  bg.quad(-1, -1, -1, 1, 1, 1, 1, -1);
}

function draw(){
  let start = millis();

	// 背景やってみる
	// おそらくモデルとかでも可能だと思うけど
	resetShader();
	gl.disable(gl.DEPTH_TEST);
	texture(bg);
	let w = width / 2;
	let h = height / 2;
	quad(-w, -h, -w, h, w, h, w, -h);
	gl.enable(gl.DEPTH_TEST);

  rotateY(TAU * count / 491);
  rotateZ(TAU * count / 753);
	rotateX(TAU * count / 666);
  myShader.setUniform("uCount", count);
  const DISTANCE_FACTOR = min(width, height) * 0.7;
  myShader.setUniform("uDistanceFactor", DISTANCE_FACTOR);
  myPoints(3000);
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
