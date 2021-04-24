// strokeShaderとfillShaderとpointShaderをすべて使う実験
// fillShaderで回転する立方体を描画し
// strokeShaderでそのまわりに線をぐるぐるさせ
// さらにパーティクルをたくさん飛び回らせる感じ
// 軌道は線を摂動させる感じ
// 総復習って感じね

// テキストで説明付けつつ正二十面体ダイス
// パーティクルのテクスチャ貼り付けで方向情報付与で矢印ぎゅーん
// テクスチャを用いた位置指示
// テキストシェーダのカスタム
// やりたいことはいっぱいある

// その前にライティングを何とかするね・・
// まあ、普通にやってもいいかな・・って気がしてきた（
// やー、やっぱ自己流危険だわ。いちから組みなおそう。

// というわけで今回はfillShaderに特化しますね

// 裏側描画できたー
// maxのとこ（ランベルト）が0.0だからか
// ここを0.3とかにするとよい

// 頂点色できたね

// フォンも気になるねやっぱり

// 今まで通りでいい気がしてきたからダメ

// よし。

// 環境光大事ね

let gl;

let myFillShader;
let myStrokeShader;
let myPointShader;
let pointBuf; // pointSpriteのバッファにアクセスできないといけない
// じゃないと_drawPointsが使えないので
let count = 0;

let vsFill =
"precision mediump float;" +
"precision mediump int;" +

"uniform mat4 uViewMatrix;" +

"uniform bool uUseLighting;" +

"uniform int uAmbientLightCount;" +
"uniform vec3 uAmbientColor[5];" +

"uniform int uDirectionalLightCount;" +
"uniform vec3 uLightingDirection[5];" +
"uniform vec3 uDirectionalDiffuseColors[5];" +
"uniform vec3 uDirectionalSpecularColors[5];" +

"const float specularFactor = 2.0;" +
"const float diffuseFactor = 0.73;" +

"struct LightResult{" +
"  float specular;" +
"  float diffuse;" +
"};" +

"float _lambertDiffuse(vec3 lightDirection, vec3 surfaceNormal){" +
// ここですね。法線ベクトルとライトベクトルで内積を取ってるのは。
"  return max(0.0, dot(-lightDirection, surfaceNormal));" +
"}" +

"LightResult _light(vec3 viewDirection, vec3 normal, vec3 lightVector){" +
"  vec3 lightDir = normalize(lightVector);" +
//compute our diffuse & specular terms
"  LightResult lr;" +
"  lr.diffuse = _lambertDiffuse(lightDir, normal);" +
"  return lr;" +
"}" +

"void totalLight(vec3 modelPosition, vec3 normal, out vec3 totalDiffuse, out vec3 totalSpecular){" +
// Diffuseのデフォは1.0でSpecularのデフォは0.0です。まあ当然よね。
"  totalSpecular = vec3(0.0);" +
"  if(!uUseLighting){" +
"    totalDiffuse = vec3(1.0);" +
"    return;" +
"  }" +
// ライティング使ってるならDiffuseをいちから計算する
"  totalDiffuse = vec3(0.0);" +
"  vec3 viewDirection = normalize(-modelPosition);" +
// これ以降の処理は定められたライトに対してのみ行なわれる感じね

"  for(int j = 0; j < 5; j++){" +
"    if(j < uDirectionalLightCount){" +
"      vec3 lightVector = (uViewMatrix * vec4(uLightingDirection[j], 0.0)).xyz;" +
"      vec3 lightColor = uDirectionalDiffuseColors[j];" +
"      vec3 specularColor = uDirectionalSpecularColors[j];" +
"      LightResult result = _light(viewDirection, normal, lightVector);" +
"      totalDiffuse += result.diffuse * lightColor;" +
"      totalSpecular += result.specular * lightColor * specularColor;" +
"    }" +
"  }" +
"}" +

// こっから下が追加部分
// ライティング適用するならほんとはこういうの書かないといけなかったのよね
// ディレクショナルオンリーにして余計な部分省いてもいいけど
// アンビエント追加

// include lighting.glgl

"attribute vec3 aPosition;" +
"attribute vec3 aNormal;" +
"attribute vec2 aTexCoord;" +
"attribute vec4 aMaterialColor;" +

"uniform mat4 uModelViewMatrix;" +
"uniform mat4 uProjectionMatrix;" +
"uniform mat3 uNormalMatrix;" +

"varying highp vec2 vVertTexCoord;" +
"varying vec3 vDiffuseColor;" +
"varying vec3 vSpecularColor;" +
"varying vec4 vVertexColor;" +

"void main(void){" +
  // 位置の変更はここでpのところをいじる
"  vec3 p = aPosition;" +
"  vec4 viewModelPosition = uModelViewMatrix * vec4(p, 1.0);" +
"  gl_Position = uProjectionMatrix * viewModelPosition;" +

"  vec3 vertexNormal = normalize(uNormalMatrix * aNormal);" +
"  vVertTexCoord = aTexCoord;" +
"  vVertexColor = aMaterialColor;" +

// totalLight
// ここでvDiffuseColorとvSpecularColorに色情報をぶち込んでる
// それらはここでは使われずvarying経由でlightTextureに送られて参照され色が決まる
"  totalLight(viewModelPosition.xyz, vertexNormal, vDiffuseColor, vSpecularColor);" +
"  for(int i = 0; i < 5; i++){" +
"    if (i < uAmbientLightCount){" +
"      vDiffuseColor += uAmbientColor[i];" +
"    }" +
"  }" +
"}";

// 若干変更しました
// tintは使いたかったら0～1で今まで通り指定して掛けたかったら掛けてね
// テクスチャで色変えたかったらvVertTexCoordに入ってるから
// 自由に加工して使ってね
// 以上

let fsFill =
"precision mediump float;" +

"uniform vec4 uMaterialColor;" +
"uniform vec4 uTint;" +
"uniform sampler2D uSampler;" +
"uniform bool isTexture;" +
"uniform bool uEmissive;" +

"varying highp vec2 vVertTexCoord;" +
"varying vec3 vDiffuseColor;" +
"varying vec3 vSpecularColor;" +
"varying vec4 vVertexColor;" +

"void main(void) {" +
"  vec4 col = vVertexColor;" +
// "col = uMaterialColor;" +
"  col.rgb = col.rgb * vDiffuseColor + vSpecularColor;" +
"  gl_FragColor = col;" +
"}";

// 次に線のシェーダいってみようか

let vsStroke =
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

// 位置をいじるにはここでaPosition.xyzをいじる
// なおaDirection.xyzも次の点の位置に向かう単位ベクトルとかに
// しないとおかしなことになる（線がかすれたりする）
"  vec4 posp = uModelViewMatrix * aPosition;" +
"  vec4 posq = uModelViewMatrix * (aPosition + vec4(aDirection.xyz, 0));" +

"  posp.xyz = posp.xyz * scale;" +
"  posq.xyz = posq.xyz * scale;" +

"  vec4 p = uProjectionMatrix * posp;" +
"  vec4 q = uProjectionMatrix * posq;" +

"  vec2 tangent = normalize((q.xy*p.w - p.xy*q.w) * uViewport.zw);" +

"  vec2 normal = vec2(-tangent.y, tangent.x);" +

// ここでaDirection.wにマイナス付けるとgl.FRONTのときに描画されるようになる
// 基本的にはgl.BACKのときしか描画されないので
// fillShaderで裏表やってるときは注意してね。
// 曲線にも裏表あるのね・・
// なおここをいじると線の太さが変わる（当然か）
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

let fsStroke =
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
// デフォルトではstrokeで指定した値だけど
// 位置情報に応じて変えたりなど自由にいじることができるのだ
"  gl_FragColor = vec4(1.0);" +
"}";

// じゃあ最後にポイントシェーダいこうか
let vsPoint =
"precision mediump float;" +
// ↑これがないと両方でuCount使えなくてエラーになる
"attribute vec3 aPosition;" +
"uniform float uPointSize;" +
"uniform float uCount;" +
"uniform float uDistanceFactor;" +
"const float TAU = 6.28318;" +
"const float PI = 3.14159;"+
"varying float vStrokeWeight;" +
"varying vec3 vPosition;" +
"uniform mat4 uModelViewMatrix;" +
"uniform mat4 uProjectionMatrix;" +
"void main() {" +
"  vec3 p = aPosition;" +

// 点の位置をいじるパート
"  p = -1.0 + 2.0 * p;" +
"  vPosition = p;" +
"  float properCount = uCount + abs(sin(p.x * 4321.579)) * 240.0;" +
"  float theta = properCount * TAU / 183.0;" +
"  float phi = properCount * TAU / 237.0;" +
"  float radius = 0.3 * cos(properCount * TAU / 400.0);" +
"  p.x += radius * sin(theta) * cos(phi);" +
"  p.y += radius * sin(theta) * sin(phi);" +
"  p.z += radius * cos(theta);" +
"  p *= uDistanceFactor;" +

// 設定
"  vec4 positionVec4 =  vec4(p, 1.0);" +

"  gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;" +

// サイズをいじる
// 点の元の位置を参照しないとちかちかするので注意
"  float sizeFactor = 0.75 + 0.5 * abs(sin(aPosition.y * 3371.412));" +
"  gl_PointSize = uPointSize * sizeFactor;" +
"  vStrokeWeight = uPointSize * sizeFactor;" +
"}";

let fsPoint =
"precision mediump float;" +
"precision mediump int;" +
"uniform vec4 uMaterialColor;" +
"uniform float uCount;" +
"const float TAU = 6.28318;" +
"varying float vStrokeWeight;" +
"varying vec3 vPosition;" +

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
"  float properCount = uCount + abs(sin(vPosition.x * 3312.749)) * 360.0;" +
"  gl_FragColor = vec4(getRGB(fract(uCount / 600.0), 0.5 + 0.5 * sin(TAU * properCount / 360.0), 1.0) * (1.0 - mask), 1.0);" +
"}";

function setup(){
  let _gl = createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1);
  gl = this._renderer.GL;
  myFillShader = createShader(vsFill, fsFill);
  myStrokeShader = createShader(vsStroke, fsStroke);
  myPointShader = createShader(vsPoint, fsPoint);

  myPointShader.isPointShader = () => true; // これはpointShaderだよ！
  _gl.userPointShader = myPointShader; // userPointShaderを変更

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
}

function draw(){
  let start = millis();

  const _SIZE = min(windowWidth, windowHeight);

  background(0);
  directionalLight(255, 255, 255, 0, 0, 1);
  ambientLight(64);
  rotateX(frameCount * 0.01);
  rotateZ(frameCount * 0.02);
  rotateX(PI/2);

  resetShader();

  // 次にstrokeShader
  // 2回呼ばないといけないのよね。
  // なぜなら仕様上、2回呼ばないとuserStrokeShaderにこれが設定されないから
  // まあそうはいっても最初のフレームで描画されないだけだけど。
  // draw内でshaderを呼び出さない場合は注意が必要ってだけの話
  shader(myStrokeShader);
  shader(myStrokeShader);
  noFill();
  stroke(255);
  strokeWeight(2);
  myLine(_SIZE * 0.66);
  rotateX(PI/2);
  myLine(_SIZE * 0.66);
  rotateY(PI/2);
  myLine(_SIZE * 0.66);
  rotateY(-PI/2);
  rotateX(-PI/2);

  resetShader();

  // まずfillShader
  shader(myFillShader);
  fill(255);
  noStroke();
  gl.cullFace(gl.BACK);
  myCube(_SIZE * 0.16);
  gl.cullFace(gl.FRONT);
  myCube(_SIZE * 0.16);
  gl.cullFace(gl.BACK); // BACKに戻さないとLineが消えてしまうのね・・
  // ということはlineShaderは裏表の影響を受けている？？
  // Frenet-Serret-frameでちゃんと描画できたのはこれを
  // やってないからだった。そういうことだそうです。
  // まあ、これで裏表の描画とstrokeを両立させられるわけだ。
  // 貴重な知見を得たね。aDirection.aが関係してそう。
  // 当たりですね。
  // aDirection.wを使ってるところで-1掛けたら描画されたわ
  // つまり、
  // aDirection.wが無修正のときはgl.BACKのときだけ描画され、
  // -1を掛けたときはgl.FRONTのときだけ描画される仕組みか。
  // ふむふむ・・何かに使えそうな・・まあ、いいや。

  resetShader();

  // 最後にポイント
  shader(myPointShader);
  stroke(0);
  strokeWeight(_SIZE * 0.01);
  myPointShader.setUniform("uCount", count);
  const DISTANCE_FACTOR = _SIZE * 0.5;
  myPointShader.setUniform("uDistanceFactor", DISTANCE_FACTOR);
  myPoints(1000);

  count++;
  let end = millis();
  //if(count % 60 == 0){ console.log((end-start)*60/1000); }
}

function myCube(size){
  const gId = `myBox`;

  if(!this._renderer.geometryInHash(gId)){
    const myCubeGeom = new p5.Geometry();

    // 位置ベクトル
    let v = new p5.Vector();
    for(let z = 0.5; z > -1; z -= 1){
      for(let x = -0.5; x < 1; x += 1){
        for(let y = -0.5; y < 1; y += 1){
          myCubeGeom.vertices.push(v.set(x, y, z).copy());
          myCubeGeom.vertexColors.push(...[x + 0.5, y + 0.5, z + 0.5, 1]);
        }
      }
    }

    // 反時計回り？
    myCubeGeom.faces.push(...[[0,1,2], [2,1,3], [1,5,3], [3,5,7], [3,7,2], [2,7,6],
                              [0,4,1], [1,4,5], [5,4,7], [7,4,6], [4,0,6], [6,0,2]]);
    // 法線・辺計算
    myCubeGeom._makeTriangleEdges()._edgesToVertices();
    myCubeGeom.computeNormals();

    // バッファ作成
    this._renderer.createBuffers(gId, myCubeGeom);
  }
  // 描画
  this._renderer.drawBuffersScaled(gId, size, size, size);
}

function myLine(size){
  // gIdを定義する
  const gId = `myLine`;

  // 以下の処理で構築。これは1回だけ実行される。
  if(!this._renderer.geometryInHash(gId)){
    const _geom = new p5.Geometry();

    // ベクトルの用意
    let v = createVector();

    for(let i = 0; i <= 400; i++){
      let t = i / 400;
      _geom.vertices.push(v.set(0, 0, t - 0.5).copy());
      if(i > 0){ _geom.edges.push([i - 1, i]); }
    }

    // 法線・辺計算
    _geom._edgesToVertices();

    // バッファ作成
    this._renderer.createBuffers(gId, _geom);
    }
    // 描画
    this._renderer.drawBuffersScaled(gId, size, size, size);
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
    pointBuf = this._renderer.createBuffers(gId, myPointsGeom);
  }
  // これでいいんだ
  this._renderer._drawPoints(pointBuf.model.vertices, this._renderer.immediateMode.buffers.point);
}
