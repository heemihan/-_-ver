// DOM이 완전히 로드된 후 실행하여 요소를 정확히 참조합니다.
document.addEventListener('DOMContentLoaded', () => {
    const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;

    const engine = Engine.create();
    const world = engine.world;
    const container = document.getElementById('game-container');
    const outer = document.getElementById('game-outer');

    // 1. 상태 변수 설정
    let currentSkinType = 'A'; // 'A' 또는 'B'
    const mergeQueue = []; 
    let score = 0;
    let isGameOver = false;
    let currentFruit = null;
    let canDrop = true;

    // 게임 설정 상수
    const GAME_WIDTH = 400;
    const GAME_HEIGHT = 600;
    const FRUITS = [
        { radius: 17.5, score: 2 }, { radius: 27.5, score: 4 }, { radius: 42.5, score: 8 },
        { radius: 52.5, score: 16 }, { radius: 67.5, score: 32 }, { radius: 82.5, score: 64 },
        { radius: 97.5, score: 128 }, { radius: 117.5, score: 256 }, { radius: 137.5, score: 512 },
        { radius: 157.5, score: 1024 }, { radius: 187.5, score: 2048 }
    ];

    // 2. 렌더러 설정 (사이즈 고정 및 배경 지정)
    const render = Render.create({
        element: container,
        engine: engine,
        options: {
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
            wireframes: false,
            background: 'asset/background.png' 
        }
    });
    render.canvas.style.width = GAME_WIDTH + "px";
render.canvas.style.height = GAME_HEIGHT + "px";
render.canvas.style.maxWidth = "100%"; // 모바일 대응용
render.canvas.style.display = "block";
render.canvas.style.margin = "0 auto";

    // 3. 벽 생성 (과일 추락 및 이탈 방지)
    const wallOptions = { isStatic: true, render: { visible: false } };
    Composite.add(world, [
        Bodies.rectangle(200, 595, 400, 30, wallOptions), // 바닥
        Bodies.rectangle(-15, 300, 30, 600, wallOptions), // 왼쪽 벽
        Bodies.rectangle(415, 300, 30, 600, wallOptions)  // 오른쪽 벽
    ]);

    // 4. 과일 생성 함수
    function createFruit(x, y, level, isStatic = false) {
        const fruitData = FRUITS[level - 1];
        const indexStr = String(level - 1).padStart(2, '0'); 
        const prefix = (currentSkinType === 'A') ? 'fruit' : 'skinB_fruit';
        const texturePath = `asset/${prefix}${indexStr}.png`; 

        const fruit = Bodies.circle(x, y, fruitData.radius, {
            label: `fruit_${level}`,
            isStatic: isStatic,
            restitution: 0.3, // 튀어오름 방지
            render: {
                sprite: {
                    texture: texturePath,
                    xScale: 1,
                    yScale: 1
                }
            }
        });
        fruit.isMerging = false; // 합성 중복 방지 플래그
        return fruit;
    }

    function spawnFruit() {
        if (isGameOver) return;
        const level = Math.floor(Math.random() * 3) + 1;
        currentFruit = createFruit(200, 80, level, true);
        Composite.add(world, currentFruit);
        canDrop = true;
    }

    // 5. 조작 로직 (좌표 계산 오류 수정)
    const handleMove = (e) => {
        if (currentFruit && canDrop && !isGameOver) {
            const rect = container.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            
            // 캔버스 내 상대 좌표 계산
            let x = clientX - rect.left;
            
            const level = parseInt(currentFruit.label.split('_')[1]);
            const radius = FRUITS[level - 1].radius;
            
            // 이동 범위 제한 (벽 뚫기 방지)
            x = Math.max(radius, Math.min(GAME_WIDTH - radius, x));
            Body.setPosition(currentFruit, { x: x, y: 80 });
        }
    };

    // 이벤트 리스너를 outer 컨테이너에 연결 (캔버스 위 UI 클릭 보호)
    outer.addEventListener('mousemove', handleMove);
    outer.addEventListener('touchmove', handleMove);
    
    outer.addEventListener('mousedown', (e) => {
        // UI 버튼 클릭 시 과일 낙하 방지
        if (e.target.closest('#ui-controls') || e.target.closest('button')) return;

        if (currentFruit && canDrop && !isGameOver) {
            canDrop = false;
            Body.setStatic(currentFruit, false);
            currentFruit = null;
            
            // 1초 뒤 다음 과일 생성
            setTimeout(spawnFruit, 1000);
        }
    });

    // 6. 스킨 전환 (전역 노출)
    window.toggleSkin = function() {
    currentSkinType = (currentSkinType === 'A') ? 'B' : 'A';
    const prefix = (currentSkinType === 'A') ? 'fruit' : 'skinB_fruit';
    
   const fruits = Composite.allBodies(world).filter(b => b.label && b.label.startsWith('fruit_'));
    
    fruits.forEach(fruit => {
        const level = parseInt(fruit.label.split('_')[1]);
        const indexStr = String(level - 1).padStart(2, '0');
        
        // 해당 레벨의 반지름에 맞는 스케일 재계산
        const scale = (FRUITS[level - 1].radius * 2) / 100;
        
        fruit.render.sprite.texture = `asset/${prefix}${indexStr}.png`;
        fruit.render.sprite.xScale = scale;
        fruit.render.sprite.yScale = scale;
    });

    // 조준 중인 과일도 즉시 업데이트
    if (currentFruit) {
        const level = parseInt(currentFruit.label.split('_')[1]);
        const scale = (FRUITS[level - 1].radius * 2) / 100;
        const indexStr = String(level - 1).padStart(2, '0');
        currentFruit.render.sprite.texture = `asset/${prefix}${indexStr}.png`;
        currentFruit.render.sprite.xScale = scale;
        currentFruit.render.sprite.yScale = scale;
    }
};

    window.resetGame = () => location.reload();

    // 7. 합성 및 물리 업데이트
    Events.on(engine, 'collisionStart', (event) => {
        event.pairs.forEach((pair) => {
            const { bodyA, bodyB } = pair;
            // 같은 레벨의 과일 충돌 확인
            if (bodyA.label === bodyB.label && bodyA.label.startsWith('fruit_')) {
                if (bodyA.isMerging || bodyB.isMerging) return;
                
                const level = parseInt(bodyA.label.split('_')[1]);
                if (level < 11) {
                    bodyA.isMerging = true;
                    bodyB.isMerging = true;
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
        // 합성 큐 처리 (사라졌다 나타나는 깜빡임 해결)
        while (mergeQueue.length > 0) {
            const { bodyA, bodyB, level, x, y } = mergeQueue.shift();
            if (Composite.allBodies(world).includes(bodyA) && Composite.allBodies(world).includes(bodyB)) {
                Composite.remove(world, [bodyA, bodyB]);
                
                const nextLevel = level + 1;
                Composite.add(world, createFruit(x, y, nextLevel));

                score += FRUITS[level - 1].score;
                document.getElementById('score').innerText = score;
            }
        }

        // 게임오버 체크 (상단 데드라인 100px 미만 유지 시)
        if (!isGameOver) {
            const fruits = Composite.allBodies(world).filter(b => b.label && b.label.startsWith('fruit_') && !b.isStatic);
            for (let fruit of fruits) {
                if (fruit.position.y < 100 && Math.abs(fruit.velocity.y) < 0.2) {
                    isGameOver = true;
                    document.getElementById('game-over').style.display = 'flex';
                    document.getElementById('final-score').innerText = score;
                }
            }
        }
    });

    // 실행
    Render.run(render);
    // Runner 설정 최적화: 웹에서 속도가 느려지는 문제 해결 (isFixed: true)
    const runner = Runner.create({ isFixed: true });
    Runner.run(runner, engine);
    spawnFruit();
    render.canvas.style.width = "400px";
render.canvas.style.height = "600px";
render.canvas.style.maxWidth = "400px"; // 시각적 늘어남 방지
render.canvas.style.margin = "0 auto";
});
