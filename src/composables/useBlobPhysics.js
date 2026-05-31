import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useBlobState, STATES } from "./useBlobState";
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
const BASE_NUDGE_INTERVAL_MS = 1500;
const BASE_NUDGE_VELOCITY = 0.5;
const IDLE_NUDGE_BLEND = 0.8;
const SLEEP_UPDATE_INTERVAL_MS = 33;
const SLEEP_TIME_SCALE = 0.2;
const PERSIST_INTERVAL_MS = 500;
const PIN_HOLD_DELAY_MS = 500;
const PIN_PROGRESS_DURATION_MS = 500;

const randomBetween = (min, max) => min + Math.random() * (max - min);
const lerp = (start, end, t) => start + (end - start) * t;
const toDegrees = (radians) => (radians * 180) / Math.PI;

import * as ipc from '../utils/ipc'
import * as storage from '../utils/storage'

export const useBlobPhysics = ({ ballRadii, blobScale, activity }) => {
    const positions = ref([]);
    const grabbing = ref(false);
    const pinProgress = ref(0);
    const pinAnchor = ref(null);
    const isPinned = ref(false);
    const blobArea = ref(null);
    const blobEdge = ref(null);
    const blobState = useBlobState();
    const smoothBlobCenter = ref(null);
    const state = blobState.state;
    let isSleeping = false;

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
    let activeIdleNudge = null;
    let lastDragMoveAt = 0;
    let interactionLocked = false;
    let lastSleepUpdateAt = 0;
    let pinnedBody = null;
    let pinHoldTimeoutId = null;
    let pinHoldStartedAt = 0;
    let pinHoldBody = null;
    let pinHoldPosition = null;
    let blobSizeScale = Math.max(0.5, Number(blobScale?.value) || 1);

    const normalizeBlobScale = (value) => Math.max(0.5, Number(value) || 1);

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

    const savePosition = () => {
        const center = getBallClusterCenter();
        if (!center) return;
        try { storage.writePosition(center); } catch { }
    };

    const getBodyIndex = (body) => ballBodies.indexOf(body);

    const clearPinHoldTimeout = () => {
        if (pinHoldTimeoutId) {
            window.clearTimeout(pinHoldTimeoutId);
            pinHoldTimeoutId = null;
        }

        pinHoldStartedAt = 0;
        pinHoldBody = null;
        pinHoldPosition = null;

        if (!pinnedBody) {
            pinProgress.value = 0;
            pinAnchor.value = null;
        }
    };

    const clearPinnedBody = () => {
        if (!pinnedBody) {
            return;
        }

        Body.setStatic(pinnedBody, false);
        pinnedBody = null;
        isPinned.value = false;
        pinProgress.value = 0;
        pinAnchor.value = null;
    };

    const beginPinHold = () => {
        if (!grabbing.value || !activeBody) {
            return;
        }

        if (activeBody === pinnedBody) {
            isPinned.value = true;
            pinAnchor.value = {
                x: activeBody.position.x,
                y: activeBody.position.y,
                radius: activeBody.circleRadius,
            };
            pinProgress.value = 1;
            return;
        }

        const nextPosition = {
            x: Math.round(activeBody.position.x),
            y: Math.round(activeBody.position.y),
        };

        if (pinHoldBody === activeBody) {
            const movedDistance = pinHoldPosition
                ? Math.hypot(nextPosition.x - pinHoldPosition.x, nextPosition.y - pinHoldPosition.y)
                : 0;

            if (pinHoldStartedAt > 0) {
                if (movedDistance <= 4) {
                    return;
                }

                clearPinHoldTimeout();
            } else if (pinHoldTimeoutId && movedDistance <= 4) {
                return;
            } else if (pinHoldTimeoutId) {
                clearPinHoldTimeout();
            }
        }

        if (pinHoldStartedAt > 0 && pinHoldBody === activeBody) {
            return;
        }

        clearPinHoldTimeout();

        pinHoldBody = activeBody;
        pinHoldPosition = nextPosition;
        pinHoldTimeoutId = window.setTimeout(() => {
            pinHoldTimeoutId = null;

            if (!grabbing.value || activeBody !== pinHoldBody || pinnedBody) {
                return;
            }

            pinHoldStartedAt = Date.now();
            pinProgress.value = 0;
            pinAnchor.value = {
                x: pinHoldBody.position.x,
                y: pinHoldBody.position.y,
                radius: pinHoldBody.circleRadius,
            };
        }, PIN_HOLD_DELAY_MS);
    };

    const pinActiveBody = () => {
        if (!activeBody || pinnedBody === activeBody) {
            return;
        }

        pinnedBody = activeBody;
        Body.setStatic(pinnedBody, true);
        Body.setVelocity(pinnedBody, { x: 0, y: 0 });
        Body.setAngularVelocity(pinnedBody, 0);
        isPinned.value = true;
        pinProgress.value = 1;
        pinAnchor.value = {
            x: pinnedBody.position.x,
            y: pinnedBody.position.y,
            radius: pinnedBody.circleRadius,
        };
        pinHoldStartedAt = 0;
        pinHoldBody = null;
    };

    const getSavedCenter = () => {
        try {
            return storage.readPosition();
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
            const scale = Math.max(0.5, blobSizeScale || 1);
            const normalizedRadius = avgRadius / scale;
            const smoothFactor = 0.25 * Math.max(0.8, Math.min(1.2, normalizedRadius / 20));

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

        clearPinHoldTimeout();

        if (activeBody) {
            if (activeBody !== pinnedBody) {
                Body.setStatic(activeBody, false);
            }
        }
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
            const radius = radii[i] * blobSizeScale;
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

    const applyBlobSizeScale = (nextScaleValue) => {
        const nextScale = normalizeBlobScale(nextScaleValue);
        if (Math.abs(nextScale - blobSizeScale) < 0.0001) {
            return;
        }

        const ratio = nextScale / blobSizeScale;
        blobSizeScale = nextScale;

        if (ballBodies.length === 0) {
            return;
        }

        ballBodies.forEach((body) => {
            Body.scale(body, ratio, ratio);
        });

        chainConstraints.forEach((constraint) => {
            constraint.length *= ratio;
        });

        const { width, height } = getViewportBounds();
        ballBodies.forEach((body) => {
            const radius = body.circleRadius;
            const x = Math.min(Math.max(body.position.x, radius), width - radius);
            const y = Math.min(Math.max(body.position.y, radius), height - radius);
            Body.setPosition(body, { x, y });
        });

        separateOverlappingBalls();
        syncBallPositions();
        updateSmoothBlobCenter();
        savePosition();
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

    const scheduleNextNudge = (now = Date.now()) => {
        const activityLevel = activity.value;
        const minDelay = lerp(BASE_NUDGE_INTERVAL_MS * 2, BASE_NUDGE_INTERVAL_MS, activityLevel);
        const maxDelay = lerp(BASE_NUDGE_INTERVAL_MS * 4, BASE_NUDGE_INTERVAL_MS * 2, activityLevel);
        const delayMs = randomBetween(minDelay, maxDelay);
        nextIdleNudgeAt = now + delayMs;
    };

    const startIdleNudge = (now = Date.now()) => {
        const activityLevel = activity.value;
        const minVelocity = lerp(BASE_NUDGE_VELOCITY, BASE_NUDGE_VELOCITY * 3, activityLevel);
        const maxVelocity = lerp(BASE_NUDGE_VELOCITY * 2, BASE_NUDGE_VELOCITY * 5, activityLevel);

        activeIdleNudge = {
            startedAt: now,
            endsAt: now + 500,
            direction: getIdleNudgeDirection(),
            strength: randomBetween(minVelocity, maxVelocity),
        };

        scheduleNextNudge(now);
    };

    const getIdleNudgeDirection = () => {
        const center = getBallClusterCenter();
        if (!center) {
            return Math.random() < 0.5 ? -1 : 1;
        }

        const { width } = getViewportBounds();
        const xRatio = center.x / Math.max(1, width);

        if (xRatio <= 0.8) {
            return Math.random() < 0.8 ? 1 : -1;
        }

        if (xRatio >= 0.2) {
            return Math.random() < 0.8 ? -1 : 1;
        }

        return Math.random() < 0.5 ? -1 : 1;
    };

    const didDragRecently = (windowMs = 180) => {
        if (!lastDragMoveAt) {
            return false;
        }

        return Date.now() - lastDragMoveAt <= windowMs;
    };

    const jump = () => {
        if (ballBodies.length === 0) {
            return;
        }

        ballBodies.forEach((body) => {
            if (body.isStatic) {
                return;
            }

            Body.setVelocity(body, {
                x: body.velocity.x + randomBetween(-1.25, 1.25),
                y: body.velocity.y - randomBetween(1.4, 2.6),
            });
        });
    };

    const updateState = (now = Date.now()) => {
        const prev = blobState.getState();
        if (prev === STATES.ACTIVE || prev === STATES.SLEEPING) {
            return;
        }

        const next = grabbing.value || cursorInsideBlob ? STATES.ENGAGED : STATES.IDLE;
        if (prev === next) return;
        blobState.setState(next);
        if (next === STATES.IDLE) {
            scheduleNextNudge(now);
        } else {
            nextIdleNudgeAt = 0;
        }
    };

    const applyIdleMovement = (now = Date.now()) => {
        if (blobState.getState() !== STATES.IDLE || ballBodies.length === 0) {
            activeIdleNudge = null;
            return;
        }

        if (!nextIdleNudgeAt) {
            scheduleNextNudge(now);
            return;
        }

        if (didDragRecently()) {
            return;
        }

        if (!activeIdleNudge && now >= nextIdleNudgeAt) {
            startIdleNudge(now);
        }

        if (!activeIdleNudge) {
            return;
        }

        const duration = Math.max(1, activeIdleNudge.endsAt - activeIdleNudge.startedAt);
        const progress = Math.max(0, Math.min(1, (now - activeIdleNudge.startedAt) / duration));
        const easing = Math.sin(progress * Math.PI);
        const velocityBoost = activeIdleNudge.direction * activeIdleNudge.strength * 0.05 * easing;

        ballBodies.forEach((body) => {
            if (body.isStatic) {
                return;
            }

            Body.setVelocity(body, {
                x: body.velocity.x + velocityBoost,
                y: body.velocity.y,
            });
        });

        if (progress >= 1) {
            activeIdleNudge = null;
        }
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
        beginPinHold();
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

        if (pinnedBody) {
            clearPinnedBody();
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

        lastDragMoveAt = Date.now();
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
        // best-effort fire-and-forget
        try {
            ipc.send('set-ignore-mouse-events', ignoreMouseEvents);
        } catch { }
    };

    const updateHoverState = () => {
        const x = mousePosition.x;
        const y = mousePosition.y;
        const insideBlobFill = isPointInBlob(blobArea.value, x, y, "fill");
        const insideBlobBand = isPointInBlob(blobEdge.value, x, y, "stroke");

        cursorInsideBlob = insideBlobFill || insideBlobBand;
        updateState();

        const shouldIgnoreMouseEvents = interactionLocked ? false : grabbing.value ? false : !cursorInsideBlob;
        sendIgnoreMouseEvents(shouldIgnoreMouseEvents);
    };

    const setInteractionLocked = (locked) => {
        interactionLocked = Boolean(locked);

        if (interactionLocked) {
            sendIgnoreMouseEvents(false);
            return;
        }

        updateHoverState();
    };

    const onMouseMove = (event) => {
        if (blobState.getState() === STATES.SLEEPING) {
            return;
        }

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
            savePosition();
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
        const sleeping = blobState.getState() === STATES.SLEEPING;

        if (sleeping && now - lastSleepUpdateAt < SLEEP_UPDATE_INTERVAL_MS) {
            animationFrameId = window.requestAnimationFrame(animate);
            return;
        }

        if (sleeping) {
            lastSleepUpdateAt = now;
        }

        updateState(now);
        applyIdleMovement(now);
        updateHoverBallScale();
        if (grabbing.value && pinHoldStartedAt > 0 && !pinnedBody) {
            const elapsedMs = now - pinHoldStartedAt;
            const progress = Math.max(0, Math.min(1, elapsedMs / PIN_PROGRESS_DURATION_MS));
            pinProgress.value = progress;

            if (progress >= 1) {
                pinActiveBody();
            }
        }
        separateOverlappingBalls();
        clampBallVelocities();
        syncBallPositions();
        if (now - lastPersist >= PERSIST_INTERVAL_MS) {
            savePosition();
            lastPersist = now;
        }
        updateSmoothBlobCenter();
        checkConvexAngle();
        animationFrameId = window.requestAnimationFrame(animate);
    };

    onMounted(() => {
        blobSizeScale = normalizeBlobScale(blobScale?.value);

        engine = Engine.create({
            gravity: { x: 0, y: 0.8 },
        });

        watch(
            () => blobScale?.value,
            (nextScale) => {
                applyBlobSizeScale(nextScale);
            }
        );

        watch(
            state,
            (next) => {
                if (!engine) {
                    return;
                }

                const sleeping = next === STATES.SLEEPING;
                if (sleeping === isSleeping) {
                    return;
                }

                isSleeping = sleeping;
                engine.timing.timeScale = sleeping ? SLEEP_TIME_SCALE : 1;
                lastSleepUpdateAt = 0;

                if (!sleeping) {
                    updateState();
                }
            },
            { immediate: true }
        );

        const { width, height } = getViewportBounds();
        lastViewportBounds = { width, height };
        const savedCenter = getSavedCenter();
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
        updateState();
        savePosition();
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

        savePosition();

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
        lastDragMoveAt = 0;
        interactionLocked = false;
        clearPinHoldTimeout();
        clearPinnedBody();
        ballScaleFactors = [];
        ballBodies = [];
        chainConstraints = [];
        positions.value = [];
        smoothBlobCenter.value = null;
    });

    return {
        positions,
        grabbing,
        state,
        outlinePoints,
        blobPath,
        faceStyle,
        setBlobAreaRef,
        setBlobEdgeRef,
        startDrag,
        didDragRecently,
        setInteractionLocked,
        jump,
        pinProgress,
        pinAnchor,
        isPinned,
    };
};