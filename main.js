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
    const endingLayer = document.getElementById('ending-layer');
    const gifContainer = document.getElementById('ending-gif-container');
    const imgContainer = document.getElementById('ending-img-container');

    if (endingLayer) {
        endingLayer.style.display = 'block';
        setTimeout(() => {
            if (gifContainer) gifContainer.style.display = 'none';
            if (imgContainer) imgContainer.style.display = 'block';
        }, 3000);
    }
}

// 이벤트 리스너 설정
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

document.getElementById('reset-btn').addEventListener('click', () => location.reload());
document.getElementById('retry-btn').addEventListener('click', () => location.reload());
const backBtn = document.getElementById('back-to-game');
if (backBtn) backBtn.addEventListener('click', () => location.reload());

// 입력 처리 (handleMove, handleDrop 등은 기존과 동일하게 유지)
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
    if (e.target.closest('.top-btn-group') || e.target.tagName === 'BUTTON') return;
    if (currentFruit && canDrop && !isGameOver) {
        canDrop = false;
        Body.setStatic(currentFruit, false);
        currentFruit = null;
        setTimeout(spawnFruit, 1000);
    }
};

container.addEventListener('mousemove', handleMove);
container.addEventListener('touchmove', (e) => { if(e.cancelable) e.preventDefault(); handleMove(e); }, { passive: false });
container.addEventListener('mousedown', handleDrop);
container.addEventListener('touchend', (e) => { handleDrop(e); }, { passive: false });

// 충돌 감지
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

// 업데이트 루프 (통합본)
Events.on(engine, 'afterUpdate', () => {
    while (mergeQueue.length > 0) {
        const { bodyA, bodyB, level, x, y } = mergeQueue.shift();
        if (Composite.allBodies(world).includes(bodyA)) {
            Composite.remove(world, [bodyA, bodyB]);
            
            const nextLevel = level + 1;
            Composite.add(world, createFruit(x, y, nextLevel));
            
            score += FRUITS[level - 1].score;
            document.getElementById('score').innerText = score;

            // 11단계 달성 시 엔딩 체크
            if (nextLevel === 11) {
                setTimeout(startEndingSequence, 500);
            }
        }
    }

    // 게임 오버 체크
    if (!isGameOver && !canDrop) {
        const fruits = Composite.allBodies(world).filter(b => 
            b.label && 
            b.label.startsWith('fruit_') && 
            !b.isStatic
        );
        for (let fruit of fruits) {
           if (fruit.position.y < 120 && Math.abs(fruit.velocity.y) < 0.1) {
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
