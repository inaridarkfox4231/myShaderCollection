// strokeで螺旋作ります。
// ピッチは縦横minの20分の1で半径は縦横minの1/10で太さは1/300にする感じ。
// んで中心に1つ用意してその他は両側に縦横minの1/5をひとつのサイズとして1/4
// が単位であとは1/4の(2k+1)倍が横を超える最小のkに対して2k+1個配置する感じ
// ですかね
// グラデーションは縦方向に正弦関数でマスクしてsatの値を0～100まで変化、
// 2k+1で100を分割してぐるぐるhueをいじる感じで。時間経過で変化
// 螺旋の内部にくるくる回る正八面体とか配置したいかも
// サイズは中央横線で縦横minの1/6くらいで

// 螺旋と正八面体

let properFrameCount = 0;
let SIZE;
let _NUM;

let gl;
let myStrokeShader;

let vs =
`
/*
Part of the Processing project - http://processing.org
Copyright (c) 2012-15 The Processing Foundation
Copyright (c) 2004-12 Ben Fry and Casey Reas
Copyright (c) 2001-04 Massachusetts Institute of Technology
This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation, version 2.1.
This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.
You should have received a copy of the GNU Lesser General
Public License along with this library; if not, write to the\n  Free Software Foundation, Inc., 59 Temple Place, Suite 330,
Boston, MA  02111-1307  USA
*/


#define PROCESSING_LINE_SHADER

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uStrokeWeight;

uniform vec4 uViewport;
uniform int uPerspective;

const float TAU = 6.28318;

attribute vec4 aPosition;
attribute vec4 aDirection;

varying vec3 vPosition;

void main() {
  vPosition = aPosition.xyz;
  // using a scale <1 moves the lines towards the camera
  // in order to prevent popping effects due to half of
  // the line disappearing behind the geometry faces.
  vec3 scale = vec3(0.9995);

  // いつものモデルビューを頂点と、そこからdirectionで向かう先の点に対して適用してるみたい
  vec4 posp = uModelViewMatrix * aPosition;
  vec4 posq = uModelViewMatrix * (aPosition + vec4(aDirection.xyz, 0));

  // Moving vertices slightly toward the camera
  // to avoid depth-fighting with the fill triangles.
  // Discussed here:
  // http://www.opengl.org/discussion_boards/ubbthreads.php?ubb=showflat&Number=252848
  posp.xyz = posp.xyz * scale;
  posq.xyz = posq.xyz * scale;

  // これもあれだよね。だからここまではなんとなくわかる・・ような・・
  vec4 p = uProjectionMatrix * posp;
  vec4 q = uProjectionMatrix * posq;

  // formula to convert from clip space (range -1..1) to screen space (range 0..[width or height])
  // screen_p = (p.xy/p.w + <1,1>) * 0.5 * uViewport.zw

  // prevent division by W by transforming the tangent formula (div by 0 causes
  // the line to disappear, see https://github.com/processing/processing/issues/5183)
  // t = screen_q - screen_p
  // formula to convert from clip space (range -1..1) to screen space (range 0..[width or height])
  // screen_p = (p.xy/p.w + <1,1>) * 0.5 * uViewport.zw

  // prevent division by W by transforming the tangent formula (div by 0 causes
  // the line to disappear, see https://github.com/processing/processing/issues/5183)
  // t = screen_q - screen_p
  //
  // tangent is normalized and we don't care which aDirection it points to (+-)
  // t = +- normalize( screen_q - screen_p )
  // t = +- normalize( (q.xy/q.w+<1,1>)*0.5*uViewport.zw - (p.xy/p.w+<1,1>)*0.5*uViewport.zw )
  //
  // extract common factor, <1,1> - <1,1> cancels out
  // t = +- normalize( (q.xy/q.w - p.xy/p.w) * 0.5 * uViewport.zw )
  //
  // convert to common divisor
  // t = +- normalize( ((q.xy*p.w - p.xy*q.w) / (p.w*q.w)) * 0.5 * uViewport.zw )
  //
  // remove the common scalar divisor/factor, not needed due to normalize and +-
  // (keep uViewport - can't remove because it has different components for x and y
  //  and corrects for aspect ratio, see https://github.com/processing/processing/issues/5181)
  // t = +- normalize( (q.xy*p.w - p.xy*q.w) * uViewport.zw )

  vec2 tangent = normalize((q.xy*p.w - p.xy*q.w) * uViewport.zw);

  // flip tangent to normal (it's already normalized)
  vec2 normal = vec2(-tangent.y, tangent.x);

  float thickness = aDirection.w * uStrokeWeight;
  vec2 offset = normal * thickness / 2.0;

  vec2 curPerspScale;

  if(uPerspective == 1) {
    // Perspective ---
    // convert from world to clip by multiplying with projection scaling factor
    // to get the right thickness (see https://github.com/processing/processing/issues/5182)
    // invert Y, projections in Processing invert Y
    curPerspScale = (uProjectionMatrix * vec4(1, -1, 0, 0)).xy;
  }else{
    // No Perspective ---
    // multiply by W (to cancel out division by W later in the pipeline) and
    // convert from screen to clip (derived from clip to screen above)
    curPerspScale = p.w / (0.5 * uViewport.zw);
  }

  gl_Position.xy = p.xy + offset.xy * curPerspScale;
  gl_Position.zw = p.zw;
}

`;

let fs =
`
precision mediump float;
precision mediump int;

uniform vec4 uMaterialColor;
uniform float uCount;

const float TAU = 6.28318;

varying vec3 vPosition;

vec3 getRGB(float h, float s, float b){
    vec3 c = vec3(h, s, b);
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    rgb = rgb * rgb * (3.0 - 2.0 * rgb);
    return c.z * mix(vec3(1.0), rgb, c.y);
}

void main() {
  vec3 col = getRGB(fract(uCount / 600.0), 0.5 + 0.5 * sin(vPosition.z * TAU * 2.0), 1.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

let myFillShader;

let vsFill =
"precision mediump float;" +
"attribute vec3 aPosition;" +
"attribute vec3 aNormal;" +

"uniform mat4 uModelViewMatrix;" +
"uniform mat4 uProjectionMatrix;" +
"uniform mat3 uNormalMatrix;" +

"uniform vec3 uLightingDirection[5];" +
"uniform vec3 uDirectionalDiffuseColors[5];" +

"varying vec3 vNormal;" +
"varying vec3 vLightDirection;" +
"varying vec3 vDirectionalDiffuseColor;" +
"varying vec3 vPosition;" +

"void main(){" +
"  vPosition = aPosition;" +

"  vec4 viewModelPosition = uModelViewMatrix * vec4(aPosition, 1.0);" +
"  gl_Position = uProjectionMatrix * viewModelPosition;" +
"  vNormal = normalize(uNormalMatrix * aNormal);" +

"  vLightDirection = -uLightingDirection[0];" +
"  vDirectionalDiffuseColor = uDirectionalDiffuseColors[0];" +
"}";

let fsFill =
"precision mediump float;" +

"varying vec3 vNormal;" +
"varying vec3 vLightDirection;" +
"varying vec3 vDirectionalDiffuseColor;" +
"varying vec3 vPosition;" +

"uniform float uCount;" +

"vec3 getRGB(float h, float s, float b){" +
"   vec3 c = vec3(h, s, b);" +
"   vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);" +
"   rgb = rgb * rgb * (3.0 - 2.0 * rgb);" +
"   return c.z * mix(vec3(1.0), rgb, c.y);" +
"}" +

"void main(){" +
"  vec4 col = vec4(getRGB(fract(uCount / 600.0), abs(vPosition.z), 1.0), 1.0);" +
"  col *= max(0.5, dot(vNormal, vLightDirection)) * 1.5;" +
"  gl_FragColor = col;" +
"}";


function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  SIZE = min(windowWidth, windowHeight);
  _NUM = floor((3 * width - SIZE) / (2 * SIZE)) + 1;
  // -NUM～NUMで配置する。ひとつひとつのスペースが1/4くらいで。
  myStrokeShader = createShader(vs, fs);
	myFillShader = createShader(vsFill, fsFill);
  shader(myStrokeShader);
}

function draw() {
  background(0);
  rotateX(PI/2);
	shader(myStrokeShader);
	stroke(255); // これを実行しないとisStrokeとかがonにならないんだと思う
	strokeWeight(SIZE/300);
	noFill();

  for(let k = -_NUM; k <= _NUM; k++){
    let c = k * SIZE * 0.3;
    let rt = (properFrameCount * TAU / 60) * pow(-1, k);
    translate(c, 0, 0);
    rotateZ(rt);
    myStrokeShader.setUniform("uCount", properFrameCount + floor(k * 600 / (2 * _NUM + 1)));
    mySpiral(SIZE * 0.5);
    rotateZ(-rt);
    translate(-c, 0, 0);
  }

	shader(myFillShader);
	fill(255); // これを実行しないとisFillがonにならない感じね
	directionalLight(255, 128, 0, 0, 0, 1);
	noStroke();

  for(let k = -_NUM; k <= _NUM; k++){
    let c = k * SIZE * 0.3;
		let h = SIZE * 0.3 * sin(properFrameCount * TAU / 180);
    let rtZ = properFrameCount * TAU / 240;
		let rtX = properFrameCount * TAU / 180;
    translate(c, 0, h * pow(-1, k));
    rotateZ(rtZ);
		rotateX(rtX);
    myFillShader.setUniform("uCount", properFrameCount + floor(k * 600 / (2 * _NUM + 1)));
    myOctagon(SIZE * 0.1);
		rotateX(-rtX);
    rotateZ(-rtZ);
    translate(-c, 0, -h * pow(-1, k));
  }
  properFrameCount++;
}

function mySpiral(size){
  // gIdを定義する
  const gId = `mySpiral`;
  // geometryを構築する
  if(!this._renderer.geometryInHash(gId)){
    // ジオメトリーの準備
    const _geom = new p5.Geometry();
    // ベクトルを用意する
    let v = createVector();
    let index = 0;
    const r = 0.2;
    const pitch = 0.1;
    let z;
    for(let i = -400; i <= 400; i++){
      z = i / 300;
      _geom.vertices.push(v.set(r * cos(z * TAU / pitch), r * sin(z * TAU / pitch), i/300).copy());
      if(i < 400){
        _geom.edges.push([index, index + 1]);
        index++;
      }
    }
    // 法線計算
    _geom._edgesToVertices();
    // バッファ作成
    this._renderer.createBuffers(gId, _geom);
  }
  this._renderer.drawBuffersScaled(gId, size, size, size);
}

// ごく普通の正八面体
function myOctagon(size){
	const gId = `octagon`;
	if(!this._renderer.geometryInHash(gId)){
		const _geom = new p5.Geometry();
		let v = createVector();
		const a = sqrt(0.5);
		_geom.vertices.push(v.set(0, 0, 1).copy());
		_geom.vertices.push(v.set(a, a, 0).copy());
		_geom.vertices.push(v.set(a, -a, 0).copy());
		_geom.vertices.push(v.set(-a, -a, 0).copy());
		_geom.vertices.push(v.set(-a, a, 0).copy());
		_geom.vertices.push(v.set(0, 0, -1).copy());
		_geom.faces.push(...[[0, 1 ,2], [0, 2, 3], [0, 3, 4], [0, 4, 1], [1, 5, 2], [2, 5, 3], [3, 5, 4], [4, 5, 1]]);

    // 法線・辺計算
    _geom._makeTriangleEdges()._edgesToVertices();
    _geom.computeNormals();

    // バッファ作成
    this._renderer.createBuffers(gId, _geom);
	}
  // 描画
  this._renderer.drawBuffersScaled(gId, size, size, size);
}
