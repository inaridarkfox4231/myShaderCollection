function preload(){
  console.log("hello!");
}
let func = () => {return 2;}
function setup() {
  createCanvas(400, 400);
  fill(0, 128, 255);
  rect(20, 20, 80, 80);
}

function draw() {
  background(0);
  circle(200, 200, 40);
  if(frameCount==3){noLoop();}
}
