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
    { radius: 17.5, score: 2 }, { radius: 27.5, score: 4 }, { radius: 42.5, score: 8 },
    { radius: 52.5, score: 16 }, { radius: 67.5, score: 32 }, { radius: 82.5, score: 64 },
    { radius: 97.5, score: 128 }, { radius: 117.5, score: 256 }, { radius: 137.5, score: 512 },
    { radius: 157.5, score: 1024 }, { radius: 187.5, score: 2048 }
];

const render = Render.create({
    element: container,
    engine: engine,
    options: { width: 400, height: 600, wireframes: false, background: 'transparent' }
});

const wallOptions = { isStatic: true, friction: 0, render: { visible: false } };
Composite.add(world, [
    Bodies.rectangle(200, 580, 400, 40, wallOptions),
    Bodies.rectangle(10, 300, 20, 600, wallOptions),
    Bodies.rectangle(390, 300, 20, 600, wallOptions)
]);

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
        const scale = (fruitData.radius * 2) / img.width;
        fruit.render.sprite.xScale = scale * 1.05;
        fruit.render.sprite.yScale = scale * 1.05;
    };
    return fruit;
}

function spawnFruit() {
    if (isGameOver) return;
    const level = Math.floor(Math.random() * 3) + 1;
    currentFruit = createFruit(200, 80, level, true);
    Composite.add(world, currentFruit);
    canDrop = true;
}

// 스킨 변경 로직: 실시간 모든 오브젝트 및 대기 과일 텍스처 교체
document.getElementById('skin-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    currentSkinType = (currentSkinType === 'A') ? 'B' : 'A';
    const prefix = (currentSkinType === 'A') ? 'fruit' : 'skinB_fruit';
    
    // 1. 월드에 있는 모든 과일 리스트 확보
    const allFruits = Composite.allBodies(world).filter(body => body.label && body.label.startsWith('fruit_'));
    
    // 2. 현재 조작 중인(대기 중인) 과일도 리스트에 추가
    if (currentFruit) {
        allFruits.push(currentFruit);
    }

    // 3. 모든 과일의 이미지와 스케일 업데이트
    allFruits.forEach(body => {
        const level = parseInt(body.label.split('_')[1]);
        const indexStr = String(level - 1).padStart(2, '0');
        const texturePath = `./asset/${prefix}${indexStr}.png`;
        const fruitData = FRUITS[level - 1];

        body.render.sprite.texture = texturePath;

        const img = new Image();
        img.src = texturePath;
        img.onload = function() {
            const scale = (fruitData.radius * 2) / img.width;
            body.render.sprite.xScale = scale * 1.05;
            body.render.sprite.yScale = scale * 1.05;
        };
    });
});

function startEndingSequence() {
    isGameOver = true;
    document.getElementById('ending-layer').style.display = 'block';
    setTimeout(() => {
        document.getElementById('ending-gif-container').style.display = 'none';
        document.getElementById('ending-img-container').style.display = 'block';
    }, 3000);
}

document.getElementById('reset-btn').onclick = (e) => { e.stopPropagation(); location.reload(); };
document.getElementById('retry-btn').onclick = () => location.reload();
document.getElementById('back-to-game').onclick = () => location.reload();

const handleMove = (e) => {
    if (currentFruit && canDrop && !isGameOver) {
        const rect = container.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let x = clientX - rect.left;
        const level = parseInt(currentFruit.label.split('_')[1]);
        const radius = FRUITS[level - 1].radius;
        x = Math.max(radius + 25, Math.min(375 - radius, x));
        Body.setPosition(currentFruit, { x: x, y: 80 });
    }
};

const handleDrop = (e) => {
    if (e.target.closest('.top-btn-group')) return;
    if (currentFruit && canDrop && !isGameOver) {
        canDrop = false;
        Body.setStatic(currentFruit, false);
        currentFruit = null;
        setTimeout(spawnFruit, 1000);
    }
};

container.addEventListener('mousemove', handleMove);
container.addEventListener('mousedown', handleDrop);
container.addEventListener('touchmove', (e) => { if(e.cancelable) e.preventDefault(); handleMove(e); }, { passive: false });
container.addEventListener('touchend', handleDrop);

Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        if (bodyA.label === bodyB.label && bodyA.label.startsWith('fruit_')) {
            if (bodyA.isMerging || bodyB.isMerging) return;
            const level = parseInt(bodyA.label.split('_')[1]);
            if (level < 11) {
                bodyA.isMerging = true; bodyB.isMerging = true;
                mergeQueue.push({ bodyA, bodyB, level, x: (bodyA.position.x + bodyB.position.x) / 2, y: (bodyA.position.y + bodyB.position.y) / 2 });
            }
        }
    });
});

Events.on(engine, 'afterUpdate', () => {
    while (mergeQueue.length > 0) {
        const { bodyA, bodyB, level, x, y } = mergeQueue.shift();
        if (Composite.allBodies(world).includes(bodyA)) {
            Composite.remove(world, [bodyA, bodyB]);
            const nextLevel = level + 1;
            Composite.add(world, createFruit(x, y, nextLevel));
            score += FRUITS[level - 1].score;
            document.getElementById('score').innerText = score;
            if (nextLevel === 11) setTimeout(startEndingSequence, 500);
        }
    }
    if (!isGameOver && !canDrop) {
        const fruits = Composite.allBodies(world).filter(b => b.label && b.label.startsWith('fruit_') && !b.isStatic);
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
