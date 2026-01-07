const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;

const engine = Engine.create();
const world = engine.world;
const container = document.getElementById('game-container');

// 상태 변수
let currentSkinType = 'A'; 
let score = 0;
let isGameOver = false;
let currentFruit = null;
let canDrop = true;
const mergeQueue = [];

const FRUITS = [
    { radius: 16, score: 2 },    // 01 
    { radius: 24, score: 4 },    // 02 
    { radius: 32, score: 8 },    // 03 
    { radius: 46, score: 16 },   // 04 
    { radius: 55, score: 32 },   // 05 
    { radius: 55, score: 64 },   // 06 
    { radius: 58, score: 128 },  // 07
    { radius: 77, score: 256 },  // 08
    { radius: 92, score: 512 },  // 09 
    { radius: 92, score: 1024 }, // 10
    { radius: 122, score: 2048 } // 11 (최종)
];

// 렌더러 및 벽 생성 로직 (기존과 동일)
const render = Render.create({
    element: container,
    engine: engine,
    options: { width: 400, height: 600, wireframes: false, background: 'transparent' }
});

const wallOptions = { isStatic: true, render: { visible: false } };
const ground = Bodies.rectangle(200, 580, 400, 40, wallOptions);
const leftWall = Bodies.rectangle(20, 300, 20, 600, wallOptions);
const rightWall = Bodies.rectangle(380, 300, 20, 600, wallOptions);
Composite.add(world, [ground, leftWall, rightWall]);

function createFruit(x, y, level, isStatic = false) {
    const fruitData = FRUITS[level - 1];
    const indexStr = String(level - 1).padStart(2, '0');
    const prefix = (currentSkinType === 'A') ? 'fruit' : 'skinB_fruit';
    const texturePath = `./asset/${prefix}${indexStr}.png`;

    const fruit = Bodies.circle(x, y, fruitData.radius, {
        label: 'fruit_' + level,
        isStatic: isStatic,
        restitution: 0.3,
        render: { sprite: { texture: texturePath, xScale: 1, yScale: 1 } }
    });

    const img = new Image();
    img.src = texturePath;
    img.onload = function() {
        const diameter = fruitData.radius * 2;
        const scale = diameter / img.width;
        fruit.render.sprite.xScale = scale * 1.05;
        fruit.render.sprite.yScale = scale * 1.05;
    };
    
    fruit.isMerging = false;
    return fruit;
}

function spawnFruit() {
    if (isGameOver) return;
    const level = Math.floor(Math.random() * 3) + 1;
    currentFruit = createFruit(200, 80, level, true);
    Composite.add(world, currentFruit);
    canDrop = true;
}

// 엔딩 시퀀스 함수
function startEndingSequence() {
    isGameOver = true;
    const
