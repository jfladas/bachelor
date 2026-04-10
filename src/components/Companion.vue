<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { Engine, Runner, World, Bodies, Body, Constraint } from "matter-js";
import eyesDefaultImage from "../assets/face/eyes_default.svg";
import mouthDefaultImage from "../assets/face/mouth_default.svg";

// placeholder props
const props = defineProps({
    onboardingData: {
        type: Object,
        default: () => ({
            hue: 220,
            assignedHue: 220,
            symmetry: 0.5,
            variability: 0.5,
            activity: 0.5,
            reaction: "sparkles",
        }),
    },
});

const { ipcRenderer } = require("electron");

//const BALL_RADII = [20, 15, 15, 20, 25];
//const BALL_RADII = [20, 20, 20, 20, 25];
const BALL_RADII = [20, 20, 20, 20, 20];
const CHAIN_GAP = 0;
const BALL_COUNT = BALL_RADII.length;
const WALL_THICKNESS = 500;
const OUTLINE_PADDING = 10;
const OUTLINE_SMOOTH_FACTOR = 0.25;
const OVERLAP_PASSES = 3;
const EDGE_WIDTH = 20;
const MAX_BALL_SPEED = 50;
const CONVEX_ANGLE = 60;
const PETTING_SCALE = 0.7;
const PETTING_LERP = 0.03;
const CENTER_LERP_MIN = 0.1;
const CENTER_LERP_MAX = 0.7;
const POSITION_STORAGE_KEY = "desktop-companion:blob-center";
const POSITION_PERSIST_INTERVAL_MS = 400;

const positions = ref([]);
const grabbing = ref(false);
const blobArea = ref(null);
const blobEdge = ref(null);
const smoothBlobCenter = ref(null);

let engine;
let runner;
let ballBodies = [];
let chainConstraints = [];
let walls = [];
let animationFrameId;
let activeBody = null;
let cursorInsideBlob = false;
let mousePosition = { x: 0, y: 0 };
let ballScaleFactors = [];
let availableSizePollId;
let lastAvailableScreenSize = { width: 0, height: 0 };
let lastViewportBounds = { width: 1, height: 1 };
let lastPositionPersistAt = 0;

const dev = false; // dev mode shows physics bodies and outlines for debugging

const reactionOptions = ["sparkles", "flowers", "hearts"];

const getViewportBounds = () => {
    const visualWidth = window.visualViewport?.width;
    const visualHeight = window.visualViewport?.height;
    const width = Number.isFinite(visualWidth) ? visualWidth : window.innerWidth;
    const height = Number.isFinite(visualHeight) ? visualHeight : window.innerHeight;

    return {
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
    };
};

const getAvailableScreenSize = () => ({
    width: Math.max(1, Math.floor(window.screen?.availWidth || window.innerWidth)),
    height: Math.max(1, Math.floor(window.screen?.availHeight || window.innerHeight)),
});

const getBallClusterCenter = () => {
    if (ballBodies.length === 0) {
        return null;
    }

    const total = ballBodies.reduce(
        (acc, body) => ({
            x: acc.x + body.position.x,
            y: acc.y + body.position.y,
        }),
        { x: 0, y: 0 }
    );

    return {
        x: total.x / ballBodies.length,
        y: total.y / ballBodies.length,
    };
};

const saveCompanionPosition = () => {
    const center = getBallClusterCenter();
    if (!center) {
        return;
    }

    const { width, height } = getViewportBounds();
    const payload = {
        xRatio: Math.min(1, Math.max(0, center.x / width)),
        yRatio: Math.min(1, Math.max(0, center.y / height)),
        savedAt: Date.now(),
    };

    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(payload));
};

const getSavedCompanionCenter = () => {
    try {
        const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);
        if (!Number.isFinite(parsed?.xRatio) || !Number.isFinite(parsed?.yRatio)) {
            return null;
        }

        const { width, height } = getViewportBounds();
        return {
            x: Math.min(width, Math.max(0, parsed.xRatio * width)),
            y: Math.min(height, Math.max(0, parsed.yRatio * height)),
        };
    } catch {
        return null;
    }
};

const clampHue = (value, fallback = 220) => {
    const numericHue = Number(value);
    if (!Number.isFinite(numericHue)) {
        return fallback;
    }

    return ((Math.round(numericHue) % 360) + 360) % 360;
};

const clampUnit = (value, fallback = 0.5) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return fallback;
    }

    return Math.min(1, Math.max(0, numericValue));
};

const hue = computed(() => {
    return clampHue(props.onboardingData?.hue, 220);
});

const assignedHue = computed(() => clampHue(props.onboardingData?.assignedHue, hue.value));

const symmetry = computed(() => clampUnit(props.onboardingData?.symmetry, 0.5));

const variability = computed(() => clampUnit(props.onboardingData?.variability, 0.5));

const activity = computed(() => clampUnit(props.onboardingData?.activity, 0.5));

const reaction = computed(() => {
    const reaction = props.onboardingData?.reaction;
    if (typeof reaction === "string" && reactionOptions.includes(reaction)) {
        return reaction;
    }

    return "sparkles";
});

const hueVariables = computed(() => ({
    "--hue": `${hue.value}deg`,
    "--white": "oklch(95% 0.01 var(--hue))",
    "--shadow": "oklch(20% 0.02 var(--hue) / 0.5)",
    "--primary": "oklch(71% 0.16 var(--hue))",
    "--lighter": "oklch(80% 0.1 var(--hue))",
    "--darker": "oklch(63% 0.14 var(--hue))",
    "--text-strong": "oklch(20% 0.04 var(--hue))",
    "--text": "oklch(40% 0.02 var(--hue))",
    "--text-muted": "oklch(80% 0.02 var(--hue))",
    "--secondary": "oklch(90% 0.02 var(--hue))",
    "--secondary-hover": "oklch(85% 0.03 var(--hue))",
}));

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

const blobPath = computed(() => {
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

const blobCenter = computed(() => {
    if (positions.value.length === 0) {
        return null;
    }

    const totals = positions.value.reduce(
        (acc, ball) => ({
            x: acc.x + ball.x + ball.radius,
            y: acc.y + ball.y + ball.radius,
        }),
        { x: 0, y: 0 }
    );

    return {
        x: totals.x / positions.value.length,
        y: totals.y / positions.value.length,
    };
});

const syncBallPositions = () => {
    if (ballBodies.length === 0) {
        return;
    }

    positions.value = ballBodies.map((body) => ({
        x: body.position.x - body.circleRadius,
        y: body.position.y - body.circleRadius,
        radius: body.circleRadius,
    }));
};

const updatesmoothBlobCenter = () => {
    if (!blobCenter.value) {
        smoothBlobCenter.value = null;
        return;
    }

    if (!smoothBlobCenter.value) {
        smoothBlobCenter.value = {
            x: blobCenter.value.x,
            y: blobCenter.value.y,
        };
        return;
    }

    const dx = blobCenter.value.x - smoothBlobCenter.value.x;
    const dy = blobCenter.value.y - smoothBlobCenter.value.y;
    const distance = Math.hypot(dx, dy);
    const blend = Math.min(1, distance / 100);
    const lerp = CENTER_LERP_MIN + (CENTER_LERP_MAX - CENTER_LERP_MIN) * blend;

    smoothBlobCenter.value = {
        x: smoothBlobCenter.value.x + dx * lerp,
        y: smoothBlobCenter.value.y + dy * lerp,
    };
};

const faceStyle = computed(() => {
    if (!smoothBlobCenter.value) {
        return {
            left: "-9999px",
            top: "-9999px",
        };
    }

    return {
        left: `${smoothBlobCenter.value.x}px`,
        top: `${smoothBlobCenter.value.y}px`,
    };
});

const clampBallVelocities = () => {
    if (ballBodies.length === 0) {
        return;
    }

    const maxSpeedSq = MAX_BALL_SPEED * MAX_BALL_SPEED;

    ballBodies.forEach((body) => {
        if (body.isStatic) {
            return;
        }

        const speedSq = body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y;
        if (speedSq <= maxSpeedSq) {
            return;
        }

        const speed = Math.sqrt(speedSq);
        const scale = MAX_BALL_SPEED / speed;
        Body.setVelocity(body, {
            x: body.velocity.x * scale,
            y: body.velocity.y * scale,
        });
    });
};

const updateHoverBallScale = () => {
    if (ballBodies.length === 0) {
        return;
    }

    if (ballScaleFactors.length !== ballBodies.length) {
        ballScaleFactors = ballBodies.map(() => 1);
    }

    const hoverActive = cursorInsideBlob && !grabbing.value;
    let closestIndex = -1;

    if (hoverActive) {
        let minDistanceSq = Number.POSITIVE_INFINITY;
        for (let i = 0; i < ballBodies.length; i += 1) {
            const body = ballBodies[i];
            const dx = body.position.x - mousePosition.x;
            const dy = body.position.y - mousePosition.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                closestIndex = i;
            }
        }
    }

    for (let i = 0; i < ballBodies.length; i += 1) {
        const body = ballBodies[i];
        const currentScale = ballScaleFactors[i] || 1;
        const targetScale = hoverActive && i === closestIndex ? PETTING_SCALE : 1;
        const nextScale = currentScale + (targetScale - currentScale) * PETTING_LERP;

        if (Math.abs(nextScale - currentScale) < 0.0001) {
            continue;
        }

        const scaleRatio = nextScale / currentScale;
        Body.scale(body, scaleRatio, scaleRatio);
        ballScaleFactors[i] = nextScale;
    }
};

const toDegrees = (radians) => (radians * 180) / Math.PI;

const getOutlineInteriorAngle = (prev, curr, next) => {
    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const mag1 = Math.hypot(v1x, v1y);
    const mag2 = Math.hypot(v2x, v2y);
    if (mag1 <= 0.0001 || mag2 <= 0.0001) {
        return 180;
    }

    const dot = v1x * v2x + v1y * v2y;
    const cosTheta = Math.min(1, Math.max(-1, dot / (mag1 * mag2)));
    return toDegrees(Math.acos(cosTheta));
};

const isBodyTouchingWall = (body) => {
    const { width, height } = getViewportBounds();
    const radius = body.circleRadius;
    const minX = radius;
    const maxX = width - radius;
    const minY = radius;
    const maxY = height - radius;

    return (
        body.position.x <= minX ||
        body.position.x >= maxX ||
        body.position.y <= minY ||
        body.position.y >= maxY
    );
};

const isAnyBallTouchingWall = () => {
    if (ballBodies.length === 0) {
        return false;
    }

    return ballBodies.some((body) => isBodyTouchingWall(body));
};

const checkConvexAngle = () => {
    if (!grabbing.value || !activeBody || outlinePoints.value.length < 3) {
        return;
    }

    if (!isAnyBallTouchingWall()) {
        return;
    }

    const points = outlinePoints.value;
    const count = points.length;

    for (let i = 0; i < count; i += 1) {
        const prev = points[(i - 1 + count) % count];
        const curr = points[i];
        const next = points[(i + 1) % count];
        const interiorAngle = getOutlineInteriorAngle(prev, curr, next);

        if (interiorAngle < CONVEX_ANGLE) {
            stopDrag();
            return;
        }
    }
};

const separateOverlappingBalls = () => {
    if (ballBodies.length < 2) {
        return;
    }

    for (let pass = 0; pass < OVERLAP_PASSES; pass += 1) {
        for (let i = 0; i < ballBodies.length; i += 1) {
            for (let j = i + 1; j < ballBodies.length; j += 1) {
                const bodyA = ballBodies[i];
                const bodyB = ballBodies[j];
                const dx = bodyB.position.x - bodyA.position.x;
                const dy = bodyB.position.y - bodyA.position.y;
                const minDistance = bodyA.circleRadius + bodyB.circleRadius;
                const distance = Math.hypot(dx, dy);

                if (distance >= minDistance) {
                    continue;
                }

                const nx = distance > 0.0001 ? dx / distance : 1;
                const ny = distance > 0.0001 ? dy / distance : 0;
                const overlap = minDistance - Math.max(distance, 0.0001);
                const shiftX = nx * (overlap / 2);
                const shiftY = ny * (overlap / 2);

                if (!bodyA.isStatic) {
                    Body.setPosition(bodyA, {
                        x: bodyA.position.x - shiftX,
                        y: bodyA.position.y - shiftY,
                    });
                }

                if (!bodyB.isStatic) {
                    Body.setPosition(bodyB, {
                        x: bodyB.position.x + shiftX,
                        y: bodyB.position.y + shiftY,
                    });
                }
            }
        }
    }
};

const createBallBodies = (centerX, centerY) => {
    const spread = Math.max(...BALL_RADII) * 18;
    const bodies = [];

    for (let i = 0; i < BALL_COUNT; i += 1) {
        const angle = (i / BALL_COUNT) * Math.PI * 2;
        const radius = BALL_RADII[i];
        bodies.push(
            Bodies.circle(centerX + Math.cos(angle) * spread, centerY + Math.sin(angle) * spread, radius, {
                restitution: 0.8,
                friction: 0.1,
                frictionAir: 0.01,
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
                stiffness: 1,
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

const rebuildWalls = (bounds = getViewportBounds()) => {
    if (!engine) {
        return;
    }

    if (walls.length > 0) {
        World.remove(engine.world, walls);
    }

    const { width, height } = bounds;
    walls = createWalls(width, height);
    World.add(engine.world, walls);
};

const updateDragPosition = (event) => {
    if (!activeBody) {
        return;
    }

    const { width, height } = getViewportBounds();
    const radius = activeBody.circleRadius;
    const x = Math.min(Math.max(event.clientX, radius), width - radius);
    const y = Math.min(Math.max(event.clientY, radius), height - radius);

    Body.setPosition(activeBody, { x, y });

    separateOverlappingBalls();
    syncBallPositions();
    checkConvexAngle();
};

const beginDrag = (event, body) => {
    if (event.button !== 0 || !body) {
        return;
    }

    activeBody = body;
    Body.setStatic(activeBody, true);
    grabbing.value = true;
    updateDragPosition(event);
};

const findClosestBall = (x, y) => {
    if (ballBodies.length === 0) {
        return null;
    }

    let closestBody = ballBodies[0];
    let minDistanceSq = Number.POSITIVE_INFINITY;

    ballBodies.forEach((body) => {
        const dx = body.position.x - x;
        const dy = body.position.y - y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq < minDistanceSq) {
            minDistanceSq = distanceSq;
            closestBody = body;
        }
    });

    return closestBody;
};

const startDrag = (event) => {
    const closestBody = findClosestBall(event.clientX, event.clientY);
    if (event.button !== 0 || !closestBody) {
        return;
    }
    activeBody = closestBody;
    Body.setStatic(activeBody, true);
    grabbing.value = true;
    updateDragPosition(event);
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

    Body.setStatic(activeBody, false);
    activeBody = null;
    grabbing.value = false;
};

const isPointInBlob = (blob, x, y, mode) => {
    if (!blob || !blob.ownerSVGElement) {
        return false;
    }

    const svg = blob.ownerSVGElement;
    const svgPoint = svg.createSVGPoint();
    svgPoint.x = x;
    svgPoint.y = y;

    const ctm = blob.getScreenCTM();
    if (!ctm) {
        return false;
    }

    const localPoint = svgPoint.matrixTransform(ctm.inverse());

    if (mode === "fill" && typeof blob.isPointInFill === "function") {
        return blob.isPointInFill(localPoint);
    }

    if (mode === "stroke" && typeof blob.isPointInStroke === "function") {
        return blob.isPointInStroke(localPoint);
    }

    return false;
};

const updateHoverState = () => {
    const x = mousePosition.x;
    const y = mousePosition.y;
    const insideBlobFill = isPointInBlob(blobArea.value, x, y, "fill");
    const insideBlobBand = isPointInBlob(blobEdge.value, x, y, "stroke");

    cursorInsideBlob = insideBlobFill || insideBlobBand;
    ipcRenderer.send("set-ignore-mouse-events", !cursorInsideBlob);
};

const onMouseMove = (event) => {
    mousePosition = { x: event.clientX, y: event.clientY };
    updateHoverState();

    if (grabbing.value) {
        onDrag(event);
    }
};

const onResize = () => {
    const nextBounds = getViewportBounds();
    const previousBounds = lastViewportBounds;
    lastViewportBounds = nextBounds;

    rebuildWalls(nextBounds);

    if (ballBodies.length > 0) {
        const previousCenter = getBallClusterCenter();
        if (previousCenter) {
            const xRatio = previousCenter.x / Math.max(1, previousBounds.width);
            const yRatio = previousCenter.y / Math.max(1, previousBounds.height);
            const targetCenter = {
                x: xRatio * nextBounds.width,
                y: yRatio * nextBounds.height,
            };

            const deltaX = targetCenter.x - previousCenter.x;
            const deltaY = targetCenter.y - previousCenter.y;

            ballBodies.forEach((body) => {
                Body.setPosition(body, {
                    x: body.position.x + deltaX,
                    y: body.position.y + deltaY,
                });
            });
        }

        const { width, height } = nextBounds;
        ballBodies.forEach((body) => {
            const radius = body.circleRadius;
            const x = Math.min(Math.max(body.position.x, radius), width - radius);
            const y = Math.min(Math.max(body.position.y, radius), height - radius);

            Body.setPosition(body, { x, y });
            Body.setVelocity(body, { x: 0, y: 0 });
        });

        separateOverlappingBalls();
        syncBallPositions();
        saveCompanionPosition();
    }
};

const onAvailableScreenSizeChange = () => {
    const nextSize = getAvailableScreenSize();
    if (nextSize.width === lastAvailableScreenSize.width && nextSize.height === lastAvailableScreenSize.height) {
        return;
    }

    lastAvailableScreenSize = nextSize;
    onResize();
};

const animate = () => {
    updateHoverBallScale();
    separateOverlappingBalls();
    clampBallVelocities();
    syncBallPositions();
    const now = Date.now();
    if (now - lastPositionPersistAt >= POSITION_PERSIST_INTERVAL_MS) {
        saveCompanionPosition();
        lastPositionPersistAt = now;
    }
    updatesmoothBlobCenter();
    checkConvexAngle();
    animationFrameId = window.requestAnimationFrame(animate);
};

onMounted(() => {
    engine = Engine.create({
        gravity: { x: 0, y: 0.8 },
    });

    const { width, height } = getViewportBounds();
    lastViewportBounds = { width, height };
    const savedCenter = getSavedCompanionCenter();
    const centerX = savedCenter?.x ?? width / 2;
    const centerY = savedCenter?.y ?? height / 2;
    ballBodies = createBallBodies(centerX, centerY);
    ballScaleFactors = ballBodies.map(() => 1);
    chainConstraints = createChainConstraints(ballBodies);
    positions.value = ballBodies.map((body) => ({
        x: body.position.x - body.circleRadius,
        y: body.position.y - body.circleRadius,
        radius: body.circleRadius,
    }));
    updatesmoothBlobCenter();

    walls = createWalls(width, height);
    World.add(engine.world, [...ballBodies, ...chainConstraints, ...walls]);

    runner = Runner.create();
    Runner.run(runner, engine);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDrag);
    window.addEventListener("resize", onResize);
    window.addEventListener("focus", onResize);
    window.addEventListener("pageshow", onResize);
    document.addEventListener("visibilitychange", onResize);
    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", onResize);
        window.visualViewport.addEventListener("scroll", onResize);
    }
    lastAvailableScreenSize = getAvailableScreenSize();
    availableSizePollId = window.setInterval(onAvailableScreenSizeChange, 300);
    saveCompanionPosition();

    animate();
});

onBeforeUnmount(() => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", stopDrag);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("focus", onResize);
    window.removeEventListener("pageshow", onResize);
    document.removeEventListener("visibilitychange", onResize);
    if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", onResize);
        window.visualViewport.removeEventListener("scroll", onResize);
    }

    if (availableSizePollId) {
        window.clearInterval(availableSizePollId);
        availableSizePollId = undefined;
    }

    saveCompanionPosition();

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
    cursorInsideBlob = false;
    mousePosition = { x: 0, y: 0 };
    ballScaleFactors = [];
    ballBodies = [];
    chainConstraints = [];
    positions.value = [];
    smoothBlobCenter.value = null;
});
</script>

<template>
    <div class="root" :style="hueVariables">
        <svg class="blob-hit-overlay" aria-hidden="true">
            <path ref="blobArea" class="blob-area" :class="{ grabbing, dev }" :d="blobPath" @mousedown="startDrag" />
            <path ref="blobEdge" class="blob-edge" :class="{ dev }" :d="blobPath"
                :style="{ strokeWidth: `${EDGE_WIDTH}px` }" @mousedown="startDrag" />
        </svg>

        <div v-if="!dev" class="face" aria-hidden="true" :style="faceStyle">
            <img class="face-eyes" :src="eyesDefaultImage" alt="" />
            <img class="face-mouth" :src="mouthDefaultImage" alt="" />
        </div>

        <svg v-if="dev" class="overlay" aria-hidden="true">

            <circle v-for="(point, index) in outlinePoints" :key="`outline-point-${index}`" class="outline-point"
                :cx="point.x" :cy="point.y" r="3.5" />

            <line v-for="(ballPosition, index) in positions" :key="`chain-${index}`"
                :x1="ballPosition.x + ballPosition.radius" :y1="ballPosition.y + ballPosition.radius"
                :x2="positions[(index + 1) % positions.length]?.x + positions[(index + 1) % positions.length]?.radius"
                :y2="positions[(index + 1) % positions.length]?.y + positions[(index + 1) % positions.length]?.radius" />
        </svg>

        <div v-if="dev" v-for="(ballPosition, index) in positions" :key="index" class="ball" :style="{
                left: `${ballPosition.x}px`,
                top: `${ballPosition.y}px`,
                width: `${ballPosition.radius * 2}px`,
                height: `${ballPosition.radius * 2}px`
            }" />
    </div>
</template>

<style scoped>
.root {
    position: fixed;
    inset: 0;
}

.blob-hit-overlay {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.blob-area {
    cursor: grab;
    fill: var(--primary);
    stroke: none;
    pointer-events: all;
}

.blob-edge {
    cursor: grab;
    fill: none;
    stroke: none;
    pointer-events: stroke;
}

.blob-area.grabbing {
    cursor: grabbing;
}

.face {
    position: fixed;
    transform: translate(-50%, -100%);
    pointer-events: none;
    z-index: 2;
}

.face-eyes,
.face-mouth {
    position: absolute;
    left: 50%;
    display: block;
    height: auto;
    transform: translateX(-50%);
}

.face-eyes {
    width: 3.5rem;
    bottom: 1.2rem;
}

.face-mouth {
    width: 2.8rem;
    bottom: -0.5rem;
}

/* dev */

.overlay {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.overlay line {
    stroke: var(--text);
    stroke-width: 1;
    stroke-linecap: round;
}

.outline-point {
    stroke: var(--text);
    stroke-width: 1;
    fill: var(--text-strong);
}

.ball {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, var(--white) 0%, var(--primary) 50%, var(--darker) 100%);
    pointer-events: none;
}

.blob-area.dev {
    fill: var(--white);
    stroke: none;
}

.blob-edge.dev {
    stroke: var(--shadow);
}
</style>