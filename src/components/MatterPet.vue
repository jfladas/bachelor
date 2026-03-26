<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { Engine, Runner, World, Bodies, Body, Constraint } from "matter-js";

const { ipcRenderer } = require("electron");

const BALL_RADII = [24, 30, 30, 28, 40];
const BALL_COUNT = BALL_RADII.length;
const WALL_THICKNESS = 50;
const FLING_SAMPLE_WINDOW_MS = 120;
const FLING_MAX_SPEED = 35;
const MS_PER_STEP = 1000 / 60;
const CHAIN_GAP = 5;
const OUTLINE_PADDING = 10;
const OUTLINE_SMOOTH_FACTOR = 0.25;

const positions = ref([]);
const dragging = ref(false);

let engine;
let runner;
let petBodies = [];
let chainConstraints = [];
let walls = [];
let animationFrameId;
let dragSamples = [];
let activeBody = null;

const outlinePoints = computed(() => {
    if (positions.value.length < 3) {
        return [];
    }

    const centers = positions.value.map((ball) => ({
        cx: ball.x + ball.radius,
        cy: ball.y + ball.radius,
        radius: ball.radius,
    }));

    const centroid = centers.reduce(
        (acc, point) => ({
            x: acc.x + point.cx,
            y: acc.y + point.cy,
        }),
        { x: 0, y: 0 }
    );

    centroid.x /= centers.length;
    centroid.y /= centers.length;

    return centers.map((point) => {
        let dx = point.cx - centroid.x;
        let dy = point.cy - centroid.y;
        const magnitude = Math.hypot(dx, dy) || 1;

        dx /= magnitude;
        dy /= magnitude;

        return {
            x: point.cx + dx * (point.radius + OUTLINE_PADDING),
            y: point.cy + dy * (point.radius + OUTLINE_PADDING),
        };
    });
});

const ringOutlinePath = computed(() => {
    if (outlinePoints.value.length < 3) {
        return "";
    }

    const outerPoints = outlinePoints.value;

    const count = outerPoints.length;
    if (count < 3) {
        return "";
    }

    const toCoord = (value) => Number(value.toFixed(2));
    let path = `M ${toCoord(outerPoints[0].x)} ${toCoord(outerPoints[0].y)}`;

    for (let i = 0; i < count; i += 1) {
        const p0 = outerPoints[(i - 1 + count) % count];
        const p1 = outerPoints[i];
        const p2 = outerPoints[(i + 1) % count];
        const p3 = outerPoints[(i + 2) % count];

        const c1x = p1.x + (p2.x - p0.x) * OUTLINE_SMOOTH_FACTOR;
        const c1y = p1.y + (p2.y - p0.y) * OUTLINE_SMOOTH_FACTOR;
        const c2x = p2.x - (p3.x - p1.x) * OUTLINE_SMOOTH_FACTOR;
        const c2y = p2.y - (p3.y - p1.y) * OUTLINE_SMOOTH_FACTOR;

        path += ` C ${toCoord(c1x)} ${toCoord(c1y)}, ${toCoord(c2x)} ${toCoord(c2y)}, ${toCoord(p2.x)} ${toCoord(p2.y)}`;
    }

    return `${path} Z`;
});

const syncPetPositions = () => {
    if (petBodies.length === 0) {
        return;
    }

    positions.value = petBodies.map((body) => ({
        x: body.position.x - body.circleRadius,
        y: body.position.y - body.circleRadius,
        radius: body.circleRadius,
    }));
};

const createBallBodies = (centerX, centerY) => {
    const spread = Math.max(...BALL_RADII) * 2.6;
    const bodies = [];

    for (let i = 0; i < BALL_COUNT; i += 1) {
        const angle = (i / BALL_COUNT) * Math.PI * 2;
        const radius = BALL_RADII[i];
        bodies.push(
            Bodies.circle(centerX + Math.cos(angle) * spread, centerY + Math.sin(angle) * spread, radius, {
                restitution: 1,
                friction: 0.001,
                frictionAir: 0.01,
                slop: 0,
            })
        );
    }

    return bodies;
};

const createChainConstraints = (bodies) => {
    const constraints = [];

    for (let i = 0; i < bodies.length; i += 1) {
        const nextIndex = (i + 1) % bodies.length;
        const length = bodies[i].circleRadius + bodies[nextIndex].circleRadius + CHAIN_GAP;
        constraints.push(
            Constraint.create({
                bodyA: bodies[i],
                bodyB: bodies[nextIndex],
                length,
                stiffness: 0,
                damping: 1,
            })
        );
    }

    return constraints;
};

const createWalls = (width, height) => {
    const halfWall = WALL_THICKNESS / 2;

    return [
        Bodies.rectangle(width / 2, -halfWall, width + WALL_THICKNESS * 2, WALL_THICKNESS, { isStatic: true }),
        Bodies.rectangle(width / 2, height + halfWall, width + WALL_THICKNESS * 2, WALL_THICKNESS, { isStatic: true }),
        Bodies.rectangle(-halfWall, height / 2, WALL_THICKNESS, height + WALL_THICKNESS * 2, { isStatic: true }),
        Bodies.rectangle(width + halfWall, height / 2, WALL_THICKNESS, height + WALL_THICKNESS * 2, { isStatic: true }),
    ];
};

const rebuildWalls = () => {
    if (!engine) {
        return;
    }

    if (walls.length > 0) {
        World.remove(engine.world, walls);
    }

    walls = createWalls(window.innerWidth, window.innerHeight);
    World.add(engine.world, walls);
};

const updateDragPosition = (event) => {
    if (!activeBody) {
        return;
    }

    const radius = activeBody.circleRadius;
    const x = Math.min(Math.max(event.clientX, radius), window.innerWidth - radius);
    const y = Math.min(Math.max(event.clientY, radius), window.innerHeight - radius);

    Body.setPosition(activeBody, { x, y });
    Body.setVelocity(activeBody, { x: 0, y: 0 });

    const now = performance.now();
    dragSamples.push({ x, y, t: now });
    dragSamples = dragSamples.filter((sample) => sample.t >= now - FLING_SAMPLE_WINDOW_MS);

    syncPetPositions();
};

const startDrag = (event, index) => {
    if (!petBodies[index]) {
        return;
    }

    activeBody = petBodies[index];

    if (activeBody) {
        Body.setStatic(activeBody, true);
        Body.setVelocity(activeBody, { x: 0, y: 0 });
    }

    dragging.value = true;
    dragSamples = [];
    updateDragPosition(event);
};

const onDrag = (event) => {
    if (!dragging.value) {
        return;
    }

    updateDragPosition(event);
};

const stopDrag = () => {
    if (!dragging.value) {
        return;
    }

    if (activeBody) {
        let flingVelocity = { x: 0, y: 0 };

        if (dragSamples.length >= 2) {
            const firstSample = dragSamples[0];
            const lastSample = dragSamples[dragSamples.length - 1];
            const dtMs = Math.max(lastSample.t - firstSample.t, 1);
            const velocityX = ((lastSample.x - firstSample.x) / dtMs) * MS_PER_STEP;
            const velocityY = ((lastSample.y - firstSample.y) / dtMs) * MS_PER_STEP;

            flingVelocity = {
                x: Math.max(Math.min(velocityX, FLING_MAX_SPEED), -FLING_MAX_SPEED),
                y: Math.max(Math.min(velocityY, FLING_MAX_SPEED), -FLING_MAX_SPEED),
            };
        }

        Body.setStatic(activeBody, false);
        Body.setVelocity(activeBody, flingVelocity);
    }

    activeBody = null;
    dragging.value = false;
    dragSamples = [];
};

const onMouseOver = (event) => {
    if (event.target.closest(".pet")) {
        ipcRenderer.send("set-ignore-mouse-events", false);
    } else {
        ipcRenderer.send("set-ignore-mouse-events", true);
    }
};

const onResize = () => {
    rebuildWalls();

    if (petBodies.length > 0) {
        petBodies.forEach((body) => {
            const radius = body.circleRadius;
            const x = Math.min(Math.max(body.position.x, radius), window.innerWidth - radius);
            const y = Math.min(Math.max(body.position.y, radius), window.innerHeight - radius);

            Body.setPosition(body, { x, y });
            Body.setVelocity(body, { x: 0, y: 0 });
        });

        syncPetPositions();
    }
};

const animate = () => {
    syncPetPositions();
    animationFrameId = window.requestAnimationFrame(animate);
};

onMounted(() => {
    engine = Engine.create({
        gravity: { x: 0, y: 0.8 },
    });


    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    petBodies = createBallBodies(centerX, centerY);
    chainConstraints = createChainConstraints(petBodies);
    positions.value = petBodies.map((body) => ({
        x: body.position.x - body.circleRadius,
        y: body.position.y - body.circleRadius,
        radius: body.circleRadius,
    }));

    walls = createWalls(window.innerWidth, window.innerHeight);
    World.add(engine.world, [...petBodies, ...chainConstraints, ...walls]);

    runner = Runner.create();
    Runner.run(runner, engine);

    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", stopDrag);
    window.addEventListener("resize", onResize);
    document.addEventListener("mouseover", onMouseOver);

    animate();
});

onBeforeUnmount(() => {
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", stopDrag);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("mouseover", onMouseOver);

    if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
    }

    if (runner) {
        Runner.stop(runner);
    }

    if (engine) {
        World.clear(engine.world, false);
        Engine.clear(engine);
    }

    activeBody = null;
    petBodies = [];
    chainConstraints = [];
    positions.value = [];
});
</script>

<template>
    <svg class="chain-overlay" aria-hidden="true">
        <path :d="ringOutlinePath" class="chain-outline" />

        <circle v-for="(point, index) in outlinePoints" :key="`outline-point-${index}`" class="chain-outline-point"
            :cx="point.x" :cy="point.y" r="3.5" />

        <line v-for="(ballPosition, index) in positions" :key="`chain-${index}`"
            :x1="ballPosition.x + ballPosition.radius" :y1="ballPosition.y + ballPosition.radius"
            :x2="positions[(index + 1) % positions.length]?.x + positions[(index + 1) % positions.length]?.radius"
            :y2="positions[(index + 1) % positions.length]?.y + positions[(index + 1) % positions.length]?.radius" />
    </svg>

    <div v-for="(ballPosition, index) in positions" :key="index" class="pet" :style="{
            left: `${ballPosition.x}px`,
            top: `${ballPosition.y}px`,
            width: `${ballPosition.radius * 2}px`,
            height: `${ballPosition.radius * 2}px`
        }" :class="{ dragging }" @mousedown="startDrag($event, index)" />
</template>

<style scoped>
.chain-overlay {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.chain-overlay line {
    stroke: aqua;
    stroke-width: 1;
    stroke-linecap: round;
}

.chain-outline {
    stroke: aqua;
    stroke-width: 1;
    stroke-linejoin: round;
    stroke-linecap: round;
}

.chain-outline-point {
    fill: rgba(255, 255, 255, 0.1);
    stroke: aqua;
    stroke-width: 1;
}

.pet {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #88fff1 0%, #3da8e2 50%, #4408ab 100%);
    cursor: grab;
    user-select: none;
    -webkit-app-region: no-drag;
}

.pet.dragging {
    cursor: grabbing;
}
</style>