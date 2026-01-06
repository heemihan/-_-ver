const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;

const engine = Engine.create();
const world = engine.world;
const container = document.getElementById('game-container');

// 1. 렌더러 설정
const render = Render.create({
    element: container,
    engine: engine,
    options: {
        width: 400,
        height: 600,
        wireframes: false,
        background: 'transparent'
    }
});

// 2. 벽 생성 (과일 크기에 맞춰 벽 두께와 위치 조정)
const wallOptions = { isStatic: true, render: { visible: false } };
const ground = Bodies.rectangle(200, 595, 400, 10, wallOptions);
const leftWall = Bodies.rectangle(0, 300, 10, 600, wallOptions); // 벽을 바깥쪽으로 이동
const rightWall = Bodies.rectangle(400, 300, 10, 600, wallOptions);
const topSensorY = 100; 

Composite.add(world, [ground, leftWall, rightWall]);

// 3. 데이터 및 상태 변수 (사이즈를 다시 조금 늘렸습니다)
const FRUITS = [
    { radius: 20, score: 2 },  
    { radius: 30, score: 4 },  
    { radius: 45, score: 8 },  
    { radius: 55, score: 16 }, 
    { radius: 70, score: 32 }, 
    { radius: 85, score: 64 }, 
    { radius: 100, score: 128 },
    { radius: 120, score: 256 },
    { radius: 140, score: 512 },
    { radius: 160, score: 1024 },
    { radius: 190, score: 2048 }
];

let score = 0;
let isGameOver = false;
let currentFruit = null;
let canDrop = true;

// 4. 과일 생성 함수 (이미지 출력 핵심 수정)
function createFruit(x, y, level, isStatic = false) {
    const fruitData = FRUITS[level - 1];
    const indexStr = String(level - 1).padStart(2, '0');
    const texturePath = `./asset/fruit${indexStr}.png`; 

    // [중요] 이미지가 안 보인다면 이 숫자를 이미지 원본 px 크기에 맞춰보세요.
    // 보통 수박게임 에셋은 100px ~ 400px 사이입니다. 
    // 이미지가 너무 작게 보이면 이 숫자를 줄이고, 너무 크면 늘리세요.
    const imageBaseSize = 50; 
    const scale = (fruitData.radius * 2) / imageBaseSize;

    const fruit = Bodies.circle(x, y, fruitData.radius, {
        label: 'fruit_' + level,
        isStatic: isStatic,
        restitution: 0.3,
        friction: 0.1,
        render: { 
            sprite: { 
                texture: texturePath, 
                xScale: scale, 
                yScale: scale 
            } 
        }
    });
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

// 5. 리셋 함수
window.resetGame = function() {
    location.reload(); // 상태 꼬임 방지를 위해 새로고침 권장
}

// 6. 효과음 함수
function playSound(id) {
    const sound = document.getElementById(id);
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }
}

// 7. 입력 처리 (모바일 터치 최적화 포함)
function handleInputMove(e) {
    if (currentFruit && currentFruit.isStatic && !isGameOver) {
        const rect = container.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let x = clientX - rect.left;
        
        const level = parseInt(currentFruit.label.split('_')[1]);
        const radius = FRUITS[level - 1].radius;
        
        // 이동 범위 제한 (벽에 끼지 않게)
        x = Math.max(radius, Math.min(400 - radius, x));
        Body.setPosition(currentFruit, { x: x, y: 80 });
    }
}

function handleInputEnd(e) {
    if (e.target.id === 'reset-btn') return;
    if (currentFruit && canDrop && !isGameOver) {
        canDrop = false;
        Body.setStatic(currentFruit, false);
        playSound('sound-drop');
        currentFruit = null;
        setTimeout(spawnFruit, 1000);
    }
}

// 이벤트 연결
container.addEventListener('mousemove', handleInputMove);
container.addEventListener('touchmove', (e) => {
    e.preventDefault(); 
    handleInputMove(e);
}, { passive: false });

container.addEventListener('mousedown', handleInputEnd);
container.addEventListener('touchstart', (e) => {
    if (e.target.id !== 'reset-btn') {
        e.preventDefault();
        handleInputEnd(e);
    }
}, { passive: false });

// 8. 충돌(합성) 로직
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        if (bodyA.label && bodyB.label && bodyA.label.startsWith('fruit_') && bodyA.label === bodyB.label) {
            if (bodyA.isMerging || bodyB.isMerging) return;
            const level = parseInt(bodyA.label.split('_')[1]);
            if (level < 11) {
                bodyA.isMerging = true; bodyB.isMerging = true;
                const midX = (bodyA.position.x + bodyB.position.x) / 2;
                const midY = (bodyA.position.y + bodyB.position.y) / 2;
                
                playSound('sound-merge');
                Composite.remove(world, [bodyA, bodyB]);
                Composite.add(world, createFruit(midX, midY, level + 1));
                
                score += FRUITS[level - 1].score;
                document.getElementById('score').innerText = score;
            }
        }
    });
});

// 9. 게임오버 체크
Events.on(engine, 'afterUpdate', () => {
    if (isGameOver) return;
    const fruits = Composite.allBodies(world).filter(b => b.label && b.label.startsWith('fruit_') && !b.isStatic);
    for (let fruit of fruits) {
        if (fruit.position.y < topSensorY && Math.abs(fruit.velocity.y) < 0.2) {
            isGameOver = true;
            playSound('sound-gameover');
            const overLayer = document.getElementById('game-over');
            overLayer.style.display = 'flex';
            document.getElementById('final-score').innerText = score;
        }
    }
});

// 실행
Render.run(render);
Runner.run(Runner.create(), engine);
spawnFruit();
