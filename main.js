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
    options: { 
        width: 400, 
        height: 600, 
        wireframes: false, 
        background: 'transparent',
        pixelRatio: window.devicePixelRatio || 1 // 모바일 고해상도 대응
    }
});

// 벽 설정
const wallOptions = { isStatic: true, friction: 0, render: { visible: false } };
Composite.add(world, [
    Bodies.rectangle(200, 580, 400, 40, wallOptions), // 바닥
    Bodies.rectangle(30, 300, 30, 600, wallOptions),  // 왼쪽 벽
    Bodies.rectangle(370, 300, 30, 600, wallOptions) // 오른쪽 벽
]);

// 과일 생성 함수
function createFruit(x, y, level, isStatic = false) {
    const fruitData = FRUITS[level - 1];
    const indexStr = String(level - 1).padStart(2, '0');
    const prefix = (currentSkinType === 'A') ? 'fruit' : 'skinB_fruit';
    const texturePath = `./asset/${prefix}${indexStr}.png`;

    const fruit = Bodies.circle(x, y, fruitData.radius, {
        label: 'fruit_' + level,
        isStatic: isStatic,
        restitution: 0.2, // [조정] 반발력을 낮춰 튀어오름 방지
        friction: 0.1,
        render: { sprite: { texture: texturePath, xScale: 1, yScale: 1 } }
    });

    fruit.spawnTime = Date.now();
    fruit.isMerging = false;

    const img = new Image();
    img.src = texturePath;
    img.onload = function() {
        const scale = (fruitData.radius * 2) / img.width;
        fruit.render.sprite.xScale = scale * 1.05;
        fruit.render.sprite.yScale = scale * 1.05;
    };
    return fruit;
}

// 새로운 과일 대기
function spawnFruit() {
    if (isGameOver) return;
    const level = Math.floor(Math.random() * 3) + 1;
    currentFruit = createFruit(200, 80, level, true);
    Composite.add(world, currentFruit);
    canDrop = true;
}

// 엔딩 시퀀스
function startEndingSequence() {
    if (isGameOver) return;
    isGameOver = true;
    document.getElementById('bg-left').classList.add('split-left');
    document.getElementById('bg-right').classList.add('split-right');
    
    setTimeout(() => {
        const endingLayer = document.getElementById('ending-layer');
        const gifContainer = document.getElementById('ending-gif-container');
        const imgContainer = document.getElementById('ending-img-container');
        const backBtn = document.getElementById('back-to-game');
        
        endingLayer.style.display = 'block';
        setTimeout(() => {
            gifContainer.style.display = 'none';
            imgContainer.style.display = 'flex';
            setTimeout(() => { imgContainer.style.opacity = '1'; }, 100);
            setTimeout(() => {
                backBtn.style.display = 'block';
                setTimeout(() => { backBtn.style.opacity = '1'; }, 100);
            }, 3000);
        }, 3000);
    }, 1200);
}

// 스킨 변경 로직
document.getElementById('skin-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    currentSkinType = (currentSkinType === 'A') ? 'B' : 'A';
    const prefix = (currentSkinType === 'A') ? 'fruit' : 'skinB_fruit';
    
    const allFruits = Composite.allBodies(world).filter(body => body.label && body.label.startsWith('fruit_'));
    if (currentFruit) allFruits.push(currentFruit);

    allFruits.forEach(body => {
        const level = parseInt(body.label.split('_')[1]);
        const indexStr = String(level - 1).padStart(2, '0');
        const texturePath = `asset/${prefix}${indexStr}.png`;
        
        const img = new Image();
        img.src = texturePath;
        img.onload = function() {
            body.render.sprite.texture = texturePath;
            const fruitData = FRUITS[level - 1];
            const scale = (fruitData.radius * 2) / img.width;
            body.render.sprite.xScale = scale * 1.05;
            body.render.sprite.yScale = scale * 1.05;
        };
    });
});

// 버튼 이벤트
document.getElementById('reset-btn').onclick = (e) => { e.stopPropagation(); location.reload(); };
document.getElementById('retry-btn').onclick = () => location.reload();
document.getElementById('back-to-game').onclick = () => location.reload();

// 이동 및 낙하
const handleMove = (e) => {
    if (currentFruit && canDrop && !isGameOver) {
        const rect = container.getBoundingClientRect();
        // 모바일 터치와 마우스 클릭 위치를 정확히 계산
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        
        // 컨테이너 대비 실제 X 좌표 계산
        let x = (clientX - rect.left) * (400 / rect.width);
        
        const level = parseInt(currentFruit.label.split('_')[1]);
        const radius = FRUITS[level - 1].radius;
        
        // 과일이 벽(30px) 밖으로 나가지 않게 제한
        x = Math.max(radius + 30, Math.min(370 - radius, x));
        
        Body.setPosition(currentFruit, { x: x, y: 80 });
    }
};
