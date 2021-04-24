// 16384という作品
// まあ8192にしとこう（CPUの限界）
// 動的更新でブレットを分裂させていく
// 大きさは縦横minの1/100とその2/3倍でおねがい
// 黒からはじめて最後は綺麗な青まで
// 1,2,4,8,16,...

// bulletが増えていく感じ
// 縦の長さがmin(width,height)*0.01で横はその2/3
// これを中央からスピード1で動かす
// 60フレームごとに分裂
// 方向は速度に対して90±30と-90±30くらいでランダム
// これを延々と
// 2次元で速度はx,yでzのところで-1なら描画しない、0より大きい時はfractで角度成分を取り出し、描画はテクスチャで行ない、
// 円の半径は長方形の縦横の半分の2乗の和の平方根で算出する感じ
// あ、整数部分で色ね。色はね・・まあいいや。テクスチャ真っ白にして掛け算で出せばいいよ。
// それかgl_PointCoord使って板ポリ芸でやってもいい。

// 色は60から±で増減させる

let _gl, gl;
let myPointShader;
let pBuf;

let count = 0;
let _SIZE;
const BULLET_SPEED = 1.5;
const BULLET_CAPACITY = 8192;
const SPLIT_COUNT = 60;
const SIZE_FACTOR = 0.01;

let positions = new Float32Array(BULLET_CAPACITY * 3);
let velocities = []; // 2次元のベクトルで。
let hueValues = [];

let vsPoint =
"precision mediump float;" +
// ↑これがないと両方でuCount使えなくてエラーになる
"attribute vec3 aPosition;" +
"uniform float uPointSize;" +
"uniform float uCount;" +
"const float TAU = 6.28318;" +
"const float PI = 3.14159;"+
"varying float vStrokeWeight;" +
"varying vec3 vPosition;" +
"varying vec4 vMaterialColor;" +
"varying float vDirection;" +
"varying float vUnitHue;" + // 0～1の100段階
"uniform mat4 uModelViewMatrix;" +
"uniform mat4 uProjectionMatrix;" +
"void main() {" +
"  vec3 p = aPosition;" +
"  vPosition = p;" + // z情報込みで
"  vDirection = fract(p.z) * TAU;" + // 角度情報
"  vUnitHue = floor(p.z) / 100.0;" + // 0～1.
"  p.z = 0.0;" + // z情報は使わない

// 点の位置をいじるパート

// 設定
"  vec4 positionVec4 =  vec4(p, 1.0);" +

"  gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;" +

// サイズをいじる
"  gl_PointSize = uPointSize;" +
"  vStrokeWeight = uPointSize;" +
"}";

let fsPoint =
"precision mediump float;" +
"precision mediump int;" +
"uniform vec4 uMaterialColor;" +
"uniform float uCount;" +
"const float TAU = 6.28318;" +
"const float oneBarRoot13 = 0.27735;" +
"varying float vStrokeWeight;" +
"varying vec3 vPosition;" +
"varying float vDirection;" +
"varying float vUnitHue;" + // 0～1の100段階
// getRGB,参上！
"vec3 getRGB(float h, float s, float b){" +
"    vec3 c = vec3(h, s, b);" +
"    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);" +
"    rgb = rgb * rgb * (3.0 - 2.0 * rgb);" +
"    return c.z * mix(vec3(1.0), rgb, c.y);" +
"}" +

"void main(){" +
"  float mask = 0.0;" +

// make a circular mask using the gl_PointCoord (goes from 0 - 1 on a point)
// might be able to get a nicer edge on big strokeweights with smoothstep but slightly less performant

"  mask = step(0.98, length(gl_PointCoord * 2.0 - 1.0));" +

// if strokeWeight is 1 or less lets just draw a square
// this prevents weird artifacting from carving circles when our points are really small
// if strokeWeight is larger than 1, we just use it as is

"  mask = mix(0.0, mask, clamp(floor(vStrokeWeight - 0.5),0.0,1.0));" +

// throw away the borders of the mask
// otherwise we get weird alpha blending issues

"  if(mask > 0.98){" +
"    discard;" +
"  }" +
"  if(vPosition.z < -0.5){ discard; }" +
// 形を決めるパート
// そのうち方向指定して進行方向がdirと一致するようにする
"  vec2 p = (gl_PointCoord.xy - 0.5) * 2.0;" +
"  float t = vDirection;" +
"  p *= mat2(cos(t), sin(t), -sin(t), cos(t));" +
"  if(abs(p.y) > 2.0 * oneBarRoot13){ discard; }" +
"  if(abs(p.x) > 3.0 * oneBarRoot13){ discard; }" +
// 色をいじるパート
"  vec3 col = vec3(1.0);" +
"  col = getRGB(vUnitHue, 0.5 * (p.x + 1.0), 1.0);" +
"  gl_FragColor = vec4(col, 1.0);" +
"}";

function setup(){
  _gl = createCanvas(windowWidth, windowHeight, WEBGL);
  _SIZE = min(width, height);
  gl = _gl.GL;
  myPointShader = createShader(vsPoint, fsPoint);
  myPointShader.isPointShader = () => true;
  _gl.pointShader = myPointShader;

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  stroke(255);
  strokeWeight(_SIZE * SIZE_FACTOR);
  for(let i = 0; i < BULLET_CAPACITY; i++){
		velocities.push(createVector(0, 0));
		hueValues.push(55);
	}
}

function draw(){
  let start = millis();
  background(0);

  resetShader();
  shader(myPointShader);
  myPointShader.setUniform("uCount", count);
  myPoints(64);

  count++;
  //if(count % 60 == 0){ console.log((millis() - start)*60/1000); }
}

function myPoints(num){
  const gId = `points|${num}`;
  if(!_gl.geometryInHash(gId)){
    const _geom = new p5.Geometry();
    let v = new p5.Vector();
    v.set(1,1,1);
    let x, y, z;
    let initialDirection = atan2(0.5, 1);
    if(initialDirection < 0){ initialDirection += TAU; }
    // TAUで割って0～1にする感じね
    // ほんとは整数加えて色付けたいけど。
    for(let i = 0; i < BULLET_CAPACITY; i++){
      positions[i * 3] = (x = 0);
      positions[i * 3 + 1] = (y = 0);
      positions[i * 3 + 2] = (z = (i > 0 ? -1 : 60 + initialDirection / TAU));
      _geom.vertices.push(v.set(x, y, z).copy());
    }
    velocities[0].set(BULLET_SPEED * cos(initialDirection), BULLET_SPEED * sin(initialDirection));
    pBuf = _gl.createBuffers(gId, _geom);
  }
  myDrawPoints();
}

// 逐次更新
function myDrawPoints(){
  _gl._setPointUniforms(myPointShader);

  _gl._bindBuffer(_gl.immediateMode.buffers.point, gl.ARRAY_BUFFER, _gl._vToNArray(pBuf.model.vertices), Float32Array, gl.DYNAMIC_DRAW);
  myPointShader.enableAttrib(myPointShader.attributes.aPosition, 3);
  setPosition();
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);

  gl.drawArrays(gl.Points, 0, pBuf.model.vertices.length);
  myPointShader.unbindShader();
}

function setPosition(){
  let x, y, v, hdg;
  for(let i = 0; i < BULLET_CAPACITY; i++){
    if(positions[(i * 3) + 2] < -0.5){ break; }
    v = velocities[i];
    x = positions[i * 3];
    y = positions[i * 3 + 1];
    if(x + v.x < -width * 0.5 || x + v.x > width * 0.5){ v.x *= -1; }
    if(y + v.y < -height * 0.5 || y + v.y > height * 0.5){ v.y *= -1; }
    x += v.x;
    y += v.y;
    // 画面外に出ちゃった場合の対策
    if(x < -width * 0.5 || x > width * 0.5 || y < -height * 0.5 || y > height * 0.5){ x = 0; y = 0; }
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    hdg = v.heading();
    if(hdg < 0){ hdg += TAU; }
    positions[i * 3 + 2] = hueValues[i] + hdg / TAU;
  }
  if(count % SPLIT_COUNT === SPLIT_COUNT - 1 && positions[BULLET_CAPACITY * 3 - 1] < -0.5){ splitting(); }
}

function splitting(){
  // カウントが59+(60の倍数)でpositionsの末尾が-1のときに分裂させる
  // たとえば0,1,2,3まで埋まってる場合、
  // 0を元に0と4, 1を元に1と5みたいな感じで増やしていく。そうして7まで埋める。
  // これを0～63が埋まるまでやる。
  // 0から見ていってまず初めに<0になるところをみつける
  // みつかったら次にその位置kを記録しておいて0を元に0とkを編集する
  // 次は1とk+1,2とk+2,...と増やしていく
  // これをk-1と2k-1までやったら終了。
  let k = 0;
  let x, y, z, _hue, dir, dir1, dir2;
  while(k < BULLET_CAPACITY){ if(positions[k * 3 + 2] < -0.5){ break; } k++; }
  for(let i = 0; i < k; i++){
    x = positions[i * 3];
    y = positions[i * 3 + 1];
    //z = positions[i * 3 + 2];
		_hue = hueValues[i];
    // x,y,zは取り出す必要ないかな・・zを元に色を変えるくらいかなぁ。
    dir = velocities[i].heading();
    dir1 = dir + random(PI/2 - PI/8, PI/2 + PI/8);
    if(dir1 < 0){ dir1 += TAU; }
    if(dir1 > TAU){ dir1 -= TAU; }
    dir2 = dir - random(PI/2 - PI/8, PI/2 + PI/8);
    if(dir2 < 0){ dir2 += TAU; }
    if(dir2 > TAU){ dir2 -= TAU; }
		hueValues[i] = _hue - 2;
		hueValues[i + k] = _hue + 2;
    positions[i * 3 + 2] = hueValues[i] + dir1 / TAU;
    positions[(i + k) * 3 + 2] = hueValues[i + k] + dir2 / TAU;
    velocities[i].set(BULLET_SPEED * cos(dir1), BULLET_SPEED * sin(dir1));
    velocities[i + k].set(BULLET_SPEED * cos(dir2), BULLET_SPEED * sin(dir2));
    positions[(i + k) * 3] = x;
    positions[(i + k) * 3 + 1] = y;
    // velocities[i]の方向を取り出してそれをもとにvelocities[i],[i+k]を更新
    // positions[(i+k)*3],[(i+k)*3+1]はx,yをコピーするだけでいい
    // [(i+k)*3+2]については方向を・・です。
  }
}
