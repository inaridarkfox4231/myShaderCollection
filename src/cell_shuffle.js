// サイズを800x600に
// CELL_NUMBERを10に
// セルの左上座標を別にして描画しやすく
// 画像は中央の正方形だけマグマシェーダでかぶせて
// 背景は青→黒のグラデーションでいいです
// それもシェーダで描いて
// 以上

// ちょっと改良
// まず20x20でフルサイズでやろう
// 縦横minが40より小さい場合はそれを2で割って2xnにする感じで
// つまりグリッドサイズを可変にするってこと
// グローバルなので_を付けてね
// たとえば1536x661らしいんだけどこのエリア
// そうなると76x33になるんだよね
// これでパフォーマンスがおおよそ0.46～0.49くらい
// ここをあれで高速化したいわけです
// サイズが一般なのでフレームを用意してその外側に出ないようにするなどいろいろ必要（オフセットを用意する）
// WEBGLは中心原点なのでオフセットに注意するなど（3Dでやったやつね）

// 変更点としては
// 1.さっき言ったようなGRID,SIZE_X,SIZE_Yの可変化とかバリデーションとかその辺（スマホで見た時正方形であってほしい）
// 2.動かすにはポイントスプライトの正方形を使う
// 3.背景は個別に用意してPlaneに貼り付ける
// 4.MOVESPANを40にして初めの20で方向転換して次の20で移動する感じにする
// 5.オブジェクトはすべて移動方向が分かりやすいように矢印にする、正方形の中の三角形と長方形を組み合わせる感じ。前から後ろへ白くなるイメージ、
// 白いテクスチャを用意しておいて前から後ろへ白くなっていく色を重ねる感じでおねがい（単純に掛け算）
// ロジックは機能してるので一切いじらない。おねがい。

// マグマとかは、要らないので、なくす。

// 最初のステップとして
// まず最初は全部右向きで
// 0,1,2,3は普通にPI/2を掛けると進行方向の角度になるので
// 直前の方向を保持しておいて
// 最初の20フレームは直前の方向と新しい方向（同じかもしれない）のlerpで
// 次の20フレームは普通にその向きで。
// 位置はそのまま位置で・・これ難しいな
// 矢印は全部白とあれのあれであれする(setUniform...)
// 位置情報はxとyはそのまま使う、中心座標に移すのを忘れずに、で、zに方向情報0～1と色情報(0～90のどれか)をぶち込む

// だからまずやるべきこととしては・・
// 結局描画部分しかいじらないので

// arrowGrを放り込んだのにbgとして扱われるバグが発生しました。
// 原因は？？？？？？
// 参照エラーとかいうやつですね。（言ってみたかっただけ）

// なんかね
// arrowShaderのsampler2Dの中にね
// imageで使ったグラフィックが勝手に入っちゃうみたい
// しかもこれ呼び出すたびになぜか知らんけど上書きされてる
// だから強引な解決策としては
// imageで背景を設定した後
// arrowGrをimageで画面外に無理やりおいて（見えないように）
// そのうえで大量描画するってやりかたでいけるし、いけた。
// しかしこれだとなぜimageで勝手にsetUniformっちゃうのか説明がつかない
// なんともはやsetUniform呼び出さなくても勝手に入っちゃうのよ。意味不明！！！！

// 結論
// imageを使わないで直接シェーダーで書いちゃえ。
// デプステストをオンオフするsayoさんのアイデア使う。

const SHOW_PERFORMANCE = false;
const PERFORMANCE_COUNTSPAN = 30;

const dx = [1, 0, -1, 0];
const dy = [0, 1, 0, -1];
const MAXIMUM_GRID = 20; // GRIDの最大値
const MOVESPAN = 40; // 20ずつ分ける。はじめの20で動かず次の20で動く感じ。あとの20はスムースにバックインバックアウトで
let GRID = 0;
const MOVING_CELL_NUMBER = 20;
let SIZE_X = 0;
let SIZE_Y = 0;
let OFFSET_X = 0; // セル集合全体からなるボードの左上の座標
let OFFSET_Y = 0;
const DENSITY = 0.5;
let ARROW_NUM = 0; // 総個数。やっぱグローバルにしないとまずいね。まあ・・うん。

const vs =
"precision mediump float;" +
"attribute vec3 aPosition;" +
"void main(){" +
"  gl_Position = vec4(aPosition, 1.0);" +
"}";

let bgShader;
const fsBG =
"precision mediump float;" +
"uniform vec2 uResolution;" +
// hsb to rgb.
"vec3 getRGB(float h, float s, float b){" +
"    vec3 c = vec3(h, s, b);" +
"    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);" +
"    rgb = rgb * rgb * (3.0 - 2.0 * rgb);" +
"    return c.z * mix(vec3(1.0), rgb, c.y);" +
"}" +
"void main(){" +
"  vec2 p = gl_FragCoord.xy * 0.5 / uResolution.xy;" +
"  gl_FragColor = vec4(getRGB(0.55, p.y, p.y), 1.0);" +
"}";

let _gl, gl;
let pBuf;
let data; // new Float32Array(個数*3)なので後で決める
let arrowShader;
let vsArrow =
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
"varying float vArrowDirection;" +
"varying float vArrowHue;" +
"uniform mat4 uModelViewMatrix;" +
"uniform mat4 uProjectionMatrix;" +
"void main() {" +
"  vec3 p = aPosition;" +

// 点の位置をいじるパート
"  vArrowHue = floor(p.z) / 100.0;" + // 色情報
"  vArrowDirection = fract(p.z) * TAU;" + // 方向情報
"  p.z = 0.0;" + // 方向情報取り出したら消す

// 設定
"  vec4 positionVec4 =  vec4(p, 1.0);" +

"  gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;" +

// サイズをいじる
"  gl_PointSize = uPointSize;" +
"  vStrokeWeight = uPointSize;" +
"}";

let fsArrow =
"precision mediump float;" +
"precision mediump int;" +
"uniform vec4 uMaterialColor;" +
"uniform float uCount;" +
"uniform sampler2D uArrow;" +
"const float TAU = 6.28318;" +
"varying float vStrokeWeight;" +
"varying vec3 vPosition;" +
"varying float vArrowDirection;" +
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
// もうGLSLで矢印描いちゃう？？何の解決にもならないけど。
"  vec2 p = gl_PointCoord.xy;" +
"  p -= 0.5;" +
"  float t = vArrowDirection;" +
"  p *= mat2(cos(t), sin(t), -sin(t), cos(t));" +
"  p += 0.5;" +
"  vec4 tex = texture2D(uArrow, p);" +
"  if(tex.a < 0.01){ discard; }" +
"  vec3 col = getRGB(vArrowHue, p.x, 1.0);" +
"  gl_FragColor = vec4(tex.rgb * col, 1.0);" +
"}";


// 一度に複数動かすとか
// イージングを工夫するとか

// リザーブする必要性

let cells = [];
let mat = [];
let arrowGr; // 矢印グラフィック. 輪郭は灰色で中身は白で

function setup(){
  const w = windowWidth;
  const h = windowHeight;
  _gl = createCanvas(w, h, WEBGL);
  const SIZE = min(w, h);
  if(SIZE > MAXIMUM_GRID * 2){
    GRID = MAXIMUM_GRID;
    SIZE_X = floor(w / GRID);
    SIZE_Y = floor(h / GRID);
  }else{
    GRID = floor(SIZE * 0.5);
    SIZE_X = floor(w / GRID);
    SIZE_Y = floor(h / GRID);
  }
  OFFSET_X = -SIZE_X * GRID * 0.5;
  OFFSET_Y = -SIZE_Y * GRID * 0.5;
	prepareBG();
  prepareArrow();
  stroke(0);
  strokeWeight(GRID); // ポイントスプライトのサイズ。
  let sorter = [];
  let rdm = [];
  for(let i = 0; i < SIZE_X * SIZE_Y; i++){
    sorter.push(i);
    rdm.push(0);
  }
  shuffle(sorter, true);
  // 要するにcellの個数はfloor(SIZE_X * SIZE_Y * DENSITY).
  for(let i = 0; i < SIZE_X * SIZE_Y * DENSITY; i++){
    rdm[sorter[i]] = 1;
    ARROW_NUM++;
  }
  // dataの定義（従来の「positions」に当たる）
  data = new Float32Array(ARROW_NUM * 3); // こうやった方が確実. ここに動的更新の際にデータをぶちこむ
  let index = 0;
  for(let x = 0; x < SIZE_X; x++){
    mat.push([]);
    for(let y = 0; y < SIZE_Y; y++){
      let id = x * SIZE_Y + y;
      mat[x].push(rdm[id]);
      if(rdm[id] == 1){
        cells.push(new Cell(x, y, index)); // index情報を新たに追加
        index++;
      }
    }
  }
  // シェーダーの用意
  gl = _gl.GL;
  arrowShader = createShader(vsArrow, fsArrow);
  arrowShader.isPointShader = () => true;
  _gl.userPointShader = arrowShader;
}

function draw() {
  let start = millis();
  search();
  cellUpdate();
  cellDraw();
  if(frameCount % PERFORMANCE_COUNTSPAN === 0 && SHOW_PERFORMANCE){ console.log((millis()-start)*60/1000); }
}

function prepareBG(){
  // シェーダーを作るだけ
  bgShader = createShader(vs, fsBG);
}

function prepareArrow(){
  arrowGr = createGraphics(100, 100);
  const g = 100;
  const x = 100 * (0.5 - sqrt(2) / 3); // 矢印が内接円に含まれるようにすることで回転の際に重ならないようにする。

  arrowGr.noStroke();
  arrowGr.fill(255);
  arrowGr.rect(x, g/3, g/2 - x, g/3);
  arrowGr.triangle(g/2, 0, g, g/2, g/2, g);

  arrowGr.noFill();
  arrowGr.stroke(128);
  arrowGr.strokeWeight(GRID/20);
  arrowGr.line(x, g/3, x, g*2/3);
  arrowGr.line(x, g/3, g/2, g/3);
  arrowGr.line(x, g*2/3, g/2, g*2/3);
  arrowGr.line(g/2, g/3, g/2, 0);
  arrowGr.line(g/2, g*2/3, g/2, g);
  arrowGr.line(g/2, 0, g, g/2);
  arrowGr.line(g, g/2, g/2, g);
}

function search(){
  shuffle(cells, true);
  let limit = MOVING_CELL_NUMBER;
  for(let c of cells){
    if(c.isMovable()){ limit--; }
    if(limit == 0){ break; }
  }
}

function cellUpdate(){
  for(let c of cells){ c.update(); }
}

function cellDraw(){

	// まずシェーダーをリセットして
	// それからデプステストをオフにした状態でいつものシェーダー芸で描画してあとで戻す。めでたし。
  resetShader();
	gl.disable(gl.DEPTH_TEST);
  shader(bgShader);
	noStroke();
	bgShader.setUniform("uResolution", [width, height]);
	quad(-1, -1, -1, 1, 1, 1, 1, -1);
	gl.enable(gl.DEPTH_TEST);

  for(let c of cells){ c.draw(); }
  resetShader();
  shader(arrowShader);
	stroke(0);
  arrowShader.setUniform("uArrow", arrowGr);
  myArrows(ARROW_NUM);
  //noLoop();
}

// シェーダーに送る際の情報として・・・
// activeがfalseならmoveDirectionをそのまま送る
// activeがtrueならproperFrameCountがMOVESPANの半分までの場合はそれをもとにprgを算出し
// 適当にイージングしてpreviousとlerpしたものを送る
// 全体のイージングは工夫して0.5までその場から動かないかほとんど動かないものを採用すればそっちは問題ない
// さて位置についてはxとyはそのままでいいんだけど
// zのところにそういう情報を格納する
// 生成するときに0～90のランダムシード値を与え
// この整数を角度の0～1に足して送る
// いつものように送った先で情報を分離する
// とりあえず現状はmoveDirection送るだけでいいですいきなり全部はできないので
class Cell{
  constructor(x, y, index){
    this.x = x;
    this.y = y;
    this.index = index; // これがないとdataに位置などの情報を放り込めない
    this.bodyHue = Math.floor(Math.random() * 90);
		this.pos = {x, y};
    this.previousMoveDirection = 0; // 0～3
    this.moveDirection = 0; // 0～3
    this.properFrameCount = 0;
    this.active = false;
    //this.gr = createGraphics(GRID, GRID);
    this.easingId = 15;
    //this.drawPrepare();
  }
  getProgress(){
    let prg = this.properFrameCount / MOVESPAN;
    prg = ease(prg, this.easingId);
    return prg;
  }
  /*
  drawPrepare(){
    this.gr.noStroke();
    this.gr.fill(192);
    this.gr.rect(0, 0, GRID, GRID);
    this.gr.fill(64);
    this.gr.rect(GRID * 0.1, GRID * 0.1, GRID * 0.9, GRID * 0.9);
    //this.gr.image(lava, GRID * 0.1, GRID * 0.1, GRID * 0.8, GRID * 0.8, this.x * GRID, this.y * GRID, GRID * 0.8, GRID * 0.8);
  }
  */
  isMovable(){
    if(this.active){ return false; }
    let k = [0, 1, 2, 3];
    shuffle(k, true); // サーチ順をいじる
    for(let i = 0; i < 4; i++){
      let id = k[i];
      if(this.x + dx[id] < 0){ continue; }
      if(this.x + dx[id] >= SIZE_X){ continue; }
      if(this.y + dy[id] < 0){ continue; }
      if(this.y + dy[id] >= SIZE_Y){ continue; }
      let next_x = this.x + dx[id];
      let next_y = this.y + dy[id];
      if(mat[next_x][next_y] > 0){ continue; } // これで・・あれ？
      // なぜか行先がかぶる・・・・・・
      if((this.moveDirection + id) % 2 == 0){ continue; }
      this.previousMoveDirection = this.moveDirection; // 直前の進行方向を保持
      this.moveDirection = id;
      this.activate();
      // リザーブしておかないと行先が被る
      mat[next_x][next_y] = 1;
      return true;
    }
    return false;
  }
  activate(){
    this.active = true;
  }
  inActivate(){
    this.active = false;
    this.properFrameCount = 0;
  }
  update(){
    if(!this.active){
			this.pos.x = this.x * GRID;
			this.pos.y = this.y * GRID;
			return;
		}
    this.properFrameCount++;
    const prg = this.getProgress();
    this.pos.x = (this.x + dx[this.moveDirection] * prg) * GRID;
    this.pos.y = (this.y + dy[this.moveDirection] * prg) * GRID;
    if(this.properFrameCount == MOVESPAN){
      mat[this.x][this.y] = 0;
      this.x += dx[this.moveDirection];
      this.y += dy[this.moveDirection];
      this.inActivate();
    }
  }
  draw(){ // dataInputとかの方がいいんだろうか・・
    // 位置の中心はthis.pos.x + GRID * 0.5, this.pos.y + GRID * 0.5
    // WEBGLモードでは中心が(0,0)なのでここから(width/2,height/2)を引けばいいです
    //image(this.gr, OFFSET_X + this.pos.x, OFFSET_Y + this.pos.y);
    //image(arrowGr, OFFSET_X + this.pos.x, OFFSET_Y + this.pos.y);
    let properDirectionId;
    // properなdirectionのidをpreviousとcurrentから算出する
    // 単純にlerpでいいかな・・どっちも0～3だから自然に0～3の範囲内におさまるし、わざわざ
    // 最短にする必要もないでしょう。なんかもう疲れた。
    if(this.active){
      let directionPrg = this.getProgress();
      // んぁーそうだ、prg < 0.5のときだけだ。だから・・
      directionPrg = min(directionPrg * 2.0, 1.0);
      properDirectionId = this.previousMoveDirection * (1 - directionPrg) + this.moveDirection * directionPrg;
    }else{
      properDirectionId = this.moveDirection;
    }
    data[this.index * 3] = OFFSET_X + this.pos.x + GRID * 0.5;
    data[this.index * 3 + 1] = OFFSET_Y + this.pos.y + GRID * 0.5;
    data[this.index * 3 + 2] = this.bodyHue + properDirectionId * 0.25;
  }
}

// 矢印。


//  TODO.


function myArrows(num){
  const gId = `myArrows|${num}`;
  if(!_gl.geometryInHash(gId)){
    const _geom = new p5.Geometry();
    let v = createVector();
    for(let i = 0; i < num; i++){
      // 流れ的に最初にここにくるときにすでに個別のdrawでdataの中身を埋めているので
      // ここでなんかdataに入れちゃうとまずい。だからここでdataはいじれない。
      _geom.vertices.push(v.set(0, 0, 0).copy());
    }
    pBuf = _gl.createBuffers(gId, _geom);
  }
  // これでいいんだ
  myDrawArrows();
}

// 逐次更新
function myDrawArrows(){
  _gl._setPointUniforms(arrowShader);

  _gl._bindBuffer(_gl.immediateMode.buffers.point, gl.ARRAY_BUFFER, _gl._vToNArray(pBuf.model.vertices), Float32Array, gl.DYNAMIC_DRAW);
  arrowShader.enableAttrib(arrowShader.attributes.aPosition, 3);
  //setPosition();
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);

  gl.drawArrays(gl.Points, 0, pBuf.model.vertices.length);
  arrowShader.unbindShader();
}

// setPositionで数字をいじる必要はない
// なぜならこの処理の前で各オブジェクトがdrawにおいて位置や角度の情報をdataに放り込むから
// 要するにここでデータを作る必要はなくて
// 各オブジェクトの更新処理に割り込ませればいいだけなんですね
// 重要なのは円の大きさ
// 20x20を最大サイズにしているのもあんま大きいと挙動が怪しくなるから
// まあ正方形大量に用意してもいいんだけど動的更新がめんどくさそうなので・・・ポイスプでやっちゃおうってわけ

function ease(x, id){
  return window["f" + id](x);
}

function f0(x){ return x * x; }
function f1(x){ return (1 - cos(PI * x)) / 2; }
function f2(x){ return 1 - pow(1 - x * x, 0.5); }
function f3(x){ return x * (2 * x - 1); }
function f4(x){ return (50 / 23) * (-2 * pow(x, 3) + 3 * pow(x, 2) - 0.54 * x); }
function f5(x){ return 3 * pow(x, 4) - 2 * pow(x, 6); }
function f6(x){ return -12 * pow(x, 3) + 18 * pow(x, 2) - 5 * x; }
function f7(x){ return (7 / 8) + (x / 8) - (7 / 8) * pow(1 - x, 4); }
function f8(x){ return (x / 8) + (7 / 8) * pow(x, 4); }
function f9(x){ return x + 0.1 * sin(8 * PI * x); }
function f10(x){ return 0.5 * (1 - cos(9 * PI * x)); }
function f11(x){ return (1 - pow(cos(PI * x), 5)) / 2; }
function f12(x){ return pow(((1 - cos(PI * x)) / 2), 3); }
function f13(x){ return max(min(192 * pow(x - 0.25, 5) - 240 * pow(x - 0.25, 4) + 80 * pow(x - 0.25, 3), 1), 0); }
function f14(x){
	if(x < 0.5){ return 8 * pow(x, 4); }
	return 1 - 8 * pow(1 - x, 4);
}
// x < 0.5のときは動かない
// x > 0.5のときはスケールをいじってからバックインバックアウト
function f15(x){
  if(x < 0.5){ return 0.0; }
  x = (x - 0.5) * 2.0; // [0.5, 1.0] → [0.0, 1.0]
  if(x < 0.5){
    return 10.0 * x * x * (x - 0.3);
  }
  x = 1.0 - x;
  return 1.0 - 10.0 * x * x * (x - 0.3);
}
