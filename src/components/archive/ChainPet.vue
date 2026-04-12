<script setup>
// UNUSED, keep archived
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { Engine, Runner, World, Bodies, Body, Composite, Composites, Constraint } from "matter-js";

const { ipcRenderer } = require("electron");

const LINK_COUNT = 13;
const LINK_WIDTH = 50;
const LINK_HEIGHT = 20;
const LINK_GAP_X = 20;
const LINK_GAP_Y = 130;
const WALL_THICKNESS = 50;
const CURSOR_IMPACT_RADIUS = 5;
const BLOB_EDGE_WIDTH = 50;

const links = ref([]);
const grabbing = ref(false);
const blobArea = ref(null);
const blobEdge = ref(null);
const cursor = ref({
    x: 0,
    y: 0,
    visible: false,
});

let engine;
let runner;
let rope;
let loopConstraint;
let shapeSprings = [];
let walls = [];
let activeBody = null;
let cursorImpactBody;
let cursorActive = false;
let cursorInsideBlob = false;
let mousePosition = { x: 0, y: 0 };
let animationFrameId;

const getConstraintPoint = (body, point) => {
    if (!body) {
        return point || { x: 0, y: 0 };
    }

    const local = point || { x: 0, y: 0 };
    const cos = Math.cos(body.angle);
    const sin = Math.sin(body.angle);

    return {
        x: body.position.x + local.x * cos - local.y * sin,
        y: body.position.y + local.x * sin + local.y * cos,
    };
};

const springSegments = computed(() => {
    // Depend on reactive animation updates so these points refresh per frame.
    links.value.length;

    if (!rope) {
        return [];
    }

    const chainConstraints = rope.constraints || [];
    const allConstraints = [...chainConstraints, ...shapeSprings];

    if (loopConstraint) {
        allConstraints.push(loopConstraint);
    }

    return allConstraints
        .map((constraint, index) => {
            const start = getConstraintPoint(constraint.bodyA, constraint.pointA);
            const end = getConstraintPoint(constraint.bodyB, constraint.pointB);

            return {
                id: `spring-${index}`,
                x1: start.x,
                y1: start.y,
                x2: end.x,
                y2: end.y,
            };
        })
        .filter((segment) => Number.isFinite(segment.x1) && Number.isFinite(segment.y1) && Number.isFinite(segment.x2) && Number.isFinite(segment.y2));
});

const blobHitPath = computed(() => {
    if (links.value.length < 3) {
        return "";
    }

    const points = links.value.map((link) => ({
        x: link.x + LINK_WIDTH / 2,
        y: link.y + LINK_HEIGHT / 2,
    }));

    const count = points.length;
    const smooth = 0.2;
    const toCoord = (value) => Number(value.toFixed(2));
    let path = `M ${toCoord(points[0].x)} ${toCoord(points[0].y)}`;

    for (let i = 0; i < count; i += 1) {
        const p0 = points[(i - 1 + count) % count];
        const p1 = points[i];
        const p2 = points[(i + 1) % count];
        const p3 = points[(i + 2) % count];

        const c1x = p1.x + (p2.x - p0.x) * smooth;
        const c1y = p1.y + (p2.y - p0.y) * smooth;
        const c2x = p2.x - (p3.x - p1.x) * smooth;
        const c2y = p2.y - (p3.y - p1.y) * smooth;

        path += ` C ${toCoord(c1x)} ${toCoord(c1y)}, ${toCoord(c2x)} ${toCoord(c2y)}, ${toCoord(p2.x)} ${toCoord(p2.y)}`;
    }

    return `${path} Z`;
});

const blobCursorClass = computed(() => {
    if (grabbing.value) {
        return "grabbing";
    }

    if (cursorActive) {
        return "grab";
    }

    return "";
});

const createShapeSprings = (bodies) => {
    const springs = [];
    const count = bodies.length;
    const oppositeOffset = Math.floor(count / 2);

    for (let i = 0; i < count; i += 1) {
        const oppositeIndex = (i + oppositeOffset) % count;
        if (i < oppositeIndex) {
            springs.push(
                Constraint.create({
                    bodyA: bodies[i],
                    bodyB: bodies[oppositeIndex],
                    stiffness: 0.01,
                    damping: 0.16,
                    length: 130,
                })
            );
        }

        const arcIndex = (i + 3) % count;
        if (i < arcIndex) {
            springs.push(
                Constraint.create({
                    bodyA: bodies[i],
                    bodyB: bodies[arcIndex],
                    stiffness: 0.015,
                    damping: 0.14,
                    length: 90,
                })
            );
        }
    }

    return springs;
};

const syncLinks = () => {
    if (!rope) {
        return;
    }

    links.value = rope.bodies.map((body) => ({
        x: body.position.x - LINK_WIDTH / 2,
        y: body.position.y - LINK_HEIGHT / 2,
        angle: body.angle,
    }));
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

    const x = Math.min(Math.max(event.clientX, LINK_WIDTH / 2), window.innerWidth - LINK_WIDTH / 2);
    const y = Math.min(Math.max(event.clientY, LINK_HEIGHT / 2), window.innerHeight - LINK_HEIGHT / 2);

    Body.setPosition(activeBody, { x, y });
    Body.setVelocity(activeBody, { x: 0, y: 0 });
    syncLinks();
};

const beginDrag = (event, body) => {
    if (event.button !== 0 || !body) {
        return;
    }

    activeBody = body;
    Body.setStatic(activeBody, true);
    Body.setVelocity(activeBody, { x: 0, y: 0 });
    grabbing.value = true;
    updateDragPosition(event);
};

const findClosestBodyToPoint = (x, y) => {
    if (!rope || rope.bodies.length === 0) {
        return null;
    }

    const entries = rope.bodies.map((body) => {
        const dx = body.position.x - x;
        const dy = body.position.y - y;
        return {
            body,
            distanceSq: dx * dx + dy * dy,
        };
    });

    entries.sort((a, b) => a.distanceSq - b.distanceSq);
    const nearestDistanceSq = entries[0].distanceSq;

    // When grabbing inside the blob, prefer visually higher segments among nearby candidates.
    const nearbyCandidates = entries.filter((entry) => entry.distanceSq <= nearestDistanceSq + 2800);
    let chosenBody = nearbyCandidates[0].body;
    let bestY = chosenBody.position.y;

    nearbyCandidates.forEach((entry) => {
        if (entry.body.position.y < bestY) {
            bestY = entry.body.position.y;
            chosenBody = entry.body;
        }
    });

    return chosenBody;
};

const startDrag = (event, index) => {
    if (!rope || !rope.bodies[index]) {
        return;
    }

    beginDrag(event, rope.bodies[index]);
};

const startBlobDrag = (event) => {
    const closestBody = findClosestBodyToPoint(event.clientX, event.clientY);
    beginDrag(event, closestBody);
};

const onDrag = (event) => {
    if (!grabbing.value) {
        return;
    }

    updateDragPosition(event);
};

const stopDrag = () => {
    if (!grabbing.value) {
        return;
    }

    if (activeBody) {
        Body.setStatic(activeBody, false);
    }

    activeBody = null;
    grabbing.value = false;
};

const updateCursorBody = () => {
    if (!cursorImpactBody) {
        return;
    }

    if (!cursorActive || cursorInsideBlob || grabbing.value) {
        Body.setPosition(cursorImpactBody, { x: 0, y: 0 });
        cursor.value = {
            x: 0,
            y: 0,
            visible: false,
        };
        return;
    }

    const x = Math.min(Math.max(mousePosition.x, CURSOR_IMPACT_RADIUS), window.innerWidth - CURSOR_IMPACT_RADIUS);
    const y = Math.min(Math.max(mousePosition.y, CURSOR_IMPACT_RADIUS), window.innerHeight - CURSOR_IMPACT_RADIUS);
    Body.setPosition(cursorImpactBody, { x, y });
    cursor.value = {
        x,
        y,
        visible: true,
    };
};

const isPointInSvgPath = (pathElement, x, y, mode) => {
    if (!pathElement || !pathElement.ownerSVGElement) {
        return false;
    }

    const svg = pathElement.ownerSVGElement;
    const svgPoint = svg.createSVGPoint();
    svgPoint.x = x;
    svgPoint.y = y;

    const ctm = pathElement.getScreenCTM();
    if (!ctm) {
        return false;
    }

    const localPoint = svgPoint.matrixTransform(ctm.inverse());

    if (mode === "fill" && typeof pathElement.isPointInFill === "function") {
        return pathElement.isPointInFill(localPoint);
    }

    if (mode === "stroke" && typeof pathElement.isPointInStroke === "function") {
        return pathElement.isPointInStroke(localPoint);
    }

    return false;
};

const updateHoverState = (x, y) => {
    const element = document.elementFromPoint(x, y);
    const insideBlobFill = isPointInSvgPath(blobArea.value, x, y, "fill");
    const insideBlobBand = isPointInSvgPath(blobEdge.value, x, y, "stroke");
    const onLink = Boolean(element?.closest(".link"));

    const insideBlob = insideBlobFill;
    const onNearGrabArea = insideBlobBand || onLink;

    cursorInsideBlob = insideBlob;
    cursorActive = insideBlob || onNearGrabArea;
    ipcRenderer.send("set-ignore-mouse-events", !cursorActive);
};

const onMouseMove = (event) => {
    mousePosition = { x: event.clientX, y: event.clientY };
    updateHoverState(event.clientX, event.clientY);

    if (grabbing.value) {
        onDrag(event);
    }

    updateCursorBody();
};

const onMouseOver = (event) => {
    updateHoverState(event.clientX, event.clientY);
    updateCursorBody();
};

const onResize = () => {
    rebuildWalls();
    updateCursorBody();
};

const animate = () => {
    syncLinks();
    updateCursorBody();
    animationFrameId = window.requestAnimationFrame(animate);
};

onMounted(() => {
    engine = Engine.create({
        gravity: { x: 0, y: 0.8 },
    });

    const group = Body.nextGroup(true);

    // Rope C approach: stacked chamfered links chained with short constraints.
    rope = Composites.stack(620, 70, LINK_COUNT, 1, LINK_GAP_X, LINK_GAP_Y, (x, y) =>
        Bodies.rectangle(x - 20, y, LINK_WIDTH, LINK_HEIGHT, {
            collisionFilter: { group },
            chamfer: 5,
            friction: 0.2,
            frictionAir: 0.015,
            restitution: 0.2,
        })
    );

    Composites.chain(rope, 0.3, 0, -0.3, 0, {
        stiffness: 1,
        length: 0,
    });

    const firstBody = rope.bodies[0];
    const lastBody = rope.bodies[rope.bodies.length - 1];
    loopConstraint = Constraint.create({
        bodyA: lastBody,
        bodyB: firstBody,
        pointA: { x: LINK_WIDTH * 0.3, y: 0 },
        pointB: { x: -LINK_WIDTH * 0.3, y: 0 },
        stiffness: 1,
        length: 0,
    });

    shapeSprings = createShapeSprings(rope.bodies);

    cursorImpactBody = Bodies.circle(0, 0, CURSOR_IMPACT_RADIUS, {
        isStatic: true,
        friction: 0,
        frictionAir: 0,
        restitution: 0,
    });

    walls = createWalls(window.innerWidth, window.innerHeight);
    Composite.add(engine.world, [rope, loopConstraint, ...shapeSprings, cursorImpactBody, ...walls]);

    runner = Runner.create();
    Runner.run(runner, engine);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDrag);
    window.addEventListener("resize", onResize);
    document.addEventListener("mouseover", onMouseOver);

    syncLinks();
    animate();
});

onBeforeUnmount(() => {
    window.removeEventListener("mousemove", onMouseMove);
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
    rope = null;
    loopConstraint = null;
    shapeSprings = [];
    cursorImpactBody = null;
    cursorActive = false;
    cursorInsideBlob = false;
    mousePosition = { x: 0, y: 0 };
    links.value = [];
});
</script>

<template>
    <svg class="blob" aria-hidden="true">
        <path ref="blobArea" class="blob-area" :class="blobCursorClass" :d="blobHitPath" @mousedown="startBlobDrag" />
        <path ref="blobEdge" class="blob-edge" :class="blobCursorClass" :d="blobHitPath"
            :style="{ strokeWidth: `${BLOB_EDGE_WIDTH}px` }" @mousedown="startBlobDrag" />
    </svg>

    <svg class="springs" aria-hidden="true">
        <line v-for="segment in springSegments" :key="segment.id" class="spring" :x1="segment.x1" :y1="segment.y1"
            :x2="segment.x2" :y2="segment.y2" />
    </svg>

    <div v-if="cursor.visible" class="cursor" :style="{
            left: `${cursor.x - CURSOR_IMPACT_RADIUS}px`,
            top: `${cursor.y - CURSOR_IMPACT_RADIUS}px`,
            width: `${CURSOR_IMPACT_RADIUS * 2}px`,
            height: `${CURSOR_IMPACT_RADIUS * 2}px`
        }" aria-hidden="true" />

    <div v-for="(link, index) in links" :key="index" class="link" :style="{
            left: `${link.x}px`,
            top: `${link.y}px`,
            transform: `rotate(${link.angle}rad)`
        }" :class="{ grabbing }" @mousedown="startDrag($event, index)" />
</template>

<style scoped>
.blob {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.blob-area {
    fill: rgba(0, 0, 0, 0.35);
    pointer-events: all;
}

.blob-edge {
    fill: none;
    stroke: rgba(255, 255, 255, 0.1);
    pointer-events: stroke;
}

.blob-area.grab,
.blob-edge.grab {
    cursor: grab;
}

.blob-area.grabbing,
.blob-edge.grabbing {
    cursor: grabbing;
}

.springs {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.spring {
    stroke: rgba(255, 255, 255, 0.1);
    stroke-width: 1;
    stroke-linecap: round;
}

.cursor {
    position: absolute;
    border-radius: 50%;
    border: 1px solid aqua;
    pointer-events: none;
}

.link {
    position: absolute;
    width: 50px;
    height: 20px;
    border-radius: 6px;
    border: 1px solid aqua;
    background: rgba(255, 255, 255, 0.1);
    cursor: grab;
    user-select: none;
    transform-origin: center;
    -webkit-app-region: no-drag;
}

.link.grabbing {
    cursor: grabbing;
}
</style>