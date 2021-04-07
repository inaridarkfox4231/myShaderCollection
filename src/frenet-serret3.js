// userStrokeShaderのテンプレート
// フレネ・セレ標構

// 何がしたいかというとキューブとか回転させる際の法線ベクトルの変換を自前で用意したい
// 赤がxで進行方向、青がzで上面、緑がyで側面って感じ

// こんな感じになるので
// これを個別に適用する感じですかね・・計算重そう

// 回転も伸縮も自由自在。スケール使ってるだけだし
// いい感じにできました。満足です。

// というわけで「アレ」をやります。（ガチで）
// わかんね
// 寝よう

// functionDef部分を分離
// 他にもいろいろ分離して個別に扱えるようにしたいわね

// 標構廃止して本数増やす処理をします

// わかったけど他のあれとの整合性取るのが難しくなりそうね
// 5のところの依存性を調べて他のプログラムでは1を指定できるようにしましょう

// 他にも直方体の所を別のオブジェクトで・・まあ今後の課題だわね。
// 今考えてるのは五角錐の後ろに三角形が5つくらいついてひらひらしてる感じのやつ
// ここまでくるともう直書きのシェーダーでないと遅すぎて話にならないわね

let count = 0;

let gl;

// ------------------------------------------------ //
// 関数定義
// 配列にぶち込んで外部変数で切り替えればいい
// ただ問題があって
// 今6000フレーム周期なんだけどこのプログラム
// 長さによって変えないといけないのよ（勘で）
// そこをユニフォして外部変数でコントロールできるようにする必要が
// あるんですよね
// あともうひとつ、indexのところで0.01ってやってるけどこれ1/100なんです
// つまり100のところもいじる必要があると・・
// 他にもxとyでも格子作れるから3つ用意しちゃった方がいいかもだけど
// xとyでパラメタ違いの別の曲線の上を動かしたりとか
// っていうのも考えたけどとりあえず100だけ動かせるようにしますか

// もういっそクラスにした方がいいのでは・・？
// らせん飛び出しちゃうのわかった
// ループさせてないんだよ、媒介変数を。0～1に落とさないと。
// fractすればおけ。

// これとは別に曲線描画専門のコード書きたい
// 2次元と3次元で個別に
// 気付いたけど2次元でもモデル使った方がいろいろ楽なんよね

// indexも引数にとってそれ使って分けた方がいいと思う

// x使った方がいいかも。曲線複数にするならxとyでやった方がいいよ！
// zは今まで通りでxを5種類にしよう。

// sizeFactorを導入
// 今0.1になってるとこ。min(w, h)の何倍の大きさにするか。オブジェクトを。
// これを自由にする感じ。

const FUNCTION_ID = 3;
const PERIOD = 6000;
const OBJ_NUM = 111;
const OBJ_NUM_X = 9;
const CURVE_DETAIL = 800;
const SCALE_FACTOR = 0.7; // min(width, height)に掛ける定数
const SIZE_FACTOR = 0.04; // よし。これで大きさを自由にいじれるね

let functionDef = [];
functionDef.push(`
vec3 getPos(float t, float index){
  float x = cos(t * TAU * 8.0);
  float y = sin(t * TAU * 8.0);
  float z = t * 4.0 - 2.0;
  return vec3(x, y, z);
}
`)
functionDef.push(`
vec3 getPos(float t, float index){
  float theta = t * TAU * 5.0;
  float phi = t * TAU * 7.0;
  float r = 1.0 + 0.2 * sin(t * TAU * 8.0);
  float x = r * sin(theta) * cos(phi);
  float y = r * sin(theta) * sin(phi);
  float z = r * cos(theta);
  return vec3(x, y, z);
}
`)
functionDef.push(`
vec3 getPos(float t, float index){
  float x = sin(t * TAU * 11.0);
  float y = sin(t * TAU * 14.0);
  float z = sin(t * TAU * 17.0);
  return vec3(x, y, z);
}
`)
functionDef.push(`
vec3 getPos(float t, float index){
  float diff = mod(index, uObjNumX) / uObjNumX;
  float theta = (t + diff) * TAU * 5.0;
  float phi = (t + diff) * TAU * 7.0;
  float r = t;
  float x = r * sin(theta) * cos(phi);
  float y = r * sin(theta) * sin(phi);
  float z = r * cos(theta);
  return vec3(x, y, z);
}
`)

// 定数定義
let constDef =
`
const float TAU = 6.28318;
const vec3 ex = vec3(1.0, 0.0, 0.0);
const vec3 ey = vec3(0.0, 1.0, 0.0);
const vec3 ez = vec3(0.0, 0.0, 1.0);
`
// ------------------------------------------------ //

let myStrokeShader;

let vsStroke =
`
precision mediump float;
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
uniform float uPeriod;
uniform float uDetail;
uniform float uObjNumX;
`+
constDef+
`
attribute vec4 aPosition;
attribute vec4 aDirection;

varying vec3 vPosition;
varying vec2 vIndices;
`+
functionDef[FUNCTION_ID]+
`
void main() {
  vPosition = aPosition.xyz;
  // using a scale <1 moves the lines towards the camera
  // in order to prevent popping effects due to half of
  // the line disappearing behind the geometry faces.
  vec3 scale = vec3(0.9995);

  // いつものモデルビューを頂点と、そこからdirectionで向かう先の点に対して適用してるみたい

  vec3 p1 = aPosition.xyz;
  float indX = aPosition.x;
  vIndices = vec2(indX, 0.0); // インデックス情報で色をいじりたいの
  vec3 p2 = getPos(p1.z, indX);
  vec3 dir = normalize(getPos(p1.z + 1.0 / uDetail, indX) - p2);

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
uniform float uObjNumX;

`+
constDef+
`
varying vec3 vPosition;
varying vec2 vIndices; // xとyについて

vec3 getRGB(float h, float s, float b){
    vec3 c = vec3(h, s, b);
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    rgb = rgb * rgb * (3.0 - 2.0 * rgb);
    return c.z * mix(vec3(1.0), rgb, c.y);
}

void main() {
  vec3 col = getRGB(fract(0.65 + vIndices.x / uObjNumX), 0.5 + 0.5 * sin(TAU * vPosition.z * 24.0), 1.0);
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
uniform float uPeriod;
uniform float uObjNum;
uniform float uObjNumX;
uniform float uDetail; // 400とか800とか
uniform float uSizeFactor;
`+
constDef+
`
uniform vec3 uLightingDirection[5];
uniform vec3 uDirectionalDiffuseColors[5];

varying vec4 vVertexColor;
varying vec3 vNormal;
varying vec3 vLightDirection;
varying vec3 vDirectionalDiffuseColor;
varying vec3 vPosition;
varying vec3 vIndices;

// vsStrokeから移植
`+
functionDef[FUNCTION_ID]+
`
void main(){
  float index = floor(aPosition.z + 0.5);
  vec3 pos = aPosition;
  pos.z -= index;
  float indX = floor(aPosition.x + 0.5);
  pos.x -= indX;

  vPosition = pos; // 補正を掛けた値をvPositionとする
  vIndices = vec3(indX, 0.0, index); // indexは個別にvaryingとする

  // 全体にfractをかける。これで解決。
  float phase = fract(mod(uCount, uPeriod) / uPeriod + (index + indX / uObjNumX) / uObjNum);

  phase = sqrt(phase); // これで中心付近に固まらなくて済む

  vec3 q1 = getPos(phase, indX);
  vec3 q2 = getPos(phase + 1.0 / uDetail, indX);
  vec3 q3 = getPos(phase - 1.0 / uDetail, indX);
  vec3 p = getPos(phase, indX);
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

  // pをuSizeFactorで割る。今まで10を掛けていたところ。
  vec4 viewModelPosition = uModelViewMatrix * vec4(m * scale * pos + p / uSizeFactor, 1.0);
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
varying vec3 vPosition;
varying vec3 vIndices; // インデックス情報。現在はxとzのところに整数。

uniform vec4 uTint;
uniform float uObjNumX;
`+
constDef+
`
vec3 getRGB(float h, float s, float b){
  vec3 c = vec3(h, s, b);
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  rgb = rgb * rgb * (3.0 - 2.0 * rgb);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

void main(){
  // vertexColorは別の使い道がありそう
  // 前の方を青くしておなかを黒くする感じ
  float hue = fract(0.65 + vIndices.x / uObjNumX);
  float sat = vPosition.x + 0.5;
  float blt= 5.0 * (vPosition.z + 0.1);
  vec4 col = vec4(getRGB(hue, sat, blt), 1.0);
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
  let start = millis();

  const _SCALE = floor(min(width, height) * SCALE_FACTOR);
  const OBJECT_SIZE = _SCALE * SIZE_FACTOR;

  shader(myStrokeShader);
  shader(myStrokeShader);
  noFill();
  stroke(255);
  background(0);
  myStrokeShader.setUniform("uCount", count);
  myStrokeShader.setUniform("uPeriod", PERIOD);
  myStrokeShader.setUniform("uDetail", CURVE_DETAIL);
	myStrokeShader.setUniform("uObjNumX", OBJ_NUM_X);
  rotateX(PI / 4 + (PI / 8) * sin(count * TAU / 600));
  rotateZ(count * TAU / 1200);
  myLine(CURVE_DETAIL, _SCALE, _SCALE, _SCALE, OBJ_NUM_X);

  resetShader();
  shader(myFillShader);
  myFillShader.setUniform("uCount", count);
  myFillShader.setUniform("uPeriod", PERIOD);
  myFillShader.setUniform("uObjNum", OBJ_NUM);
	myFillShader.setUniform("uObjNumX", OBJ_NUM_X);
  myFillShader.setUniform("uDetail", CURVE_DETAIL);
  myFillShader.setUniform("uSizeFactor", SIZE_FACTOR);
  noStroke();
  tint(1);
  directionalLight(255, 200, 255, 0, 0.5, 1);
  fill(255);
  myRect(OBJECT_SIZE, OBJ_NUM, OBJ_NUM_X);
  noFill();
  stroke(255);

  count++;
  let end = millis();
  //if(count % 60 == 0){ console.log((end - start) * 60 / 1000); }
}

function myLine(detail, sizeX, sizeY, sizeZ, numX = 1){
  // gIdを定義する
  const gId = `myLine|${detail}`;
  // geometryを構築する
  if(!this._renderer.geometryInHash(gId)){
    // ジオメトリーの準備
    const _geom = new p5.Geometry();
    // ベクトルを用意する
    let v = createVector();

    let index;
    for(let m = 0; m < numX; m++){
      for(let i = 0; i <= detail; i++){
        _geom.vertices.push(v.set(m, 0, i/detail).copy());
        if(i > 0){
          index = i + (detail + 1) * m;
          _geom.edges.push([index - 1, index]);
        }
      }
    }

    // フレネセレ標構用の3本のベクトルは廃止

    // 法線計算
    _geom._edgesToVertices();
    // バッファ作成
    this._renderer.createBuffers(gId, _geom);
  }
  this._renderer.drawBuffersScaled(gId, sizeX, sizeY, sizeZ);
}

function myRect(size, num, numX = 1){
  const gId = `myRect|${num}`;
  // z軸方向をつぶしてy軸方向ちょっと細くした
  // z軸方向が青でx軸方向が赤でとかそんなイメージ

  if(!this._renderer.geometryInHash(gId)){
    const myRectGeom = new p5.Geometry();

    // 位置ベクトル
    let v = new p5.Vector();
    for(let m = 0; m < numX; m++){
    for(let k = 0; k < num; k++){
      for(let z = 0.1; z > -0.3; z -= 0.2){
        for(let x = -0.49; x < 1; x += 0.98){
          for(let y = -0.49; y < 1; y += 0.98){
            myRectGeom.vertices.push(v.set(x + m, y, z + k).copy());
            // 別の使い道を考える
            myRectGeom.vertexColors.push(...[1.0, 1.0, 1.0, 1.0]);
          }
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
    for(let m = 0; m < numX; m++){
      for(let k = 0; k < num; k++){
        for(let f of indexArray){
          let diff = k * 8 + m * num * 8;
          let f2 = [f[0] + diff, f[1] + diff, f[2] + diff];
          myRectGeom.faces.push(f2);
        }
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
