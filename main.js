document.addEventListener('DOMContentLoaded', () => {
    const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;

    const engine = Engine.create();
    const world = engine.world;
    const container = document.getElementById('game-container');
    const outer = document.getElementById('game-outer');

    // 상태 변수
    let currentSkinType = 'A';
    let score = 0;
    let isGameOver = false;
    let currentFruit = null;
    let canDrop = true;
    const mergeQueue = [];

    const GAME_WIDTH = 400;
    const GAME_HEIGHT = 600;

    const FRUITS = [
        { radius: 17.5, score: 2 }, { radius: 27.5, score: 4 }, { radius: 42.5, score: 8 },
        { radius: 52.5, score: 16 }, { radius: 67.5, score: 32 }, { radius: 82.5, score: 64 },
        { radius: 97.5, score: 128 }, { radius: 117.5, score: 256 }, { radius: 137.5, score: 512 },
        { radius: 157.5, score: 1024 }, { radius: 187.5, score: 2048 }
    ];

    // 렌더러 설정
    const render = Render.create({
        element: container,
        engine: engine,
        options: {
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
            wireframes: false,
            background: 'transparent' // HTML 배경을 사용하기 위해 투명 설정
        }
    });

    // 벽 생성
    const wallOptions = { isStatic: true, render: { visible: false } };
    Composite.add(world, [
        Bodies.rectangle(200, 590, 400, 20, wallOptions), // 바닥
        Bodies.rectangle(5, 300, 10, 600, wallOptions),  // 왼쪽
        Bodies.rectangle(395, 300, 10, 600, wallOptions) // 오른쪽
    ]);

    function createFruit(x, y, level, isStatic = false) {
        const fruitData = FRUITS[level - 1];
        const indexStr = String(level - 1).padStart(2, '0');
        const prefix = (currentSkinType === 'A') ? 'fruit' : 'skinB_fruit';
        
        const fruit = Bodies.circle(x, y, fruitData.radius, {
            label: `fruit_${level}`,
            isStatic: isStatic,
            restitution: 0.3,
            render: {
                sprite: {
                    texture: `asset/${prefix}${indexStr}.png`,
                    xScale: (fruitData.radius * 2) / 100, // 이미지 크기에 맞춰 조절 (기본 100px 가정)
                    yScale: (fruitData.radius * 2) / 100
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

    // 입력 처리 로직
    const handleMove = (e) => {
        if (currentFruit && canDrop && !isGameOver) {
            const rect = container.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let x = clientX - rect.left;
            
            const radius = FRUITS[parseInt(currentFruit.label.split('_')[1]) - 1].radius;
            x = Math.max(radius + 10, Math.min(GAME_WIDTH - radius - 10, x));
            Body.setPosition(currentFruit, { x: x, y: 80 });
        }
    };

    const handleDrop = (e) => {
        if (e.target.closest('.top-btn-group') || isGameOver) return;
        if (currentFruit && canDrop) {
            canDrop = false;
            Body.setStatic(currentFruit, false);
            currentFruit = null;
            setTimeout(spawnFruit, 1000);
        }
    };

    outer.addEventListener('mousemove', handleMove);
    outer.addEventListener('touchmove', handleMove, { passive: false });
    outer.addEventListener('mousedown', handleDrop);
    outer.addEventListener('touchend', handleDrop);

    // 전역 함수 등록 (HTML 버튼용)
    window.toggleSkin = function() {
        currentSkinType = (currentSkinType === 'A') ? 'B' : 'A';
        const prefix = (currentSkinType === 'A') ? 'fruit' : 'skinB_fruit';
        
        Composite.allBodies(world).forEach(body => {
            if (body.label && body.label.startsWith('fruit_')) {
                const level = parseInt(body.label.split('_')[1]);
                body.render.sprite.texture = `asset/${prefix}${String(level-1).padStart(2,'0')}.png`;
            }
        });
    };

    window.resetGame = () => location.reload();

    // 합성 로직
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
            const fruits = Composite.allBodies(world).filter(b => b.label?.startsWith('fruit_') && !b.isStatic);
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
});
