// 直交するベクトル(-1,1,0)
// 単位ベクトルがzでこれがxとしたときのyは？
// z成分は正なので(-1,-1,1)かな。
// できました。

// ダメでした。

// 間違ってました。ごめんなさい。
// x,y,zの順に指定しないとだね・・・・

// これで(1,0,0)がe1,(0,1,0)がe2,(0,0,1)がe3になります。
// そういう指定の仕方なのです。

// ちょっとサンプル作ろうかな
// サンプル程度ならstrokeShader要らないかなー
// って思って従来のやり方で曲線描こうとしたら
// 重すぎて死んだ（（（
// 結論
// もう従来のやり方では曲線描画できない
// 無理！！！！！
// だいたいさぁ、曲線描画にしてもさ、
// まあいいや、重いのは確か、shaderなら速いのも確か。ならこれ以上調べることはない。
// 今まで通り、strokeShaderでや・る・だ・け！

// まず閉曲線をいつものやり方で
// 一本の0～1線を動的に変化させる
// それと同時に連動させて
// 別のstroke用のshaderを使って
// 無数の、てか100個くらいの正方形を回転させる
// detailを100分割して・・
// それぞれのポイントで回転させる感じ
// ディレイで合わせる
// それで、まあとりあえずそこまで。

// レール・・にしたいのよね。

// やめよう

// こういうのが作りたいんじゃないかも・・
// とりあえず2本にしてレールっぽく
// 枕木おいてレールっぽく
// その上でなんか正方形のゲートとか回したら面白そう

// Ctrl+b要らないから今度無効化しといて。うざい。
// ずっと見てられる・・やば・・中毒性ある。
// 色を工夫したいかな。

// 1. キラキラパーティクル6000
// 毎フレーム100個出す。寿命60で。位置は動的更新。で、大きさまちまちで、自由落下。カメラの影響でそれっぽく見えるので。
// 色は黄色～オレンジ系で。まちまちで。ゆるやかに一往復で明滅。
// 2. 星型トンネル100個用意。それで完成！おわり！次行こう。
// あ、忘れてた、枕木は直方体でもいいかも。

// 次に線のシェーダいってみようか

//let objP;
//let objV;
//let objF = 0;

let gl, _gl;
let count = 0;
let currentCount = 0;
let speed = 1;
let speedFactor = 100;
let _SIZE;
let _TRAIN_SIZE; // グローバルにします
let cur, prev, next; // curはグローバルでのオブジェクトの位置、prevはその直前でnextはその直後
let tang1, tang2, v2, v3; // そのうち名前付けるけどこれもグローバルにしないと位置更新がめんどう
// まあクラス化してないからね・・

const FUNCTION_ID = 1;
const PERIOD = 4800;
const RAIL_DETAIL = 800;
const SCALE_FACTOR = 0.3; // min(width, height)に掛ける定数
const SIZE_FACTOR = 0.08; // よし。これで大きさを自由にいじれるね
const POINTSIZE_FACTOR = 1.0; // パーティクルの大きさはカメラに依らないので
const PARTICLE_NUM = 1800;

let positions = new Float32Array(PARTICLE_NUM * 3); // そうです。
let velocities = [];
let selfCounts = []; // 最初は-1いれといて-1のときは位置をcurで更新して隠れるようにする、順繰りに60をセットして0になったら戻す感じ
let pBuf; // パーティクル用のバッファへのポインタ

let functionDef = [];
// DETAIL=800.
functionDef.push(
"vec3 getPos(float t){" +
"  float theta = t * TAU * 5.0;" +
"  float r = 1.0;" +
"  float x = r * sin(2.0 * theta);" +
"  float y = r * sin(theta);" +
"  float z = 0.0;" +
"  return vec3(x, y, z);" +
"}")
functionDef.push(
"vec3 getPos(float t){" +
"  float theta = t * TAU * 5.0;" +
"  float phi = t * TAU * 7.0;" +
"  float r = 1.0 + 0.4 * sin(t * TAU * 8.0);" +
"  float x = r * sin(theta) * cos(phi);" +
"  float y = r * sin(theta) * sin(phi);" +
"  float z = r * cos(theta);" +
"  return vec3(x, y, z);" +
"}")

let railShader;

let vsRail =
"precision mediump float;" +
"uniform mat4 uModelViewMatrix;" +
"uniform mat4 uProjectionMatrix;" +
"uniform float uStrokeWeight;" +

"uniform vec4 uViewport;" +
"uniform int uPerspective;" +

"uniform float uDiff;" + // やっぱ1/detailでdiffにしよう

"attribute vec4 aPosition;" +
"attribute vec4 aDirection;" +

"const float TAU = 6.28318;" +

"varying vec3 vPosition;" +

functionDef[FUNCTION_ID] +

"void main() {" +
"  vPosition = aPosition.xyz;" +

"  vec3 scale = vec3(0.9995);" +

// 位置をいじるにはここでaPosition.xyzをいじる
// なおaDirection.xyzも次の点の位置に向かう単位ベクトルとかに
// しないとおかしなことになる（線がかすれたりする）

// さぁ、posとdirを自由に決めましょう！！
// 具体的にはpos.zからprgを取り出してxとyとzを決めて
// ちょっとprgずらした（1/detail分だけずらした）やつについてx,y,zを取り差を取って正規化してdirとする
// だけです
"  vec3 pos = aPosition.xyz;" +
"  vec3 dir;" +
"  float prg = pos.z;" +
"  vec3 cur = getPos(prg);" +
"  vec3 q1 = getPos(prg - uDiff);" +
"  vec3 q2 = getPos(prg + uDiff);" +
"  vec3 tan1 = normalize(cur - q1);" +
"  vec3 tan2 = normalize(q2 - cur);" +
"  vec3 v2 = normalize(tan2 - tan1);" +
"  vec3 v3 = cross(tan2, v2);" +
"  vec3 q3 = getPos(prg + uDiff * 2.0);" +
"  vec3 tan3 = normalize(q3 - q2);" +
"  vec3 v4 = normalize(tan3 - tan2);" +
"  vec3 v5 = cross(tan3, v4);" +
"  pos = cur + pos.x * v3 * 0.1;" +
"  dir = normalize(q2 + pos.x * v5 * 0.1 - pos);" +
"  vec4 posp = uModelViewMatrix * vec4(pos, aPosition.w);" +
"  vec4 posq = uModelViewMatrix * (vec4(pos, aPosition.w) + vec4(dir, 0));" +

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

let fsRail =
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
"  float hue = 0.55;" +
"  float sat = 0.5 + 0.5 * sin(p.z * TAU * 200.0);" +
"  float blt = 1.0;" +
"  vec3 col = getRGB(hue, sat, blt);" +
"  gl_FragColor = vec4(col, 1.0);" +
"}";

let sleeperShader;

let vsSleeper =
"precision mediump float;" +
"uniform mat4 uModelViewMatrix;" +
"uniform mat4 uProjectionMatrix;" +
"uniform float uStrokeWeight;" +

"uniform vec4 uViewport;" +
"uniform int uPerspective;" +

"uniform float uDiff;" + // やっぱ1/detailでdiffにしよう

"attribute vec4 aPosition;" +
"attribute vec4 aDirection;" +

"const float TAU = 6.28318;" +

"varying vec3 vPosition;" +

functionDef[FUNCTION_ID] +

"void main() {" +
"  vPosition = aPosition.xyz;" +

"  vec3 scale = vec3(0.9995);" +

// 位置をいじるにはここでaPosition.xyzをいじる
// なおaDirection.xyzも次の点の位置に向かう単位ベクトルとかに
// しないとおかしなことになる（線がかすれたりする）

// さぁ、posとdirを自由に決めましょう！！
// 具体的にはpos.zからprgを取り出してxとyとzを決めて
// ちょっとprgずらした（1/detail分だけずらした）やつについてx,y,zを取り差を取って正規化してdirとする
// だけです
"  vec3 pos = aPosition.xyz;" +
"  vec3 dir;" +
"  float prg = pos.z;" +
"  vec3 cur = getPos(prg);" +
"  vec3 q1 = getPos(prg - uDiff);" +
"  vec3 q2 = getPos(prg + uDiff);" +
"  vec3 tan1 = normalize(cur - q1);" +
"  vec3 tan2 = normalize(q2 - cur);" +
"  vec3 v2 = normalize(tan2 - tan1);" +
"  vec3 v3 = cross(tan2, v2);" +
"  float tmp = pos.x;" + // やべぇここ間違えてた・・・・
"  pos = cur + tmp * v3 * 0.14;" +
"  dir = normalize(-tmp * v3);" +
"  vec4 posp = uModelViewMatrix * vec4(pos, aPosition.w);" +
"  vec4 posq = uModelViewMatrix * (vec4(pos, aPosition.w) + vec4(dir, 0));" +

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

let fsSleeper =
"precision mediump float;" +
"precision mediump int;" +

"uniform vec4 uMaterialColor;" +

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
"  vec3 col = vec3(0.0, 0.3, 1.0);" +
"  gl_FragColor = vec4(col, 1.0);" +
"}";

let trainShader;

let vsTrain =
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

"uniform float uProgress;" + // 位置を示す0～1の値
"uniform float uDiff;" + // やっぱ1/detailでdiffにしよう
"uniform float uSizeFactor;" + // これで割る

"varying highp vec2 vVertTexCoord;" +
"varying vec3 vDiffuseColor;" +
"varying vec3 vSpecularColor;" +
"varying vec4 vVertexColor;" +

"const float TAU = 6.28318;" +

functionDef[FUNCTION_ID] +

"void main(void){" +
// 位置の変更はここでpのところをいじる
"  vec3 p = aPosition;" +

"  vec3 dir;" +
"  vec3 cur = getPos(uProgress);" +
"  vec3 q1 = getPos(uProgress - uDiff);" +
"  vec3 q2 = getPos(uProgress + uDiff);" +
"  vec3 tan1 = normalize(cur - q1);" +
"  vec3 tan2 = normalize(q2 - cur);" +
"  vec3 v2 = normalize(tan2 - tan1);" +
"  vec3 v3 = cross(tan2, v2);" +
// tan1が前方向、v3が右、-v2が上。だからx,y,zになる。
"  mat3 m = mat3(tan1, v3, -v2);" +
// なぜuSizeFactorで割るというかというと、
// _SCALEにSIZE_FACTORを掛けてTRAIN_SIZEを出しててこれがそのまま使われると
// 具合が悪いからSIZE_FACTORで割って_SCALEを出してる。曲線上の位置の計算のために。
// m * pの方はTRAIN_SIZEになってもらわないと困るので無修正です。ふぅ、理解できた！
// ついでに-v2でいじってちょっと浮かせるか
"  vec4 viewModelPosition = uModelViewMatrix * vec4(m * p + cur / uSizeFactor - v2 * 0.2, 1.0);" +
"  gl_Position = uProjectionMatrix * viewModelPosition;" +

"  vec3 vertexNormal = normalize(uNormalMatrix * (m * aNormal));" +
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

let fsTrain =
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

let particleShader;
// 星型パーティクル
// 動的変更で位置を送る
// attributeを増やせばいい
// そのうち自由にattribute増やせるように改造するからとりあえず全部同じ色形でコード書いて

let vsParticle =
// これがないと両方でuCount使えなくてエラーになる
"precision mediump float;" +
"attribute vec3 aPosition;" +
"uniform float uPointSize;" +
"uniform float uCount;" +
"const float TAU = 6.28318;" +
"const float PI = 3.14159;" +
"varying float vStrokeWeight;" +
"varying vec3 vPosition;" +
"uniform mat4 uModelViewMatrix;" +
"uniform mat4 uProjectionMatrix;" +
"void main() {" +
"  vec3 p = aPosition;" +
"  vec4 positionVec4 =  vec4(aPosition, 1.0);" +
"  gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;" +
"  gl_PointSize = uPointSize;" +
"  vStrokeWeight = uPointSize;" +
"}";

let fsParticle =
"precision mediump float;" +
"precision mediump int;" +
"uniform vec4 uMaterialColor;" +
"uniform float uCount;" +
"const float TAU = 6.28318;" +
"const float PI = 3.14159;" +
"varying float vStrokeWeight;" +
"varying vec3 vPosition;" +
"const int STAR_ITER = 5;" +

// getRGB,参上！
"vec3 getRGB(float h, float s, float b){" +
"    vec3 c = vec3(h, s, b);" +
"    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);" +
"    rgb = rgb * rgb * (3.0 - 2.0 * rgb);" +
"    return c.z * mix(vec3(1.0), rgb, c.y);" +
"}" +

// ベクトル取得関数
"vec2 fromAngle(float t){ return vec2(cos(t), sin(t)); }" +

// 基本領域のはじっこに0がくるやつ（0～PI/n）
"vec2 dihedral_bound(vec2 p, float n){" +
"  float k = PI / n;" +
"  vec2 e1 = vec2(0.0, 1.0);" +
"  vec2 e2 = vec2(sin(k), -cos(k));" +
"  for(float i = 0.0; i < 99.0; i += 1.0){" +
"    if(i == n){ break; }" +
"    p -= 2.0 * min(dot(p, e1), 0.0) * e1;" +
"    p -= 2.0 * min(dot(p, e2), 0.0) * e2;" +
"  }" +
"  return p;" +
"}" +

// 星型
"float star(vec2 p, float r){" +
"  p = dihedral_bound(p, 5.0);" +
"  vec2 e = fromAngle(0.4 * PI);" +
"  return dot(p - vec2(r, 0.0), e);" +
"}" +

"void main(){" +
"  float mask = 0.0;" +

"  mask = step(0.98, length(gl_PointCoord * 2.0 - 1.0));" +

"  mask = mix(0.0, mask, clamp(floor(vStrokeWeight - 0.5),0.0,1.0));" +

"  if(mask > 0.98){" +
"    discard;" +
"  }" +
"  vec3 v = vPosition;" +

// -1.0～1.0に正規化する
"  vec2 p = (gl_PointCoord.xy - vec2(0.5)) * 2.0;" +

"  float t = uCount * TAU * 0.1;" +
"  p *= mat2(cos(t), -sin(t), sin(t), cos(t));" +
"  vec3 col;" +
"  float d = star(p, 1.0);" +
"  float hue = mod(uCount * 0.001, 1.0);" +
"  if(d < 0.0){ col = getRGB(hue, 1.0 + d * 3.2, 0.8); }else{ discard; }" +

"  gl_FragColor = vec4(col, 1.0);" +
"}";


function setup() {
	_gl = createCanvas(windowWidth, windowHeight, WEBGL);
	_SIZE = min(width, height);
	gl = _gl.GL;
	railShader = createShader(vsRail, fsRail);
	sleeperShader = createShader(vsSleeper, fsSleeper);
	trainShader = createShader(vsTrain, fsTrain);
	particleShader = createShader(vsParticle, fsParticle);
	particleShader.isPointShader = () => true; //
	_gl.userPointShader = particleShader; // userPointShaderを変更
	// これ複数用意する場合は切り替える必要があるのでdraw内で呼び出す必要が出てくるかも
	// strokeShaderの場合はshader()の中で切り替えてくれるけどpointShaderは備わってないので
	for(let i = 0; i < PARTICLE_NUM; i++){ velocities.push(createVector(0, 0, 0)); }

	strokeWeight(2);
	cur = createVector();
	prev = createVector();
	next = createVector();
	tang1 = createVector();
	tang2 = createVector();
	v2 = createVector();
	v3 = createVector();

	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);

	//objP = createVector(); // デバッグ的な
	//objV = createVector();
}

function draw() {
	let start = millis();

	background(0);
	strokeWeight(2);

	// ここのtang1-tang2のベクトルの大きさをdiffで割ったものがだいたいの曲率。
	// 一連の流れで最初のcount % PERIODのcountをcurrentCountでやってspeedを毎フレーム足す、
	// そのspeedを可変にするみたいな感じでいけるはず。曲率が小さいほど速くする感じ。曲率半径が逆数で与えられるのでそれを使う。
	// デフォルトを+1にして0～4くらいで変化させる感じ。
	const _SCALE = _SIZE * SCALE_FACTOR;
	_TRAIN_SIZE = _SCALE * SIZE_FACTOR;
	const prg = (currentCount % PERIOD) / PERIOD;
	const diff = 1 / PERIOD;
	setPos(_SCALE, prg, cur);
	setPos(_SCALE, prg + diff, next);
	setPos(_SCALE, prg - diff, prev);
	//tang1 = p5.Vector.sub(next, cur).normalize(); // 前方向
	tang1.set(next.x - cur.x, next.y - cur.y, next.z - cur.z).normalize(); // 前方向
	//tang2 = p5.Vector.sub(cur, prev).normalize();
	tang2.set(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z).normalize();
	//v2 = p5.Vector.sub(tang1, tang2); // 下方向
	v2.set(tang1.x - tang2.x, tang1.y - tang2.y, tang1.z - tang2.z); // 下方向
	// 曲率のファクターを使うためにnormalize前に大きさを取得する
	//if(count % 10 == 0){ console.log(v2.mag() * PERIOD); } // この値がだいたい40～100くらいで推移してる。つまり0.025～0.01か。で・・1000倍して25～10なので5で割るなどする。
	speed = speedFactor / (v2.mag() * PERIOD); // 曲率の逆数が曲率半径なのでそれに比例したスピードを与える感じね
	currentCount += speed; // これが位置に速度を足すみたいなイメージね
	v2.normalize();
	//v3 = p5.Vector.cross(tang1, v2); // 右方向
	// ここもいじらないとなぁ。たぶんどっちか。
	v3.set(tang1.y * v2.z - tang1.z * v2.y, tang1.z * v2.x - tang1.x * v2.z, tang1.x * v2.y - tang1.y * v2.x); // 右方向。合ってた。いぇい。
	// カメラワークは近づきすぎるとダメ・・球面上を動かすのもありかなぁ
	const c3 = 40 * sin(count * TAU * 0.001); // 手前方向
	const c2 = 120 + 30 * sin(count * TAU * 0.0003); // 上方向
	const c1 = 20 + 30 * sin(count * TAU * 0.0007); // 後ろ方向
	directionalLight(255, 200, 255, -v2.x, -v2.y, -v2.z);
  ambientLight(64);
	camera(cur.x + c3 * v3.x - c2 * v2.x - c1 * tang1.x, cur.y + c3 * v3.y - c2 * v2.y - c1 * tang1.y, cur.z + c3 * v3.z - c2 * v2.z - c1 * tang1.z,
         cur.x, cur.y, cur.z, v2.x, v2.y, v2.z);

	resetShader();
	shader(railShader);
	shader(railShader);
	railShader.setUniform("uDiff", 1.0 / RAIL_DETAIL);
	railShader.setUniform("uCount", count);
	noFill();
	stroke(255);
	rail(_SCALE, RAIL_DETAIL);

	resetShader();
	shader(sleeperShader);
	shader(sleeperShader);
	sleeperShader.setUniform("uDiff", 1.0 / RAIL_DETAIL);
	noFill();
	stroke(255);
	sleeper(_SCALE, RAIL_DETAIL / 2);

	resetShader();
	shader(trainShader);
	trainShader.setUniform("uProgress", prg);
	trainShader.setUniform("uDiff", 1.0 / RAIL_DETAIL);
	trainShader.setUniform("uSizeFactor", SIZE_FACTOR);
	fill(255);
	noStroke();
	train(_TRAIN_SIZE);


	resetShader();
	shader(particleShader);
	stroke(0);
	noFill();
	particleShader.setUniform("uCount", count);
	strokeWeight(_TRAIN_SIZE * POINTSIZE_FACTOR); // TRAIN_SIZEの2倍で。
	particles(PARTICLE_NUM);


	/*
  fill(255, 0, 0);
	translate(cur.x, cur.y, cur.z);
	box(10);
  */
	/*
	if(objF > 0){
		objV.z += 0.04;
		objP.add(objV);
		objF--;
	}else if(objF == 0){
		objP.set(cur.x - tang1.x * _TRAIN_SIZE * 0.5, cur.y - tang1.y * _TRAIN_SIZE * 0.5, cur.z - tang1.z * _TRAIN_SIZE * 0.5);
		objV.set(0, 0, 0);
		objF = 60;
	}
  fill(0, 255, 0);
	translate(objP.x, objP.y, objP.z);
	box(4);
	*/
	/*
	fill(0, 0, 255);
	translate(-tang1.x * 40+v2.x * 40,-tang1.y * 40+v2.y * 40,-tang1.z * 40+v2.z * 40);
	box(10);
	*/

	count++;
	//if(count % 60 == 0){ console.log((millis() - start) * 60 / 1000); }
}
/*
function setPos(_scale, t, v){
	let theta = t * TAU * 5;
	let x = _scale * sin(2 * theta);
	let y = _scale * sin(theta);
	v.set(x, y, 0);
}
*/
function setPos(_scale, t, v) {
	let theta = t * TAU * 5.0;
	let phi = t * TAU * 7.0;
	let r = 1.0 + 0.4 * sin(t * TAU * 8.0);
	r *= _scale;
	let x = r * sin(theta) * cos(phi);
	let y = r * sin(theta) * sin(phi);
	let z = r * cos(theta);
	v.set(x, y, z);
}

// レール
function rail(size, detail) {
	// gIdを用意
	const gId = `rail|${detail}`;
	if (!_gl.geometryInHash(gId)) {
		// ジオメトリー
		const _geom = new p5.Geometry();
		// ベクトルを用意
		let v = createVector();
		for (let k = 0; k < 2; k++) {
			for (let i = 0; i <= detail; i++) {
				_geom.vertices.push(v.set(k - 0.5, 0, i / detail).copy());
				if (i > 0) {
					_geom.edges.push([i - 1 + (detail + 1) * k, i + (detail + 1) * k]);
				}
			}
		}
		// 法線・辺計算
		_geom._edgesToVertices();

		// バッファ作成
		_gl.createBuffers(gId, _geom);
	}
	// 描画
	_gl.drawBuffersScaled(gId, size, size, size);
}

// 枕木
function sleeper(size, num) {
	// gIdを用意
	const gId = `sleeper|${num}`;
	if (!_gl.geometryInHash(gId)) {
		const _geom = new p5.Geometry();
		let v = createVector();
		for (let i = 0; i < num; i++) {
			_geom.vertices.push(v.set(-0.5, 0, i / num).copy());
			_geom.vertices.push(v.set(0.5, 0, i / num).copy());
			_geom.edges.push([2 * i, 2 * i + 1]);
			_geom.edges.push([2 * i + 1, 2 * i]);
		}
		// 法線・辺計算
		_geom._edgesToVertices();

		// バッファ作成
		_gl.createBuffers(gId, _geom);
	}
	// 描画
	_gl.drawBuffersScaled(gId, size, size, size);
}

// トレイン
function train(size) {
	const gId = `train`;
	// z軸方向をつぶしてy軸方向ちょっと細くした
	// z軸方向が青でx軸方向が赤でとかそんなイメージ

	if (!_gl.geometryInHash(gId)) {
		const _geom = new p5.Geometry();

		// 位置ベクトル
		let v = new p5.Vector();
		for (let z = 0.1; z > -0.3; z -= 0.2) {
			for (let x = -0.5; x < 1; x += 1) {
				for (let y = -0.5; y < 1; y += 1) {
					_geom.vertices.push(v.set(x, y, z).copy());
					// 背中を黒く、前の方を青く
					_geom.vertexColors.push(...getRGB(65, 100 * (x + 0.5), 500 * (z + 0.1)));
				}
			}
		}
		_geom.faces = [];
		let indexArray = [[0,1,2], [2,1,3], [1,5,3], [3,5,7], [3,7,2], [2,7,6], [0,4,1], [1,4,5], [5,4,7], [7,4,6], [4,0,6], [6,0,2]];
		//let indexArray = [[0,2,1], [2, 3, 1], [1, 3, 5],[3, 7, 5],[3, 2, 7],[2, 6, 7],[0, 1, 4],[1, 5, 4],[5, 7, 4],[7, 6, 4],[4, 6, 0],[6, 2, 0]];
		for (let f of indexArray) {
			_geom.faces.push(f);
		}

		// 法線・辺計算
		_geom._makeTriangleEdges()._edgesToVertices();
		_geom.computeNormals();

		// バッファ作成
		_gl.createBuffers(gId, _geom);
	}
	// 描画
	_gl.drawBuffersScaled(gId, size, size, size);
}

// パーティクル
function particles(num){
	const gId = `particle|${num}`;
	if(!_gl.geometryInHash(gId)){
		const _geom = new p5.Geometry();
		let v = createVector();
		// どうしようもないので最初は6000個全部オブジェクトで隠して見えないようにしておく。
		// 100個ずつ順繰りに飛ばしていく。最後はすべてサイクルに収まる感じ。
		let x, y, z;
		for(let i = 0; i < num; i++){
			positions[i * 3] = (x = cur.x - tang1.x * _TRAIN_SIZE * 0.5 * i);
			positions[i * 3 + 1] = (y = cur.y - tang1.y * _TRAIN_SIZE * 0.5 * i);
			positions[i * 3 + 2] = (z = cur.z - tang1.z * _TRAIN_SIZE * 0.5 * i);
			selfCounts.push(60 + floor(i / 30)); // 初めの100個は60,次は61,次は62,...って感じ。60より大きかったらcurをセットしてカウント減らすだけ。
			_geom.vertices.push(v.set(x, y, z).copy());
		}
		pBuf = _gl.createBuffers(gId, _geom);
	}
	//_gl._drawPoints(pBuf.model.vertices, _gl.immediateMode.buffers.point);
	drawParticles(); // 独自メソッドに切り替え
	// createShaderの中身が理解できるようになればattribute増やせるはずだから待ってて
}

// _bindBufferを毎フレーム呼ぶようにしたら改善したけど・・
// んー。
// そしてそれとは別にbufferSubDataも必要・・arrowsでは毎フレームの_bindBufferは必要なかったよね？？どうして？
// まあ、動くわけだが・・（それも高速に）・・腑に落ちないけどとりあえずこれで・・ね。
function drawParticles(){
	_gl._setPointUniforms(particleShader);
	//if(count == 0){
    _gl._bindBuffer(_gl.immediateMode.buffers.point, gl.ARRAY_BUFFER, _gl._vToNArray(pBuf.model.vertices), Float32Array, gl.DYNAMIC_DRAW);

    particleShader.enableAttrib(particleShader.attributes.aPosition, 3);
	//}else{
		setPositions();
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
	//}
	gl.drawArrays(gl.Points, 0, pBuf.model.vertices.length);
	particleShader.unbindShader();
}

function setPositions(){
	let selfCount, p, dBack, dx, dy;
	p = createVector();
	for(let i = 0; i < PARTICLE_NUM; i++){
		// selfCounts[i]が60より大きかったらcurをセットしてカウント減らす
		// 60だったら位置をオブジェクト後方のどこかにセットする（グローバルの位置指示関数を使う）、速度も0でリセット
		// 60以下だったら速度になんか足してそれで位置更新してカウント減らす
		// もろもろ終わって0だったらカウントを60に戻す
		if(selfCounts[i] > 60){
			positions[i * 3] = cur.x;
			positions[i * 3 + 1] = cur.y;
			positions[i * 3 + 2] = cur.z;
			selfCounts[i]--;
			continue;
		}
		if(selfCounts[i] === 60){
			// setup.
			dBack = _TRAIN_SIZE * 0.5;
			dx = (Math.random() - 0.5) * 2.0 * _TRAIN_SIZE * 0.6; // v3に掛ける。手前方向
			dy = (Math.random() - 0.5) * 2.0 * _TRAIN_SIZE * 0.2; // v2に掛ける。下方向
			p.set(cur.x - tang1.x * dBack - v3.x * dx - v2.x * dy,
						cur.y - tang1.y * dBack - v3.y * dx - v2.y * dy,
						cur.z - tang1.z * dBack - v3.z * dx - v2.z * dy);
			positions[i * 3] = p.x;
			positions[i * 3 + 1] = p.y;
			positions[i * 3 + 2] = p.z;
			dx *= 0.5;
			dy *= 0.5;
			velocities[i].set(-tang1.x * dx + v2.x * dy, -tang1.y * dx + v2.y * dy, -tang1.z * dx + v2.z * dy);
			velocities[i].mult(1.0 - 0.3 * Math.random());
		}
		velocities[i].x += 0.1 * v2.x;
		velocities[i].y += 0.1 * v2.y;
		velocities[i].z += 0.1 * v2.z; // ここもファクターでなんとかするべきかも
		positions[i * 3 + 2] += velocities[i].z;
		selfCounts[i]--;
		if(selfCounts[i] === 0){ selfCounts[i] = 60; }
	}
}

// たとえば水色欲しいならgetRGB(55, 100, 100)でおけ
function getRGB(h, s, b, a = 1, max_h = 100, max_s = 100, max_b = 100) {
	let hue = h * 6 / max_h; // We will split hue into 6 sectors.
	let sat = s / max_s;
	let val = b / max_b;

	let RGB = [];

	if (sat === 0) {
		RGB = [val, val, val]; // Return early if grayscale.
	} else {
		let sector = Math.floor(hue);
		let tint1 = val * (1 - sat);
		let tint2 = val * (1 - sat * (hue - sector));
		let tint3 = val * (1 - sat * (1 + sector - hue));
		switch (sector) {
			case 1:
				RGB = [tint2, val, tint1];
				break;
			case 2:
				RGB = [tint1, val, tint3];
				break;
			case 3:
				RGB = [tint1, tint2, val];
				break;
			case 4:
				RGB = [tint3, tint1, val];
				break;
			case 5:
				RGB = [val, tint1, tint2];
				break;
			default:
				RGB = [val, tint3, tint1];
				break;
		}
	}
	return [...RGB, a];
}

/*
let e3,e1,e2,gl;

function setup() {
  createCanvas(400, 400, WEBGL);
  e3 = createVector(1,1,2).normalize(); // これがz軸
  e1 = createVector(-1,1,0).normalize(); // これがx軸
  e2 = createVector(-1,-1,1).normalize(); // これがy軸
  gl = this._renderer.GL; // 本家のwebglの3Dコンテクスト
  gl.enable(gl.DEPTH_TEST);
}

function draw() {
  background(220);

  //camera(-80,-80,-160,0,0,0,e2.x,e2.y,e2.z);

  strokeWeight(2);
  stroke(0);
  line(-160,-160,-320,160,160,320);
  applyMatrix(e1.x,e1.y,e1.z,0,e2.x,e2.y,e2.z,0,e3.x,e3.x,e3.z,0,0,0,0,1);
  noStroke();
  translate(0,0,-150);
  rotateZ(frameCount/40);
  for(let i = 0; i < 10; i++){
    translate(0,0,30);
    fill(i*25,0,255);
    torus(30,3,5);
  }
}
*/
