// 衝突判定を。

// 参考にしているのは古都ことさんのブログ：https://sbfl.net/blog/2017/12/03/javascript-collision/
// です。以前STGもどきを作ろうとしたとき参考にしたものです。
// 普通にやると遅いので・・（描画部分が主に）
// それどうにかしようとかそういう企画。

// もっとも1000個の衝突判定とって何するのかって話ではあるけどね・・・・
// ぶつけるなら反射とかするべきだし、でもそれ実装したらえらいことになるでしょ。

// レベル3でバッファ不使用で1000個：0.53～0.6くらい
// レベル2でバッファ不使用で1000個：0.44～0.55くらい
// このようにレベル2の方が速いんだけど、バッファ使った方が速いのよ。
// やっぱバッファはすごい・・・

let mySystem;
let _SIZE;
const UNIT_NUM = 1000;

let count = 0;

function setup() {
	createCanvas(800, 640);
	_SIZE = min(width, height);
	noStroke();
	mySystem = new System();
}

function draw() {
	let start = millis();
	background(128,128,255);
	mySystem.update();
	mySystem.collisionCheck();
	mySystem.draw();
	count++;
	if(count % 30 == 0){ console.log((millis()-start)*60/1000); }
}

class System{
	constructor(){
		this.unitArray = new SimpleCrossReferenceArray();
    this._qTree = new LinearQuadTreeSpace(width, height, 2);
    this._detector = new CollisionDetector();
		this.prepareUnits();
	}
	prepareUnits(){
		let x, y, radius, speed, direction;
		for(let i = 0; i < UNIT_NUM; i++){
			x = width * (0.03 + 0.94 * Math.random());
			y = height * (0.03 + 0.94 * Math.random());
			radius = _SIZE * (0.009 + 0.015 * Math.random());
			speed = _SIZE * (0.003 + 0.007 * Math.random());
			direction = TAU * Math.random();
			this.unitArray.add(new Unit(x, y, speed * cos(direction), speed * sin(direction), radius));
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
		this.unitArray.loop("draw");
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
	constructor(x, y, vx, vy, radius){
		/* 位置と速度とcollider */
		this.position = createVector(x, y);
		this.velocity = createVector(vx, vy);
		this.collider = new CircleCollider(x, y, radius);
		this.radius = radius;
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
		if(this.colFrag){ fill(255,0,0); }else{ fill(255); }
		circle(this.position.x, this.position.y, this.radius * 2);
	}
	hit(obj){
		this.colFrag = true;
	}
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
