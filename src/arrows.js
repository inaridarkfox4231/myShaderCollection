// 動的変更

let gl, _gl;
let arrow;
let _SIZE;

// このように長さ固定のFloat32Arrayを生成しておくこと
// 長さは固定する
const POINT_NUM = 1300;
let velocities = [];
let positions = new Float32Array(POINT_NUM * 3);

let myPointShader;
let pBuf; // pointSpriteのバッファにアクセスできないといけない
// じゃないと_drawPointsが使えないので
let count = 0;

// じゃあ最後にポイントシェーダいこうか
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
"varying float vArrowHue;" +
"uniform mat4 uModelViewMatrix;" +
"uniform mat4 uProjectionMatrix;" +
"void main() {" +
"  vec3 p = aPosition;" +

// 点の位置をいじるパート
"  vArrowHue = floor(p.z);" + // 色情報
"  p.z -= vArrowHue;" +
"  vDirection = p.z * TAU;" + // 方向情報
"  p.z = 0.0;" + // 方向情報取り出したら消す

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
"uniform sampler2D uArrow;" +
"const float TAU = 6.28318;" +
"varying float vStrokeWeight;" +
"varying vec3 vPosition;" +
"varying float vDirection;" +
"varying float vArrowHue;" +
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

// 色をいじるパート
"  vec2 p = gl_PointCoord.xy;" +
"  p -= 0.5;" +
"  float t = vDirection;" +
"  p *= mat2(cos(t), sin(t), -sin(t), cos(t));" +
"  p += 0.5;" +
"  vec4 tex = texture2D(uArrow, p);" +
"  if(tex.a < 0.01){ discard; }" +
"  vec3 col = getRGB(pow((80.0 - vArrowHue) / 100.0, 2.0), 1.0, 1.0);" +
"  gl_FragColor = vec4(tex.rgb * col, 1.0);" +
"}";

function setup(){
  _gl = createCanvas(windowWidth, windowHeight, WEBGL);
	_SIZE = min(windowWidth, windowHeight);
  pixelDensity(1);
  gl = _gl.GL;

  myPointShader = createShader(vsPoint, fsPoint);

  myPointShader.isPointShader = () => true; // これはpointShaderだよ！
  _gl.userPointShader = myPointShader; // userPointShaderを変更

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

	for(let i = 0; i < POINT_NUM; i++){ velocities.push(createVector(0, 0)); }
	arrow = createGraphics(40, 40);
	arrow.stroke(255);
	arrow.strokeWeight(4);
	arrow.line(0, 20, 40, 20);
  arrow.fill(255);
	arrow.noStroke();
	arrow.triangle(40, 20, 40 - 12, 20 - 6, 40 - 12, 20 + 6);
}

function draw(){
  let start = millis();

  background(0);

  //rotateX(frameCount * 0.01);
  //rotateZ(frameCount * 0.02);
  //rotateX(PI/2);

  resetShader();

  // 最後にポイント
  shader(myPointShader);
  stroke(0);
  strokeWeight(_SIZE * 0.05);
  myPointShader.setUniform("uCount", count);
	myPointShader.setUniform("uArrow", arrow);
  //const DISTANCE_FACTOR = _SIZE * 0.1;
  //myPointShader.setUniform("uDistanceFactor", DISTANCE_FACTOR);
  myPoints(POINT_NUM);

  count++;
  let end = millis();
  //if(count % 60 == 0){ console.log((end-start)*60/1000); }
}

function myPoints(num){
  const gId = `myPoints|${num}`;
  if(!_gl.geometryInHash(gId)){
    const myPointsGeom = new p5.Geometry();
    let v = createVector();
		let angle, radius, x, y, z;
    for(let i = 0; i < num; i++){
      // もはやただのノイズ
      // 1より大きい値にすればidにできるね・・0.01～0.99に落とすとかして。何でもできる。自由自在。
			angle = TAU * i / num;
			radius = _SIZE * (0.1 + Math.random() * 0.3);
			positions[i * 3] = (x = radius * cos(angle));
			positions[i * 3 + 1] = (y = radius * sin(angle));
			positions[i * 3 + 2] = (z = angle / TAU);
			velocities[i].set(cos(angle), sin(angle), 0);
      myPointsGeom.vertices.push(v.set(x, y, z).copy());
    }
    pBuf = _gl.createBuffers(gId, myPointsGeom);
  }
  // これでいいんだ
  myDrawPoints();
}

// _drawPointsを改造する
// とりあえずbindBufferとenableAttribが1回でいいのかどうか調べる
function myDrawPoints(){
  _gl._setPointUniforms(myPointShader);

  if(count == 0){
    _gl._bindBuffer(_gl.immediateMode.buffers.point, gl.ARRAY_BUFFER, _gl._vToNArray(pBuf.model.vertices), Float32Array, gl.DYNAMIC_DRAW);

    myPointShader.enableAttrib(myPointShader.attributes.aPosition, 3);
  }else{
		setPositions();
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
	}
  gl.drawArrays(gl.Points, 0, pBuf.model.vertices.length);
  myPointShader.unbindShader();
}

// アイデアとしては
// 速度の情報をz座標に入れる
// TAUで割って0～1とし整数部分で色を表現、speedが大きいほど赤くする(80～0）
function setPositions(){
	let x, y, mx, my, v, dir, f, hdg, magId;
	for(let i = 0; i < POINT_NUM; i++){
		x = positions[i * 3];
		y = positions[i * 3 + 1];
		mx = mouseX - width * 0.5;
		my = mouseY - height * 0.5;
		v = velocities[i];
		if(mouseIsPressed){
		  dir = atan2(my - y, mx - x);
		  f = min(_SIZE * 5.0 / (pow(mx - x, 2) + pow(my - y, 2)), _SIZE * 0.005);
		  v.x += f * cos(dir);
		  v.y += f * sin(dir);
		  if(v.mag() > _SIZE * 0.04){ v.limit(_SIZE * 0.04); }
		}
		v.x *= 0.994;
		v.y *= 0.994;
		if(x + v.x < -width * 0.5 || x + v.x > width * 0.5){ v.x *= -1; }
		if(y + v.y < -height * 0.5 || y + v.y > height * 0.5){ v.y *= -1; }
		x += v.x;
		y += v.y;
		if(x < -width * 0.5 || x > width * 0.5 || y < -height * 0.5 || y > height * 0.5){ x = 0; y = 0; }
		positions[i * 3] = x;
		positions[i * 3 + 1] = y;
		hdg = v.heading();
		if(hdg < 0){ hdg += TAU; }
		magId = floor(v.mag() * 80 / (_SIZE * 0.04));
		positions[i * 3 + 2] = magId + hdg / TAU; // 方向
	}
}

/*
else{
    positions[0] = 100;
    positions[1] = 100;
    positions[2] = 50;
    positions[3] = 200;
    positions[4] = 100;
    positions[5] = 50;
    positions[6] = 100;
    positions[7] = 200;
    positions[8] = 50;
    dummy[0] = -100;
    dummy[1] = -100;
    dummy[2] = -100;
    // ここのpositionsのところは単なる配列では駄目で
    // Float32Arrayという規格が定まっていないと
    // オーバーロードエラーになるわけ
    //gl.bufferSubData(gl.ARRAY_BUFFER, 24, dummy);
  }
*/
