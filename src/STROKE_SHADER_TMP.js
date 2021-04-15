// p5.Geometryを使って曲線を描画する実験
// うまくいった
// 直書きのシェーダでは何もできない。
// なぜならデフォルトシェーダが使われているので。
// 曲線に対してあれこれしようと思ったらそっちをいじる必要があるみたい
// 直書きはnoFillだと機能しない

// しかしuStrokeWeightが定義されていればuserStrokeShaderとみなされ
// （shader関数を実行したときにね）
// 各種の操作が可能に・・？わかんね

// 軽いなぁ。
// やっぱジオメトリーで作ると違うわね。
// immediateだと遅いからね。

// というわけでdaveさんのこれ→https://twitter.com/beesandbombs/status/1363113635615227912
// ・・・っぽいのを描いてみました。これすごいよね・・

// 線ごとに色を変えるやり方が判明しました。
// あっちのline用のシェーダをパクって、作るときにshaderを2回実行して、中身を書き換えちゃえばいいそうです！やったね！！
// とりあえずz座標で色変えるか

// 1行ずつの書き方に直しました。
// これでOpenProcessingの方でforループ使ってもエラー出されないよ
// よかったね

let gl;
let myShader;

let vs =
"precision mediump float;" +
"uniform mat4 uModelViewMatrix;" +
"uniform mat4 uProjectionMatrix;" +
"uniform float uStrokeWeight;" +

"uniform vec4 uViewport;" +
"uniform int uPerspective;" +

"attribute vec4 aPosition;" +
"attribute vec4 aDirection;" +

"const float TAU = 6.28318;" +

"varying vec3 vPosition;" +

"void main() {" +
"  vPosition = aPosition.xyz;" +

"  vec3 scale = vec3(0.9995);" +

"  vec4 posp = uModelViewMatrix * aPosition;" +
"  vec4 posq = uModelViewMatrix * (aPosition + vec4(aDirection.xyz, 0));" +

"  posp.xyz = posp.xyz * scale;" +
"  posq.xyz = posq.xyz * scale;" +

"  vec4 p = uProjectionMatrix * posp;" +
"  vec4 q = uProjectionMatrix * posq;" +

"  vec2 tangent = normalize((q.xy*p.w - p.xy*q.w) * uViewport.zw);" +

"  vec2 normal = vec2(-tangent.y, tangent.x);" +

"  float thickness = aDirection.w * uStrokeWeight;" +
"  vec2 offset = normal * thickness / 2.0;" +

"  vec2 curPerspScale;" +

"  if(uPerspective == 1) {" +
"    curPerspScale = (uProjectionMatrix * vec4(1, -1, 0, 0)).xy;" +
"  }else{" +
"    curPerspScale = p.w / (0.5 * uViewport.zw);" +
"  }" +

"  gl_Position.xy = p.xy + offset.xy * curPerspScale;" +
"  gl_Position.zw = p.zw;" +
"}";

// ちょっとわかんないや

let fs =
"precision mediump float;" +
"precision mediump int;" +

"uniform vec4 uMaterialColor;" +
"uniform float uCount;" +

"const float TAU = 6.28318;" +

"varying vec3 vPosition;" +

"vec3 getRGB(float h, float s, float b){" +
"    vec3 c = vec3(h, s, b);" +
"    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);" +
"    rgb = rgb * rgb * (3.0 - 2.0 * rgb);" +
"    return c.z * mix(vec3(1.0), rgb, c.y);" +
"}" +

"void main() {" +
"  vec3 p = vPosition;" +
"  float hue = fract(floor(uCount / 10.0) / 100.0);" +
"  float sat = abs(p.z);" +
"  float finalHue = mix(hue, fract(hue + 0.5), 0.5 * (p.z + 1.0));" +
"  vec3 col = getRGB(finalHue, sat, 1.0);" +
"  gl_FragColor = vec4(col, 1.0);" +
"}";


let properFrameCount = 0;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  gl = this._renderer.GL;
  myShader = createShader(vs, fs);
  shader(myShader);
  shader(myShader);
  noFill();
  gl.enable(gl.DEPTH_TEST); // 深度は基本無効になってるので有効にしておく
}

function draw() {
  background(0);
  stroke(...HSBA_to_RGBA(5 + floor(abs(90 - properFrameCount * 0.1 % 180)), 100, 100));
  strokeWeight(2);
  let prg = 1 - abs(240 - properFrameCount % 480) / 240;
  prg = ease14(prg);
  scale(1, 1, 1 + 2 * prg);
  rotateX(PI/2);
  rotateZ(PI*properFrameCount/180);
  const SIZE = floor(min(windowWidth, windowHeight) / 3);
  myShader.setUniform("uCount", properFrameCount);
  myLine(SIZE);
  //noLoop();
  properFrameCount++;
}

function myLine(size){
  // gIdを定義する
  const gId = `myLine`;

  // 以下の処理で構築。これは1回だけ実行される。
  if(!this._renderer.geometryInHash(gId)){
    const _geom = new p5.Geometry();

    // ベクトルの用意
    let v = createVector();
    let index = 0;

    for(let k = 0; k < 10; k++){
    for(let i = 0; i <= 200; i++){
      let t = i * PI / 200;
      let p = PI * k / 5 + 4 * t;
      let x = sin(t) * cos(p);
      let y = sin(t) * sin(p);
      let z = cos(t);
      _geom.vertices.push(v.set(x, y, z).copy());
      if(i < 200){ _geom.edges.push([index + i, index + i + 1]); }
    }
      index += 201;
    }

    // 法線・辺計算
    _geom._edgesToVertices();

    // バッファ作成
    this._renderer.createBuffers(gId, _geom);
    }

    // 描画
    this._renderer.drawBuffersScaled(gId, size, size, size);
}

// 秘密兵器
// 255では割らないです
// 透明度のデフォは1です透明にするなら0.4とかしてください
// h,s,bは未指定なら0～100でお願いします
// 結果は0～1なのでそのまま使えます
// 以上です
function HSBA_to_RGBA(h,s,b,a = 1, max_h = 100, max_s = 100, max_b = 100){
  let hue = h * 6 / max_h; // We will split hue into 6 sectors.
  let sat = s / max_s;
  let val = b / max_b;

  let RGB = [];

  if(sat === 0) {
    RGB = [val, val, val]; // Return early if grayscale.
  }else{
    let sector = Math.floor(hue);
    let tint1 = val * (1 - sat) * 255;
    let tint2 = val * (1 - sat * (hue - sector)) * 255;
    let tint3 = val * (1 - sat * (1 + sector - hue)) * 255;
    val *= 255;
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


function ease14(x){
  if(x < 0.5){ return 8 * pow(x, 4); }
  return 1 - 8 * pow(1 - x, 4);
}
