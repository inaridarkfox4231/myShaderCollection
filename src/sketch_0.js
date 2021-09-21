function setup() {
  createCanvas(400, 400, WEBGL);
  strokeWeight(6);
}

function draw() {
  background(0);
  beginShape();
  stroke(255,0,0);
  fill(0,0,255);
  vertex(0,0,0);
  stroke(255);
  fill(255);
  vertex(100,0,0);
  stroke(255,0,0);
  fill(0,0,255);
  vertex(100,100,0);
  stroke(255);
  fill(255);
  vertex(0,100,0);
  stroke(255,0,0);
  fill(0,0,255);
  vertex(0,0,0);
  endShape();
  noLoop();
}
