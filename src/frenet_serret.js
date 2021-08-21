// フレネセレ

// userStrokeShaderのテンプレート
// フレネ・セレ標構

// 何がしたいかというとキューブとか回転させる際の法線ベクトルの変換を自前で用意したい
// 赤がxで進行方向、青がzで上面、緑がyで側面って感じ

// こんな感じになるので
// これを個別に適用する感じですかね・・計算重そう

// 回転も伸縮も自由自在。スケール使ってるだけだし
// いい感じにできました。満足です。

// というわけで「アレ」をやります。（ガチで）

let count = 0;

let gl;
let myStrokeShader;

let vsStroke =
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
Public License along with this library; if not, write to the
Free Software Foundation, Inc., 59 Temple Place, Suite 330,
Boston, MA  02111-1307  USA
*/


#define PROCESSING_LINE_SHADER

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uStrokeWeight;

uniform vec4 uViewport;
uniform int uPerspective;
uniform float uCount;

const float TAU = 6.28318;
const vec3 ex = vec3(1.0, 0.0, 0.0);
const vec3 ey = vec3(0.0, 1.0, 0.0);
const vec3 ez = vec3(0.0, 0.0, 1.0);

attribute vec4 aPosition;
attribute vec4 aDirection;

varying vec3 vPosition;

vec3 getPos0(float t){
  float x = cos(t * TAU * 8.0);
  float y = sin(t * TAU * 8.0);
  float z = t * 4.0;
  return vec3(x, y, z);
}

vec3 getPos1(float t){
  float theta = t * TAU * 5.0;
  float phi = t * TAU * 7.0;
  float r = 1.0 + 0.2 * sin(t * TAU * 8.0);
  float x = r * sin(theta) * cos(phi);
  float y = r * sin(theta) * sin(phi);
  float z = r * cos(theta);
  return vec3(x, y, z);
}

vec3 getPos2(float t){
  float x = sin(t * TAU * 11.0);
  float y = sin(t * TAU * 14.0);
  float z = sin(t * TAU * 17.0);
  return vec3(x, y, z);
}

void main() {
  vPosition = aPosition.xyz;
  // using a scale <1 moves the lines towards the camera
  // in order to prevent popping effects due to half of
  // the line disappearing behind the geometry faces.
  vec3 scale = vec3(0.9995);

  // いつものモデルビューを頂点と、そこからdirectionで向かう先の点に対して適用してるみたい

  vec3 p1 = aPosition.xyz;
  vec3 p2 = getPos1(p1.z);
  vec3 dir = normalize(getPos1(p1.z + 1.0 / 400.0) - p2);
  float phase = mod(uCount, 6000.0) / 6000.0;
  vec3 q1 = getPos1(phase);
  vec3 q2 = getPos1(phase + 1.0 / 400.0);
  vec3 q3 = getPos1(phase - 1.0 / 400.0);
  // tangent vector.
  // これは曲線のパラメータの進行方向
  vec3 e1 = normalize(q2 - q3);
  // normal vector.
  // これは曲線の曲がっていく方向
  vec3 e2 = normalize(normalize(q2 - q1) - normalize(q1 - q3));
  // binormal vector.
  // それらの外積。これで正規直交基底が完成。
  // 同時にcrossの挙動も分かる。
  // xとyに当てはめた時のzの方向ですね
  vec3 e3 = cross(e1, e2);
  float len = 0.3;
  if(p1.x == 1.0){
    dir = e1;
    p2 = q1 + e1 * p1.z * len;
  }
  if(p1.x == 2.0){
    dir = e2;
    p2 = q1 + e2 * p1.z * len;
  }
  if(p1.x == 3.0){
    dir = e3;
    p2 = q1 + e3 * p1.z * len;
  }

  vec4 posp = uModelViewMatrix * vec4(p2, 1.0);
  vec4 posq = uModelViewMatrix * (vec4(p2, 1.0) + vec4(dir, 0));

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

let fsStroke =
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
  vec3 col = getRGB(0.55, 0.5 + 0.5 * sin(TAU * vPosition.z * 24.0), 1.0);
  if(vPosition.x == 1.0){ col = vec3(1.0, 0.0, 0.0); }
  if(vPosition.x == 2.0){ col = vec3(0.0, 1.0, 0.0); }
  if(vPosition.x == 3.0){ col = vec3(0.0, 0.0, 1.0); }
  gl_FragColor = vec4(col, 1.0);
}
`;

let myFillShader;

let vsFill =
`
precision mediump float;
attribute vec3 aPosition;
attribute vec4 aMaterialColor;
attribute vec3 aNormal;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;
uniform float uCount;

const float TAU = 6.28318;
const vec3 ex = vec3(1.0, 0.0, 0.0);
const vec3 ey = vec3(0.0, 1.0, 0.0);
const vec3 ez = vec3(0.0, 0.0, 1.0);

uniform vec3 uLightingDirection[5];
uniform vec3 uDirectionalDiffuseColors[5];

varying vec4 vVertexColor;
varying vec3 vNormal;
varying vec3 vLightDirection;
varying vec3 vDirectionalDiffuseColor;

// vsStrokeから移植
vec3 getPos1(float t){
  float theta = t * TAU * 5.0;
  float phi = t * TAU * 7.0;
  float r = 1.0 + 0.2 * sin(t * TAU * 8.0);
  float x = r * sin(theta) * cos(phi);
  float y = r * sin(theta) * sin(phi);
  float z = r * cos(theta);
  return vec3(x, y, z);
}

vec3 getPos2(float t){
  float x = sin(t * TAU * 11.0);
  float y = sin(t * TAU * 14.0);
  float z = sin(t * TAU * 17.0);
  return vec3(x, y, z);
}

void main(){

  float index = floor(aPosition.z + 0.5);
  vec3 pos = aPosition;
  pos.z -= index;

  float phase = mod(uCount, 6000.0) / 6000.0 + index * 0.01;
  vec3 q1 = getPos1(phase);
  vec3 q2 = getPos1(phase + 1.0 / 400.0);
  vec3 q3 = getPos1(phase - 1.0 / 400.0);
  vec3 p = getPos1(phase);
  // tangent vector.
  // これは曲線のパラメータの進行方向
  vec3 e1 = normalize(q2 - q3);
  // normal vector.
  // これは曲線の曲がっていく方向
  vec3 e2 = normalize(normalize(q2 - q1) - normalize(q1 - q3));
  // binormal vector.
  // それらの外積。これで正規直交基底が完成。
  // 同時にcrossの挙動も分かる。
  // xとyに当てはめた時のzの方向ですね
  vec3 e3 = cross(e1, e2);
  float spin = uCount * TAU / 60.0; // 進行方向の周りに回転しないかなぁ
  mat3 m = mat3(e1, e2 * cos(spin) - e3 * sin(spin), e2 * sin(spin) + e3 * cos(spin));

  float scaleX = 1.25 * (1.0 + 0.5 * sin(uCount * TAU / 30.0));
  float scaleY = 0.75 * (1.0 - 0.5 * sin(uCount * TAU / 30.0));
  mat3 scale = mat3(scaleX * ex, scaleY * ey, ez);

  vec4 viewModelPosition = uModelViewMatrix * vec4(m * scale * pos + p * 10.0, 1.0);
  gl_Position = uProjectionMatrix * viewModelPosition;
  vNormal = normalize(uNormalMatrix * (m * aNormal));

  vVertexColor = aMaterialColor;
  vLightDirection = -uLightingDirection[0];
  vDirectionalDiffuseColor = uDirectionalDiffuseColors[0];
}
`;

let fsFill =
`
precision mediump float;

varying vec4 vVertexColor;
varying vec3 vNormal;
varying vec3 vLightDirection;
varying vec3 vDirectionalDiffuseColor;

uniform vec4 uTint;

vec3 getRGB(float h, float s, float b){
  vec3 c = vec3(h, s, b);
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  rgb = rgb * rgb * (3.0 - 2.0 * rgb);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

void main(){
  vec4 col = vVertexColor;
//  col = vec4(getRGB(0.55, 1.0, 1.0), 1.0);
  col *= uTint;
  col.rgb = mix(col.rgb, vDirectionalDiffuseColor, 0.25);
  col *= max(0.5, dot(vNormal, vLightDirection)) * 1.5;
  gl_FragColor = col;
}
`;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  gl = this._renderer.GL;
  myStrokeShader = createShader(vsStroke, fsStroke);
  myFillShader = createShader(vsFill, fsFill);
  //shader(myStrokeShader);
  //shader(myStrokeShader);
  strokeWeight(2);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
}

function draw() {
  const _SIZE = floor(min(width, height) * 0.33);
  shader(myStrokeShader);
  shader(myStrokeShader);
  noFill();
  stroke(255);
  background(0);
  myStrokeShader.setUniform("uCount", count);
  rotateX(PI / 4 + (PI / 8) * sin(count * TAU / 600));
  rotateZ(count * TAU / 1200);
  myLine(800, _SIZE, _SIZE, _SIZE);

  resetShader();
  shader(myFillShader);
  myFillShader.setUniform("uCount", count);
  noStroke();
  tint(1);
  directionalLight(255, 200, 255, 0, 0.5, 1);
  fill(255);
  myRect(_SIZE * 0.1, 100);
  noFill();
  stroke(255);

  count++;
}

function myLine(detail, sizeX, sizeY, sizeZ){
  // gIdを定義する
  const gId = `myLine|${detail}`;
  // geometryを構築する
  if(!this._renderer.geometryInHash(gId)){
    // ジオメトリーの準備
    const _geom = new p5.Geometry();
    // ベクトルを用意する
    let v = createVector();

    for(let i = 0; i <= detail; i++){
      _geom.vertices.push(v.set(0, 0, i/detail).copy());
      if(i > 0){
        _geom.edges.push([i - 1, i]);
      }
    }

    // フレネセレ標構用の3本のベクトル
    // この技術を応用すればグラフの座標軸とか描画できるよ
    let n = _geom.vertices.length;
    _geom.vertices.push(v.set(1, 0, 0).copy());
    _geom.vertices.push(v.set(1, 0, 0.5).copy());
    _geom.vertices.push(v.set(1, 0, 1).copy());
    _geom.vertices.push(v.set(2, 0, 0).copy());
    _geom.vertices.push(v.set(2, 0, 0.5).copy());
    _geom.vertices.push(v.set(2, 0, 1).copy());
    _geom.vertices.push(v.set(3, 0, 0).copy());
    _geom.vertices.push(v.set(3, 0, 0.5).copy());
    _geom.vertices.push(v.set(3, 0, 1).copy());
    _geom.edges.push(...[[n, n + 1], [n + 1, n + 2], [n + 3, n + 4], [n + 4, n + 5], [n + 6, n + 7], [n + 7, n + 8]]);
    // 法線計算
    _geom._edgesToVertices();
    // バッファ作成
    this._renderer.createBuffers(gId, _geom);
  }
  this._renderer.drawBuffersScaled(gId, sizeX, sizeY, sizeZ);
}

function myRect(size, num){
  const gId = `myRect|${num}`;
  // z軸方向をつぶしてy軸方向ちょっと細くした
  // z軸方向が青でx軸方向が赤でとかそんなイメージ

  if(!this._renderer.geometryInHash(gId)){
    const myRectGeom = new p5.Geometry();

    // 位置ベクトル
    let v = new p5.Vector();
    for(let k = 0; k < num; k++){
      for(let z = 0.1; z > -0.3; z -= 0.2){
        for(let x = -0.5; x < 1; x += 1){
          for(let y = -0.5; y < 1; y += 1){
            myRectGeom.vertices.push(v.set(x, y, z + k).copy());
            // 背中を黒く、前の方を青く
            myRectGeom.vertexColors.push(...getRGB(65, 100 * (x + 0.5), 500 * (z + 0.1)));
          }
        }
      }
    }
    /*
    // こっちだと逆方向なので裏面が描画されてしまいます！！
    myCubeGeom.faces.push(...[[0,2,1], [2,3,1], [1,3,5], [3,7,5], [3,2,7], [2,6,7],
                              [0,1,4], [1,5,4], [5,7,4], [7,6,4], [4,6,0], [6,2,0]]);*/

    // こっちが正方向です。そうなんだ・・・z軸を上から見た時y軸がx軸に最短で重なるような向きの回転みたいですね（時計回り）
    // カリングは難しいので冷静に対処しましょう！
    let indexArray = [[0,1,2], [2,1,3], [1,5,3], [3,5,7], [3,7,2], [2,7,6], [0,4,1], [1,4,5], [5,4,7], [7,4,6], [4,0,6], [6,0,2]];
    for(let k = 0; k < num; k++){
      for(let f of indexArray){
        let f2 = [f[0] + k * 8, f[1] + k * 8, f[2] + k * 8];
        myRectGeom.faces.push(f2);
      }
    }

    // 法線・辺計算
    myRectGeom._makeTriangleEdges()._edgesToVertices();
    myRectGeom.computeNormals();

    // バッファ作成
    this._renderer.createBuffers(gId, myRectGeom);
  }
  // 描画
  this._renderer.drawBuffersScaled(gId, size, size, size);
}

// たとえば水色欲しいならgetRGB(55, 100, 100)でおけ
function getRGB(h,s,b,a = 1, max_h = 100, max_s = 100, max_b = 100){
  let hue = h * 6 / max_h; // We will split hue into 6 sectors.
  let sat = s / max_s;
  let val = b / max_b;

  let RGB = [];

  if(sat === 0) {
    RGB = [val, val, val]; // Return early if grayscale.
  }else{
    let sector = Math.floor(hue);
    let tint1 = val * (1 - sat);
    let tint2 = val * (1 - sat * (hue - sector));
    let tint3 = val * (1 - sat * (1 + sector - hue));
    switch(sector){
      case 1:
        RGB = [tint2, val, tint1]; break;
      case 2:
        RGB = [tint1, val, tint3]; break;
      case 3:
        RGB = [tint1, tint2, val]; break;
      case 4:
        RGB = [tint3, tint1, val]; break;
      case 5:
        RGB = [val, tint1, tint2]; break;
      default:
        RGB = [val, tint3, tint1]; break;
    }
   }
   return [...RGB, a];
}
