const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;

const engine = Engine.create();
const world = engine.world;
const container = document.getElementById('game-container');

// 상태 변수
let currentSkinType = 'A'; // 'A' 또는 'B'
let score = 0;
let isGameOver = false;
let currentFruit = null;
let canDrop = true;
const mergeQueue = [];

const FRUITS = [
    { radius: 26, score: 2 },    // 00 
    { radius: 40, score: 4 },    // 01 
    { radius: 54, score: 8 },    // 02 
    { radius: 60, score: 16 },   // 03 
    { radius: 76, score: 32 },   // 04 
    { radius: 92, score: 64 },   // 05 
    { radius: 97, score: 128 },  // 06
    { radius: 129, score: 256 }, // 07
    { radius: 154, score: 512 }, // 08 
    { radius: 154, score: 1024 },// 09
    { radius: 204, score: 2048 } // 10 
];

// 렌더러 설정
const render = Render.create({
    element: container,
    engine: engine,
    options: {
        width: 400, height: 600,
        wireframes:false, background: 'transparent'
    }
});

// 벽 생성
const wallOptions = { isStatic: true, render: { visible: false } };
const ground = Bodies.rectangle(200, 580, 400, 40, wallOptions);
const leftWall = Bodies.rectangle(10, 300, 20, 600, wallOptions);
const rightWall = Bodies.rectangle(390, 300, 20, 600, wallOptions);
Composite.add(world, [ground, leftWall, rightWall]);

// 캐릭터 생성 함수
function createFruit(x, y, level, isStatic = false) {
    const fruitData = FRUITS[level - 1];
    const indexStr = String(level - 1).padStart(2, '0');
    const prefix = (currentSkinType === 'A') ? 'fruit' : 'skinB_fruit';
    const texturePath = `./asset/${prefix}${indexStr}.png`;

    const fruit = Bodies.circle(x, y, fruitData.radius, {
        label: 'fruit_' + level,
        isStatic: isStatic,
        restitution: 0.3,
        render: {
                sprite: {
                    texture: texturePath,
                    xScale: 1,
                    yScale: 1
                }
            }
    });
     // [핵심 로직] 이미지 크기에 맞춰 스케일 자동 조정
    const img = new Image();
    img.src = texturePath;

    img.onload = function() {
        const diameter = fruitData.radius * 2;
        const scale = diameter / img.width;

          fruit.render.sprite.xScale = scale;
        fruit.render.sprite.yScale = scale;
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

// UI 이벤트 리스너 등록
document.getElementById('skin-btn').addEventListener('click', () => {
    currentSkinType = (currentSkinType === 'A') ? 'B' : 'A';
    const prefix = (currentSkinType === 'A') ? 'fruit' : 'skinB_fruit';
    
    Composite.allBodies(world).forEach(body => {
        if (body.label && body.label.startsWith('fruit_')) {
            const level = body.label.split('_')[1];
            body.render.sprite.texture = `./asset/${prefix}${String(level-1).padStart(2,'0')}.png`;
        }
    });
});

document.getElementById('reset-btn').addEventListener('click', resetGame);
document.getElementById('retry-btn').addEventListener('click', resetGame);

function resetGame() {
    location.reload();
}

// 입력 처리
function getInputX(e) {
    const rect = container.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return clientX - rect.left;
}

const handleMove = (e) => {
    if (currentFruit && canDrop && !isGameOver) {
        let x = getInputX(e);
        const level = parseInt(currentFruit.label.split('_')[1]);
        const radius = FRUITS[level - 1].radius;
        x = Math.max(radius + 20, Math.min(380 - radius, x));
        Body.setPosition(currentFruit, { x: x, y: 80 });
    }
};

const handleDrop = (e) => {
    // 버튼 클릭 시에는 무시 (이벤트 전파 방지)
    if (e.target.closest('.top-btn-group') || e.target.tagName === 'BUTTON') return;
    
    if (currentFruit && canDrop && !isGameOver) {
        canDrop = false;
        Body.setStatic(currentFruit, false);
        currentFruit = null;
        setTimeout(spawnFruit, 1000);
    }
};

container.addEventListener('mousemove', handleMove);
container.addEventListener('touchmove', (e) => { 
    if(e.cancelable) e.preventDefault(); 
    handleMove(e); 
}, { passive: false });
container.addEventListener('mousedown', handleDrop);
container.addEventListener('touchend', (e) => { 
    handleDrop(e); 
}, { passive: false });

// 충돌 및 합성 루프
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        if (bodyA.label === bodyB.label && bodyA.label.startsWith('fruit_')) {
            if (bodyA.isMerging || bodyB.isMerging) return;
            const level = parseInt(bodyA.label.split('_')[1]);
            if (level < 11) {
                bodyA.isMerging = true; bodyB.isMerging = true;
                mergeQueue.push({
                    bodyA, bodyB, level,
                    x: (bodyA.position.x + bodyB.position.x) / 2,
                    y: (bodyA.position.y + bodyB.position.y) / 2
                });
            }
        }
    });
});

Events.on(engine, 'afterUpdate', () => {
    while (mergeQueue.length > 0) {
        const { bodyA, bodyB, level, x, y } = mergeQueue.shift();
        if (Composite.allBodies(world).includes(bodyA)) {
            Composite.remove(world, [bodyA, bodyB]);
            Composite.add(world, createFruit(x, y, level + 1));
            score += FRUITS[level - 1].score;
            document.getElementById('score').innerText = score;
        }
    }

    if (!isGameOver && !canDrop) {
        const fruits = Composite.allBodies(world).filter(b => b.label && b.label.startsWith('fruit_') && !b.isStatic);
        for (let fruit of fruits) {
            if (fruit.position.y < 120 && Math.abs(fruit.velocity.y) < 0.2) {
                isGameOver = true;
                document.getElementById('game-over').style.display = 'block';
                document.getElementById('final-score').innerText = score;
            }
        }
    }
});

Render.run(render);
Runner.run(Runner.create({ isFixed: true }), engine);
spawnFruit();
