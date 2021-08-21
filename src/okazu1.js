
// 最近傍探索を最適化しない限りどうしようもないわね

let points = [];

function setup() {
	createCanvas(800, 800);
	colorMode(HSB, 360, 100, 100, 100);
	blendMode(ADD);
	background(13);

	let start = millis();
	for(let i=0; i<30; i++){
	let x = random(-0.1, 1.1)*width;
	let y = random(-0.1, 1.1)*height;
	let rad = random(10, 200);
	let aa = TAU / int(rad);
	for(let a=0; a<TAU; a+=aa){
		let px = x + rad * Math.cos(a);
		let py = y + rad * Math.sin(a);
		points.push(createVector(px, py));
	}
	noStroke();
	//fill(random(150, 260),random(70, 100),random(90, 100), 50);
	fill(255,50);
	circle(x, y, 5);
}

	for (let i = 0; i < points.length; i++) {
		let p1 = points[i];
		for (let j = points.length - 1; j >= 0; j--) {
			let p2 = points[j];
			let dis = Math.sqrt((p1.x-p2.x)*(p1.x-p2.x)+(p1.y-p2.y)*(p1.y-p2.y));
			//let dis = dist(p1.x, p1.y, p2.x, p2.y);
			if (dis < 40 && i < j) {
				//stroke(random(150, 299),random(70, 100),random(90, 100), random(1, 20));
				stroke(255,10);
				line(p1.x, p1.y, p2.x, p2.y);
			}
		}
	}
	let end = millis();
	console.log((end-start)/1000); // 5.25685（distの場合）、0.35061（Math.sqrtの場合）
	// ただ0.35だと1フレームの限界を超えているので
	// もうちょっと・・ねぇ
	// lineとcircleはそんな負荷じゃないから描画スピード上げても意味無さそう
	// まあこれはこれって感じですかね。でも速い方がいいでしょ、普通に。
}

function draw() {

}
