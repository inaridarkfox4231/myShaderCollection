// 何作るの？
// cubewaveだって。お遊びよ。練習みたいな。

// んー
// どうすればいいのやら

// 121x121でやろうとしたらメモリがアウトになった
// やっぱ多すぎるとエラー起こすっぽいな
// 用心しよ

// なんだ
// 2つ以上にわけたら行けた
// なるほどね
// せっかくだから（？）4つに分けるか
// うん、まあまあね
// もっと工夫する必要はあるしいろんなバリエーションもあるでしょう

let gl, _gl;

let myFillShader;
let count = 0;

let GRID_NUM = 121;

let vsFill =
"precision mediump float;" +
"precision mediump int;" +

"uniform mat4 uViewMatrix;" +

"uniform bool uUseLighting;" +

"uniform int uAmbientLightCount;" +
"uniform vec3 uAmbientColor[5];" +

"uniform float uGridNum;" +
"uniform float uCount;" +

"uniform int uDirectionalLightCount;" +
"uniform vec3 uLightingDirection[5];" +
"uniform vec3 uDirectionalDiffuseColors[5];" +
"uniform vec3 uDirectionalSpecularColors[5];" +

"const float specularFactor = 2.0;" +
"const float diffuseFactor = 0.73;" +
"const float TAU = 6.28318;" +

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
"varying vec3 vGrid;" +

"float calcHeight(vec2 p){" +
"  float z;" +
"  z += sin(4.0 * TAU * (uCount * 0.003 + dot(p - vec2(0.5, 0.0), p - vec2(0.5, 0.0)))) * 16.0 * (0.5 + 0.5 * cos(uCount * 0.005));" +
"  z += sin(4.0 * TAU * (uCount * 0.003 + dot(p - vec2(-0.5, 0.0), p - vec2(-0.5, 0.0)))) * 16.0 * (0.5 + 0.5 * cos(uCount * 0.005));" +
"  z += sin(4.0 * TAU * (uCount * 0.003 + dot(p - vec2(0.0, 0.5), p - vec2(0.0, 0.5)))) * 16.0 * (0.5 + 0.5 * cos(uCount * 0.005));" +
"  z += sin(4.0 * TAU * (uCount * 0.003 + dot(p - vec2(0.0, -0.5), p - vec2(0.0, -0.5)))) * 16.0 * (0.5 + 0.5 * cos(uCount * 0.005));" +
"  return z * 0.25;" +
"}" +

"void main(void){" +
// 位置の変更はここでpのところをいじる
"  vec3 p = aPosition;" +
// GRID_NUMはuGridNumで入ってて、まず
"  float L = (uGridNum - 1.0) * 0.5;" +
"  vec2 id = floor(p.xy + 0.5);" +
// たとえば31なら-15～15のあれになるからそれで引く
"  p.xy -= L;" +
"  vec2 gridUV = (id - L) / L;" + // -1～1の値
// これを元にzを決める
"  p.z += calcHeight(gridUV);" +
"  vGrid = vec3(gridUV, (p.z + 16.0) / 32.0);" +
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

"const float TAU = 6.28318;" +

"uniform vec4 uMaterialColor;" +
"uniform vec4 uTint;" +
"uniform sampler2D uSampler;" +
"uniform bool isTexture;" +
"uniform bool uEmissive;" +

"uniform float uCount;" +

"varying highp vec2 vVertTexCoord;" +
"varying vec3 vDiffuseColor;" +
"varying vec3 vSpecularColor;" +
"varying vec4 vVertexColor;" +
"varying vec3 vGrid;" + // これで色とか変えたいかも

// getRGB,参上！
"vec3 getRGB(float h, float s, float b){" +
"    vec3 c = vec3(h, s, b);" +
"    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);" +
"    rgb = rgb * rgb * (3.0 - 2.0 * rgb);" +
"    return c.z * mix(vec3(1.0), rgb, c.y);" +
"}" +

"void main(void) {" +
"  vec4 col = vVertexColor;" +
"  col.rgb = getRGB(vGrid.z, 0.7 + 0.35 * cos(8.0 * TAU * length(vGrid.xy) - uCount * 0.1), 1.0);" +
"  col.rgb = col.rgb * vDiffuseColor + vSpecularColor;" +
"  gl_FragColor = col;" +
"}";

function setup(){
  _gl = createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1);
  gl = this._renderer.GL;
  myFillShader = createShader(vsFill, fsFill);
	shader(myFillShader);
	noStroke();

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
}

function draw(){
  let start = millis();

  const _SIZE = min(width, height);

  background(0);
  directionalLight(255, 255, 255, 0, 0, 1);
  ambientLight(64);
  rotateX(PI/3);
	rotateZ(frameCount * 0.005);

  // まずfillShader
	myFillShader.setUniform("uGridNum", GRID_NUM);
	myFillShader.setUniform("uCount", count);
  fill(255);
	const half = floor(GRID_NUM / 2);
	myCube(_SIZE * 0.01, 0, half, 0, half);
  myCube(_SIZE * 0.01, half, GRID_NUM, 0, half);
	myCube(_SIZE * 0.01, 0, half, half, GRID_NUM);
  myCube(_SIZE * 0.01, half, GRID_NUM, half, GRID_NUM);

  count++;
  let end = millis();
  //if(count % 60 == 0){ console.log((end-start)*60/1000); }
}

// 複数のキューブを作る
// 想定してるのは55x55の3025個で
// 中心からなんか波打たせる感じ
function myCube(size, nXleft, nXright, nYleft, nYright){
  const gId = `myBox|${nXleft}|${nXright}|${nYleft}|${nYright}`;

  if(!this._renderer.geometryInHash(gId)){
    const myCubeGeom = new p5.Geometry();

    // 位置ベクトル
    let v = new p5.Vector();
		let index = 0;
		let indexArray = [[0,1,2], [2,1,3], [1,5,3], [3,5,7], [3,7,2], [2,7,6], [0,4,1], [1,4,5], [5,4,7], [7,4,6], [4,0,6], [6,0,2]];
		for(let idX = nXleft; idX < nXright; idX++){
			for(let idY = nYleft; idY < nYright; idY++){
        for(let z = 0.499; z > -1; z -= 0.998){ // こうしないとうまくずれてくれないのよね
          for(let x = -0.499; x < 1; x += 0.998){
            for(let y = -0.499; y < 1; y += 0.998){
              myCubeGeom.vertices.push(v.set(x + idX, y + idY, z).copy());
              myCubeGeom.vertexColors.push(...[x + 0.5, y + 0.5, z + 0.5, 1]);
            }
          }
        }
				for(let w of indexArray){
					myCubeGeom.faces.push([w[0] + index, w[1] + index, w[2] + index]);
				}
				index += 8;
			}
		}

    // 反時計回り？
    //myCubeGeom.faces.push(...[[0,1,2], [2,1,3], [1,5,3], [3,5,7], [3,7,2], [2,7,6],
    //                          [0,4,1], [1,4,5], [5,4,7], [7,4,6], [4,0,6], [6,0,2]]);
    // 法線・辺計算
    myCubeGeom._makeTriangleEdges()._edgesToVertices();
    myCubeGeom.computeNormals();

    // バッファ作成
    this._renderer.createBuffers(gId, myCubeGeom);
  }
  // 描画
  this._renderer.drawBuffersScaled(gId, size, size, size);
}
