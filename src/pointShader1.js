// 自作pointShaderのポイント
// ひとつめ
// まず自作シェーダを落とす場合、シェーダーに実装された関数であるところの
// isPointShaderがtrueを返さないといけないんだけど、
// isPointShaderが「存在しない」ので、それはできないことになってる。
// だから勝手にisPointShaderに()=>trueとか1とかまあつまりtrueを返す関数を
// 適当に当てはめる必要があるわけ。
// もうひとつ、レンダリングコンテキスト（createCanvasで返される値）の
// userPointShaderにこのシェーダをセットする必要がある。そうすると、
// これが呼ばれて・・まあいろいろ起こる。
// ふたつめ
// 他のモデルのようにdrawBuffersを使えばいいと思うじゃん？
// 実はあれ、lineが存在しない場合はスルーされる仕様になってるの。
// 点だけ描画する方法が存在しない。
// drawBuffersでは点を描画できない！！
// ところでpoint関数の中では普通に複数の点描画の関数を使ってるのね。
// _drawPointsってやつ。
// ちなみに_から始まる関数はすべてp5謹製の関数です。
// それをさぁ、一つの点からなる配列をその場で生成して
// それに対して使ってるわけ！信じられる？あほみたい。
// だからこれを使うにはあらかじめベクトルの集合を作っておいて
// それを用意してアクセスできるようにしてやればいい
// ただし単なるベクトルの集合では駄目で
// いつものようにcreateBufferをかませないと
// んでその返り値としてbufferを取得したうえで
// その中のmodelに設定されているverticesから配列を取り出し
// bufferの方はそのままimmediateMode.buffers.pointを使えばよくって
// これでいいんです。できました。
// やってみたら、あらかじめ点の座標の配列を作っておいて
// pointを800回呼び出すのに比べて10倍以上速かったです・・すげぇ・・

// 関係ないけどrotateXやらrotateYやらに頼らずに
// 特定の軸をzに置く方法とかそういうのないんかな
// って考えた。今。

let gl;
let _gl;
let buf;

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
	float sizeFactor = 0.5 + abs(sin(p.y * 3371.412));
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
  gl_FragColor = vec4(getRGB(fract(uCount / 600.0), 0.5 + 0.5 * sin(TAU * properCount / 360.0), 1.0) * (1.0 - mask), 1.0);
}
`

function setup(){
  _gl=createCanvas(windowWidth, windowHeight, WEBGL);
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
  rotateX(TAU * count / 241);
  rotateZ(TAU * count / 353);
  myShader.setUniform("uCount", count);
	const DISTANCE_FACTOR = min(width, height) * 0.5;
	myShader.setUniform("uDistanceFactor", DISTANCE_FACTOR);
  myPoints(1000);
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
