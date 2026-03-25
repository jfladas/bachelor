<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { Engine, Runner, World, Bodies, Body } from "matter-js";

const { ipcRenderer } = require("electron");

const PET_RADIUS = 36;
const WALL_THICKNESS = 40;
const FLING_SAMPLE_WINDOW_MS = 120;
const FLING_MAX_SPEED = 35;
const MS_PER_STEP = 1000 / 60;

const pet = ref(null);
const position = ref({ x: 100, y: 100 });
const dragging = ref(false);

let engine;
let runner;
let petBody;
let walls = [];
let animationFrameId;
let dragSamples = [];

const syncPetPosition = () => {
    if (!petBody) {
        return;
    }

    position.value = {
        x: petBody.position.x - PET_RADIUS,
        y: petBody.position.y - PET_RADIUS,
    };
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
    if (!petBody) {
        return;
    }

    const x = Math.min(Math.max(event.clientX, PET_RADIUS), window.innerWidth - PET_RADIUS);
    const y = Math.min(Math.max(event.clientY, PET_RADIUS), window.innerHeight - PET_RADIUS);

    Body.setPosition(petBody, { x, y });
    Body.setVelocity(petBody, { x: 0, y: 0 });

    const now = performance.now();
    dragSamples.push({ x, y, t: now });
    dragSamples = dragSamples.filter((sample) => sample.t >= now - FLING_SAMPLE_WINDOW_MS);

    syncPetPosition();
};

const startDrag = (event) => {
    if (petBody) {
        Body.setStatic(petBody, true);
        Body.setVelocity(petBody, { x: 0, y: 0 });
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

    if (petBody) {
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

        Body.setStatic(petBody, false);
        Body.setVelocity(petBody, flingVelocity);
    }

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

    if (petBody) {
        const x = Math.min(Math.max(petBody.position.x, PET_RADIUS), window.innerWidth - PET_RADIUS);
        const y = Math.min(Math.max(petBody.position.y, PET_RADIUS), window.innerHeight - PET_RADIUS);

        Body.setPosition(petBody, { x, y });
        Body.setVelocity(petBody, { x: 0, y: 0 });
        syncPetPosition();
    }
};

const animate = () => {
    syncPetPosition();
    animationFrameId = window.requestAnimationFrame(animate);
};

onMounted(() => {
    engine = Engine.create({
        gravity: { x: 0, y: 0.8 },
    });

    petBody = Bodies.circle(position.value.x + PET_RADIUS, position.value.y + PET_RADIUS, PET_RADIUS, {
        restitution: 0.7,
        friction: 0.001,
        frictionAir: 0.01,
    });

    walls = createWalls(window.innerWidth, window.innerHeight);
    World.add(engine.world, [petBody, ...walls]);

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
});
</script>

<template>
    <div ref="pet" class="pet" :style="{
      left: `${position.x}px`,
      top: `${position.y}px`
    }" :class="{ dragging }" @mousedown="startDrag" />
</template>

<style scoped>
.pet {
    position: absolute;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #88fff1 0%, #3da8e2 50%, #4408ab 100%);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35), inset -6px -10px 16px rgba(0, 0, 0, 0.2);
    cursor: grab;
    user-select: none;
    -webkit-app-region: no-drag;
}

.pet.dragging {
    cursor: grabbing;
}
</style>
