const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;

const engine = Engine.create();
const world = engine.world;

// 1. 렌더러 설정
const render = Render.create({
    element: document.getElementById('game-container'),
    engine: engine,
    options: {
        width: 400,
        height: 600,
        wireframes: false,
        background: 'transparent'
    }
});

// 2. 벽 생성
const wallOptions = { isStatic: true, render: { visible: false } };
const ground = Bodies.rectangle(200, 595, 400, 10, wallOptions);
const leftWall = Bodies.rectangle(40, 300, 10, 600, wallOptions);
const rightWall = Bodies.rectangle(360, 300, 10, 600, wallOptions);
const topSensorY = 100; 

Composite.add(world, [ground, leftWall, rightWall]);

// 3. 데이터 및 상태 변수
// 기존 대비 0.8배 축소 예시
const FRUITS = [
    { radius: 16, score: 2 },  // 20 -> 16
    { radius: 24, score: 4 },  // 30 -> 24
    { radius: 36, score: 8 },  // 45 -> 36
    { radius: 44, score: 16 }, // 55 -> 44
    { radius: 56, score: 32 }, // 70 -> 56
    { radius: 68, score: 64 }, // 85 -> 68
    { radius: 80, score: 128 },// 100 -> 80
    { radius: 96, score: 256 },// 120 -> 96
    { radius: 112, score: 512 },// 140 -> 112
    { radius: 128, score: 1024 },// 160 -> 128
    { radius: 152, score: 2048 } // 190 -> 152
];

let score = 0;
let isGameOver = false;
let currentFruit = null;
let canDrop = true;

function createFruit(x, y, level, isStatic = false) {
    const fruitData = FRUITS[level - 1];
    const indexStr = String(level - 1).padStart(2, '0');
    // 경로 앞에 ./를 붙여 현재 폴더 기준임을 명확히 합니다.
    const texturePath = './asset/fruit' + indexStr + '.png';

    // [수정] 이미지 크기 계산 로직
    // 과일 반지름(radius)이 20일 때, 지름은 40입니다.
    // 만약 이미지 원본이 100px이라면 0.4 배율이 되어야 합니다.
    // 이미지 원본 크기에 맞춰 100 혹은 128 등으로 숫자를 바꿔보세요.
    const imageBaseSize = 100; // 이 숫자를 이미지 원본 크기(px)에 맞춰 조정하세요.
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
    const fruits = Composite.allBodies(world).filter(b => b.label && b.label.startsWith('fruit_'));
    Composite.remove(world, fruits);
    score = 0;
    isGameOver = false;
    document.getElementById('score').innerText = '0';
    document.getElementById('game-over').style.display = 'none';
    spawnFruit();
}

// --- [추가] 효과음 재생 함수 ---
function playSound(id) {
    const sound = document.getElementById(id);
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {}); // 첫 터치 전 재생 차단 방지
    }
}

// --- [수정] 좌표 계산 및 입력 처리 ---
function handleInputMove(e) {
    if (currentFruit && currentFruit.isStatic && !isGameOver) {
        const rect = container.getBoundingClientRect();
        // 터치면 touches[0], 마우스면 clientX 사용
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let x = clientX - rect.left;
        
        const level = parseInt(currentFruit.label.split('_')[1]);
        const radius = FRUITS[level - 1].radius;
        
        // 벽 안쪽으로 제한
        x = Math.max(40 + radius, Math.min(360 - radius, x));
        Body.setPosition(currentFruit, { x: x, y: 80 });
    }
}

function handleInputEnd(e) {
    // 리셋 버튼 클릭 시에는 과일이 떨어지지 않게 방지
    if (e.target.id === 'reset-btn') return;

    if (currentFruit && canDrop && !isGameOver) {
        canDrop = false;
        Body.setStatic(currentFruit, false);
        playSound('sound-drop'); // 떨어질 때 소리
        currentFruit = null;
        setTimeout(spawnFruit, 1000);
    }
}

// --- [수정] 모바일 터치 및 마우스 이벤트 통합 리스너 ---
// mousemove/touchmove: 과일 따라다니기
container.addEventListener('mousemove', handleInputMove);
container.addEventListener('touchmove', (e) => {
    e.preventDefault(); // 스크롤 방지
    handleInputMove(e);
}, { passive: false });

// mousedown/touchstart: 과일 떨어뜨리기
container.addEventListener('mousedown', handleInputEnd);
container.addEventListener('touchstart', (e) => {
    // 리셋 버튼이 아니면 게임 로직 실행
    if (e.target.id !== 'reset-btn') {
        e.preventDefault();
        handleInputEnd(e);
    }
}, { passive: false });

// --- [수정] 8번 충돌 로직에 소리 추가 ---
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
                
                playSound('sound-merge'); // 합쳐질 때 소리
                Composite.remove(world, [bodyA, bodyB]);
                Composite.add(world, createFruit(midX, midY, level + 1));
                
                score += FRUITS[level - 1].score;
                document.getElementById('score').innerText = score;
            }
        }
    });
});

// --- [수정] 9번 게임오버 로직에 소리 및 엔딩창 연동 ---
Events.on(engine, 'afterUpdate', () => {
    if (isGameOver) return;
    const fruits = Composite.allBodies(world).filter(b => b.label && b.label.startsWith('fruit_') && !b.isStatic);
    for (let fruit of fruits) {
        if (fruit.position.y < topSensorY && Math.abs(fruit.velocity.y) < 0.2) {
            isGameOver = true;
            playSound('sound-gameover'); // 게임오버 소리
            const overLayer = document.getElementById('game-over');
            overLayer.style.display = 'flex'; // 엔딩창 보이기
            document.getElementById('final-score').innerText = score;
        }
    }
});
});

// 8. 충돌(합성) 로직
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        if (bodyA.label && bodyB.label && bodyA.label.startsWith('fruit_') && bodyA.label === bodyB.label) {
            if (bodyA.isMerging || bodyB.isMerging) return;
            const level = parseInt(bodyA.label.split('_')[1]);
            if (level < 11) {
                bodyA.isMerging = true; 
                bodyB.isMerging = true;
                const midX = (bodyA.position.x + bodyB.position.x) / 2;
                const midY = (bodyA.position.y + bodyB.position.y) / 2;
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
            document.getElementById('game-over').style.display = 'block';
            document.getElementById('final-score').innerText = score;
        }
    }
});

// 실행
Render.run(render);
Runner.run(Runner.create(), engine);
spawnFruit();
