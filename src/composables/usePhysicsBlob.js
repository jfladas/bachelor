import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Engine, Runner, World, Bodies, Body, Constraint } from "matter-js";

const CHAIN_GAP = 0;
const WALL_THICKNESS = 500;
const OUTLINE_PADDING = 10;
const OVERLAP_PASSES = 3;
const MAX_BALL_SPEED = 50;
const CONVEX_ANGLE = 60;
const PETTING_SCALE = 0.7;
const PETTING_LERP = 0.03;
const CENTER_LERP_MIN = 0.1;
const CENTER_LERP_MAX = 0.7;
const COMPANION_STATES = {
    IDLE: "idle",
    ENGAGED: "engaged",
    ACTIVE: "active",
    SLEEPING: "sleeping",
};
const BASE_NUDGE_INTERVAL_MS = 1500;
const BASE_NUDGE_VELOCITY = 0.5;
const POSITION_STORAGE_KEY = "desktop-companion:blob-center";
const PERSIST_INTERVAL_MS = 500;

const randomBetween = (min, max) => min + Math.random() * (max - min);
const lerp = (start, end, t) => start + (end - start) * t;
const toDegrees = (radians) => (radians * 180) / Math.PI;

export const usePhysicsBlob = ({ ballRadii, activity, ipcRenderer }) => {
    const positions = ref([]);
    const grabbing = ref(false);
    const blobArea = ref(null);
    const blobEdge = ref(null);
    const smoothBlobCenter = ref(null);
    const companionState = ref(COMPANION_STATES.IDLE);

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
    let lastPersist = 0;
    let nextIdleNudgeAt = 0;

    const setBlobAreaRef = (element) => {
        blobArea.value = element;
    };

    const setBlobEdgeRef = (element) => {
        blobEdge.value = element;
    };

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

            const p1Radius = positions.value[i % positions.value.length]?.radius ?? 1;
            const p2Radius = positions.value[(i + 1) % positions.value.length]?.radius ?? 1;
            const avgRadius = (p1Radius + p2Radius) / 2;
            const smoothFactor = 0.25 * Math.max(0.8, Math.min(1.2, avgRadius / 20));

            const c1x = p1.x + (p2.x - p0.x) * smoothFactor;
            const c1y = p1.y + (p2.y - p0.y) * smoothFactor;
            const c2x = p2.x - (p3.x - p1.x) * smoothFactor;
            const c2y = p2.y - (p3.y - p1.y) * smoothFactor;

            path += ` C ${toCoord(c1x)} ${toCoord(c1y)}, ${toCoord(c2x)} ${toCoord(c2y)}, ${toCoord(p2.x)} ${toCoord(
                p2.y
            )}`;
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

    const updateSmoothBlobCenter = () => {
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
        const smoothFactor = CENTER_LERP_MIN + (CENTER_LERP_MAX - CENTER_LERP_MIN) * blend;

        smoothBlobCenter.value = {
            x: smoothBlobCenter.value.x + dx * smoothFactor,
            y: smoothBlobCenter.value.y + dy * smoothFactor,
        };
    };

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

        return body.position.x <= minX || body.position.x >= maxX || body.position.y <= minY || body.position.y >= maxY;
    };

    const isAnyBallTouchingWall = () => {
        if (ballBodies.length === 0) {
            return false;
        }

        return ballBodies.some((body) => isBodyTouchingWall(body));
    };

    const stopDrag = () => {
        if (!grabbing.value) {
            return;
        }

        Body.setStatic(activeBody, false);
        activeBody = null;
        grabbing.value = false;
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
        const radii = ballRadii.value;
        const spread = Math.max(...radii) * 18;
        const bodies = [];

        for (let i = 0; i < radii.length; i += 1) {
            const angle = (i / radii.length) * Math.PI * 2;
            const radius = radii[i];
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

    const getCompanionState = () => {
        if (grabbing.value || cursorInsideBlob) {
            return COMPANION_STATES.ENGAGED;
        }

        return COMPANION_STATES.IDLE;
    };

    const scheduleNextNudge = (now = Date.now()) => {
        const activityLevel = activity.value;
        const minDelay = lerp(BASE_NUDGE_INTERVAL_MS * 2, BASE_NUDGE_INTERVAL_MS, activityLevel);
        const maxDelay = lerp(BASE_NUDGE_INTERVAL_MS * 4, BASE_NUDGE_INTERVAL_MS * 2, activityLevel);
        const delayMs = randomBetween(minDelay, maxDelay);
        nextIdleNudgeAt = now + delayMs;
    };

    const setCompanionState = (nextState, now = Date.now()) => {
        if (companionState.value === nextState) {
            return;
        }

        companionState.value = nextState;
        if (nextState === COMPANION_STATES.IDLE) {
            scheduleNextNudge(now);
            return;
        }

        nextIdleNudgeAt = 0;
    };

    const syncCompanionState = (now = Date.now()) => {
        const derivedState = getCompanionState();
        setCompanionState(derivedState, now);
    };

    const applyIdleMovement = (now = Date.now()) => {
        if (companionState.value !== COMPANION_STATES.IDLE || ballBodies.length === 0) {
            return;
        }

        if (!nextIdleNudgeAt) {
            scheduleNextNudge(now);
            return;
        }

        if (now < nextIdleNudgeAt) {
            return;
        }

        const activityLevel = activity.value;
        const direction = Math.random() < 0.5 ? -1 : 1;
        const minVelocity = lerp(BASE_NUDGE_VELOCITY, BASE_NUDGE_VELOCITY * 2, activityLevel);
        const maxVelocity = lerp(BASE_NUDGE_VELOCITY * 2, BASE_NUDGE_VELOCITY * 4, activityLevel);
        const velocityBoost = randomBetween(minVelocity, maxVelocity) * direction;

        ballBodies.forEach((body) => {
            if (body.isStatic) {
                return;
            }

            Body.setVelocity(body, {
                x: body.velocity.x + velocityBoost,
                y: body.velocity.y,
            });
        });

        scheduleNextNudge(now);
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

    const sendIgnoreMouseEvents = (ignoreMouseEvents) => {
        ipcRenderer?.send?.("set-ignore-mouse-events", ignoreMouseEvents);
    };

    const updateHoverState = () => {
        const x = mousePosition.x;
        const y = mousePosition.y;
        const insideBlobFill = isPointInBlob(blobArea.value, x, y, "fill");
        const insideBlobBand = isPointInBlob(blobEdge.value, x, y, "stroke");

        cursorInsideBlob = insideBlobFill || insideBlobBand;
        syncCompanionState();
        sendIgnoreMouseEvents(!cursorInsideBlob);
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
        const now = Date.now();
        syncCompanionState(now);
        applyIdleMovement(now);
        updateHoverBallScale();
        separateOverlappingBalls();
        clampBallVelocities();
        syncBallPositions();
        if (now - lastPersist >= PERSIST_INTERVAL_MS) {
            saveCompanionPosition();
            lastPersist = now;
        }
        updateSmoothBlobCenter();
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
        updateSmoothBlobCenter();

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
        syncCompanionState();
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

    return {
        positions,
        grabbing,
        outlinePoints,
        blobPath,
        faceStyle,
        setBlobAreaRef,
        setBlobEdgeRef,
        startDrag,
    };
};