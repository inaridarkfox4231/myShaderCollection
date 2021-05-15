// 衝突判定を。

// 参考にしているのは古都ことさんのブログ：https://sbfl.net/blog/2017/12/03/javascript-collision/
// です。以前STGもどきを作ろうとしたとき参考にしたものです。
// 普通にやると遅いので・・（描画部分が主に）
// それどうにかしようとかそういう企画。

// もっとも1000個の衝突判定とって何するのかって話ではあるけどね・・・・
// ぶつけるなら反射とかするべきだし、でもそれ実装したらえらいことになるでしょ。

// うぉぉぉ・・クワドツリーのレベルを3から2に下げたらクッソ速くなったやんけ・・・
// やっぱこれ構成負荷相当大きいのね・・
// こういう知見は有用よね。

let mySystem;
let _SIZE;
let _MIN_RADIUS;
let _MAX_RADIUS;
const UNIT_NUM = 1000;

let count = 0;

let _gl, gl;
let pBuf;
let pointData = new Float32Array(UNIT_NUM * 3); // new Float32Array(個数*3)なので後で決める
// 第3引数で大きさと色を調整する。大きさについて0～1で動かす。最小サイズと最大サイズを決めておいてその間の割合。？？
// attribute問題ぇ・・・
// 大きさを段階に分けちゃう。そうすれば方向・・あっちも大きさ離散的だから問題ない。
// とりあえず大きさを10段階、色を2段階にして20段階でスケーリング、0～1で方向。これでいく。
// まあいい。そのうちp5見限る必要出てきそう。
let myPointShader;
let vsPoint =
"precision mediump float;" +
// ↑これがないと両方でuCount使えなくてエラーになる
"attribute vec3 aPosition;" +
"uniform float uPointSize;" +
"uniform float uCount;" +
"uniform float uMinSize;" +
"uniform float uMaxSize;" +
"const float TAU = 6.28318;" +
"const float PI = 3.14159;"+
"varying float vStrokeWeight;" +
"varying vec3 vPosition;" +
"varying vec4 vMaterialColor;" +
"varying float vDirection;" +
"varying float vColId;" +
"uniform mat4 uModelViewMatrix;" +
"uniform mat4 uProjectionMatrix;" +
"void main() {" +
"  vec3 p = aPosition;" +

// 点の位置をいじるパート
"  float data = floor(p.z);" +
"  float sizeId = mod(data, 10.0);" +
"  float size = uMinSize + sizeId * 0.1 * (uMaxSize - uMinSize);" +
"  vColId = (data - sizeId) * 0.1;" +
"  vDirection = fract(p.z) * TAU;" + // 方向情報
"  p.z = 0.0;" + // 方向情報取り出したら消す

// 設定
"  vec4 positionVec4 =  vec4(p, 1.0);" +

"  gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;" +

// サイズをいじる
"  gl_PointSize = uPointSize * size;" +
"  vStrokeWeight = uPointSize * size;" +
"}";

let fsPoint =
"precision mediump float;" +
"precision mediump int;" +
"uniform vec4 uMaterialColor;" +
"uniform float uCount;" +
"const float TAU = 6.28318;" +
"varying float vStrokeWeight;" +
"varying vec3 vPosition;" +
"varying float vDirection;" +
"varying float vColId;" +
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
"  vec3 col = getRGB(0.0, vColId, 1.0);" + // vColIdが1.0なら赤、みたいな。
//"  gl_FragColor = vec4(1.0);" +
"  gl_FragColor = vec4(col, 1.0);" +
"}";

function setup() {
	_gl = createCanvas(windowWidth, windowHeight, WEBGL);
	_SIZE = min(width, height);
	_MIN_RADIUS = _SIZE * 0.009;
	_MAX_RADIUS = _SIZE * 0.024;
	mySystem = new System();

	gl = _gl.GL;
	myPointShader = createShader(vsPoint, fsPoint);
	myPointShader.isPointShader = () => true;
	_gl.userPointShader = myPointShader;
}

function draw() {
	let start = millis();
	background(128, 128, 255);
	mySystem.update();
	mySystem.collisionCheck();
	mySystem.draw();
	count++;
	if(count % 30 == 0){ console.log((millis()-start)*60/1000); }
}

class System{
	constructor(){
		this.unitArray = new SimpleCrossReferenceArray();
    this._qTree = new LinearQuadTreeSpace(width, height, 2); // え？？2にしたらめっちゃ速くなった？？
		// あー、なるほど・・クワドツリーの構成負荷の方が大きかったか・・
    this._detector = new CollisionDetector();
		this.prepareUnits();
	}
	prepareUnits(){
		let x, y, radiusId, speed, direction;
		for(let i = 0; i < UNIT_NUM; i++){
			x = width * (0.03 + 0.94 * Math.random());
			y = height * (0.03 + 0.94 * Math.random());
			radiusId = Math.floor(Math.random() * 10);
			speed = _SIZE * (0.003 + 0.007 * Math.random());
			direction = TAU * Math.random();
			this.unitArray.add(new Unit(i, x, y, speed * cos(direction), speed * sin(direction), radiusId));
		}
	}
	update(){
		this.unitArray.loop("update");
	}
  collisionCheck(){
    //return;
    // やることは簡単。_qTreeをクリアして、actor放り込んで、hitTestするだけ。
    this._qTree.clear();
		for(let u of this.unitArray){
			this._qTree.addActor(u);
		}
    this._hitTest();
  }
	draw(){
		resetShader();
		this.unitArray.loop("draw");
		shader(myPointShader);
		noFill();
		stroke(0);
		strokeWeight(2);
		myPointShader.setUniform("uMinSize", _MIN_RADIUS);
		myPointShader.setUniform("uMaxSize", _MAX_RADIUS);
		myPoints(UNIT_NUM);
	}
  _hitTest(currentIndex = 0, objList = []){
    // 衝突判定のメインコード。これと、このあとセルごとの下位関数、更にvalidationを追加して一応Systemは完成とする。
  	const currentCell = this._qTree.data[currentIndex];

    // 現在のセルの中と、衝突オブジェクトリストとで
    // 当たり判定を取る。
    this._hitTestInCell(currentCell, objList);

    // 次に下位セルを持つか調べる。
    // 下位セルは最大4個なので、i=0から3の決め打ちで良い。
    let hasChildren = false;
    for(let i = 0; i < 4; i++) {
      const nextIndex = currentIndex * 4 + 1 + i;

      // 下位セルがあったら、
      const hasChildCell = (nextIndex < this._qTree.data.length) && (this._qTree.data[nextIndex] !== null);
      hasChildren = hasChildren || hasChildCell;
      if(hasChildCell) {
        // 衝突オブジェクトリストにpushして、
        objList.push(...currentCell);
        // 下位セルで当たり判定を取る。再帰。
        this._hitTest(nextIndex, objList);
      }
    }
    // 終わったら追加したオブジェクトをpopする。
    if(hasChildren) {
      const popNum = currentCell.length;
      for(let i = 0; i < popNum; i++) {
        objList.pop();
      }
    }
  }
  _hitTestInCell(cell, objList) {
    // セルの中。総当たり。
    const length = cell.length;
    const cellColliderCahce = new Array(length); // globalColliderのためのキャッシュ。
    if(length > 0){ cellColliderCahce[0] = cell[0].collider; }

    for(let i = 0; i < length - 1; i++){
      const obj1 = cell[i];
      const collider1  = cellColliderCahce[i]; // キャッシュから取ってくる。
      for(let j = i + 1; j < length; j++){
        const obj2 = cell[j];

        // キャッシュから取ってくる。
        // ループ初回は直接取得してキャッシュに入れる。
        let collider2;
        if(i === 0) {
          collider2 = obj2.collider;
          cellColliderCahce[j] = collider2;
        }else{
          collider2 = cellColliderCahce[j];
        }
        // Cahceへの代入までスルーしちゃうとまずいみたい
        // ここでobj1, obj2のcollisionFlagでバリデーションかけてfalseならcontinue.
        //if(!this.validation(obj1.collisionFlag, obj2.collisionFlag)){ continue; }
        const hit = this._detector.detectCollision(collider1, collider2);

        if(hit) {
          // 両方ともvanishがfalseならば判定する。
          if(!obj1.vanish && !obj2.vanish){
            obj1.hit(obj2);
            obj2.hit(obj1);
          }
        }
      }
    }

    // 衝突オブジェクトリストと。
    const objLength = objList.length;
    const cellLength = cell.length;

    // これはもう最初に一通りobjListとcellをさらってplayerもenemyもいなければそのままスルー・・
    for(let i = 0; i < objLength; i++) {
      const obj = objList[i];
      const collider1 = obj.collider; // 直接取得する。
      for(let j = 0; j < cellLength; j++) {
        const cellObj = cell[j];

        // objとcellobjの性質からバリデーションかけてfalseならcontinue.
        //if(!this.validation(obj.collisionFlag, cellObj.collisionFlag)){ continue; }

        const collider2 = cellColliderCahce[j]; // キャッシュから取ってくる。
        const hit = this._detector.detectCollision(collider1, collider2);

        if(hit) {
          if(!obj.vanish && !cellObj.vanish){
            obj.hit(cellObj);
            cellObj.hit(obj);
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------- //
class Unit{
	constructor(index, x, y, vx, vy, radiusId){
		/* 位置と速度とcollider */
		this.index = index;
		this.position = createVector(x, y);
		this.velocity = createVector(vx, vy);
		this.radiusId = radiusId;
		this.radius = getRadius(radiusId);
		this.collider = new CircleCollider(x, y, this.radius);
		this.colFrag = false;
	}
	update(){
		/* 直進、壁で反射. colliderもupdateするのを忘れずに */
		this.colFrag = false; // フラグの初期化
	  const _x = this.position.x + this.velocity.x;
		const _y = this.position.y + this.velocity.y;
		if(_x < this.radius || _x > width - this.radius){ this.velocity.x *= -1; }
		if(_y < this.radius || _y > height - this.radius){ this.velocity.y *= -1; }
		this.position.add(this.velocity);
		this.collider.update(this.position.x, this.position.y);
	}
	draw(){
		/* 円を描く */
		//if(this.colFrag){ fill(255,0,0); }else{ fill(255); }
		//circle(this.position.x, this.position.y, this.radius * 2);
		let colId = (this.colFrag ? 1 : 0);
		let dir = this.velocity.heading();
		if(dir < 0){ dir += TAU; }
		pointData[this.index * 3 + 2] = (dir / TAU) + this.radiusId + 10 * colId;
		pointData[this.index * 3] = this.position.x - width * 0.5;
		pointData[this.index * 3 + 1] = this.position.y - height * 0.5;
	}
	hit(obj){
		this.colFrag = true;
	}
}

function getRadius(id){
	return _MIN_RADIUS + id * 0.1 * _MAX_RADIUS;
}

// ---------------------------------------------------------------------------------------- //
// ここからしばらく衝突判定関連
// ---------------------------------------------------------------------------------------- //
// quadTree関連。
class LinearQuadTreeSpace {
  constructor(_width, _height, level){
    this._width = _width;
    this._height = _height;
    this.data = [null];
    this._currentLevel = 0;

    // 入力レベルまでdataを伸長する。
    while(this._currentLevel < level){
      this._expand();
    }
  }

  // dataをクリアする。
  clear() {
    this.data.fill(null);
  }

  // 要素をdataに追加する。
  // 必要なのは、要素と、レベルと、レベル内での番号。
  _addNode(node, level, index){
    // オフセットは(4^L - 1)/3で求まる。
    // それにindexを足せば線形四分木上での位置が出る。
    const offset = ((4 ** level) - 1) / 3;
    const linearIndex = offset + index;

    // もしdataの長さが足りないなら拡張する。
    while(this.data.length <= linearIndex){
      this._expandData();
    }

    // セルの初期値はnullとする。
    // しかし上の階層がnullのままだと面倒が発生する。
    // なので要素を追加する前に親やその先祖すべてを
    // 空配列で初期化する。
    let parentCellIndex = linearIndex;
    while(this.data[parentCellIndex] === null){
      this.data[parentCellIndex] = [];

      parentCellIndex = Math.floor((parentCellIndex - 1) / 4);
      if(parentCellIndex >= this.data.length){
        break;
      }
    }

    // セルに要素を追加する。
    const cell = this.data[linearIndex];
    cell.push(node);
  }

  // Actorを線形四分木に追加する。
  // Actorのコリジョンからモートン番号を計算し、
  // 適切なセルに割り当てる。
  addActor(actor){
    const collider = actor.collider;

    // モートン番号の計算。
    const leftTopMorton = this._calc2DMortonNumber(collider.left, collider.top);
    const rightBottomMorton = this._calc2DMortonNumber(collider.right, collider.bottom);

    // 左上も右下も-1（画面外）であるならば、
    // レベル0として扱う。
    // なおこの処理には気をつける必要があり、
    // 画面外に大量のオブジェクトがあるとレベル0に
    // オブジェクトが大量配置され、当たり判定に大幅な処理時間がかかる。
    // 実用の際にはここをうまく書き換えて、あまり負担のかからない
    // 処理に置き換えるといい。
    if(leftTopMorton === -1 && rightBottomMorton === -1){
      this._addNode(actor, 0, 0);
      return;
    }

    // 左上と右下が同じ番号に所属していたら、
    // それはひとつのセルに収まっているということなので、
    // 特に計算もせずそのまま現在のレベルのセルに入れる。
    if(leftTopMorton === rightBottomMorton){
      this._addNode(actor, this._currentLevel, leftTopMorton);
      return;
    }

    // 左上と右下が異なる番号（＝境界をまたいでいる）の場合、
    // 所属するレベルを計算する。
    const level = this._calcLevel(leftTopMorton, rightBottomMorton);

    // そのレベルでの所属する番号を計算する。
    // モートン番号の代表値として大きい方を採用する。
    // これは片方が-1の場合、-1でない方を採用したいため。
    const larger = Math.max(leftTopMorton, rightBottomMorton);
    const cellNumber = this._calcCell(larger, level);

    // 線形四分木に追加する。
    this._addNode(actor, level, cellNumber);
  }
  // addActorsは要らない。個別に放り込む。

  // 線形四分木の長さを伸ばす。
  _expand(){
    const nextLevel = this._currentLevel + 1;
    const length = ((4 ** (nextLevel + 1)) - 1) / 3;

    while(this.data.length < length) {
      this.data.push(null);
    }

    this._currentLevel++;
  }

  // 16bitの数値を1bit飛ばしの32bitにする。
  _separateBit32(n){
    n = (n|(n<<8)) & 0x00ff00ff;
    n = (n|(n<<4)) & 0x0f0f0f0f;
    n = (n|(n<<2)) & 0x33333333;
    return (n|(n<<1)) & 0x55555555;
  }

  // x, y座標からモートン番号を算出する。
  _calc2DMortonNumber(x, y){
    // 空間の外の場合-1を返す。
    if(x < 0 || y < 0){
      return -1;
    }

    if(x > this._width || y > this._height){
      return -1;
    }

    // 空間の中の位置を求める。
    const xCell = Math.floor(x / (this._width / (2 ** this._currentLevel)));
    const yCell = Math.floor(y / (this._height / (2 ** this._currentLevel)));

    // x位置とy位置をそれぞれ1bit飛ばしの数にし、
    // それらをあわせてひとつの数にする。
    // これがモートン番号となる。
    return (this._separateBit32(xCell) | (this._separateBit32(yCell)<<1));
  }

  // オブジェクトの所属レベルを算出する。
  // XORを取った数を2bitずつ右シフトして、
  // 0でない数が捨てられたときのシフト回数を採用する。
  _calcLevel(leftTopMorton, rightBottomMorton){
    const xorMorton = leftTopMorton ^ rightBottomMorton;
    let level = this._currentLevel - 1;
    let attachedLevel = this._currentLevel;

    for(let i = 0; level >= 0; i++){
      const flag = (xorMorton >> (i * 2)) & 0x3;
      if(flag > 0){
        attachedLevel = level;
      }

      level--;
    }

    return attachedLevel;
  }

  // 階層を求めるときにシフトした数だけ右シフトすれば
  // 空間の位置がわかる。
  _calcCell(morton, level){
    const shift = ((this._currentLevel - level) * 2);
    return morton >> shift;
  }
}

// ---------------------------------------------------------------------------------------- //
// collider関連。
// 今回は全部円なので円判定のみ。
// unitの場合は最初に作ったものをinitializeや毎フレームのアップデートで変えていく感じ（余計に作らない）
// 衝突判定のタイミングはactionの直前、behaviorの直後にする。

class Collider{
	constructor(){
		this.type = "";
    this.index = Collider.index++;
	}
}

Collider.index = 0;

// circle.
// 今のinFrameの仕様だと端っこにいるときによけられてしまう、これは大きくなるとおそらく無視できないので、
// レクトと画面との共通を取った方がよさそう。その理屈で行くとプレイヤーが端っこにいるときにダメージ受けないはずだが、
// プレイヤーは毎フレーム放り込んでたので問題が生じなかったのでした。
// たとえば今の場合、敵が体の半分しか出てない時に倒せない。
// leftとtopは0とMAX取る。これらは<AREA_WIDTHかつ<AREA_HEIGHTでないといけない。
// rightとbottomはそれぞれw-1とh-1でMIN取る。これらは>0でないといけない。
class CircleCollider extends Collider{
	constructor(x, y, r){
    super();
		this.type = "circle";
		this.x = x;
		this.y = y;
		this.r = r;
	}
	get left(){ return Math.max(0, this.x - this.r); }
	get right(){ return Math.min(width, this.x + this.r); }
	get top(){ return Math.max(0, this.y - this.r); }
	get bottom(){ return Math.min(height, this.y + this.r); }
  inFrame(){
    // trueを返さなければTreeには入れない。
    const flag1 = (this.left < AREA_WIDTH && this.top < AREA_HEIGHT);
    const flag2 = (this.right > 0 && this.bottom > 0);
    return flag1 && flag2;
  }
	update(x, y, r = -1){
		this.x = x;
		this.y = y;
		if(r > 0){ this.r = r; } // rをupdateしたくないときは(x, y)と記述してくださいね！それでスルーされるので！
	}
}

class CollisionDetector {
  // 当たり判定を検出する。
  detectCollision(collider1, collider2) {
    if(collider1.type == 'circle' && collider2.type == 'circle'){
      return this.detectCircleCollision(collider1, collider2);
    }
    // レーザー廃止
		return false;
  }
  // 円形同士
  detectCircleCollision(circle1, circle2){
    const distance = Math.sqrt((circle1.x - circle2.x) ** 2 + (circle1.y - circle2.y) ** 2);
    const sumOfRadius = circle1.r + circle2.r;
    return (distance < sumOfRadius);
  }
  // レーザー廃止
}

// ---------------------------------------------------------------------------------------- //
// Simple Cross Reference Array.
// 改造する前のやつ。

class SimpleCrossReferenceArray extends Array{
	constructor(){
    super();
	}
  add(element){
    this.push(element);
    element.belongingArray = this; // 所属配列への参照
  }
  addMulti(elementArray){
    // 複数の場合
    elementArray.forEach((element) => { this.add(element); })
  }
  remove(element){
    let index = this.indexOf(element, 0);
    this.splice(index, 1); // elementを配列から排除する
  }
  loop(methodName){
		if(this.length === 0){ return; }
    // methodNameには"update"とか"display"が入る。まとめて行う処理。
		for(let i = 0; i < this.length; i++){
			this[i][methodName]();
		}
  }
	loopReverse(methodName){
		if(this.length === 0){ return; }
    // 逆から行う。排除とかこうしないとエラーになる。もうこりごり。
		for(let i = this.length - 1; i >= 0; i--){
			this[i][methodName]();
		}
  }
	clear(){
		this.length = 0;
	}
}

function myPoints(num){
  const gId = `myPoints|${num}`;
  if(!_gl.geometryInHash(gId)){
    const _geom = new p5.Geometry();
    let v = createVector();
    for(let i = 0; i < num; i++){
      // 流れ的に最初にここにくるときにすでに個別のdrawでdataの中身を埋めているので
      // ここでなんかpointDataに入れちゃうとまずい。だからここでdataはいじれない。
      _geom.vertices.push(v.set(0, 0, 0).copy());
    }
    pBuf = _gl.createBuffers(gId, _geom);
  }
  // これでいいんだ
  myDrawPoints();
}

// 逐次更新
function myDrawPoints(){
  _gl._setPointUniforms(myPointShader);

  _gl._bindBuffer(_gl.immediateMode.buffers.point, gl.ARRAY_BUFFER, _gl._vToNArray(pBuf.model.vertices), Float32Array, gl.DYNAMIC_DRAW);
  myPointShader.enableAttrib(myPointShader.attributes.aPosition, 3);
  //setPosition();
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, pointData);
  gl.drawArrays(gl.Points, 0, pBuf.model.vertices.length);
  myPointShader.unbindShader();
}
